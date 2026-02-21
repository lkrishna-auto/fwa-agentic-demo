/**
 * Readmission Review - Rule Engine
 *
 * Deterministic rules that evaluate readmission pairs.
 * Each rule is a pure function: (ReadmissionPair) => ReadmissionFinding | null
 */

import {
    ReadmissionPair,
    ReadmissionFinding,
    ReadmissionFindingCategory,
} from '../src/types';

export interface ReadmissionRule {
    id: string;
    name: string;
    category: ReadmissionFindingCategory;
    check: (pair: ReadmissionPair) => ReadmissionFinding | null;
}

// -- Helper utilities --------------------------------------------------------

function indexNotes(pair: ReadmissionPair): string {
    return pair.indexClinicalNotes.toLowerCase();
}

function readmitNotes(pair: ReadmissionPair): string {
    return pair.readmitClinicalNotes.toLowerCase();
}

function samePrincipalDxCategory(pair: ReadmissionPair): boolean {
    const idx = pair.indexPrimaryDiagnosis.code.substring(0, 3);
    const rdm = pair.readmitPrimaryDiagnosis.code.substring(0, 3);
    return idx === rdm;
}

function sharedDiagnosisCodes(pair: ReadmissionPair): string[] {
    const indexCodes = new Set([
        pair.indexPrimaryDiagnosis.code,
        ...pair.indexSecondaryDiagnoses.map((d) => d.code),
    ]);
    const readmitCodes = [
        pair.readmitPrimaryDiagnosis.code,
        ...pair.readmitSecondaryDiagnoses.map((d) => d.code),
    ];
    return readmitCodes.filter((c) => indexCodes.has(c));
}

// -- Clinical Relatedness Rules ----------------------------------------------

const SAME_PRINCIPAL_DIAGNOSIS: ReadmissionRule = {
    id: 'RULE-RA-CR-001',
    name: 'Same Principal Diagnosis',
    category: 'CLINICAL_RELATEDNESS',
    check: (pair) => {
        if (!samePrincipalDxCategory(pair)) return null;
        if (pair.isPlannedReadmission) return null;

        return {
            ruleId: 'RULE-RA-CR-001',
            category: 'CLINICAL_RELATEDNESS',
            severity: 'High',
            description: `Readmission has the same principal diagnosis category as the index admission (${pair.indexPrimaryDiagnosis.code} -> ${pair.readmitPrimaryDiagnosis.code}: ${pair.readmitPrimaryDiagnosis.description}). This strongly suggests the readmission is clinically related to the index stay and may represent incomplete treatment or disease recurrence.`,
            recommendation:
                'Review index discharge to assess whether treatment was adequate. Evaluate if the readmission could have been prevented with more aggressive treatment, closer follow-up, or extended index stay.',
            financialImpact: -(pair.readmitBilledAmount),
        };
    },
};

const COMPLICATION_OF_INDEX_TREATMENT: ReadmissionRule = {
    id: 'RULE-RA-CR-002',
    name: 'Complication of Index Treatment',
    category: 'CLINICAL_RELATEDNESS',
    check: (pair) => {
        const rn = readmitNotes(pair);
        const isComplication =
            rn.includes('complication') ||
            rn.includes('post-surgical') ||
            rn.includes('postoperative') ||
            rn.includes('surgical site infection') ||
            rn.includes('post-procedural') ||
            rn.includes('adverse drug event') ||
            rn.includes('digoxin toxicity') ||
            rn.includes('medication-related');

        // Also check for complication ICD codes (T-codes)
        const hasTCode = pair.readmitSecondaryDiagnoses.some(
            (d) => d.code.startsWith('T8') || d.code.startsWith('T84')
        );

        if (isComplication || hasTCode) {
            return {
                ruleId: 'RULE-RA-CR-002',
                category: 'CLINICAL_RELATEDNESS',
                severity: 'Critical',
                description:
                    'Readmission appears to be a direct complication of treatment provided during the index admission. Complication/adverse event codes and/or clinical documentation support a treatment-related readmission. This is clinically related and potentially preventable.',
                recommendation:
                    'Refer to quality committee for root cause analysis. Evaluate index treatment protocols, surgical technique, medication management, and post-discharge monitoring. Consider whether the readmission should be bundled with the index stay for payment purposes.',
                financialImpact: -(pair.readmitBilledAmount),
            };
        }

        return null;
    },
};

const PROGRESSION_OF_DISEASE: ReadmissionRule = {
    id: 'RULE-RA-CR-003',
    name: 'Disease Progression from Index Condition',
    category: 'CLINICAL_RELATEDNESS',
    check: (pair) => {
        const rn = readmitNotes(pair);
        const progression =
            rn.includes('progressed') ||
            rn.includes('progression') ||
            rn.includes('worsening') ||
            rn.includes('escalation') ||
            rn.includes('same organism') ||
            rn.includes('same condition') ||
            rn.includes('incompletely treated') ||
            rn.includes('incomplete treatment');

        // Check if readmission diagnosis is in same ICD chapter or a known complication
        const shared = sharedDiagnosisCodes(pair);

        if (progression && shared.length > 0) {
            return {
                ruleId: 'RULE-RA-CR-003',
                category: 'CLINICAL_RELATEDNESS',
                severity: 'High',
                description: `Readmission represents progression or recurrence of the index condition. Shared diagnosis codes: ${shared.join(', ')}. Clinical notes indicate the index condition was not fully resolved at discharge.`,
                recommendation:
                    'Review whether the index treatment course was adequate. Evaluate if the index length of stay was sufficient for clinical stabilization. Document root cause for quality reporting.',
                financialImpact: -(pair.readmitBilledAmount * 0.7),
            };
        }

        return null;
    },
};

// -- Discharge Adequacy Rules ------------------------------------------------

const PREMATURE_DISCHARGE: ReadmissionRule = {
    id: 'RULE-RA-DA-001',
    name: 'Premature Discharge Pattern',
    category: 'DISCHARGE_ADEQUACY',
    check: (pair) => {
        if (pair.isPlannedReadmission) return null;

        // Very short index stay + rapid readmission with same/worse condition
        const shortStay = pair.indexLengthOfStay <= 2;
        const rapidReadmit = pair.daysBetween <= 3;
        const sameDx = samePrincipalDxCategory(pair);
        const rn = readmitNotes(pair);
        const prematureIndicators =
            rn.includes('premature discharge') ||
            rn.includes('inadequate') ||
            rn.includes('identical') ||
            rn.includes('same presentation') ||
            rn.includes('single episode');

        if (shortStay && rapidReadmit && (sameDx || prematureIndicators)) {
            return {
                ruleId: 'RULE-RA-DA-001',
                category: 'DISCHARGE_ADEQUACY',
                severity: 'Critical',
                description: `Index stay of only ${pair.indexLengthOfStay} days followed by readmission in ${pair.daysBetween} days with the same or worsened condition. Pattern strongly suggests premature discharge from the index admission. These two stays may represent a single episode of care.`,
                recommendation:
                    'Consider bundling these two admissions as a single episode. Review index discharge decision-making. If bundled, only the higher-weighted DRG should be reimbursed. Flag for case management review.',
                financialImpact: -(pair.readmitBilledAmount),
            };
        }

        return null;
    },
};

const AMA_DISCHARGE_READMISSION: ReadmissionRule = {
    id: 'RULE-RA-DA-002',
    name: 'AMA Discharge Leading to Readmission',
    category: 'DISCHARGE_ADEQUACY',
    check: (pair) => {
        if (pair.indexDischargeStatus !== 'AMA') return null;

        const sameDx = samePrincipalDxCategory(pair);
        const rapidReturn = pair.daysBetween <= 7;

        if (sameDx && rapidReturn) {
            return {
                ruleId: 'RULE-RA-DA-002',
                category: 'DISCHARGE_ADEQUACY',
                severity: 'High',
                description: `Patient left the index admission Against Medical Advice (AMA) and was readmitted ${pair.daysBetween} days later with the same condition. The readmission represents continuation of the interrupted treatment course. CMS may consider this a single episode of care.`,
                recommendation:
                    'Review AMA discharge documentation. Evaluate whether bundling is appropriate. Note that AMA discharges followed by rapid readmission are a known HRRP concern. Consider enhanced discharge planning protocols for high-risk AMA patients.',
                financialImpact: -(pair.readmitBilledAmount * 0.8),
            };
        }

        return null;
    },
};

const INADEQUATE_FOLLOW_UP: ReadmissionRule = {
    id: 'RULE-RA-DA-003',
    name: 'Inadequate Follow-Up Planning',
    category: 'DISCHARGE_ADEQUACY',
    check: (pair) => {
        if (pair.isPlannedReadmission) return null;

        const rn = readmitNotes(pair);
        const followUpGap =
            rn.includes('no follow-up') ||
            rn.includes('did not follow up') ||
            rn.includes('no pulmonology follow-up') ||
            rn.includes('no cardiology follow-up') ||
            rn.includes('ran out of') ||
            rn.includes('stopped taking') ||
            rn.includes('did not complete') ||
            rn.includes('medication noncompliance') ||
            rn.includes('noncompliance');

        if (followUpGap && pair.daysBetween <= 30) {
            return {
                ruleId: 'RULE-RA-DA-003',
                category: 'DISCHARGE_ADEQUACY',
                severity: 'Medium',
                description:
                    'Readmission notes indicate gaps in post-discharge follow-up: missed appointments, medication noncompliance, or incomplete treatment courses. These gaps contributed to the readmission and suggest the discharge plan was inadequate or patient adherence support was insufficient.',
                recommendation:
                    'Review discharge planning process. Consider enhanced transitional care: 48-hour post-discharge phone calls, medication delivery programs, and home health assessment. Refer to case management for high-risk patient identification.',
                financialImpact: -(pair.readmitBilledAmount * 0.3),
            };
        }

        return null;
    },
};

// -- Timing Pattern Rules ----------------------------------------------------

const SAME_DAY_TRANSFER: ReadmissionRule = {
    id: 'RULE-RA-TP-001',
    name: 'Same-Day Transfer — Bundle Candidate',
    category: 'TIMING_PATTERN',
    check: (pair) => {
        if (pair.daysBetween > 0) return null;
        if (pair.sameFacility) return null; // Same facility same-day is rare

        const indexTransferred = pair.indexDischargeStatus === 'Transferred';

        if (indexTransferred) {
            return {
                ruleId: 'RULE-RA-TP-001',
                category: 'TIMING_PATTERN',
                severity: 'Critical',
                description:
                    'Same-day transfer between facilities. The index admission shows transfer discharge status and the readmission occurs on the same date at a different facility. Per CMS transfer rules, the transferring hospital receives a per diem payment and the receiving hospital bills the full DRG. Both facilities should not be billing full DRG rates.',
                recommendation:
                    'Apply CMS transfer DRG pricing rules. The transferring facility should receive a per diem rate (not the full DRG). Verify transfer agreement documentation. Flag for payment adjustment.',
                financialImpact: -(pair.indexBilledAmount * 0.6),
            };
        }

        return null;
    },
};

const RAPID_READMISSION_PATTERN: ReadmissionRule = {
    id: 'RULE-RA-TP-002',
    name: 'Rapid Readmission (<=3 Days)',
    category: 'TIMING_PATTERN',
    check: (pair) => {
        if (pair.daysBetween > 3) return null;
        if (pair.daysBetween === 0) return null; // Handled by same-day transfer rule
        if (pair.isPlannedReadmission) return null;

        return {
            ruleId: 'RULE-RA-TP-002',
            category: 'TIMING_PATTERN',
            severity: 'High',
            description: `Readmission occurred within ${pair.daysBetween} day${pair.daysBetween === 1 ? '' : 's'} of discharge. Very rapid readmissions (<=3 days) have the highest correlation with premature discharge or continuation of the same episode of care. This timing pattern warrants close scrutiny for potential bundling.`,
            recommendation:
                'Conduct detailed clinical review to determine if this is a single episode of care. If so, bundle the two admissions. Consider denying the readmission if it represents the same treatment episode.',
            financialImpact: -(pair.readmitBilledAmount),
        };
    },
};

// -- DRG Bundling Rules ------------------------------------------------------

const IDENTICAL_DRG_BUNDLING: ReadmissionRule = {
    id: 'RULE-RA-DB-001',
    name: 'Identical DRG — Potential Unbundling',
    category: 'DRG_BUNDLING',
    check: (pair) => {
        if (pair.isPlannedReadmission) return null;
        if (pair.indexDRG !== pair.readmitDRG) return null;
        if (pair.daysBetween > 14) return null;

        return {
            ruleId: 'RULE-RA-DB-001',
            category: 'DRG_BUNDLING',
            severity: 'Critical',
            description: `Both admissions have identical DRG assignments (${pair.indexDRG}: ${pair.indexDRGDescription}) within ${pair.daysBetween} days. This pattern is consistent with DRG unbundling — splitting a single episode into two admissions to bill two DRG payments. Combined billing: $${pair.combinedBilledAmount.toLocaleString()}.`,
            recommendation:
                'Strongly consider bundling these admissions as a single episode of care. If bundled, reimburse only one DRG payment. Refer to Special Investigations Unit (SIU) if pattern is repeated across multiple patients at this facility.',
            financialImpact: -(pair.readmitBilledAmount),
        };
    },
};

// -- Quality Concern Rules ---------------------------------------------------

const REVOLVING_DOOR_PATTERN: ReadmissionRule = {
    id: 'RULE-RA-QC-001',
    name: 'Revolving Door Admission Pattern',
    category: 'QUALITY_CONCERN',
    check: (pair) => {
        const rn = readmitNotes(pair);
        const revolvingDoor =
            rn.includes('revolving door') ||
            rn.includes('third') ||
            rn.includes('fourth') ||
            rn.includes('multiple admissions') ||
            rn.includes('recurrent admissions') ||
            rn.includes('frequent flyer');

        const noOptimization =
            rn.includes('no evidence of medication optimization') ||
            rn.includes('no disease management') ||
            rn.includes('no palliative care') ||
            rn.includes('without medication optimization') ||
            rn.includes('no social work');

        if (revolvingDoor || (samePrincipalDxCategory(pair) && noOptimization)) {
            return {
                ruleId: 'RULE-RA-QC-001',
                category: 'QUALITY_CONCERN',
                severity: 'Critical',
                description:
                    'Documentation indicates a pattern of recurrent admissions for the same condition without evidence of care escalation, medication optimization, disease management enrollment, or palliative care discussion. This revolving door pattern represents a systemic quality concern.',
                recommendation:
                    'Mandatory case management review. Require documented evidence of medication optimization, specialist referral, disease management enrollment, and goals of care discussion before approving further admissions. Consider palliative care or hospice referral if appropriate.',
                financialImpact: -(pair.readmitBilledAmount),
            };
        }

        return null;
    },
};

const SURGICAL_COMPLICATION_QUALITY: ReadmissionRule = {
    id: 'RULE-RA-QC-002',
    name: 'Surgical Complication Readmission',
    category: 'QUALITY_CONCERN',
    check: (pair) => {
        const indexSurgical =
            pair.indexAdmissionType === 'Elective' &&
            (indexNotes(pair).includes('surgery') ||
                indexNotes(pair).includes('arthroplasty') ||
                indexNotes(pair).includes('appendectomy') ||
                indexNotes(pair).includes('procedure'));

        const readmitComplication =
            pair.readmitSecondaryDiagnoses.some(
                (d) => d.code.startsWith('T81') || d.code.startsWith('T84')
            ) ||
            readmitNotes(pair).includes('surgical site infection') ||
            readmitNotes(pair).includes('post-surgical complication') ||
            readmitNotes(pair).includes('postoperative');

        if (indexSurgical && readmitComplication && pair.daysBetween <= 30) {
            return {
                ruleId: 'RULE-RA-QC-002',
                category: 'QUALITY_CONCERN',
                severity: 'High',
                description:
                    'Readmission for a surgical complication within 30 days of an elective surgical procedure. This is a patient safety indicator (PSI) event that should be reported. Consider whether the complication was preventable.',
                recommendation:
                    'Report as Patient Safety Indicator event. Conduct surgical M&M (morbidity and mortality) review. Evaluate perioperative protocols (antibiotic prophylaxis, surgical technique, sterile technique). Flag for CMS quality reporting.',
                financialImpact: -(pair.readmitBilledAmount),
            };
        }

        return null;
    },
};

// -- Documentation Gap Rules -------------------------------------------------

const MISSING_DISCHARGE_PLAN: ReadmissionRule = {
    id: 'RULE-RA-DOC-001',
    name: 'Missing or Inadequate Discharge Plan',
    category: 'DOCUMENTATION_GAP',
    check: (pair) => {
        if (pair.isPlannedReadmission) return null;

        const hasNoPlan = !pair.indexDischargePlan;
        const indexDp = (pair.indexDischargePlan ?? '').toLowerCase();
        const minimalPlan =
            indexDp.length < 80 ||
            (!indexDp.includes('follow-up') && !indexDp.includes('follow up'));

        if ((hasNoPlan || minimalPlan) && pair.daysBetween <= 30) {
            return {
                ruleId: 'RULE-RA-DOC-001',
                category: 'DOCUMENTATION_GAP',
                severity: 'Medium',
                description:
                    'Index admission has a missing or inadequate discharge plan. Comprehensive discharge planning is a key element of readmission prevention. Without documented follow-up arrangements, medication reconciliation, and patient education, readmission risk is significantly elevated.',
                recommendation:
                    'Require comprehensive discharge summary with: follow-up appointments, medication list with changes highlighted, warning signs education, and contact information for questions. Implement discharge planning checklist.',
                financialImpact: -(pair.readmitBilledAmount * 0.2),
            };
        }

        return null;
    },
};

// -- Export all rules --------------------------------------------------------

export const ALL_READMISSION_RULES: ReadmissionRule[] = [
    // Clinical Relatedness
    SAME_PRINCIPAL_DIAGNOSIS,
    COMPLICATION_OF_INDEX_TREATMENT,
    PROGRESSION_OF_DISEASE,
    // Discharge Adequacy
    PREMATURE_DISCHARGE,
    AMA_DISCHARGE_READMISSION,
    INADEQUATE_FOLLOW_UP,
    // Timing Pattern
    SAME_DAY_TRANSFER,
    RAPID_READMISSION_PATTERN,
    // DRG Bundling
    IDENTICAL_DRG_BUNDLING,
    // Quality Concern
    REVOLVING_DOOR_PATTERN,
    SURGICAL_COMPLICATION_QUALITY,
    // Documentation Gap
    MISSING_DISCHARGE_PLAN,
];

export function runAllReadmissionRules(
    pair: ReadmissionPair
): ReadmissionFinding[] {
    return ALL_READMISSION_RULES.map((rule) => rule.check(pair)).filter(
        (f): f is ReadmissionFinding => f !== null
    );
}
