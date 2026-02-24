'use client';

import { useState } from 'react';

// ── Local types (mirrors agent output) ───────────────────────────────

interface OutlierFinding {
    ruleId: string;
    ruleName: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    recommendation: string;
    affectedClaimIds: string[];
    estimatedImpact: number;
    statDetail?: string;
}

interface ProviderOutlierResult {
    providerId: string;
    providerName: string;
    claimCount: number;
    totalBilled: number;
    findings: OutlierFinding[];
    riskScore: number;
    summary: string;
}

interface OutlierDetectionReport {
    generatedAt: string;
    totalClaims: number;
    totalProviders: number;
    flaggedProviders: number;
    criticalProviders: number;
    totalEstimatedExposure: number;
    providerResults: ProviderOutlierResult[];
    executiveSummary: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const RULE_META: Record<string, { icon: string; short: string }> = {
    DUPLICATE_BILLING:          { icon: '⚠', short: 'Duplicate' },
    HIGH_FREQUENCY_BILLING:     { icon: '📊', short: 'Hi-Freq' },
    AMOUNT_STATISTICAL_OUTLIER: { icon: '💰', short: 'Amt Outlier' },
    PROVIDER_AMOUNT_PATTERN:    { icon: '📈', short: 'Amt Pattern' },
    BENEFICIARY_CHURNING:       { icon: '🔄', short: 'Churning' },
    ROUND_NUMBER_BILLING:       { icon: '🎯', short: 'Round $' },
    RISK_SCORE_CONCENTRATION:   { icon: '🚨', short: 'Risk Conc.' },
};

const SEV_ORDER = ['Critical', 'High', 'Medium', 'Low'] as const;

// ── Style helpers ────────────────────────────────────────────────────

function severityBadge(severity: OutlierFinding['severity']) {
    switch (severity) {
        case 'Critical': return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'High':     return 'bg-orange-100 text-orange-700 border-orange-200';
        case 'Medium':   return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Low':      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
}

function severityDot(severity: OutlierFinding['severity']) {
    switch (severity) {
        case 'Critical': return 'bg-rose-500';
        case 'High':     return 'bg-orange-500';
        case 'Medium':   return 'bg-amber-500';
        case 'Low':      return 'bg-slate-400';
    }
}

function riskBarColor(score: number) {
    if (score >= 70) return 'bg-rose-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-emerald-500';
}

function riskLabel(score: number) {
    if (score >= 70) return { label: 'High Risk',  cls: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (score >= 40) return { label: 'Moderate',   cls: 'text-amber-700 bg-amber-50 border-amber-200' };
    return                   { label: 'Low Risk',  cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
}

// ── Sub-components ────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, cls }: {
    label: string; value: string | number; sub?: string; cls?: string;
}) {
    return (
        <div className={`rounded-xl border p-4 ${cls ?? 'bg-white border-slate-100'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function RuleTag({ ruleId, severity }: { ruleId: string; severity: OutlierFinding['severity'] }) {
    const meta = RULE_META[ruleId] ?? { icon: '🔍', short: ruleId };
    const severityColors: Record<string, string> = {
        Critical: 'bg-rose-50 text-rose-700 border-rose-200',
        High:     'bg-orange-50 text-orange-700 border-orange-200',
        Medium:   'bg-amber-50 text-amber-700 border-amber-200',
        Low:      'bg-slate-50 text-slate-600 border-slate-200',
    };
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${severityColors[severity]}`}>
            {meta.icon} {meta.short}
        </span>
    );
}

function FindingCard({ finding }: { finding: OutlierFinding }) {
    const [open, setOpen] = useState(false);
    const meta = RULE_META[finding.ruleId] ?? { icon: '🔍', short: finding.ruleId };

    return (
        <div className="border border-slate-100 rounded-xl bg-white overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            >
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900">{finding.ruleName}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${severityBadge(finding.severity)}`}>
                            <span className={`w-1 h-1 rounded-full ${severityDot(finding.severity)}`} />
                            {finding.severity}
                        </span>
                        <span className="ml-auto text-xs text-slate-400 flex-shrink-0">
                            {finding.affectedClaimIds.length} claim{finding.affectedClaimIds.length !== 1 ? 's' : ''}
                            {finding.estimatedImpact > 0 && ` · $${finding.estimatedImpact.toLocaleString()}`}
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{finding.description}</p>
                    {finding.statDetail && !open && (
                        <code className="mt-1.5 text-[10px] bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-slate-500 inline-block">
                            {finding.statDetail}
                        </code>
                    )}
                </div>
                <span className="text-slate-300 text-xs ml-2 flex-shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3 bg-slate-50">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Analysis</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{finding.description}</p>
                    </div>
                    {finding.statDetail && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statistical Evidence</p>
                            <code className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1.5 text-violet-700 font-semibold inline-block">
                                {finding.statDetail}
                            </code>
                        </div>
                    )}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Recommended Action</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{finding.recommendation}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                            Affected Claims ({finding.affectedClaimIds.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {finding.affectedClaimIds.map((id) => (
                                <span key={id} className="text-[10px] font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600">
                                    {id}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SeverityBreakdown({ findings }: { findings: OutlierFinding[] }) {
    const counts = findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.severity] = (acc[f.severity] ?? 0) + 1;
        return acc;
    }, {});
    const present = SEV_ORDER.filter((s) => counts[s]);
    if (present.length === 0) return null;
    return (
        <div className="flex gap-1.5">
            {present.map((sev) => (
                <span key={sev} className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityBadge(sev)}`}>
                    {counts[sev]} {sev}
                </span>
            ))}
        </div>
    );
}

function ProviderCard({ result }: { result: ProviderOutlierResult }) {
    const [open, setOpen] = useState(false);
    const risk = riskLabel(result.riskScore);
    const flagged = result.findings.length > 0;
    const totalExposure = result.findings.reduce((s, f) => s + f.estimatedImpact, 0);

    return (
        <div className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-shadow hover:shadow-md ${
            result.riskScore >= 70 ? 'border-rose-200' : flagged ? 'border-amber-100' : 'border-slate-100'
        }`}>
            {/* Header row — always visible */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/60 transition-colors"
            >
                {/* Risk score ring */}
                <div className="flex-shrink-0 relative w-11 h-11">
                    <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                        <circle
                            cx="18" cy="18" r="15" fill="none"
                            stroke={result.riskScore >= 70 ? '#f43f5e' : result.riskScore >= 40 ? '#f59e0b' : '#10b981'}
                            strokeWidth="3.5"
                            strokeDasharray={`${result.riskScore * 0.942} 94.2`}
                            strokeLinecap="round"
                        />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-700">
                        {result.riskScore}
                    </span>
                </div>

                {/* Provider info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{result.providerName}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${risk.cls}`}>
                            {risk.label}
                        </span>
                        {flagged && <SeverityBreakdown findings={result.findings} />}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">
                            {result.claimCount} claims · ${result.totalBilled.toLocaleString()} billed
                        </span>
                        {totalExposure > 0 && (
                            <span className="text-xs font-semibold text-rose-600">
                                ~${totalExposure.toLocaleString()} exposure
                            </span>
                        )}
                    </div>
                    {/* Rule tag strip */}
                    {result.findings.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                            {result.findings.map((f) => (
                                <RuleTag key={f.ruleId} ruleId={f.ruleId} severity={f.severity} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Risk bar */}
                <div className="flex-shrink-0 hidden md:flex flex-col items-end gap-1 w-20">
                    <span className="text-[10px] text-slate-400">{result.riskScore}/100</span>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${riskBarColor(result.riskScore)}`}
                            style={{ width: `${result.riskScore}%` }}
                        />
                    </div>
                </div>

                <span className="text-slate-300 text-xs ml-1 flex-shrink-0">{open ? '▲' : '▼'}</span>
            </button>

            {/* Expanded detail */}
            {open && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4 bg-slate-50/40">
                    <p className="text-xs text-slate-600 leading-relaxed border-l-2 border-violet-300 pl-3 italic">
                        {result.summary}
                    </p>

                    {result.findings.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Outlier Findings ({result.findings.length})
                            </p>
                            {result.findings.map((f) => (
                                <FindingCard key={f.ruleId} finding={f} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                            <span>✓</span>
                            <span>No outlier patterns detected. Billing within normal parameters.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function FindingsSummaryBar({ results }: { results: ProviderOutlierResult[] }) {
    const ruleCounts: Record<string, number> = {};
    results.forEach((r) => r.findings.forEach((f) => {
        ruleCounts[f.ruleId] = (ruleCounts[f.ruleId] ?? 0) + 1;
    }));
    const sorted = Object.entries(ruleCounts).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) return null;

    return (
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                Finding Frequency by Rule
            </p>
            <div className="space-y-2">
                {sorted.map(([ruleId, count]) => {
                    const meta = RULE_META[ruleId] ?? { icon: '🔍', short: ruleId };
                    const maxCount = sorted[0][1];
                    const pct = (count / maxCount) * 100;
                    return (
                        <div key={ruleId} className="flex items-center gap-3">
                            <span className="text-sm w-4 flex-shrink-0">{meta.icon}</span>
                            <span className="text-xs text-slate-600 w-28 flex-shrink-0 truncate">{meta.short}</span>
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-violet-400 rounded-full"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 w-6 text-right">{count}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Panel ────────────────────────────────────────────────────────

export default function OutlierDetectionPanel() {
    const [report, setReport] = useState<OutlierDetectionReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<'all' | 'flagged' | 'critical'>('all');

    async function runDetection() {
        setLoading(true);
        setError('');
        setReport(null);
        try {
            const res = await fetch('/api/outlier-detection', { method: 'POST' });
            if (!res.ok) throw new Error(`API error: ${res.status}`);
            const data: OutlierDetectionReport = await res.json();
            setReport(data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    const visibleProviders = report
        ? report.providerResults.filter((r) => {
              if (filter === 'flagged') return r.findings.length > 0;
              if (filter === 'critical') return r.riskScore >= 70;
              return true;
          })
        : [];

    return (
        <div className="mt-10 space-y-6">
            {/* Section header */}
            <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-rose-100 flex items-center justify-center text-rose-600 text-sm">⬡</span>
                        FWA Outlier Detection
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        Statistical analysis across all providers — duplicate billing, frequency anomalies,
                        amount outliers, beneficiary churning, and risk concentration.
                    </p>
                </div>
                <button
                    onClick={runDetection}
                    disabled={loading}
                    className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm shadow-violet-600/20"
                >
                    {loading ? (
                        <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                            Analyzing…
                        </>
                    ) : (
                        <>▶ Run Outlier Detection</>
                    )}
                </button>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">{error}</div>
            )}

            {loading && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl p-6 flex items-center gap-4">
                    <div className="w-5 h-5 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-violet-800">Agent running statistical analysis…</p>
                        <p className="text-xs text-violet-500 mt-0.5">
                            Evaluating 7 outlier detection rules across all providers: duplicate billing, frequency
                            z-scores, amount outliers, beneficiary churning, round-number patterns, and risk concentration.
                        </p>
                    </div>
                </div>
            )}

            {report && (
                <div className="space-y-5">
                    {/* Summary stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SummaryCard
                            label="Providers Analyzed"
                            value={report.totalProviders}
                            sub={`${report.totalClaims} total claims`}
                        />
                        <SummaryCard
                            label="Flagged Providers"
                            value={report.flaggedProviders}
                            sub="with outlier findings"
                            cls={report.flaggedProviders > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}
                        />
                        <SummaryCard
                            label="Critical Risk"
                            value={report.criticalProviders}
                            sub="risk score ≥ 70"
                            cls={report.criticalProviders > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}
                        />
                        <SummaryCard
                            label="Est. Exposure"
                            value={`$${report.totalEstimatedExposure.toLocaleString()}`}
                            sub="across all findings"
                        />
                    </div>

                    {/* Executive summary */}
                    <div className="bg-slate-900 text-white rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Agent Executive Summary
                            </p>
                            <span className="ml-auto text-[10px] text-slate-600">
                                {new Date(report.generatedAt).toLocaleString()}
                            </span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{report.executiveSummary}</p>
                    </div>

                    {/* Findings frequency bar */}
                    <FindingsSummaryBar results={report.providerResults} />

                    {/* Filter tabs */}
                    <div className="flex gap-2 flex-wrap">
                        {(
                            [
                                { key: 'all',      label: `All Providers (${report.totalProviders})` },
                                { key: 'flagged',  label: `Flagged (${report.flaggedProviders})` },
                                { key: 'critical', label: `Critical Risk (${report.criticalProviders})` },
                            ] as const
                        ).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                    filter === key
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Provider result cards */}
                    <div className="space-y-3">
                        {visibleProviders.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 text-sm">
                                No providers match the selected filter.
                            </div>
                        ) : (
                            visibleProviders.map((r) => (
                                <ProviderCard key={r.providerId} result={r} />
                            ))
                        )}
                    </div>

                    {/* Detection rule legend */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Detection Rule Reference
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600">
                            {[
                                ['⚠',  'DUPLICATE_BILLING',          'Same provider + beneficiary + code within 7 days'],
                                ['📊', 'HIGH_FREQUENCY_BILLING',     'Claim volume z-score > 2 vs. peer group'],
                                ['💰', 'AMOUNT_STATISTICAL_OUTLIER', 'Per-code amount z-score > 2.5 vs. peers'],
                                ['📈', 'PROVIDER_AMOUNT_PATTERN',    'Overall avg amount z-score > 2 vs. peers'],
                                ['🔄', 'BENEFICIARY_CHURNING',       'High-utilization beneficiaries (z > 2)'],
                                ['🎯', 'ROUND_NUMBER_BILLING',       '>50% of claims in round dollar amounts'],
                                ['🚨', 'RISK_SCORE_CONCENTRATION',   '>60% of claims with AI risk score ≥ 70'],
                            ].map(([icon, id, desc]) => (
                                <div key={id} className="flex items-start gap-2 py-0.5">
                                    <span className="flex-shrink-0 w-4 text-center">{icon}</span>
                                    <span className="font-semibold text-slate-700 flex-shrink-0">
                                        {id?.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-slate-400">— {desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
