/**
 * Medical Necessity Review Agent - Prompt Templates
 *
 * Pure functions that build prompts for LLM-based medical necessity validation.
 * Currently consumed by the rule-based backend (which ignores them)
 * but structured for drop-in LLM integration.
 */

import { MedNecessityClaim, MedNecessityFinding } from '../src/types';

export interface MedNecessityPromptContext {
    claim: MedNecessityClaim;
}

// -- Main Medical Necessity Review Prompt ------------------------------------

export function buildMedNecessityReviewPrompt(ctx: MedNecessityPromptContext): string {
    const { claim } = ctx;

    const secondaryDxList = claim.secondaryDiagnoses
        .map(
            (d) =>
                `- ${d.code}: ${d.description}${d.isMCC ? ' [MCC]' : d.isCC ? ' [CC]' : ''}`
        )
        .join('\n');

    const labsList = claim.admissionLabValues
        .map(
            (l) =>
                `- ${l.name}: ${l.value} ${l.unit}${l.abnormal ? ' [ABNORMAL]' : ''}`
        )
        .join('\n');

    const vitals = claim.admissionVitals;

    return `You are a certified utilization review nurse and physician advisor with expertise in InterQual, MCG, and Milliman medical necessity criteria. You specialize in evaluating whether inpatient admissions meet medical necessity requirements for acute care hospitalization.

Review the following inpatient admission and determine whether it meets medical necessity criteria for inpatient level of care.

## Patient Record
- Patient: ${claim.beneficiaryName} (${claim.beneficiaryId})
- Admission: ${claim.admissionDate} -> Discharge: ${claim.dischargeDate}
- Length of Stay: ${claim.lengthOfStay} days
- Admission Type: ${claim.admissionType}
- Discharge Status: ${claim.dischargeStatus}
- Attending: ${claim.attendingPhysicianName} (${claim.attendingSpecialty})

## DRG / Billing
- DRG ${claim.assignedDRG}: ${claim.assignedDRGDescription}
- Billed Amount: $${claim.billedAmount.toLocaleString()}

## Principal Diagnosis
- ${claim.primaryDiagnosis.code}: ${claim.primaryDiagnosis.description}

## Secondary Diagnoses
${secondaryDxList}

${claim.principalProcedure ? `## Principal Procedure\n- ${claim.principalProcedure}\n` : ''}
## Admission Vitals
- Blood Pressure: ${vitals.bloodPressure}
- Heart Rate: ${vitals.heartRate} bpm
- Temperature: ${vitals.temperature} F
- Respiratory Rate: ${vitals.respiratoryRate} /min
- O2 Saturation: ${vitals.o2Saturation}%

## Admission Lab Values
${labsList}

## Treatments Provided
${claim.treatmentsProvided.map((t) => `- ${t}`).join('\n')}

## Resource Utilization Indicators
- IV Medications Required: ${claim.ivMedicationsRequired ? 'Yes' : 'No'}
- ICU Admission: ${claim.icuAdmission ? 'Yes' : 'No'}
- Surgical Procedure: ${claim.surgicalProcedure ? 'Yes' : 'No'}
- Telemetry Required: ${claim.telemetryRequired ? 'Yes' : 'No'}
- Supplemental Oxygen: ${claim.oxygenRequired ? 'Yes' : 'No'}
- Isolation Required: ${claim.isolationRequired ? 'Yes' : 'No'}

## Clinical Notes
${claim.clinicalNotes}

## Review Criteria
Evaluate the following medical necessity dimensions:

1. **Severity of Illness (SI)**: Does the patient's condition demonstrate acute severity requiring inpatient-level monitoring and intervention? Consider vital sign abnormalities, lab derangements, and clinical acuity.

2. **Intensity of Service (IS)**: Do the services provided require hospital-level resources that cannot be delivered in a lower level of care? Consider IV medications, monitoring requirements, nursing intensity, and procedure complexity.

3. **Admission Criteria**: Does the clinical presentation meet recognized admission criteria (InterQual/MCG)? Could the patient have been safely managed as observation or outpatient?

4. **Level of Care**: What is the appropriate level of care? (Inpatient, Observation, Outpatient, SNF, Home)

5. **Continued Stay Justification**: If length of stay exceeds expected, is the extended stay clinically justified?

6. **Documentation Gaps**: Are there any missing elements that would strengthen or weaken the medical necessity determination?

Respond with a JSON object:
{
  "medNecessityStatus": "Meets Criteria" | "Does Not Meet" | "Observation" | "Queried",
  "recommendedLevelOfCare": "Inpatient" | "Observation" | "Outpatient" | "Skilled Nursing" | "Home",
  "criteriaAssessment": {
    "severityOfIllness": "Met" | "Not Met" | "Partially Met",
    "intensityOfService": "Met" | "Not Met" | "Partially Met",
    "admissionCriteria": "Met" | "Not Met" | "Partially Met",
    "continuedStay": "Justified" | "Not Justified" | "Indeterminate"
  },
  "confidence": <0-100>,
  "denialRisk": <0-100>,
  "estimatedDenialAmount": <number>,
  "findings": [
    {
      "ruleId": "<identifier>",
      "category": "SEVERITY_OF_ILLNESS" | "INTENSITY_OF_SERVICE" | "ADMISSION_CRITERIA" | "LEVEL_OF_CARE" | "CONTINUED_STAY" | "DOCUMENTATION_GAP",
      "severity": "Critical" | "High" | "Medium" | "Low",
      "description": "<what was found>",
      "recommendation": "<what should be done>",
      "financialImpact": <estimated_denial_amount_if_applicable>
    }
  ],
  "summary": "<2-3 sentence plain English summary>"
}`;
}

// -- Severity of Illness Focused Prompt --------------------------------------

export function buildSeverityOfIllnessPrompt(ctx: MedNecessityPromptContext): string {
    const { claim } = ctx;
    const vitals = claim.admissionVitals;

    const labsList = claim.admissionLabValues
        .filter((l) => l.abnormal)
        .map((l) => `- ${l.name}: ${l.value} ${l.unit}`)
        .join('\n');

    return `You are a physician advisor specializing in severity of illness assessment for inpatient medical necessity determinations.

Evaluate whether this patient's clinical presentation demonstrates acute severity of illness requiring inpatient-level care. Apply InterQual criteria for SI assessment.

## Patient: ${claim.beneficiaryName}
## Principal Diagnosis: ${claim.primaryDiagnosis.code} - ${claim.primaryDiagnosis.description}
## Admission Type: ${claim.admissionType}

## Admission Vitals
- BP: ${vitals.bloodPressure}, HR: ${vitals.heartRate}, Temp: ${vitals.temperature}F
- RR: ${vitals.respiratoryRate}, O2 Sat: ${vitals.o2Saturation}%

## Abnormal Lab Values
${labsList || 'No abnormal labs'}

## Clinical Notes
${claim.clinicalNotes}

Assess each SI criterion:
1. **Vital Sign Instability**: Are vitals outside normal parameters indicating acute illness?
2. **Laboratory Derangements**: Do lab values indicate organ dysfunction or acute process?
3. **Clinical Acuity**: Does the overall presentation require continuous monitoring?
4. **Risk of Deterioration**: Without inpatient care, what is the risk of clinical decline?

Respond with:
{
  "severityOfIllness": "Met" | "Not Met" | "Partially Met",
  "justification": "<specific clinical indicators supporting determination>",
  "criticalFindings": ["<list of specific findings>"],
  "riskLevel": "High" | "Moderate" | "Low"
}`;
}

// -- Intensity of Service Prompt ---------------------------------------------

export function buildIntensityOfServicePrompt(ctx: MedNecessityPromptContext): string {
    const { claim } = ctx;

    return `You are a utilization review specialist assessing intensity of service for medical necessity determination.

Evaluate whether the services provided to this patient require hospital-level resources that could not be delivered at a lower level of care.

## Patient: ${claim.beneficiaryName}
## Principal Diagnosis: ${claim.primaryDiagnosis.code} - ${claim.primaryDiagnosis.description}
## Length of Stay: ${claim.lengthOfStay} days

## Treatments & Services Provided
${claim.treatmentsProvided.map((t) => `- ${t}`).join('\n')}

## Resource Utilization
- IV Medications: ${claim.ivMedicationsRequired ? 'Yes' : 'No'}
- ICU Level Care: ${claim.icuAdmission ? 'Yes' : 'No'}
- Surgical Procedure: ${claim.surgicalProcedure ? 'Yes' : 'No'}
- Cardiac Monitoring/Telemetry: ${claim.telemetryRequired ? 'Yes' : 'No'}
- Supplemental Oxygen: ${claim.oxygenRequired ? 'Yes' : 'No'}
- Isolation Precautions: ${claim.isolationRequired ? 'Yes' : 'No'}

## Clinical Notes
${claim.clinicalNotes}

Evaluate each IS dimension:
1. **Treatment Complexity**: Do treatments require hospital-level administration/monitoring?
2. **Monitoring Requirements**: Does the patient need continuous or frequent monitoring?
3. **Nursing Intensity**: Does nursing care exceed what can be provided at lower levels?
4. **Alternative Settings**: Could these services be safely delivered as observation, outpatient, or at home?

Respond with:
{
  "intensityOfService": "Met" | "Not Met" | "Partially Met",
  "justification": "<specific services requiring inpatient level>",
  "alternativeSettings": ["<viable lower-level settings if any>"],
  "keyServices": ["<services that drive inpatient need>"]
}`;
}

// -- Recommendation Generation Prompt ----------------------------------------

export function buildMedNecessityRecommendationPrompt(
    claim: MedNecessityClaim,
    findings: MedNecessityFinding[]
): string {
    const findingsList = findings
        .map(
            (f, i) =>
                `${i + 1}. [${f.severity}] ${f.category}: ${f.description} (Financial impact: $${(f.financialImpact ?? 0).toLocaleString()})`
        )
        .join('\n');

    return `Based on the following medical necessity review findings for ${claim.beneficiaryName} (${claim.id}), generate a prioritized action plan for the Utilization Review (UR) team.

## Current Assignment
- DRG ${claim.assignedDRG}: ${claim.assignedDRGDescription}
- Billed: $${claim.billedAmount.toLocaleString()}
- Length of Stay: ${claim.lengthOfStay} days
- Admission Type: ${claim.admissionType}

## Review Findings
${findingsList}

Generate:
1. **Priority Actions**: Ordered list of what the UR nurse should do first
2. **Physician Advisor Referral**: Whether this case needs physician advisor review and why
3. **Peer-to-Peer Preparation**: Key clinical points for a peer-to-peer review with the payer
4. **Documentation Improvement**: Specific documentation that would strengthen medical necessity
5. **Appeal Strategy**: If denied, recommended appeal approach and supporting evidence
6. **Level of Care Recommendation**: Whether to maintain inpatient status, convert to observation, or recommend outpatient follow-up`;
}
