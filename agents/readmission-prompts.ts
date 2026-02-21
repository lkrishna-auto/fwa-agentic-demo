/**
 * Readmission Review Agent - Prompt Templates
 *
 * Pure functions that build prompts for LLM-based readmission analysis.
 * Currently consumed by the rule-based backend (which ignores them)
 * but structured for drop-in LLM integration.
 */

import { ReadmissionPair, ReadmissionFinding } from '../src/types';

export interface ReadmissionPromptContext {
    pair: ReadmissionPair;
}

// -- Main Readmission Review Prompt ------------------------------------------

export function buildReadmissionReviewPrompt(ctx: ReadmissionPromptContext): string {
    const { pair } = ctx;

    const indexDxList = pair.indexSecondaryDiagnoses
        .map((d) => `- ${d.code}: ${d.description}${d.isMCC ? ' [MCC]' : d.isCC ? ' [CC]' : ''}`)
        .join('\n');

    const readmitDxList = pair.readmitSecondaryDiagnoses
        .map((d) => `- ${d.code}: ${d.description}${d.isMCC ? ' [MCC]' : d.isCC ? ' [CC]' : ''}`)
        .join('\n');

    return `You are a hospital readmission review specialist with expertise in CMS Hospital Readmissions Reduction Program (HRRP), clinical relatedness determination, and payment integrity. You evaluate whether readmissions are clinically related to the index admission, potentially preventable, or candidates for DRG bundling.

Review the following readmission pair and determine the appropriate classification.

## INDEX ADMISSION
- Claim: ${pair.indexClaimId}
- Patient: ${pair.indexBeneficiaryName} (${pair.indexBeneficiaryId})
- Provider: ${pair.indexProviderName} (${pair.indexProviderId})
- Admission: ${pair.indexAdmissionDate} -> Discharge: ${pair.indexDischargeDate}
- LOS: ${pair.indexLengthOfStay} days | Type: ${pair.indexAdmissionType} | Discharge: ${pair.indexDischargeStatus}
- Attending: ${pair.indexAttendingPhysicianName} (${pair.indexAttendingSpecialty})
- DRG ${pair.indexDRG}: ${pair.indexDRGDescription}
- Billed: $${pair.indexBilledAmount.toLocaleString()}

### Index Principal Diagnosis
- ${pair.indexPrimaryDiagnosis.code}: ${pair.indexPrimaryDiagnosis.description}

### Index Secondary Diagnoses
${indexDxList}

### Index Clinical Notes
${pair.indexClinicalNotes}

${pair.indexDischargePlan ? `### Index Discharge Plan\n${pair.indexDischargePlan}\n` : ''}

## READMISSION
- Claim: ${pair.readmitClaimId}
- Provider: ${pair.readmitProviderName} (${pair.readmitProviderId})
- Admission: ${pair.readmitAdmissionDate} -> Discharge: ${pair.readmitDischargeDate}
- LOS: ${pair.readmitLengthOfStay} days | Type: ${pair.readmitAdmissionType} | Discharge: ${pair.readmitDischargeStatus}
- Attending: ${pair.readmitAttendingPhysicianName} (${pair.readmitAttendingSpecialty})
- DRG ${pair.readmitDRG}: ${pair.readmitDRGDescription}
- Billed: $${pair.readmitBilledAmount.toLocaleString()}

### Readmission Principal Diagnosis
- ${pair.readmitPrimaryDiagnosis.code}: ${pair.readmitPrimaryDiagnosis.description}

### Readmission Secondary Diagnoses
${readmitDxList}

### Readmission Clinical Notes
${pair.readmitClinicalNotes}

## COMPUTED METRICS
- Days Between Discharge and Readmission: ${pair.daysBetween}
- Same Facility: ${pair.sameFacility ? 'Yes' : 'No'}
- Same Attending: ${pair.sameAttending ? 'Yes' : 'No'}
- Combined Billed Amount: $${pair.combinedBilledAmount.toLocaleString()}
${pair.hrrpTargetCondition ? `- HRRP Target Condition: ${pair.hrrpTargetCondition}` : ''}
- Planned Readmission: ${pair.isPlannedReadmission ? 'Yes' : 'No'}

## REVIEW TASKS
1. **Clinical Relatedness**: Is the readmission diagnosis clinically related to the index admission? Consider same/similar diagnosis, complications, progression, or adverse events from index treatment.

2. **Preventability**: Could this readmission have been prevented with better discharge planning, patient education, medication management, or follow-up care?

3. **Discharge Adequacy**: Was the index discharge appropriate? Consider timing, discharge disposition, follow-up planning, and medication reconciliation.

4. **DRG Bundling**: Should these two stays be bundled as a single episode of care? Consider same-day transfers, very rapid readmissions, and continuation of treatment.

5. **HRRP Impact**: Does this readmission count toward HRRP penalty calculations? Is it an HRRP target condition within 30 days?

6. **Quality Concerns**: Does this pattern indicate systemic quality issues (e.g., revolving door admissions, premature discharge pattern)?

Respond with a JSON object:
{
  "reviewStatus": "Clinically Related" | "Not Related" | "Planned" | "Potentially Preventable" | "Bundle Candidate",
  "clinicalRelatedness": "Definitely Related" | "Likely Related" | "Possibly Related" | "Not Related",
  "preventabilityScore": <0-100>,
  "confidence": <0-100>,
  "bundleSavings": <amount_if_bundled>,
  "hrrpPenaltyRisk": <0-100>,
  "findings": [...],
  "summary": "<2-3 sentence summary>"
}`;
}

// -- Clinical Relatedness Focused Prompt -------------------------------------

export function buildClinicalRelatednessPrompt(ctx: ReadmissionPromptContext): string {
    const { pair } = ctx;

    return `You are a clinical reviewer specializing in determining clinical relatedness between hospital admissions for the same patient.

Evaluate whether the readmission is clinically related to the index admission.

## Index Admission
- Diagnosis: ${pair.indexPrimaryDiagnosis.code} - ${pair.indexPrimaryDiagnosis.description}
- DRG: ${pair.indexDRG} - ${pair.indexDRGDescription}
- Notes: ${pair.indexClinicalNotes}

## Readmission
- Diagnosis: ${pair.readmitPrimaryDiagnosis.code} - ${pair.readmitPrimaryDiagnosis.description}
- DRG: ${pair.readmitDRG} - ${pair.readmitDRGDescription}
- Notes: ${pair.readmitClinicalNotes}

## Timing
- Days between: ${pair.daysBetween}

Assess relatedness across these dimensions:
1. **Diagnostic Overlap**: Same or related ICD-10 codes between admissions?
2. **Complication Chain**: Is the readmission diagnosis a known complication of the index condition or treatment?
3. **Treatment Continuity**: Does the readmission represent continuation or escalation of the same treatment course?
4. **Temporal Pattern**: Does the timing suggest clinical progression vs. new disease process?

Respond with:
{
  "clinicalRelatedness": "Definitely Related" | "Likely Related" | "Possibly Related" | "Not Related",
  "relatednessJustification": "<specific clinical reasoning>",
  "sharedDiagnosticCodes": ["<list of overlapping codes>"],
  "complicationChain": "<description if applicable>"
}`;
}

// -- Discharge Adequacy Prompt -----------------------------------------------

export function buildDischargeAdequacyPrompt(ctx: ReadmissionPromptContext): string {
    const { pair } = ctx;

    return `You are a quality improvement specialist evaluating whether the index discharge was adequate and whether the readmission could have been prevented.

## Index Admission Summary
- Diagnosis: ${pair.indexPrimaryDiagnosis.description}
- LOS: ${pair.indexLengthOfStay} days
- Discharge Status: ${pair.indexDischargeStatus}
- Discharge Plan: ${pair.indexDischargePlan ?? 'Not documented'}
- Clinical Notes: ${pair.indexClinicalNotes}

## Readmission (${pair.daysBetween} days later)
- Diagnosis: ${pair.readmitPrimaryDiagnosis.description}
- Notes: ${pair.readmitClinicalNotes}

Evaluate:
1. **Discharge Timing**: Was the patient clinically stable at discharge? Was LOS adequate?
2. **Discharge Planning**: Were appropriate follow-up, home services, and medications arranged?
3. **Medication Reconciliation**: Were medication changes appropriate and clearly communicated?
4. **Patient Education**: Was the patient/family educated on warning signs and when to return?
5. **Follow-up Gaps**: Did the patient have timely outpatient follow-up?

Respond with:
{
  "dischargeAdequacy": "Adequate" | "Inadequate" | "Indeterminate",
  "preventabilityScore": <0-100>,
  "gaps": ["<list of identified gaps>"],
  "recommendations": ["<list of improvement recommendations>"]
}`;
}

// -- Recommendation Generation Prompt ----------------------------------------

export function buildReadmissionRecommendationPrompt(
    pair: ReadmissionPair,
    findings: ReadmissionFinding[]
): string {
    const findingsList = findings
        .map(
            (f, i) =>
                `${i + 1}. [${f.severity}] ${f.category}: ${f.description} (Financial impact: $${(f.financialImpact ?? 0).toLocaleString()})`
        )
        .join('\n');

    return `Based on the following readmission review findings for ${pair.indexBeneficiaryName} (${pair.id}), generate a prioritized action plan.

## Readmission Summary
- Index: DRG ${pair.indexDRG} ($${pair.indexBilledAmount.toLocaleString()}) -> Readmit: DRG ${pair.readmitDRG} ($${pair.readmitBilledAmount.toLocaleString()})
- Days Between: ${pair.daysBetween}
- Same Facility: ${pair.sameFacility ? 'Yes' : 'No'}
${pair.hrrpTargetCondition ? `- HRRP Target: ${pair.hrrpTargetCondition}` : ''}

## Review Findings
${findingsList}

Generate:
1. **Payment Action**: Whether to bundle, deny the readmission, or pay separately
2. **Quality Referral**: Whether to refer for quality review or root cause analysis
3. **HRRP Impact**: Assessment of HRRP penalty implications
4. **Provider Outreach**: Recommended communication to the facility
5. **Systemic Patterns**: Whether this case suggests broader patterns requiring investigation`;
}
