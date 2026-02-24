/**
 * FWA Outlier Detection Agent - Prompt Templates
 *
 * Pure functions that build prompts for LLM-based outlier analysis.
 * Consumed by the agent orchestrator; structured for drop-in LLM integration.
 */

import { Claim } from '../src/types';
import { OutlierFinding, ProviderOutlierResult } from './outlier-detection-rules';

export interface OutlierPromptContext {
    providerId: string;
    providerName: string;
    providerClaims: Claim[];
    allClaims: Claim[];
    findings: OutlierFinding[];
}

// ── Main Outlier Analysis Prompt ──────────────────────────────────────

export function buildOutlierAnalysisPrompt(ctx: OutlierPromptContext): string {
    const { providerName, providerClaims, allClaims, findings } = ctx;

    const totalBilled = providerClaims.reduce((s, c) => s + c.amount, 0);
    const avgAmount = totalBilled / providerClaims.length;
    const allProviderAvg =
        allClaims.reduce((s, c) => s + c.amount, 0) / allClaims.length;

    const procedureCounts = providerClaims.reduce<Record<string, number>>((acc, c) => {
        acc[c.procedureCode] = (acc[c.procedureCode] ?? 0) + 1;
        return acc;
    }, {});

    const topProcedures = Object.entries(procedureCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([code, count]) => `${code}: ${count} claims`)
        .join(', ');

    const findingsSummary = findings
        .map(
            (f, i) =>
                `${i + 1}. [${f.severity}] ${f.ruleName}: ${f.description} (Estimated exposure: $${f.estimatedImpact.toLocaleString()})`
        )
        .join('\n');

    return `You are a senior healthcare fraud, waste, and abuse (FWA) analyst specializing in statistical outlier detection and claims pattern analysis.

Review the following provider billing profile and statistical findings, then produce a comprehensive risk assessment.

## Provider Profile
- Provider: ${providerName}
- Total Claims: ${providerClaims.length}
- Total Billed: $${totalBilled.toLocaleString()}
- Average Claim Amount: $${avgAmount.toFixed(2)} (all-provider avg: $${allProviderAvg.toFixed(2)})
- Top Procedure Codes: ${topProcedures}

## Statistical Outlier Findings
${findingsSummary || 'No statistical outliers detected.'}

## Analysis Tasks
1. **Risk Assessment**: Based on the findings, classify the overall provider risk as Critical / High / Medium / Low.
2. **Pattern Analysis**: Are the findings consistent with a specific fraud typology (upcoding, phantom billing, kickbacks, unnecessary services)?
3. **Priority Actions**: What are the top 3 immediate investigation steps?
4. **Estimated Financial Exposure**: What is the estimated total overpayment at risk?
5. **Narrative Summary**: Write a 2-3 sentence plain-English summary for a compliance officer.

Respond with a JSON object:
{
  "overallRisk": "Critical" | "High" | "Medium" | "Low",
  "fraudTypology": "<best-fit typology or 'Mixed'>",
  "priorityActions": ["<action 1>", "<action 2>", "<action 3>"],
  "estimatedExposure": <number>,
  "summary": "<2-3 sentence narrative>"
}`;
}

// ── Portfolio Summary Prompt ──────────────────────────────────────────

export function buildPortfolioSummaryPrompt(
    results: ProviderOutlierResult[],
    allClaims: Claim[]
): string {
    const flaggedProviders = results.filter((r) => r.findings.length > 0);
    const totalExposure = flaggedProviders.reduce(
        (s, r) => s + r.findings.reduce((fs, f) => fs + f.estimatedImpact, 0),
        0
    );

    const criticalCount = flaggedProviders.filter((r) =>
        r.findings.some((f) => f.severity === 'Critical')
    ).length;

    const providerList = flaggedProviders
        .slice(0, 10)
        .map((r) => `- ${r.providerName} (${r.findings.length} findings, risk ${r.riskScore}/100)`)
        .join('\n');

    return `You are a healthcare program integrity director reviewing an automated outlier detection report.

## Portfolio Overview
- Total Providers Analyzed: ${[...new Set(allClaims.map((c) => c.providerId))].length}
- Providers with Outlier Findings: ${flaggedProviders.length}
- Providers with Critical Findings: ${criticalCount}
- Total Estimated Financial Exposure: $${totalExposure.toLocaleString()}
- Total Claims in Dataset: ${allClaims.length}

## Top Flagged Providers
${providerList}

Generate a 3-5 sentence executive summary suitable for a compliance board report, including:
1. Overall portfolio risk posture
2. Most significant finding types
3. Recommended immediate actions

Respond with plain text (no JSON).`;
}

// ── Provider Recommendation Prompt ───────────────────────────────────

export function buildProviderRecommendationPrompt(
    result: ProviderOutlierResult
): string {
    const findingsList = result.findings
        .map(
            (f) =>
                `- [${f.severity}] ${f.ruleName}: ${f.affectedClaimIds.length} claims, $${f.estimatedImpact.toLocaleString()} exposure`
        )
        .join('\n');

    return `Generate a structured investigation plan for the following FWA outlier provider.

## Provider: ${result.providerName} (${result.providerId})
## Overall Risk Score: ${result.riskScore}/100

## Outlier Findings
${findingsList}

Produce:
1. Recommended disposition (Deny / Pre-payment review / Post-payment audit / Monitor)
2. Top 5 prioritized investigation steps
3. Data requests needed from the provider
4. Timeline recommendation (urgent = 24-48h, standard = 5-10 business days)

Format as a concise numbered action plan.`;
}
