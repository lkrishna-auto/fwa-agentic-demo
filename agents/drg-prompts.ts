/**
 * DRG Clinical Validation Agent - Prompt Templates
 *
 * Pure functions that build prompts for LLM-based DRG validation.
 * Currently consumed by the rule-based backend (which ignores them)
 * but structured for drop-in LLM integration.
 */

import { DRGClaim, DRGValidationFinding } from '../src/types';

export interface DRGPromptContext {
    claim: DRGClaim;
    hospitalBaseRate: number;
    msDRGWeightTable: Record<string, { weight: number; description: string }>;
}

// ── Main DRG Validation Prompt ───────────────────────────────────────

export function buildDRGValidationPrompt(ctx: DRGPromptContext): string {
    const { claim } = ctx;

    const secondaryDxList = claim.secondaryDiagnoses
        .map(
            (d) =>
                `- ${d.code}: ${d.description}${d.isMCC ? ' [MCC]' : d.isCC ? ' [CC]' : ''}`
        )
        .join('\n');

    return `You are a certified clinical documentation integrity (CDI) specialist and DRG validation expert with deep knowledge of ICD-10-CM/PCS coding guidelines, MS-DRG grouper logic, and CMS reimbursement rules.

Review the following inpatient claim and determine whether the MS-DRG assignment is clinically supported by the documentation.

## Patient Record
- Patient: ${claim.beneficiaryName} (${claim.beneficiaryId})
- Admission: ${claim.admissionDate} → Discharge: ${claim.dischargeDate}
- Length of Stay: ${claim.lengthOfStay} days
- Admission Type: ${claim.admissionType}
- Discharge Status: ${claim.dischargeStatus}
- Attending: ${claim.attendingPhysicianName} (${claim.attendingSpecialty})

## Assigned DRG
- DRG ${claim.assignedDRG}: ${claim.assignedDRGDescription}
- DRG Weight: ${claim.assignedDRGWeight}
- Billed Amount: $${claim.billedAmount.toLocaleString()}

## Principal Diagnosis
- ${claim.primaryDiagnosis.code}: ${claim.primaryDiagnosis.description}${claim.primaryDiagnosis.isMCC ? ' [MCC]' : claim.primaryDiagnosis.isCC ? ' [CC]' : ''}

## Secondary Diagnoses
${secondaryDxList}

${claim.principalProcedure ? `## Principal Procedure\n- ${claim.principalProcedure}\n` : ''}
## Clinical Notes
${claim.clinicalNotes}

## Validation Tasks
1. **Principal Diagnosis Sequencing**: Is the principal diagnosis sequenced correctly per UHDDS guidelines? Should a different diagnosis be principal?
2. **DRG Assignment**: Does the assigned DRG accurately reflect the principal diagnosis and procedures performed?
3. **MCC/CC Validation**: Are all coded MCC and CC diagnoses clinically supported by the documentation? Are there clinical indicators (lab values, vital signs, treatments) that substantiate each complication/comorbidity?
4. **Missing Diagnoses**: Are there conditions documented in the clinical notes that should be coded but are missing? Would adding them change the DRG?
5. **Upcoding/Downcoding Assessment**: Is there evidence that the DRG is coded to a higher severity than documented (upcoding) or lower severity than documented (downcoding)?

Respond with a JSON object:
{
  "validationStatus": "Validated" | "Queried" | "Upcoded" | "Downcoded",
  "expectedDRG": "<drg_code>",
  "expectedDRGDescription": "<description>",
  "expectedDRGWeight": <number>,
  "confidence": <0-100>,
  "findings": [
    {
      "ruleId": "<identifier>",
      "category": "DRG_ASSIGNMENT" | "CC_MCC_VALIDATION" | "CLINICAL_CRITERIA" | "CODING_SEQUENCE" | "UPCODING" | "DOWNCODING",
      "severity": "Critical" | "High" | "Medium" | "Low",
      "description": "<what was found>",
      "recommendation": "<what should be done>",
      "financialImpact": <positive_if_underbilled_negative_if_overbilled>
    }
  ],
  "summary": "<2-3 sentence plain English summary>"
}`;
}

// ── CC/MCC Focused Validation Prompt ─────────────────────────────────

export function buildCCMCCValidationPrompt(ctx: DRGPromptContext): string {
    const { claim } = ctx;

    const dxWithFlags = [claim.primaryDiagnosis, ...claim.secondaryDiagnoses]
        .filter((d) => d.isMCC || d.isCC)
        .map(
            (d) =>
                `- ${d.code}: ${d.description} → ${d.isMCC ? 'MCC' : 'CC'}`
        )
        .join('\n');

    return `You are a clinical coding auditor specializing in CC (Complication/Comorbidity) and MCC (Major Complication/Comorbidity) validation for MS-DRG assignment.

For each CC/MCC diagnosis listed below, determine whether the clinical documentation supports its inclusion. A CC/MCC must meet ALL of the following:
1. The condition is clearly documented by the attending physician
2. Clinical indicators (labs, vitals, imaging, treatments) corroborate the diagnosis
3. The condition required clinical evaluation, monitoring, or treatment during the encounter
4. The condition is not an integral part of the principal diagnosis

## Patient: ${claim.beneficiaryName}
## Assigned DRG: ${claim.assignedDRG} - ${claim.assignedDRGDescription}

## CC/MCC Codes to Validate
${dxWithFlags || 'No CC/MCC codes assigned'}

## Clinical Notes
${claim.clinicalNotes}

For each CC/MCC code, respond with:
{
  "code": "<ICD-10 code>",
  "supported": true | false,
  "clinicalEvidence": "<specific documentation that supports or contradicts>",
  "recommendation": "<keep, remove, or query physician>"
}`;
}

// ── Clinical Criteria Check Prompt ───────────────────────────────────

export function buildClinicalCriteriaPrompt(ctx: DRGPromptContext): string {
    const { claim } = ctx;

    return `You are a physician advisor reviewing clinical criteria for coded diagnoses. Your role is to determine whether each coded diagnosis meets its clinical definition based on the documentation.

## Patient: ${claim.beneficiaryName}
## Admission: ${claim.admissionDate} → ${claim.dischargeDate}

## All Coded Diagnoses
- Principal: ${claim.primaryDiagnosis.code} - ${claim.primaryDiagnosis.description}
${claim.secondaryDiagnoses.map((d) => `- Secondary: ${d.code} - ${d.description}`).join('\n')}

## Clinical Notes
${claim.clinicalNotes}

For each diagnosis, evaluate:
1. Does the documentation meet the clinical definition for this diagnosis?
2. Are the required clinical criteria present (e.g., for sepsis: documented infection + SIRS criteria + organ dysfunction)?
3. Could a more specific or accurate code be used?
4. Are there documented conditions NOT yet coded that meet clinical criteria?

Focus especially on high-value diagnoses: sepsis/severe sepsis/septic shock, respiratory failure, acute kidney injury staging, heart failure classification, and any MCC-qualifying conditions.

Respond with a structured assessment for each diagnosis.`;
}

// ── Recommendation Generation Prompt ─────────────────────────────────

export function buildRecommendationPrompt(
    claim: DRGClaim,
    findings: DRGValidationFinding[]
): string {
    const findingsList = findings
        .map(
            (f, i) =>
                `${i + 1}. [${f.severity}] ${f.category}: ${f.description} (Financial impact: $${(f.financialImpact ?? 0).toLocaleString()})`
        )
        .join('\n');

    return `Based on the following DRG validation findings for ${claim.beneficiaryName} (${claim.id}), generate a prioritized action plan for the Clinical Documentation Improvement (CDI) team.

## Current Assignment
- DRG ${claim.assignedDRG}: ${claim.assignedDRGDescription}
- Billed: $${claim.billedAmount.toLocaleString()}

## Validation Findings
${findingsList}

Generate:
1. **Priority Actions**: Ordered list of what the CDI specialist should do first
2. **Physician Query Templates**: Draft query language for any items requiring physician clarification
3. **Expected DRG Impact**: What the DRG should change to and the financial variance
4. **Timeline**: Recommended timeline for resolution (urgent = within 24hrs, standard = within 5 business days)
5. **Documentation Tips**: Specific documentation improvements to prevent recurrence`;
}
