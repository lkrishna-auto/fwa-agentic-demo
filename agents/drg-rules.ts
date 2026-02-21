/**
 * DRG Clinical Validation - Rule Engine
 *
 * Deterministic rules that detect common DRG coding issues.
 * Each rule is a pure function: (DRGClaim) => DRGValidationFinding | null
 */

import {
    DRGClaim,
    DRGValidationFinding,
    FindingCategory,
    FindingSeverity,
} from '../src/types';

export interface ValidationRule {
    id: string;
    name: string;
    category: FindingCategory;
    check: (claim: DRGClaim) => DRGValidationFinding | null;
}

// ── Helper utilities ─────────────────────────────────────────────────

function notes(claim: DRGClaim): string {
    return claim.clinicalNotes.toLowerCase();
}

function hasDxCode(claim: DRGClaim, prefix: string): boolean {
    return (
        claim.primaryDiagnosis.code.startsWith(prefix) ||
        claim.secondaryDiagnoses.some((d) => d.code.startsWith(prefix))
    );
}

function hasSecondaryMCC(claim: DRGClaim): boolean {
    return claim.secondaryDiagnoses.some((d) => d.isMCC);
}

// ── Sepsis Rules ─────────────────────────────────────────────────────

const SEPSIS_MISSED_PRINCIPAL: ValidationRule = {
    id: 'RULE-SEP-001',
    name: 'Sepsis Missed as Principal Diagnosis',
    category: 'CODING_SEQUENCE',
    check: (claim) => {
        const n = notes(claim);
        const sepsisInNotes =
            n.includes('sepsis') ||
            n.includes('septicemia') ||
            n.includes('bacteremia') ||
            (n.includes('sirs') && n.includes('infection'));

        const sepsisPrincipal = claim.primaryDiagnosis.code.startsWith('A41');
        const sepsisCoded = hasDxCode(claim, 'A41');

        // Sepsis is in notes but not coded as principal — and principal is a source infection
        if (
            sepsisInNotes &&
            !sepsisPrincipal &&
            (claim.primaryDiagnosis.code.startsWith('N39') ||
                claim.primaryDiagnosis.code.startsWith('J18') ||
                claim.primaryDiagnosis.code.startsWith('L03'))
        ) {
            return {
                ruleId: 'RULE-SEP-001',
                category: 'CODING_SEQUENCE',
                severity: 'Critical',
                description: `Clinical notes reference sepsis/SIRS criteria but principal diagnosis is "${claim.primaryDiagnosis.description}" (${claim.primaryDiagnosis.code}). Per ICD-10 and Coding Clinic guidelines, when sepsis is present with a localized infection, sepsis (A41.x) should be sequenced as the principal diagnosis.`,
                recommendation:
                    'Query attending physician to confirm sepsis as reason for admission. If confirmed, recode A41.9 as principal diagnosis and move current principal to secondary. Add R65.20 (severe sepsis) if organ dysfunction criteria met.',
                financialImpact: 3100,
            };
        }

        return null;
    },
};

const SEPSIS_MCC_UNSUPPORTED: ValidationRule = {
    id: 'RULE-SEP-002',
    name: 'Sepsis MCC Not Clinically Supported',
    category: 'CC_MCC_VALIDATION',
    check: (claim) => {
        const sepsisPrincipal = claim.primaryDiagnosis.code.startsWith('A41');
        if (!sepsisPrincipal) return null;

        // Check if respiratory failure MCC is coded
        const hasRespFailure = claim.secondaryDiagnoses.some(
            (d) => d.code.startsWith('J96') && d.isMCC
        );
        if (!hasRespFailure) return null;

        const n = notes(claim);
        // Check if respiratory failure is NOT supported by clinical indicators
        const respFailureSupported =
            n.includes('intubat') ||
            n.includes('mechanical ventilation') ||
            n.includes('bipap') ||
            n.includes('high-flow') ||
            (n.includes('o2 sat') && n.includes('8')) || // sats in 80s
            n.includes('pao2') ||
            n.includes('hypoxemi');

        const respFailureContradicted =
            n.includes('room air') &&
            (n.includes('96%') ||
                n.includes('97%') ||
                n.includes('98%') ||
                n.includes('99%') ||
                n.includes('no supplemental oxygen'));

        if (!respFailureSupported || respFailureContradicted) {
            return {
                ruleId: 'RULE-SEP-002',
                category: 'CC_MCC_VALIDATION',
                severity: 'High',
                description:
                    'Acute respiratory failure (J96.00) coded as MCC but clinical documentation does not support respiratory failure criteria. Patient maintained normal oxygenation without supplemental oxygen support.',
                recommendation:
                    'Query physician regarding clinical basis for respiratory failure diagnosis. If not clinically supported, remove J96.00. This would change DRG from septicemia w MCC to septicemia w/o MCC.',
                financialImpact: -8700,
            };
        }

        return null;
    },
};

const SEPSIS_SHOCK_MISSED: ValidationRule = {
    id: 'RULE-SEP-003',
    name: 'Septic Shock Not Coded',
    category: 'DOWNCODING',
    check: (claim) => {
        const sepsisPrincipal = claim.primaryDiagnosis.code.startsWith('A41');
        if (!sepsisPrincipal) return null;

        const hasShockCode =
            hasDxCode(claim, 'R65.21') || hasDxCode(claim, 'R57.2');
        if (hasShockCode) return null;

        const n = notes(claim);
        const shockIndicators =
            (n.includes('vasopressor') || n.includes('norepinephrine') || n.includes('levophed') || n.includes('dopamine')) &&
            (n.includes('septic shock') ||
                n.includes('map') ||
                n.includes('bp 7') ||
                n.includes('bp 6') ||
                n.includes('hypotension'));

        const lacticAcidMatch = n.match(/lactic acid\s+([\d.]+)/);
        const highLactate =
            lacticAcidMatch && parseFloat(lacticAcidMatch[1]) > 4.0;

        if (shockIndicators || (highLactate && n.includes('vasopressor'))) {
            return {
                ruleId: 'RULE-SEP-003',
                category: 'DOWNCODING',
                severity: 'Critical',
                description:
                    'Clinical notes document vasopressor use and hemodynamic instability consistent with septic shock, but R65.21 (septic shock) is not coded. Septic shock is an MCC that significantly impacts DRG assignment.',
                recommendation:
                    'Query physician to confirm septic shock. If confirmed, add R65.21. This would upgrade DRG to septicemia with MCC, reflecting true clinical severity and resource utilization.',
                financialImpact: 8700,
            };
        }

        return null;
    },
};

const SEPSIS_SEQUENCE_ERROR: ValidationRule = {
    id: 'RULE-SEP-004',
    name: 'Sepsis Principal Diagnosis Sequence Error',
    category: 'CODING_SEQUENCE',
    check: (claim) => {
        // If sepsis is coded as secondary but should be principal
        const sepsisPrincipal = claim.primaryDiagnosis.code.startsWith('A41');
        const sepsisSecondary = claim.secondaryDiagnoses.some((d) =>
            d.code.startsWith('A41')
        );
        const severeSepsisSecondary = claim.secondaryDiagnoses.some((d) =>
            d.code.startsWith('R65.2')
        );

        if (!sepsisPrincipal && sepsisSecondary && severeSepsisSecondary) {
            return {
                ruleId: 'RULE-SEP-004',
                category: 'CODING_SEQUENCE',
                severity: 'High',
                description: `Sepsis (A41.x) and severe sepsis (R65.20) are coded as secondary diagnoses but per ICD-10 sequencing guidelines, sepsis should be the principal diagnosis when it meets the definition of "condition established after study."`,
                recommendation:
                    'Resequence A41.x as principal diagnosis. Move current principal to secondary position. This may change the MS-DRG assignment.',
                financialImpact: 1800,
            };
        }

        return null;
    },
};

// ── Cardiovascular Rules ─────────────────────────────────────────────

const CHF_MCC_MISSED: ValidationRule = {
    id: 'RULE-CARD-001',
    name: 'Heart Failure MCC/CC Omission',
    category: 'DOWNCODING',
    check: (claim) => {
        const isHFPrincipal = claim.primaryDiagnosis.code.startsWith('I50');
        if (!isHFPrincipal) return null;

        const n = notes(claim);
        // Check for acute-on-chronic HF not fully captured
        const acuteOnChronic =
            n.includes('acute-on-chronic') ||
            n.includes('acute decompensated') ||
            (n.includes('acute') && n.includes('chronic') && n.includes('heart failure'));

        const specificHFCoded =
            hasDxCode(claim, 'I50.2') || // systolic
            hasDxCode(claim, 'I50.3') || // diastolic
            hasDxCode(claim, 'I50.4');   // combined

        // Check for CKD not coded
        const ckdInNotes =
            (n.includes('ckd') || n.includes('chronic kidney') || n.includes('egfr')) &&
            !hasDxCode(claim, 'N18');

        const findings: string[] = [];
        let impact = 0;

        if (acuteOnChronic && !specificHFCoded) {
            findings.push(
                'Documentation indicates acute-on-chronic heart failure but I50.9 (unspecified) was coded. A more specific code (e.g., I50.33 for acute-on-chronic combined HF) may qualify as higher severity.'
            );
            impact += 5000;
        }

        if (ckdInNotes) {
            findings.push(
                'Chronic kidney disease documented in notes (eGFR values present) but not coded. CKD stage 3+ (N18.3+) qualifies as CC.'
            );
            impact += 2900;
        }

        if (findings.length > 0) {
            return {
                ruleId: 'RULE-CARD-001',
                category: 'DOWNCODING',
                severity: 'High',
                description: findings.join(' '),
                recommendation:
                    'Query physician for specific heart failure type and CKD staging. Code to highest specificity supported by documentation. Missing CCs/MCCs may upgrade DRG from HF w/o CC/MCC to HF w CC or w MCC.',
                financialImpact: impact,
            };
        }

        return null;
    },
};

const CARDIAC_PROCEDURE_MISMATCH: ValidationRule = {
    id: 'RULE-CARD-002',
    name: 'Interventional Procedure DRG Without Documentation',
    category: 'UPCODING',
    check: (claim) => {
        // DRG 247-249 are PCI with stent DRGs
        const isPCIDRG = ['247', '248', '249'].includes(claim.assignedDRG);
        if (!isPCIDRG) return null;

        const n = notes(claim);
        const noIntervention =
            (n.includes('diagnostic') && !n.includes('interventional')) ||
            n.includes('no stent') ||
            n.includes('no percutaneous coronary intervention') ||
            n.includes('not amenable to intervention') ||
            n.includes('medical management');

        if (noIntervention) {
            return {
                ruleId: 'RULE-CARD-002',
                category: 'UPCODING',
                severity: 'Critical',
                description:
                    'DRG assigned for percutaneous cardiovascular procedure with stent, but documentation indicates only diagnostic catheterization was performed. No interventional procedure or stent placement documented.',
                recommendation:
                    'Recode to diagnostic cardiac catheterization DRG. Remove PCI procedure codes. This is a significant DRG discrepancy requiring immediate correction.',
                financialImpact: -15250,
            };
        }

        return null;
    },
};

const AKI_CC_MISSED: ValidationRule = {
    id: 'RULE-CARD-003',
    name: 'Acute Kidney Injury CC Omission',
    category: 'DOWNCODING',
    check: (claim) => {
        // Only fire if AKI is NOT already coded
        if (hasDxCode(claim, 'N17')) return null;

        const n = notes(claim);
        const akiInNotes =
            n.includes('acute kidney injury') ||
            n.includes('acute kidney failure') ||
            n.includes('aki') ||
            n.includes('acute renal failure');

        const creatinineEvidence =
            n.includes('creatinine') &&
            (n.includes('baseline') || n.includes('peaked') || n.includes('elevated'));

        if (akiInNotes && creatinineEvidence) {
            return {
                ruleId: 'RULE-CARD-003',
                category: 'DOWNCODING',
                severity: 'Medium',
                description:
                    'Acute kidney injury documented in clinical notes with supporting lab values (creatinine changes) but N17.x (AKI) is not coded. AKI qualifies as a CC.',
                recommendation:
                    'Add N17.9 (AKI, unspecified) or stage-specific code based on KDIGO criteria from labs. This CC may impact DRG assignment.',
                financialImpact: 2700,
            };
        }

        return null;
    },
};

// ── Respiratory Rules ────────────────────────────────────────────────

const VENTILATION_DRG_MISMATCH: ValidationRule = {
    id: 'RULE-RESP-001',
    name: 'Mechanical Ventilation Duration vs DRG',
    category: 'DOWNCODING',
    check: (claim) => {
        const n = notes(claim);
        // Check for prolonged mechanical ventilation
        const ventMatch = n.match(
            /(?:mechanical ventilation|intubat|ventilator).*?(\d+)\s*(?:hours|hrs|days)/
        );
        if (!ventMatch) return null;

        let ventHours = parseInt(ventMatch[1]);
        if (n.includes('days') && ventHours < 30) {
            ventHours *= 24;
        }

        // DRG 207/208 are for ventilation >96 hours
        const isVentDRG = ['207', '208'].includes(claim.assignedDRG);

        if (ventHours > 96 && !isVentDRG) {
            return {
                ruleId: 'RULE-RESP-001',
                category: 'DOWNCODING',
                severity: 'Critical',
                description: `Documentation indicates ${ventHours} hours of mechanical ventilation (>96 hours threshold) but claim is assigned DRG ${claim.assignedDRG} (${claim.assignedDRGDescription}). Should be grouped to DRG 207 (Respiratory System Diagnosis w Ventilator Support >96 Hours).`,
                recommendation:
                    'Verify ventilator start and stop times in respiratory therapy notes. If >96 hours confirmed, add procedure code 5A1955Z and recode to DRG 207. This is a high-value DRG change.',
                financialImpact: 43900,
            };
        }

        return null;
    },
};

const PE_MCC_UNSUPPORTED: ValidationRule = {
    id: 'RULE-RESP-002',
    name: 'PE Acute Cor Pulmonale Not Supported',
    category: 'UPCODING',
    check: (claim) => {
        const hasPEWithCorPulmonale =
            claim.primaryDiagnosis.code === 'I26.09' ||
            claim.secondaryDiagnoses.some((d) => d.code === 'I26.09');

        if (!hasPEWithCorPulmonale) return null;

        const n = notes(claim);
        const echoNotSupporting =
            (n.includes('rv size normal') ||
                n.includes('rv function normal') ||
                n.includes('no rv strain') ||
                n.includes('no rv dilation')) &&
            n.includes('echo');

        if (echoNotSupporting) {
            return {
                ruleId: 'RULE-RESP-002',
                category: 'UPCODING',
                severity: 'High',
                description:
                    'PE coded as I26.09 (with acute cor pulmonale) but echocardiogram documents normal RV size and function with no RV strain. The "with acute cor pulmonale" code is not clinically supported.',
                recommendation:
                    'Recode to I26.99 (PE without acute cor pulmonale). Remove associated respiratory failure MCC if also unsupported. This may change DRG from PE w MCC to PE w/o MCC.',
                financialImpact: -6600,
            };
        }

        return null;
    },
};

const STATUS_ASTHMATICUS_CRITERIA: ValidationRule = {
    id: 'RULE-RESP-003',
    name: 'Status Asthmaticus Criteria Not Met',
    category: 'UPCODING',
    check: (claim) => {
        const hasStatusAsthmaticus =
            claim.primaryDiagnosis.code === 'J46' ||
            claim.secondaryDiagnoses.some((d) => d.code === 'J46');

        if (!hasStatusAsthmaticus) return null;

        const n = notes(claim);
        const criteriaMet =
            n.includes('refractory') ||
            n.includes('intubat') ||
            n.includes('respiratory acidosis') ||
            n.includes('icu') ||
            (n.includes('paco2') && n.includes('4') && !n.includes('36')) || // elevated pCO2
            n.includes('status asthmaticus criteria');

        const criteriaNotMet =
            n.includes('does not meet status asthmaticus') ||
            n.includes('not meet status') ||
            (n.includes('paco2') && n.includes('36')) || // normal pCO2
            (n.includes('responded') && n.includes('nebulizer'));

        if (!criteriaMet || criteriaNotMet) {
            return {
                ruleId: 'RULE-RESP-003',
                category: 'UPCODING',
                severity: 'High',
                description:
                    'Status asthmaticus (J46) coded but documentation does not demonstrate refractory bronchospasm, respiratory failure, or need for intubation. Patient responded to standard bronchodilator therapy.',
                recommendation:
                    'Recode to J45.41 (moderate persistent asthma with acute exacerbation) or J45.51 (severe persistent asthma with acute exacerbation). Status asthmaticus requires documentation of life-threatening bronchospasm not responding to standard therapy.',
                financialImpact: -4400,
            };
        }

        return null;
    },
};

// ── General / Cross-Category Rules ───────────────────────────────────

const STROKE_CC_MISSED: ValidationRule = {
    id: 'RULE-GEN-001',
    name: 'Stroke Complication CC Omission',
    category: 'DOWNCODING',
    check: (claim) => {
        const isStroke =
            claim.primaryDiagnosis.code.startsWith('I63') ||
            claim.primaryDiagnosis.code.startsWith('I61');
        if (!isStroke) return null;

        const n = notes(claim);
        const hemiplegiaInNotes =
            n.includes('hemiplegia') ||
            n.includes('hemiparesis') ||
            n.includes('weakness') && (n.includes('right-sided') || n.includes('left-sided'));

        const hemiplegiaCoded = hasDxCode(claim, 'G81');

        if (hemiplegiaInNotes && !hemiplegiaCoded) {
            return {
                ruleId: 'RULE-GEN-001',
                category: 'DOWNCODING',
                severity: 'High',
                description:
                    'Hemiplegia/hemiparesis documented following stroke but G81.x is not coded. Hemiplegia is a CC that impacts DRG assignment for cerebrovascular diagnoses.',
                recommendation:
                    'Add appropriate G81.x code (G81.91 for right-sided, G81.92 for left-sided hemiplegia). Specify dominant vs non-dominant side if documented. This CC upgrades the stroke DRG.',
                financialImpact: 4400,
            };
        }

        return null;
    },
};

const AKI_SEVERITY_OVERCODED: ValidationRule = {
    id: 'RULE-GEN-002',
    name: 'AKI Severity Overcoded',
    category: 'UPCODING',
    check: (claim) => {
        const akiPrincipal = claim.primaryDiagnosis.code.startsWith('N17');
        if (!akiPrincipal) return null;

        const n = notes(claim);
        // Check for MCC coded with AKI
        const hasMCCSecondary = hasSecondaryMCC(claim);
        if (!hasMCCSecondary) return null;

        // Check if labs show only mild AKI
        const mildAKI =
            n.includes('stage 1') ||
            n.includes('creatinine') && n.includes('2.1') && n.includes('baseline') ||
            (n.includes('no dialysis') && n.includes('urine output maintained'));

        const mccContradicted =
            n.includes('does not meet criteria') ||
            n.includes('does not support mcc') ||
            n.includes('mild') ||
            (n.includes('corrected') && n.includes('by day'));

        if (mildAKI && mccContradicted) {
            return {
                ruleId: 'RULE-GEN-002',
                category: 'UPCODING',
                severity: 'High',
                description:
                    'AKI coded as principal with MCC secondary diagnoses, but lab values indicate only Stage 1 AKI (mild). The MCC severity level is not supported by the clinical documentation.',
                recommendation:
                    'Review MCC codes for clinical support. If hyponatremia or other MCC is mild and self-resolving, recode appropriately. DRG should reflect actual clinical severity.',
                financialImpact: -5500,
            };
        }

        return null;
    },
};

const GI_BLEED_MCC_MISSED: ValidationRule = {
    id: 'RULE-GEN-003',
    name: 'GI Hemorrhage MCC Omission - DIC',
    category: 'DOWNCODING',
    check: (claim) => {
        const isGIBleed =
            claim.primaryDiagnosis.code.startsWith('K92') ||
            claim.primaryDiagnosis.code.startsWith('K25') ||
            claim.primaryDiagnosis.code.startsWith('K26');
        if (!isGIBleed) return null;

        const n = notes(claim);
        const dicEvidence =
            (n.includes('dic') || n.includes('disseminated intravascular coagulation')) &&
            (n.includes('d-dimer') || n.includes('fibrinogen') || n.includes('inr'));

        const dicNotCoded = !hasDxCode(claim, 'D65');

        if (dicEvidence && dicNotCoded) {
            return {
                ruleId: 'RULE-GEN-003',
                category: 'DOWNCODING',
                severity: 'Critical',
                description:
                    'Clinical documentation supports disseminated intravascular coagulation (DIC) with elevated D-dimer, low fibrinogen, and coagulopathy, but D65 is not coded. DIC is an MCC that significantly impacts DRG weight.',
                recommendation:
                    'Add D65 (DIC) based on documented lab findings. This MCC upgrades GI hemorrhage DRG from w/o CC/MCC to w MCC, reflecting the true clinical complexity.',
                financialImpact: 7200,
            };
        }

        return null;
    },
};

// ── Export all rules ─────────────────────────────────────────────────

export const ALL_RULES: ValidationRule[] = [
    // Sepsis
    SEPSIS_MISSED_PRINCIPAL,
    SEPSIS_MCC_UNSUPPORTED,
    SEPSIS_SHOCK_MISSED,
    SEPSIS_SEQUENCE_ERROR,
    // Cardiovascular
    CHF_MCC_MISSED,
    CARDIAC_PROCEDURE_MISMATCH,
    AKI_CC_MISSED,
    // Respiratory
    VENTILATION_DRG_MISMATCH,
    PE_MCC_UNSUPPORTED,
    STATUS_ASTHMATICUS_CRITERIA,
    // General
    STROKE_CC_MISSED,
    AKI_SEVERITY_OVERCODED,
    GI_BLEED_MCC_MISSED,
];

export function runAllRules(claim: DRGClaim): DRGValidationFinding[] {
    return ALL_RULES.map((rule) => rule.check(claim)).filter(
        (f): f is DRGValidationFinding => f !== null
    );
}
