/**
 * FWA Outlier Detection - Rule Engine
 *
 * Statistical and pattern-based rules that detect anomalous billing behavior
 * across claims, providers, and beneficiaries.
 *
 * Each rule is a pure function operating on the full claims dataset.
 * Results feed into the OutlierDetectionAgent orchestrator.
 */

import { Claim } from '../src/types';

// ── Types ─────────────────────────────────────────────────────────────

export type OutlierRuleId =
    | 'DUPLICATE_BILLING'
    | 'HIGH_FREQUENCY_BILLING'
    | 'AMOUNT_STATISTICAL_OUTLIER'
    | 'PROVIDER_AMOUNT_PATTERN'
    | 'BENEFICIARY_CHURNING'
    | 'ROUND_NUMBER_BILLING'
    | 'RISK_SCORE_CONCENTRATION';

export type OutlierSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface OutlierFinding {
    ruleId: OutlierRuleId;
    ruleName: string;
    severity: OutlierSeverity;
    description: string;
    recommendation: string;
    affectedClaimIds: string[];
    /** Estimated financial exposure */
    estimatedImpact: number;
    /** Statistical detail (z-score, ratio, etc.) */
    statDetail?: string;
}

export interface ProviderOutlierResult {
    providerId: string;
    providerName: string;
    claimCount: number;
    totalBilled: number;
    findings: OutlierFinding[];
    riskScore: number;
    summary: string;
}

// ── Statistical helpers ───────────────────────────────────────────────

function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function zScore(value: number, m: number, sd: number): number {
    if (sd === 0) return 0;
    return (value - m) / sd;
}

function daysBetween(dateA: string, dateB: string): number {
    return Math.abs(
        (new Date(dateA).getTime() - new Date(dateB).getTime()) / (1000 * 60 * 60 * 24)
    );
}

function isRoundNumber(amount: number): boolean {
    return amount % 100 === 0 || amount % 50 === 0;
}

// ── Rule 1: Duplicate Billing ─────────────────────────────────────────
//
// Same provider bills the same beneficiary for the same procedure code
// within a 7-day window.

export function detectDuplicateBilling(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const providerClaims = claims.filter((c) => c.providerId === providerId);
    const duplicates: string[] = [];

    for (let i = 0; i < providerClaims.length; i++) {
        for (let j = i + 1; j < providerClaims.length; j++) {
            const a = providerClaims[i];
            const b = providerClaims[j];
            if (
                a.beneficiaryId === b.beneficiaryId &&
                a.procedureCode === b.procedureCode &&
                daysBetween(a.serviceDate, b.serviceDate) <= 7
            ) {
                if (!duplicates.includes(a.id)) duplicates.push(a.id);
                if (!duplicates.includes(b.id)) duplicates.push(b.id);
            }
        }
    }

    if (duplicates.length === 0) return null;

    const duplicateClaims = providerClaims.filter((c) => duplicates.includes(c.id));
    const estimatedImpact = duplicateClaims.reduce((s, c) => s + c.amount, 0);

    return {
        ruleId: 'DUPLICATE_BILLING',
        ruleName: 'Duplicate Billing',
        severity: duplicates.length >= 4 ? 'Critical' : 'High',
        description: `Provider submitted ${duplicates.length} claims for the same beneficiary + procedure code within a 7-day window. Duplicate billing may indicate systematic overbilling or billing errors.`,
        recommendation: 'Conduct line-by-line review of duplicated service dates. Deny duplicate claims and initiate provider education or recovery audit.',
        affectedClaimIds: duplicates,
        estimatedImpact,
        statDetail: `${duplicates.length} duplicate claim pairs detected`,
    };
}

// ── Rule 2: High Frequency Billing ───────────────────────────────────
//
// Provider bills a specific procedure code significantly more often than
// peers (z-score > 2 on procedure frequency relative to peer group).

export function detectHighFrequencyBilling(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const allProviders = [...new Set(claims.map((c) => c.providerId))];
    if (allProviders.length < 3) return null;

    // Count per-provider total claim volume
    const providerCounts = allProviders.map((pid) => ({
        pid,
        count: claims.filter((c) => c.providerId === pid).length,
    }));

    const counts = providerCounts.map((p) => p.count);
    const m = mean(counts);
    const sd = stdDev(counts);

    const providerCount = providerCounts.find((p) => p.pid === providerId)?.count ?? 0;
    const z = zScore(providerCount, m, sd);

    if (z <= 2) return null;

    const providerClaims = claims.filter((c) => c.providerId === providerId);

    return {
        ruleId: 'HIGH_FREQUENCY_BILLING',
        ruleName: 'High Frequency Billing',
        severity: z > 3 ? 'Critical' : 'High',
        description: `Provider's claim volume is ${z.toFixed(2)} standard deviations above the peer mean (${providerCount} claims vs. peer avg ${m.toFixed(1)}). Unusually high billing frequency can indicate churning, upcoding, or services rendered without necessity.`,
        recommendation: 'Initiate focused medical review on a statistically significant sample. Validate medical necessity for high-frequency procedure codes.',
        affectedClaimIds: providerClaims.map((c) => c.id),
        estimatedImpact: providerClaims.reduce((s, c) => s + c.amount, 0),
        statDetail: `z=${z.toFixed(2)}, volume=${providerCount}, peer avg=${m.toFixed(1)}, sd=${sd.toFixed(1)}`,
    };
}

// ── Rule 3: Amount Statistical Outlier ───────────────────────────────
//
// Provider's average billed amount for a procedure code is significantly
// higher than the peer average (z-score > 2.5).

export function detectAmountOutlier(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const providerClaims = claims.filter((c) => c.providerId === providerId);
    if (providerClaims.length < 3) return null;

    // Group by procedure code across all providers
    const allProcedureCodes = [...new Set(claims.map((c) => c.procedureCode))];
    const outlierClaims: string[] = [];
    let totalExcess = 0;
    const flaggedCodes: string[] = [];

    for (const code of allProcedureCodes) {
        const allForCode = claims.filter((c) => c.procedureCode === code);
        if (allForCode.length < 4) continue; // not enough peers

        const provForCode = providerClaims.filter((c) => c.procedureCode === code);
        if (provForCode.length === 0) continue;

        const peerAmounts = allForCode
            .filter((c) => c.providerId !== providerId)
            .map((c) => c.amount);
        if (peerAmounts.length < 3) continue;

        const m = mean(peerAmounts);
        const sd = stdDev(peerAmounts);
        const provAvg = mean(provForCode.map((c) => c.amount));
        const z = zScore(provAvg, m, sd);

        if (z > 2.5) {
            provForCode.forEach((c) => {
                if (!outlierClaims.includes(c.id)) outlierClaims.push(c.id);
            });
            totalExcess += (provAvg - m) * provForCode.length;
            flaggedCodes.push(`${code} (z=${z.toFixed(1)}, avg $${provAvg.toFixed(0)} vs peer $${m.toFixed(0)})`);
        }
    }

    if (outlierClaims.length === 0) return null;

    return {
        ruleId: 'AMOUNT_STATISTICAL_OUTLIER',
        ruleName: 'Amount Statistical Outlier',
        severity: totalExcess > 5000 ? 'Critical' : 'High',
        description: `Provider's billed amounts are statistically elevated for ${flaggedCodes.length} procedure code(s): ${flaggedCodes.join('; ')}. Pattern suggests potential upcoding or inflated billing.`,
        recommendation: 'Compare against Medicare fee schedule and peer benchmarks. Request itemized bills and supporting documentation for outlier claims.',
        affectedClaimIds: outlierClaims,
        estimatedImpact: Math.round(totalExcess),
        statDetail: flaggedCodes.join(' | '),
    };
}

// ── Rule 4: Provider Amount Pattern ──────────────────────────────────
//
// Provider's overall average claim amount deviates significantly from
// peer group average (z-score > 2).

export function detectProviderAmountPattern(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const allProviders = [...new Set(claims.map((c) => c.providerId))];
    if (allProviders.length < 3) return null;

    const providerAvgs = allProviders.map((pid) => {
        const c = claims.filter((x) => x.providerId === pid);
        return { pid, avg: mean(c.map((x) => x.amount)), count: c.length };
    });

    const avgs = providerAvgs.filter((p) => p.count >= 3).map((p) => p.avg);
    if (avgs.length < 3) return null;

    const m = mean(avgs);
    const sd = stdDev(avgs);

    const provData = providerAvgs.find((p) => p.pid === providerId);
    if (!provData || provData.count < 3) return null;

    const z = zScore(provData.avg, m, sd);
    if (z <= 2) return null;

    const providerClaims = claims.filter((c) => c.providerId === providerId);
    const excessPerClaim = provData.avg - m;
    const estimatedImpact = Math.round(excessPerClaim * provData.count);

    return {
        ruleId: 'PROVIDER_AMOUNT_PATTERN',
        ruleName: 'Provider Amount Pattern',
        severity: z > 3 ? 'Critical' : 'High',
        description: `Provider's average claim amount ($${provData.avg.toFixed(0)}) is ${z.toFixed(2)} standard deviations above the peer average ($${m.toFixed(0)}). This systematic elevation may indicate routine upcoding or unnecessary services.`,
        recommendation: 'Conduct comprehensive billing audit. Compare procedure mix and patient acuity. Consider pre-payment review or payment suspension pending investigation.',
        affectedClaimIds: providerClaims.map((c) => c.id),
        estimatedImpact,
        statDetail: `z=${z.toFixed(2)}, provider avg=$${provData.avg.toFixed(0)}, peer avg=$${m.toFixed(0)}`,
    };
}

// ── Rule 5: Beneficiary Churning ──────────────────────────────────────
//
// A beneficiary appears across an unusually high number of claims
// (multi-provider shopping or provider-driven overutilization).

export function detectBeneficiaryChurning(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const providerClaims = claims.filter((c) => c.providerId === providerId);
    if (providerClaims.length < 3) return null;

    // Count how many times each beneficiary appears across ALL claims
    const allBenIds = claims.map((c) => c.beneficiaryId);
    const benCounts: Record<string, number> = {};
    for (const bid of allBenIds) benCounts[bid] = (benCounts[bid] ?? 0) + 1;

    const counts = Object.values(benCounts);
    const m = mean(counts);
    const sd = stdDev(counts);

    // Find beneficiaries seen by this provider who are high-utilizers
    const provBenIds = [...new Set(providerClaims.map((c) => c.beneficiaryId))];
    const churningBens = provBenIds.filter((bid) => {
        const z = zScore(benCounts[bid] ?? 0, m, sd);
        return z > 2;
    });

    if (churningBens.length === 0) return null;

    const affectedClaims = providerClaims
        .filter((c) => churningBens.includes(c.beneficiaryId))
        .map((c) => c.id);

    return {
        ruleId: 'BENEFICIARY_CHURNING',
        ruleName: 'Beneficiary Churning',
        severity: churningBens.length >= 3 ? 'High' : 'Medium',
        description: `${churningBens.length} beneficiar${churningBens.length === 1 ? 'y' : 'ies'} treated by this provider appear across the dataset at an unusually high frequency (z > 2). This pattern may indicate beneficiary steering, unnecessary repeat visits, or collusive overutilization.`,
        recommendation: 'Conduct beneficiary outreach to verify services were received. Cross-check with other provider billings for the same beneficiaries.',
        affectedClaimIds: affectedClaims,
        estimatedImpact: affectedClaims.reduce(
            (s, id) => s + (providerClaims.find((c) => c.id === id)?.amount ?? 0),
            0
        ),
        statDetail: `${churningBens.length} high-utilization beneficiaries, claim count threshold z>2 (peer avg ${m.toFixed(1)})`,
    };
}

// ── Rule 6: Round Number Billing ──────────────────────────────────────
//
// More than 50% of a provider's claims are billed in round numbers
// (multiples of $50 or $100), a known fraud indicator.

export function detectRoundNumberBilling(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const providerClaims = claims.filter((c) => c.providerId === providerId);
    if (providerClaims.length < 5) return null;

    const roundClaims = providerClaims.filter((c) => isRoundNumber(c.amount));
    const ratio = roundClaims.length / providerClaims.length;

    if (ratio <= 0.5) return null;

    return {
        ruleId: 'ROUND_NUMBER_BILLING',
        ruleName: 'Round Number Billing',
        severity: ratio > 0.8 ? 'High' : 'Medium',
        description: `${(ratio * 100).toFixed(0)}% of provider's claims are billed in round dollar amounts (multiples of $50 or $100). Legitimate medical billing typically produces irregular amounts driven by fee schedules. Round-number dominance is a recognized indicator of fabricated or estimated billing.`,
        recommendation: 'Request itemized supporting documentation for a random sample. Verify against EHR and actual service costs. Escalate if documentation cannot be produced.',
        affectedClaimIds: roundClaims.map((c) => c.id),
        estimatedImpact: roundClaims.reduce((s, c) => s + c.amount, 0),
        statDetail: `${roundClaims.length}/${providerClaims.length} claims (${(ratio * 100).toFixed(0)}%) are round numbers`,
    };
}

// ── Rule 7: Risk Score Concentration ─────────────────────────────────
//
// More than 60% of a provider's claims carry a high risk score (>= 70).
// Normal providers have a distribution; concentrated high-risk claims
// suggest systematic issues or AI-flagged fraud patterns.

export function detectRiskScoreConcentration(
    providerId: string,
    claims: Claim[]
): OutlierFinding | null {
    const providerClaims = claims.filter((c) => c.providerId === providerId);
    if (providerClaims.length < 4) return null;

    const highRisk = providerClaims.filter((c) => c.riskScore >= 70);
    const ratio = highRisk.length / providerClaims.length;

    if (ratio <= 0.6) return null;

    return {
        ruleId: 'RISK_SCORE_CONCENTRATION',
        ruleName: 'Risk Score Concentration',
        severity: ratio > 0.8 ? 'Critical' : 'High',
        description: `${(ratio * 100).toFixed(0)}% of provider's claims (${highRisk.length}/${providerClaims.length}) carry a risk score ≥ 70. Normal providers have distributed risk profiles. Concentrated high-risk claims indicate systematic fraud patterns flagged by the AI risk engine.`,
        recommendation: 'Suspend provider for pre-payment review. Initiate full billing audit and consider referral to program integrity team. Cross-reference with LEIE/SAM exclusion lists.',
        affectedClaimIds: highRisk.map((c) => c.id),
        estimatedImpact: highRisk.reduce((s, c) => s + c.amount, 0),
        statDetail: `${highRisk.length}/${providerClaims.length} claims with riskScore ≥ 70 (${(ratio * 100).toFixed(0)}%)`,
    };
}

// ── Run all rules for a provider ──────────────────────────────────────

export function runOutlierRules(
    providerId: string,
    allClaims: Claim[]
): OutlierFinding[] {
    const rules = [
        detectDuplicateBilling,
        detectHighFrequencyBilling,
        detectAmountOutlier,
        detectProviderAmountPattern,
        detectBeneficiaryChurning,
        detectRoundNumberBilling,
        detectRiskScoreConcentration,
    ];

    return rules
        .map((rule) => rule(providerId, allClaims))
        .filter((f): f is OutlierFinding => f !== null);
}
