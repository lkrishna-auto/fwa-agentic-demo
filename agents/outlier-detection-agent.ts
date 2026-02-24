/**
 * FWA Outlier Detection Agent
 *
 * Orchestrates statistical outlier rules across all providers in the claims
 * dataset and produces a structured detection report.
 *
 * The AgentBackend interface is the seam for swapping in an LLM (Claude)
 * without changing any other code.
 */

import { Claim } from '../src/types';
import {
    OutlierFinding,
    ProviderOutlierResult,
    runOutlierRules,
} from './outlier-detection-rules';
import {
    buildOutlierAnalysisPrompt,
    OutlierPromptContext,
} from './outlier-detection-prompts';

// ── Result Types ──────────────────────────────────────────────────────

export interface OutlierDetectionReport {
    generatedAt: string;
    totalClaims: number;
    totalProviders: number;
    flaggedProviders: number;
    criticalProviders: number;
    totalEstimatedExposure: number;
    providerResults: ProviderOutlierResult[];
    executiveSummary: string;
}

// ── Agent Backend Interface (LLM Seam) ────────────────────────────────

export interface AgentBackendResult {
    riskScore: number;
    summary: string;
}

export interface OutlierAgentBackend {
    analyze(
        prompt: string,
        ctx: OutlierPromptContext
    ): Promise<AgentBackendResult>;
}

// ── Rule-Based Backend (default) ──────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number> = {
    Critical: 30,
    High: 20,
    Medium: 10,
    Low: 4,
};

export class RuleBasedOutlierBackend implements OutlierAgentBackend {
    async analyze(
        _prompt: string,
        ctx: OutlierPromptContext
    ): Promise<AgentBackendResult> {
        const { findings, providerClaims, allClaims } = ctx;

        // Risk score: severity points + exposure ratio
        const severityScore = findings.reduce(
            (s, f) => s + (SEVERITY_WEIGHTS[f.severity] ?? 0),
            0
        );
        const totalExposure = findings.reduce((s, f) => s + f.estimatedImpact, 0);
        const totalBilled = providerClaims.reduce((s, c) => s + c.amount, 0);
        const exposureRatio = totalBilled > 0 ? totalExposure / totalBilled : 0;
        const exposureScore = Math.min(40, Math.round(exposureRatio * 40));

        const riskScore = Math.min(100, severityScore + exposureScore);

        const summary = this.buildSummary(ctx, findings, riskScore);

        return { riskScore, summary };
    }

    private buildSummary(
        ctx: OutlierPromptContext,
        findings: OutlierFinding[],
        riskScore: number
    ): string {
        const { providerName, providerClaims } = ctx;
        const totalBilled = providerClaims.reduce((s, c) => s + c.amount, 0);

        if (findings.length === 0) {
            return `${providerName} — No statistical outliers detected across ${providerClaims.length} claims totaling $${totalBilled.toLocaleString()}. Billing patterns fall within expected parameters.`;
        }

        const critical = findings.filter((f) => f.severity === 'Critical').length;
        const high = findings.filter((f) => f.severity === 'High').length;
        const totalExposure = findings.reduce((s, f) => s + f.estimatedImpact, 0);
        const topRule = findings.sort(
            (a, b) => (SEVERITY_WEIGHTS[b.severity] ?? 0) - (SEVERITY_WEIGHTS[a.severity] ?? 0)
        )[0];

        const riskLabel =
            riskScore >= 70 ? 'HIGH RISK' : riskScore >= 40 ? 'MODERATE RISK' : 'LOW RISK';

        return `[${riskLabel}] ${providerName}: ${findings.length} outlier finding${findings.length > 1 ? 's' : ''} detected${critical > 0 ? ` (${critical} critical, ${high} high)` : ''}. Primary concern: ${topRule.ruleName}. Estimated financial exposure: $${totalExposure.toLocaleString()} across ${providerClaims.length} claims.`;
    }
}

// ── Future LLM Backend ────────────────────────────────────────────────
//
// import Anthropic from '@anthropic-ai/sdk';
//
// export class ClaudeOutlierBackend implements OutlierAgentBackend {
//     private client: Anthropic;
//     constructor() { this.client = new Anthropic(); }
//
//     async analyze(prompt: string, _ctx: OutlierPromptContext): Promise<AgentBackendResult> {
//         const response = await this.client.messages.create({
//             model: 'claude-sonnet-4-6',
//             max_tokens: 2000,
//             messages: [{ role: 'user', content: prompt }],
//         });
//         const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
//         const parsed = JSON.parse(text);
//         return {
//             riskScore: parsed.estimatedExposure ? Math.min(100, Math.round(parsed.estimatedExposure / 1000)) : 50,
//             summary: parsed.summary ?? 'Analysis complete.',
//         };
//     }
// }

// ── Agent Orchestrator ────────────────────────────────────────────────

export class OutlierDetectionAgent {
    private backend: OutlierAgentBackend;

    constructor(backend?: OutlierAgentBackend) {
        this.backend = backend ?? new RuleBasedOutlierBackend();
    }

    async analyzeProvider(
        providerId: string,
        allClaims: Claim[]
    ): Promise<ProviderOutlierResult> {
        const providerClaims = allClaims.filter((c) => c.providerId === providerId);
        const providerName = providerClaims[0]?.providerName ?? providerId;

        // Run deterministic rules
        const findings = runOutlierRules(providerId, allClaims);

        // Build context and prompt
        const ctx: OutlierPromptContext = {
            providerId,
            providerName,
            providerClaims,
            allClaims,
            findings,
        };
        const prompt = buildOutlierAnalysisPrompt(ctx);

        // Delegate to backend
        const result = await this.backend.analyze(prompt, ctx);

        return {
            providerId,
            providerName,
            claimCount: providerClaims.length,
            totalBilled: providerClaims.reduce((s, c) => s + c.amount, 0),
            findings,
            riskScore: result.riskScore,
            summary: result.summary,
        };
    }

    async analyzeAll(allClaims: Claim[]): Promise<OutlierDetectionReport> {
        const providerIds = [...new Set(allClaims.map((c) => c.providerId))];
        const providerResults: ProviderOutlierResult[] = [];

        for (const pid of providerIds) {
            // Stagger to simulate agent "thinking" cadence
            await new Promise((r) => setTimeout(r, 100));
            providerResults.push(await this.analyzeProvider(pid, allClaims));
        }

        // Sort by risk score descending
        providerResults.sort((a, b) => b.riskScore - a.riskScore);

        const flaggedProviders = providerResults.filter(
            (r) => r.findings.length > 0
        ).length;
        const criticalProviders = providerResults.filter((r) => r.riskScore >= 70).length;
        const totalEstimatedExposure = providerResults.reduce(
            (s, r) => s + r.findings.reduce((fs, f) => fs + f.estimatedImpact, 0),
            0
        );

        const executiveSummary = this.buildExecutiveSummary(
            providerResults,
            allClaims,
            flaggedProviders,
            criticalProviders,
            totalEstimatedExposure
        );

        return {
            generatedAt: new Date().toISOString(),
            totalClaims: allClaims.length,
            totalProviders: providerIds.length,
            flaggedProviders,
            criticalProviders,
            totalEstimatedExposure,
            providerResults,
            executiveSummary,
        };
    }

    private buildExecutiveSummary(
        results: ProviderOutlierResult[],
        allClaims: Claim[],
        flagged: number,
        critical: number,
        exposure: number
    ): string {
        const topProvider = results.find((r) => r.findings.length > 0);
        const topRuleIds = results
            .flatMap((r) => r.findings.map((f) => f.ruleId))
            .reduce<Record<string, number>>((acc, id) => {
                acc[id] = (acc[id] ?? 0) + 1;
                return acc;
            }, {});
        const dominantRule = Object.entries(topRuleIds).sort(
            ([, a], [, b]) => b - a
        )[0]?.[0] ?? 'N/A';

        if (flagged === 0) {
            return `Outlier detection complete across ${results.length} providers and ${allClaims.length} claims. No statistically significant anomalies detected. Portfolio risk posture is within expected parameters.`;
        }

        return `Outlier detection identified ${flagged} of ${results.length} provider${results.length > 1 ? 's' : ''} with anomalous billing patterns (${critical} critical). Estimated financial exposure: $${exposure.toLocaleString()}. Most prevalent finding: ${dominantRule.replace(/_/g, ' ')}. ${topProvider ? `Highest-risk provider: ${topProvider.providerName} (risk score ${topProvider.riskScore}/100).` : ''} Immediate investigation recommended for all critical-risk providers.`;
    }
}
