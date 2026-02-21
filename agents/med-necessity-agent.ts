/**
 * Medical Necessity Review Agent
 *
 * Orchestrates clinical rules, evaluates medical necessity criteria, and returns
 * structured review results. The AgentBackend interface is the seam for
 * swapping in an LLM (Claude) without changing any other code.
 */

import {
    MedNecessityClaim,
    MedNecessityFinding,
    MedNecessityStatus,
    MedNecessityCriteria,
    RecommendedLevelOfCare,
} from '../src/types';
import { runAllMedNecessityRules } from './med-necessity-rules';
import {
    buildMedNecessityReviewPrompt,
    MedNecessityPromptContext,
} from './med-necessity-prompts';

// -- Agent Backend Interface (LLM Seam) --------------------------------------

export interface MedNecessityBackendResult {
    medNecessityStatus: MedNecessityStatus;
    recommendedLevelOfCare: RecommendedLevelOfCare;
    criteriaAssessment: MedNecessityCriteria;
    confidence: number;
    denialRisk: number;
    estimatedDenialAmount: number;
    findings: MedNecessityFinding[];
    summary: string;
}

export interface MedNecessityAgentBackend {
    evaluate(
        prompt: string,
        context: MedNecessityPromptContext
    ): Promise<MedNecessityBackendResult>;
}

// -- Helper: Parse vitals for scoring ----------------------------------------

function parseBP(bp: string): { systolic: number; diastolic: number } | null {
    const match = bp.match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) return null;
    return { systolic: parseInt(match[1]), diastolic: parseInt(match[2]) };
}

// -- Rule-Based Backend (default) --------------------------------------------

export class RuleBasedMedNecessityBackend implements MedNecessityAgentBackend {
    async evaluate(
        _prompt: string,
        context: MedNecessityPromptContext
    ): Promise<MedNecessityBackendResult> {
        const { claim } = context;
        const findings = runAllMedNecessityRules(claim);

        // Assess criteria based on clinical indicators
        const criteriaAssessment = this.assessCriteria(claim, findings);

        // Determine status from criteria
        const medNecessityStatus = this.determineStatus(
            criteriaAssessment,
            findings
        );

        // Determine recommended level of care
        const recommendedLevelOfCare = this.recommendLevelOfCare(
            claim,
            criteriaAssessment,
            findings
        );

        // Calculate denial risk
        const denialRisk = this.calculateDenialRisk(
            claim,
            criteriaAssessment,
            findings
        );

        // Estimated denial amount
        const estimatedDenialAmount =
            medNecessityStatus === 'Does Not Meet'
                ? claim.billedAmount
                : medNecessityStatus === 'Observation'
                  ? Math.round(claim.billedAmount * 0.5)
                  : 0;

        // Confidence
        const confidence =
            findings.length === 0
                ? 92
                : Math.max(55, 88 - findings.length * 8);

        // Summary
        const summary = this.buildSummary(
            claim,
            findings,
            medNecessityStatus,
            recommendedLevelOfCare,
            denialRisk
        );

        return {
            medNecessityStatus,
            recommendedLevelOfCare,
            criteriaAssessment,
            confidence,
            denialRisk,
            estimatedDenialAmount,
            findings,
            summary,
        };
    }

    private assessCriteria(
        claim: MedNecessityClaim,
        findings: MedNecessityFinding[]
    ): MedNecessityCriteria {
        const v = claim.admissionVitals;
        const bp = parseBP(v.bloodPressure);

        // Severity of Illness
        const vitalInstability =
            (bp && (bp.systolic < 90 || bp.diastolic < 60)) ||
            v.heartRate > 110 ||
            v.temperature > 101.0 ||
            v.respiratoryRate > 22 ||
            v.o2Saturation < 92;

        const abnormalLabs = claim.admissionLabValues.filter(
            (l) => l.abnormal
        ).length;
        const siFindings = findings.filter(
            (f) => f.category === 'SEVERITY_OF_ILLNESS'
        );

        let severityOfIllness: 'Met' | 'Not Met' | 'Partially Met';
        if (vitalInstability && abnormalLabs >= 2) {
            severityOfIllness = 'Met';
        } else if (siFindings.length > 0) {
            severityOfIllness = 'Not Met';
        } else if (vitalInstability || abnormalLabs >= 2) {
            severityOfIllness = 'Partially Met';
        } else {
            severityOfIllness = 'Not Met';
        }

        // Intensity of Service
        const highIntensity =
            claim.icuAdmission ||
            claim.surgicalProcedure ||
            (claim.ivMedicationsRequired && claim.telemetryRequired);
        const moderateIntensity =
            claim.ivMedicationsRequired ||
            claim.oxygenRequired ||
            claim.telemetryRequired ||
            claim.isolationRequired;
        const isFindings = findings.filter(
            (f) => f.category === 'INTENSITY_OF_SERVICE'
        );

        let intensityOfService: 'Met' | 'Not Met' | 'Partially Met';
        if (highIntensity) {
            intensityOfService = 'Met';
        } else if (isFindings.length > 0) {
            intensityOfService = 'Not Met';
        } else if (moderateIntensity) {
            intensityOfService = 'Partially Met';
        } else {
            intensityOfService = 'Not Met';
        }

        // Admission Criteria
        const acFindings = findings.filter(
            (f) => f.category === 'ADMISSION_CRITERIA'
        );
        let admissionCriteria: 'Met' | 'Not Met' | 'Partially Met';
        if (acFindings.length > 0) {
            admissionCriteria = 'Not Met';
        } else if (
            severityOfIllness === 'Met' &&
            intensityOfService === 'Met'
        ) {
            admissionCriteria = 'Met';
        } else if (
            severityOfIllness === 'Not Met' &&
            intensityOfService === 'Not Met'
        ) {
            admissionCriteria = 'Not Met';
        } else {
            admissionCriteria = 'Partially Met';
        }

        // Continued Stay
        const csFindings = findings.filter(
            (f) => f.category === 'CONTINUED_STAY'
        );
        let continuedStay: 'Justified' | 'Not Justified' | 'Indeterminate';
        if (csFindings.length > 0) {
            continuedStay = 'Not Justified';
        } else if (claim.lengthOfStay <= 3) {
            continuedStay = 'Justified';
        } else if (claim.icuAdmission || claim.surgicalProcedure) {
            continuedStay = 'Justified';
        } else {
            continuedStay = 'Indeterminate';
        }

        return {
            severityOfIllness,
            intensityOfService,
            admissionCriteria,
            continuedStay,
        };
    }

    private determineStatus(
        criteria: MedNecessityCriteria,
        findings: MedNecessityFinding[]
    ): MedNecessityStatus {
        const hasCriticalFindings = findings.some(
            (f) => f.severity === 'Critical'
        );

        if (
            criteria.severityOfIllness === 'Met' &&
            criteria.intensityOfService === 'Met' &&
            criteria.admissionCriteria === 'Met'
        ) {
            return 'Meets Criteria';
        }

        if (
            criteria.severityOfIllness === 'Not Met' &&
            criteria.intensityOfService === 'Not Met' &&
            hasCriticalFindings
        ) {
            return 'Does Not Meet';
        }

        if (
            criteria.admissionCriteria === 'Not Met' &&
            hasCriticalFindings
        ) {
            return 'Does Not Meet';
        }

        // Borderline cases may be observation-appropriate
        const locFindings = findings.filter(
            (f) => f.category === 'LEVEL_OF_CARE'
        );
        if (locFindings.length > 0) {
            return 'Observation';
        }

        if (findings.length > 0) {
            return 'Queried';
        }

        return 'Meets Criteria';
    }

    private recommendLevelOfCare(
        claim: MedNecessityClaim,
        criteria: MedNecessityCriteria,
        findings: MedNecessityFinding[]
    ): RecommendedLevelOfCare {
        if (
            criteria.severityOfIllness === 'Met' &&
            criteria.intensityOfService === 'Met'
        ) {
            return 'Inpatient';
        }

        if (
            criteria.severityOfIllness === 'Not Met' &&
            criteria.intensityOfService === 'Not Met'
        ) {
            const n = claim.clinicalNotes.toLowerCase();
            if (
                n.includes('ambulatory') &&
                n.includes('tolerating') &&
                !claim.icuAdmission
            ) {
                return 'Outpatient';
            }
            return 'Observation';
        }

        // Check for SNF/Home indicators
        if (
            claim.dischargeStatus === 'SNF' ||
            claim.clinicalNotes.toLowerCase().includes('skilled nursing')
        ) {
            return 'Skilled Nursing';
        }

        const locFindings = findings.filter(
            (f) => f.category === 'LEVEL_OF_CARE'
        );
        if (locFindings.length > 0) {
            return 'Observation';
        }

        return 'Inpatient';
    }

    private calculateDenialRisk(
        claim: MedNecessityClaim,
        criteria: MedNecessityCriteria,
        findings: MedNecessityFinding[]
    ): number {
        let risk = 10; // baseline

        // Criteria not met increases risk
        if (criteria.severityOfIllness === 'Not Met') risk += 25;
        else if (criteria.severityOfIllness === 'Partially Met') risk += 10;

        if (criteria.intensityOfService === 'Not Met') risk += 25;
        else if (criteria.intensityOfService === 'Partially Met') risk += 10;

        if (criteria.admissionCriteria === 'Not Met') risk += 20;

        // Critical findings
        const criticalCount = findings.filter(
            (f) => f.severity === 'Critical'
        ).length;
        risk += criticalCount * 15;

        // Documentation gaps
        const docGaps = findings.filter(
            (f) => f.category === 'DOCUMENTATION_GAP'
        ).length;
        risk += docGaps * 10;

        // Short stays with elective admission
        if (claim.admissionType === 'Elective' && claim.lengthOfStay <= 2) {
            risk += 15;
        }

        return Math.min(100, risk);
    }

    private buildSummary(
        claim: MedNecessityClaim,
        findings: MedNecessityFinding[],
        status: MedNecessityStatus,
        levelOfCare: RecommendedLevelOfCare,
        denialRisk: number
    ): string {
        if (findings.length === 0) {
            return `Medical necessity criteria for inpatient admission are met. Patient ${claim.beneficiaryName} presented with clinical severity and service intensity supporting inpatient-level care. No adverse findings identified.`;
        }

        const criticalCount = findings.filter(
            (f) => f.severity === 'Critical'
        ).length;
        const totalImpact = findings.reduce(
            (sum, f) => sum + Math.abs(f.financialImpact ?? 0),
            0
        );

        if (status === 'Does Not Meet') {
            return `Medical necessity criteria for inpatient admission are NOT met. ${findings.length} finding${findings.length > 1 ? 's' : ''} identified${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}. Recommended level of care: ${levelOfCare}. Estimated denial exposure: $${totalImpact.toLocaleString()}. Denial risk: ${denialRisk}%.`;
        }

        if (status === 'Observation') {
            return `Admission may be more appropriate at observation level of care. ${findings.length} finding${findings.length > 1 ? 's' : ''} suggest the patient's condition could be managed without full inpatient admission. Denial risk: ${denialRisk}%.`;
        }

        return `${findings.length} review finding${findings.length > 1 ? 's' : ''} identified requiring clinical clarification. Denial risk: ${denialRisk}%. Physician advisor review recommended for medical necessity determination.`;
    }
}

// -- Future LLM Backend ------------------------------------------------------
//
// import Anthropic from '@anthropic-ai/sdk';
//
// export class ClaudeBackend implements MedNecessityAgentBackend {
//     private client: Anthropic;
//     constructor() { this.client = new Anthropic(); }
//
//     async evaluate(prompt: string, _ctx: MedNecessityPromptContext): Promise<MedNecessityBackendResult> {
//         const response = await this.client.messages.create({
//             model: 'claude-sonnet-4-5-20250929',
//             max_tokens: 3000,
//             messages: [{ role: 'user', content: prompt }],
//         });
//         return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
//     }
// }

// -- Agent Orchestrator ------------------------------------------------------

export interface MedNecessityReviewResult {
    claimId: string;
    processedAt: string;
    medNecessityStatus: MedNecessityStatus;
    recommendedLevelOfCare: RecommendedLevelOfCare;
    criteriaAssessment: MedNecessityCriteria;
    medNecessityFindings: MedNecessityFinding[];
    agentSummary: string;
    agentConfidence: number;
    denialRisk: number;
    estimatedDenialAmount: number;
    riskScore: number;
}

export class MedNecessityAgent {
    private backend: MedNecessityAgentBackend;

    constructor(backend?: MedNecessityAgentBackend) {
        this.backend = backend ?? new RuleBasedMedNecessityBackend();
    }

    async reviewClaim(
        claim: MedNecessityClaim
    ): Promise<MedNecessityReviewResult> {
        const context: MedNecessityPromptContext = { claim };

        const prompt = buildMedNecessityReviewPrompt(context);
        const result = await this.backend.evaluate(prompt, context);

        // Compute risk score from findings + denial risk
        const severityPoints: Record<string, number> = {
            Critical: 25,
            High: 15,
            Medium: 8,
            Low: 3,
        };
        const findingsScore = result.findings.reduce(
            (sum, f) => sum + (severityPoints[f.severity] ?? 0),
            0
        );
        const riskScore = Math.min(
            100,
            Math.round(findingsScore * 0.4 + result.denialRisk * 0.6)
        );

        return {
            claimId: claim.id,
            processedAt: new Date().toISOString(),
            medNecessityStatus: result.medNecessityStatus,
            recommendedLevelOfCare: result.recommendedLevelOfCare,
            criteriaAssessment: result.criteriaAssessment,
            medNecessityFindings: result.findings,
            agentSummary: result.summary,
            agentConfidence: result.confidence,
            denialRisk: result.denialRisk,
            estimatedDenialAmount: result.estimatedDenialAmount,
            riskScore,
        };
    }

    async reviewBatch(
        claims: MedNecessityClaim[]
    ): Promise<MedNecessityReviewResult[]> {
        const results: MedNecessityReviewResult[] = [];
        for (const claim of claims) {
            await new Promise((r) => setTimeout(r, 200));
            results.push(await this.reviewClaim(claim));
        }
        return results;
    }
}
