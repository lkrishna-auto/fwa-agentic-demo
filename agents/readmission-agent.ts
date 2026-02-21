/**
 * Readmission Review Agent
 *
 * Orchestrates clinical rules, evaluates readmission pairs, and returns
 * structured review results. The AgentBackend interface is the seam for
 * swapping in an LLM (Claude) without changing any other code.
 */

import {
    ReadmissionPair,
    ReadmissionFinding,
    ReadmissionReviewStatus,
} from '../src/types';
import { runAllReadmissionRules } from './readmission-rules';
import {
    buildReadmissionReviewPrompt,
    ReadmissionPromptContext,
} from './readmission-prompts';

// -- Agent Backend Interface (LLM Seam) --------------------------------------

export interface ReadmissionBackendResult {
    reviewStatus: ReadmissionReviewStatus;
    clinicalRelatedness: 'Definitely Related' | 'Likely Related' | 'Possibly Related' | 'Not Related';
    preventabilityScore: number;
    confidence: number;
    bundleSavings: number;
    hrrpPenaltyRisk: number;
    findings: ReadmissionFinding[];
    summary: string;
}

export interface ReadmissionAgentBackend {
    evaluate(
        prompt: string,
        context: ReadmissionPromptContext
    ): Promise<ReadmissionBackendResult>;
}

// -- Rule-Based Backend (default) --------------------------------------------

export class RuleBasedReadmissionBackend implements ReadmissionAgentBackend {
    async evaluate(
        _prompt: string,
        context: ReadmissionPromptContext
    ): Promise<ReadmissionBackendResult> {
        const { pair } = context;
        const findings = runAllReadmissionRules(pair);

        // Determine clinical relatedness
        const clinicalRelatedness = this.assessRelatedness(pair, findings);

        // Determine review status
        const reviewStatus = this.determineStatus(pair, findings, clinicalRelatedness);

        // Calculate preventability
        const preventabilityScore = this.calculatePreventability(pair, findings);

        // Calculate bundle savings
        const bundleSavings = this.calculateBundleSavings(pair, reviewStatus);

        // Calculate HRRP penalty risk
        const hrrpPenaltyRisk = this.calculateHRRPRisk(pair, findings);

        // Confidence
        const confidence =
            findings.length === 0
                ? 90
                : Math.max(55, 88 - findings.length * 6);

        // Summary
        const summary = this.buildSummary(
            pair,
            findings,
            reviewStatus,
            clinicalRelatedness,
            preventabilityScore,
            bundleSavings
        );

        return {
            reviewStatus,
            clinicalRelatedness,
            preventabilityScore,
            confidence,
            bundleSavings,
            hrrpPenaltyRisk,
            findings,
            summary,
        };
    }

    private assessRelatedness(
        pair: ReadmissionPair,
        findings: ReadmissionFinding[]
    ): 'Definitely Related' | 'Likely Related' | 'Possibly Related' | 'Not Related' {
        if (pair.isPlannedReadmission && !this.hasComplicationFindings(findings)) {
            return 'Not Related';
        }

        const crFindings = findings.filter((f) => f.category === 'CLINICAL_RELATEDNESS');
        const hasCritical = crFindings.some((f) => f.severity === 'Critical');
        const hasHigh = crFindings.some((f) => f.severity === 'High');

        // Same principal dx + rapid return = definitely related
        const idxDx = pair.indexPrimaryDiagnosis.code.substring(0, 3);
        const rdmDx = pair.readmitPrimaryDiagnosis.code.substring(0, 3);
        const sameDxCategory = idxDx === rdmDx;

        if (hasCritical || (sameDxCategory && pair.daysBetween <= 3)) {
            return 'Definitely Related';
        }
        if (hasHigh || (sameDxCategory && pair.daysBetween <= 14)) {
            return 'Likely Related';
        }
        if (crFindings.length > 0 || pair.daysBetween <= 7) {
            return 'Possibly Related';
        }

        return 'Not Related';
    }

    private hasComplicationFindings(findings: ReadmissionFinding[]): boolean {
        return findings.some(
            (f) => f.ruleId === 'RULE-RA-CR-002' || f.ruleId === 'RULE-RA-QC-002'
        );
    }

    private determineStatus(
        pair: ReadmissionPair,
        findings: ReadmissionFinding[],
        relatedness: string
    ): ReadmissionReviewStatus {
        // Planned readmissions
        if (pair.isPlannedReadmission && !this.hasComplicationFindings(findings)) {
            return 'Planned';
        }

        // Bundle candidates: same-day transfer, or rapid + identical DRG
        const hasBundling = findings.some((f) => f.category === 'DRG_BUNDLING');
        const hasTiming = findings.some(
            (f) => f.category === 'TIMING_PATTERN' && f.severity === 'Critical'
        );
        if (hasBundling || hasTiming) {
            return 'Bundle Candidate';
        }

        // Potentially preventable: discharge adequacy issues or quality concerns
        const hasDischargeIssues = findings.some((f) => f.category === 'DISCHARGE_ADEQUACY');
        const hasQualityConcerns = findings.some((f) => f.category === 'QUALITY_CONCERN');
        if (hasDischargeIssues || hasQualityConcerns) {
            return 'Potentially Preventable';
        }

        // Clinically related
        if (relatedness === 'Definitely Related' || relatedness === 'Likely Related') {
            return 'Clinically Related';
        }

        // No significant findings
        if (findings.length === 0 || relatedness === 'Not Related') {
            return 'Not Related';
        }

        return 'Clinically Related';
    }

    private calculatePreventability(
        pair: ReadmissionPair,
        findings: ReadmissionFinding[]
    ): number {
        if (pair.isPlannedReadmission) return 0;

        let score = 10; // baseline

        // Rapid readmission
        if (pair.daysBetween <= 3) score += 25;
        else if (pair.daysBetween <= 7) score += 15;
        else if (pair.daysBetween <= 14) score += 10;

        // Same diagnosis
        const idxDx = pair.indexPrimaryDiagnosis.code.substring(0, 3);
        const rdmDx = pair.readmitPrimaryDiagnosis.code.substring(0, 3);
        if (idxDx === rdmDx) score += 20;

        // Discharge issues
        const daFindings = findings.filter((f) => f.category === 'DISCHARGE_ADEQUACY');
        score += daFindings.length * 15;

        // Quality concerns
        const qcFindings = findings.filter((f) => f.category === 'QUALITY_CONCERN');
        score += qcFindings.length * 10;

        // AMA discharge
        if (pair.indexDischargeStatus === 'AMA') score += 15;

        return Math.min(100, score);
    }

    private calculateBundleSavings(
        pair: ReadmissionPair,
        status: ReadmissionReviewStatus
    ): number {
        if (status === 'Bundle Candidate') {
            return pair.readmitBilledAmount;
        }
        if (status === 'Potentially Preventable') {
            return Math.round(pair.readmitBilledAmount * 0.5);
        }
        return 0;
    }

    private calculateHRRPRisk(
        pair: ReadmissionPair,
        findings: ReadmissionFinding[]
    ): number {
        if (!pair.hrrpTargetCondition) return 0;
        if (pair.isPlannedReadmission) return 5;
        if (pair.daysBetween > 30) return 0;

        let risk = 30; // baseline for any HRRP target readmission

        // Same diagnosis increases risk
        const idxDx = pair.indexPrimaryDiagnosis.code.substring(0, 3);
        const rdmDx = pair.readmitPrimaryDiagnosis.code.substring(0, 3);
        if (idxDx === rdmDx) risk += 25;

        // Rapid return
        if (pair.daysBetween <= 7) risk += 20;
        else if (pair.daysBetween <= 14) risk += 10;

        // Quality findings
        const criticalCount = findings.filter((f) => f.severity === 'Critical').length;
        risk += criticalCount * 10;

        return Math.min(100, risk);
    }

    private buildSummary(
        pair: ReadmissionPair,
        findings: ReadmissionFinding[],
        status: ReadmissionReviewStatus,
        relatedness: string,
        preventability: number,
        bundleSavings: number
    ): string {
        if (status === 'Planned') {
            return `Planned readmission for ${pair.readmitPrimaryDiagnosis.description}. Documented in index discharge plan. No adverse findings — separate payment appropriate.`;
        }

        if (status === 'Not Related' && findings.length === 0) {
            return `Readmission for ${pair.readmitPrimaryDiagnosis.description} appears clinically unrelated to the index admission for ${pair.indexPrimaryDiagnosis.description}. Different diagnosis, appropriate timing. Separate payment appropriate.`;
        }

        const criticalCount = findings.filter((f) => f.severity === 'Critical').length;

        if (status === 'Bundle Candidate') {
            return `${findings.length} finding${findings.length > 1 ? 's' : ''} identified${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}. Readmission ${pair.daysBetween} days after discharge is a strong bundle candidate. Estimated savings if bundled: $${bundleSavings.toLocaleString()}. Clinical relatedness: ${relatedness}.`;
        }

        if (status === 'Potentially Preventable') {
            return `${findings.length} finding${findings.length > 1 ? 's' : ''} identified. Readmission was potentially preventable (preventability score: ${preventability}%). ${pair.hrrpTargetCondition ? `HRRP target condition: ${pair.hrrpTargetCondition}.` : ''} Clinical relatedness: ${relatedness}.`;
        }

        return `${findings.length} finding${findings.length > 1 ? 's' : ''} identified. Clinical relatedness: ${relatedness}. Preventability: ${preventability}%.${pair.hrrpTargetCondition ? ` HRRP target: ${pair.hrrpTargetCondition}.` : ''}`;
    }
}

// -- Future LLM Backend ------------------------------------------------------
//
// import Anthropic from '@anthropic-ai/sdk';
//
// export class ClaudeBackend implements ReadmissionAgentBackend {
//     private client: Anthropic;
//     constructor() { this.client = new Anthropic(); }
//
//     async evaluate(prompt: string, _ctx: ReadmissionPromptContext): Promise<ReadmissionBackendResult> {
//         const response = await this.client.messages.create({
//             model: 'claude-sonnet-4-5-20250929',
//             max_tokens: 3000,
//             messages: [{ role: 'user', content: prompt }],
//         });
//         return JSON.parse(response.content[0].type === 'text' ? response.content[0].text : '{}');
//     }
// }

// -- Agent Orchestrator ------------------------------------------------------

export interface ReadmissionReviewResult {
    pairId: string;
    processedAt: string;
    reviewStatus: ReadmissionReviewStatus;
    clinicalRelatedness: 'Definitely Related' | 'Likely Related' | 'Possibly Related' | 'Not Related';
    preventabilityScore: number;
    readmissionFindings: ReadmissionFinding[];
    agentSummary: string;
    agentConfidence: number;
    bundleSavings: number;
    hrrpPenaltyRisk: number;
    riskScore: number;
}

export class ReadmissionAgent {
    private backend: ReadmissionAgentBackend;

    constructor(backend?: ReadmissionAgentBackend) {
        this.backend = backend ?? new RuleBasedReadmissionBackend();
    }

    async reviewPair(pair: ReadmissionPair): Promise<ReadmissionReviewResult> {
        const context: ReadmissionPromptContext = { pair };

        const prompt = buildReadmissionReviewPrompt(context);
        const result = await this.backend.evaluate(prompt, context);

        // Compute risk score from findings + preventability
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
            Math.round(findingsScore * 0.3 + result.preventabilityScore * 0.4 + result.hrrpPenaltyRisk * 0.3)
        );

        return {
            pairId: pair.id,
            processedAt: new Date().toISOString(),
            reviewStatus: result.reviewStatus,
            clinicalRelatedness: result.clinicalRelatedness,
            preventabilityScore: result.preventabilityScore,
            readmissionFindings: result.findings,
            agentSummary: result.summary,
            agentConfidence: result.confidence,
            bundleSavings: result.bundleSavings,
            hrrpPenaltyRisk: result.hrrpPenaltyRisk,
            riskScore,
        };
    }

    async reviewBatch(pairs: ReadmissionPair[]): Promise<ReadmissionReviewResult[]> {
        const results: ReadmissionReviewResult[] = [];
        for (const pair of pairs) {
            await new Promise((r) => setTimeout(r, 200));
            results.push(await this.reviewPair(pair));
        }
        return results;
    }
}
