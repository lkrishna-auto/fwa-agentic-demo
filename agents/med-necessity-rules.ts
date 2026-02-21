/**
 * Medical Necessity Review - Rule Engine
 *
 * Deterministic rules that evaluate medical necessity criteria.
 * Each rule is a pure function: (MedNecessityClaim) => MedNecessityFinding | null
 */

import {
    MedNecessityClaim,
    MedNecessityFinding,
    MedNecessityFindingCategory,
    FindingSeverity,
} from '../src/types';

export interface MedNecessityRule {
    id: string;
    name: string;
    category: MedNecessityFindingCategory;
    check: (claim: MedNecessityClaim) => MedNecessityFinding | null;
}

// -- Helper utilities --------------------------------------------------------

function notes(claim: MedNecessityClaim): string {
    return claim.clinicalNotes.toLowerCase();
}

function getLabValue(claim: MedNecessityClaim, labName: string): number | null {
    const lab = claim.admissionLabValues.find(
        (l) => l.name.toLowerCase() === labName.toLowerCase()
    );
    if (!lab) return null;
    const val = parseFloat(lab.value);
    return isNaN(val) ? null : val;
}

function hasAbnormalLab(claim: MedNecessityClaim, labName: string): boolean {
    return claim.admissionLabValues.some(
        (l) => l.name.toLowerCase() === labName.toLowerCase() && l.abnormal
    );
}

function parseBP(bp: string): { systolic: number; diastolic: number } | null {
    const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;
    return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) };
}

function countAbnormalLabs(claim: MedNecessityClaim): number {
    return claim.admissionLabValues.filter((l) => l.abnormal).length;
}

// -- Severity of Illness Rules -----------------------------------------------

const STABLE_VITALS_LOW_ACUITY: MedNecessityRule = {
    id: 'RULE-MN-SI-001',
    name: 'Stable Vitals with Low Acuity',
    category: 'SEVERITY_OF_ILLNESS',
    check: (claim) => {
        const v = claim.admissionVitals;
        const bp = parseBP(v.bloodPressure);
        if (!bp) return null;

        const vitalsStable =
            bp.systolic >= 100 &&
            bp.systolic <= 160 &&
            bp.diastolic >= 60 &&
            bp.diastolic <= 95 &&
            v.heartRate >= 60 &&
            v.heartRate <= 100 &&
            v.temperature >= 97.5 &&
            v.temperature <= 99.5 &&
            v.respiratoryRate >= 12 &&
            v.respiratoryRate <= 20 &&
            v.o2Saturation >= 95;

        const abnormalLabCount = countAbnormalLabs(claim);

        if (vitalsStable && abnormalLabCount <= 1 && !claim.icuAdmission) {
            return {
                ruleId: 'RULE-MN-SI-001',
                category: 'SEVERITY_OF_ILLNESS',
                severity: 'High',
                description:
                    'Admission vitals are within normal limits and lab values show minimal derangement. Severity of illness criteria for inpatient admission may not be met. Patient appears hemodynamically stable without evidence of acute organ dysfunction.',
                recommendation:
                    'Evaluate whether observation status or outpatient management would be appropriate. Document specific clinical indicators that require inpatient-level monitoring if applicable.',
                financialImpact: -(claim.billedAmount),
            };
        }

        return null;
    },
};

const HEMODYNAMIC_INSTABILITY: MedNecessityRule = {
    id: 'RULE-MN-SI-002',
    name: 'Hemodynamic Instability Supports Admission',
    category: 'SEVERITY_OF_ILLNESS',
    check: (claim) => {
        const v = claim.admissionVitals;
        const bp = parseBP(v.bloodPressure);
        if (!bp) return null;

        const hypotensive = bp.systolic < 90 || bp.diastolic < 60;
        const tachycardic = v.heartRate > 110;
        const febrile = v.temperature > 101.0;
        const tachypneic = v.respiratoryRate > 22;
        const hypoxic = v.o2Saturation < 92;

        const instabilityCount = [
            hypotensive,
            tachycardic,
            febrile,
            tachypneic,
            hypoxic,
        ].filter(Boolean).length;

        if (instabilityCount >= 2 && claim.medNecessityStatus === 'Pending') {
            // This is a positive finding - supports admission
            return null; // No finding needed - admission is justified
        }

        return null;
    },
};

// -- Intensity of Service Rules ----------------------------------------------

const LOW_INTENSITY_SERVICES: MedNecessityRule = {
    id: 'RULE-MN-IS-001',
    name: 'Low Intensity Services - Outpatient Capable',
    category: 'INTENSITY_OF_SERVICE',
    check: (claim) => {
        if (
            !claim.ivMedicationsRequired &&
            !claim.icuAdmission &&
            !claim.surgicalProcedure &&
            !claim.telemetryRequired &&
            !claim.oxygenRequired &&
            !claim.isolationRequired
        ) {
            return {
                ruleId: 'RULE-MN-IS-001',
                category: 'INTENSITY_OF_SERVICE',
                severity: 'High',
                description:
                    'No hospital-level services identified: no IV medications required, no ICU care, no surgical procedures, no telemetry, no supplemental oxygen, and no isolation precautions. Services provided could potentially be delivered at a lower level of care.',
                recommendation:
                    'Review whether oral medications, outpatient monitoring, or observation status would have been appropriate. Document any services requiring inpatient-level nursing or monitoring intensity.',
                financialImpact: -(claim.billedAmount),
            };
        }

        return null;
    },
};

const SINGLE_IV_DOSE_ONLY: MedNecessityRule = {
    id: 'RULE-MN-IS-002',
    name: 'Single IV Dose Does Not Justify Admission',
    category: 'INTENSITY_OF_SERVICE',
    check: (claim) => {
        const n = notes(claim);
        const singleDose =
            (n.includes('x1 dose') ||
                n.includes('one dose') ||
                n.includes('single dose')) &&
            (n.includes('transitioned to oral') ||
                n.includes('switched to oral') ||
                n.includes('converted to po'));

        if (singleDose && !claim.icuAdmission && !claim.surgicalProcedure) {
            return {
                ruleId: 'RULE-MN-IS-002',
                category: 'INTENSITY_OF_SERVICE',
                severity: 'Medium',
                description:
                    'Patient received only a single IV medication dose before transitioning to oral therapy. A single IV dose in the ED does not typically justify inpatient admission unless other intensity criteria are met.',
                recommendation:
                    'Document clinical rationale for why ongoing IV therapy or inpatient monitoring was required beyond the initial IV dose. Consider whether ED observation or outpatient follow-up was appropriate.',
                financialImpact: -(claim.billedAmount * 0.6),
            };
        }

        return null;
    },
};

// -- Admission Criteria Rules ------------------------------------------------

const ELECTIVE_ADMISSION_NO_PROCEDURE: MedNecessityRule = {
    id: 'RULE-MN-AC-001',
    name: 'Elective Admission Without Procedure',
    category: 'ADMISSION_CRITERIA',
    check: (claim) => {
        if (
            claim.admissionType === 'Elective' &&
            !claim.surgicalProcedure &&
            !claim.icuAdmission
        ) {
            const n = notes(claim);
            const diagnosticOnly =
                n.includes('diagnostic') ||
                n.includes('evaluation') ||
                n.includes('workup') ||
                n.includes('monitoring');

            if (diagnosticOnly) {
                return {
                    ruleId: 'RULE-MN-AC-001',
                    category: 'ADMISSION_CRITERIA',
                    severity: 'Critical',
                    description:
                        'Elective admission for diagnostic evaluation without a therapeutic procedure or ICU-level care. Elective diagnostic workups and monitoring can typically be performed in an outpatient or observation setting.',
                    recommendation:
                        'Review admission criteria. Elective admissions should have a clear therapeutic intent. If the admission is for pre-procedural evaluation, document the planned procedure and medical necessity for inpatient pre-op stay.',
                    financialImpact: -(claim.billedAmount),
                };
            }
        }

        return null;
    },
};

const OUTPATIENT_MANAGEABLE: MedNecessityRule = {
    id: 'RULE-MN-AC-002',
    name: 'Condition Manageable as Outpatient',
    category: 'ADMISSION_CRITERIA',
    check: (claim) => {
        const n = notes(claim);
        const outpatientIndicators =
            n.includes('could have been managed as outpatient') ||
            n.includes('could be managed outpatient') ||
            n.includes('outpatient management appropriate') ||
            n.includes('could have been managed in outpatient') ||
            (n.includes('oral') &&
                n.includes('tolerating') &&
                n.includes('ambulatory'));

        const stableVitals =
            claim.admissionVitals.heartRate <= 100 &&
            claim.admissionVitals.temperature <= 99.5 &&
            claim.admissionVitals.o2Saturation >= 95;

        if (outpatientIndicators && stableVitals && !claim.icuAdmission) {
            return {
                ruleId: 'RULE-MN-AC-002',
                category: 'ADMISSION_CRITERIA',
                severity: 'Critical',
                description:
                    'Clinical documentation suggests condition is manageable in an outpatient setting. Patient is tolerating oral intake, ambulatory, and hemodynamically stable. Inpatient admission criteria may not be met.',
                recommendation:
                    'Consider retrospective review for observation or outpatient status. Ensure documentation clearly supports why inpatient-level care was required despite stable presentation.',
                financialImpact: -(claim.billedAmount),
            };
        }

        return null;
    },
};

// -- Level of Care Rules -----------------------------------------------------

const OBSERVATION_APPROPRIATE: MedNecessityRule = {
    id: 'RULE-MN-LOC-001',
    name: 'Observation Level of Care Appropriate',
    category: 'LEVEL_OF_CARE',
    check: (claim) => {
        if (claim.lengthOfStay > 2) return null; // Longer stays less likely observation

        const v = claim.admissionVitals;
        const bp = parseBP(v.bloodPressure);
        if (!bp) return null;

        const mildlyAbnormal =
            (v.heartRate > 100 && v.heartRate <= 110) ||
            (v.temperature > 99.5 && v.temperature <= 101.0) ||
            (v.o2Saturation >= 92 && v.o2Saturation < 95) ||
            (bp.systolic >= 90 && bp.systolic < 100);

        const shortStay = claim.lengthOfStay <= 2;
        const noICU = !claim.icuAdmission;
        const noSurgery = !claim.surgicalProcedure;

        if (mildlyAbnormal && shortStay && noICU && noSurgery) {
            const n = notes(claim);
            const respondedQuickly =
                n.includes('responded') ||
                n.includes('improved') ||
                n.includes('resolved') ||
                n.includes('stabilized');

            if (respondedQuickly) {
                return {
                    ruleId: 'RULE-MN-LOC-001',
                    category: 'LEVEL_OF_CARE',
                    severity: 'High',
                    description:
                        'Short length of stay (<=2 days) with mildly abnormal presentation that responded quickly to treatment. This pattern is consistent with observation-level care rather than full inpatient admission.',
                    recommendation:
                        'Consider whether observation status would have been more appropriate. Document specific clinical criteria that required inpatient admission at the time of the admission decision. If converted to observation, reimbursement may be at outpatient rates.',
                    financialImpact: -(claim.billedAmount * 0.5),
                };
            }
        }

        return null;
    },
};

// -- Continued Stay Rules ----------------------------------------------------

const EXCESSIVE_LOS_NO_COMPLICATIONS: MedNecessityRule = {
    id: 'RULE-MN-CS-001',
    name: 'Excessive Length of Stay Without Complications',
    category: 'CONTINUED_STAY',
    check: (claim) => {
        // Check if LOS seems excessive based on typical geometric mean
        const n = notes(claim);
        const hasComplications =
            n.includes('complication') ||
            n.includes('readmit') ||
            n.includes('deteriorat') ||
            n.includes('icu transfer') ||
            n.includes('return to or') ||
            claim.icuAdmission;

        // Simple heuristic: flag if LOS > 5 days without complications or ICU
        if (claim.lengthOfStay > 5 && !hasComplications && !claim.surgicalProcedure) {
            return {
                ruleId: 'RULE-MN-CS-001',
                category: 'CONTINUED_STAY',
                severity: 'Medium',
                description: `Length of stay (${claim.lengthOfStay} days) exceeds typical geometric mean for this DRG without documented complications, ICU stays, or surgical procedures. Extended stay may not be justified by clinical documentation.`,
                recommendation:
                    'Review daily progress notes for continued stay justification. Document specific clinical barriers to discharge (e.g., pending procedures, unstable vitals, IV medication requirements, discharge planning barriers).',
                financialImpact: -(claim.billedAmount * 0.3),
            };
        }

        return null;
    },
};

// -- Documentation Gap Rules -------------------------------------------------

const MISSING_CLINICAL_INDICATORS: MedNecessityRule = {
    id: 'RULE-MN-DOC-001',
    name: 'Missing Clinical Indicators for Diagnosis',
    category: 'DOCUMENTATION_GAP',
    check: (claim) => {
        const n = notes(claim);

        // Check for documentation that explicitly notes outpatient capability
        const selfContradicting =
            n.includes('could have been managed') ||
            n.includes('not require inpatient') ||
            n.includes('no indication for admission') ||
            n.includes('social admit');

        if (selfContradicting) {
            return {
                ruleId: 'RULE-MN-DOC-001',
                category: 'DOCUMENTATION_GAP',
                severity: 'Critical',
                description:
                    'Clinical documentation contains language suggesting the condition did not require inpatient admission. This significantly weakens medical necessity justification and increases denial risk on payer review.',
                recommendation:
                    'Query attending physician to clarify medical necessity. If inpatient care was truly required, documentation must be amended to remove contradictory language and add specific clinical criteria supporting admission. CDI query recommended.',
                financialImpact: -(claim.billedAmount),
            };
        }

        return null;
    },
};

const FAILED_OUTPATIENT_NOT_DOCUMENTED: MedNecessityRule = {
    id: 'RULE-MN-DOC-002',
    name: 'Failed Outpatient Treatment Not Documented',
    category: 'DOCUMENTATION_GAP',
    check: (claim) => {
        const n = notes(claim);

        // For conditions that typically require failed outpatient therapy first
        const conditionsNeedingFailedOutpatient =
            n.includes('cellulitis') ||
            n.includes('pneumonia') ||
            (n.includes('uti') && !n.includes('sepsis')) ||
            n.includes('asthma') ||
            n.includes('copd exacerbation');

        const failedOutpatientDocumented =
            n.includes('failed oral') ||
            n.includes('failed outpatient') ||
            n.includes('refractory') ||
            n.includes('not responding to') ||
            n.includes('worsening despite');

        if (
            conditionsNeedingFailedOutpatient &&
            !failedOutpatientDocumented &&
            !claim.icuAdmission &&
            claim.admissionType !== 'Emergency'
        ) {
            return {
                ruleId: 'RULE-MN-DOC-002',
                category: 'DOCUMENTATION_GAP',
                severity: 'Medium',
                description:
                    'For this condition, payers typically require documentation of failed outpatient therapy before approving inpatient admission. No documentation of failed oral antibiotics, outpatient treatment failure, or clinical progression despite outpatient management.',
                recommendation:
                    'Document any prior outpatient treatment attempts and why they were insufficient. If the patient was directly admitted, document clinical severity that precluded outpatient trial. This documentation strengthens medical necessity and reduces denial risk.',
                financialImpact: -(claim.billedAmount * 0.4),
            };
        }

        return null;
    },
};

// -- Export all rules --------------------------------------------------------

export const ALL_MED_NECESSITY_RULES: MedNecessityRule[] = [
    // Severity of Illness
    STABLE_VITALS_LOW_ACUITY,
    HEMODYNAMIC_INSTABILITY,
    // Intensity of Service
    LOW_INTENSITY_SERVICES,
    SINGLE_IV_DOSE_ONLY,
    // Admission Criteria
    ELECTIVE_ADMISSION_NO_PROCEDURE,
    OUTPATIENT_MANAGEABLE,
    // Level of Care
    OBSERVATION_APPROPRIATE,
    // Continued Stay
    EXCESSIVE_LOS_NO_COMPLICATIONS,
    // Documentation Gaps
    MISSING_CLINICAL_INDICATORS,
    FAILED_OUTPATIENT_NOT_DOCUMENTED,
];

export function runAllMedNecessityRules(
    claim: MedNecessityClaim
): MedNecessityFinding[] {
    return ALL_MED_NECESSITY_RULES.map((rule) => rule.check(claim)).filter(
        (f): f is MedNecessityFinding => f !== null
    );
}
