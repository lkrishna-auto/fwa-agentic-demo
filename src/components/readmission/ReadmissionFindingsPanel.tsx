'use client';

import { ReadmissionPair, ReadmissionFinding, FindingSeverity } from '@/types';

interface ReadmissionFindingsPanelProps {
    pair: ReadmissionPair;
}

const severityStyle = (severity: FindingSeverity) => {
    switch (severity) {
        case 'Critical':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'High':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Medium':
            return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        case 'Low':
            return 'bg-slate-50 text-slate-600 border-slate-200';
    }
};

const severityDot = (severity: FindingSeverity) => {
    switch (severity) {
        case 'Critical':
            return 'bg-rose-500';
        case 'High':
            return 'bg-amber-500';
        case 'Medium':
            return 'bg-yellow-500';
        case 'Low':
            return 'bg-slate-400';
    }
};

const relatednessStyle = (rel: string) => {
    switch (rel) {
        case 'Definitely Related':
            return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'Likely Related':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'Possibly Related':
            return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'Not Related':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
};

export default function ReadmissionFindingsPanel({
    pair,
}: ReadmissionFindingsPanelProps) {
    const hasFindings =
        pair.readmissionFindings && pair.readmissionFindings.length > 0;

    return (
        <div className="animate-fadeIn space-y-4">
            {/* Top row: Admission Comparison + Metrics */}
            <div className="grid grid-cols-2 gap-4">
                {/* Admission Comparison */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Admission Comparison
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Index */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="text-xs text-slate-400 mb-1">
                                Index Admission
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                                DRG {pair.indexDRG}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {pair.indexDRGDescription}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                {pair.indexAdmissionDate} - {pair.indexDischargeDate}
                            </div>
                            <div className="text-xs text-slate-400">
                                LOS: {pair.indexLengthOfStay}d | {pair.indexAdmissionType}
                            </div>
                            <div className="text-sm font-semibold text-slate-700 mt-1">
                                ${pair.indexBilledAmount.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Dx: {pair.indexPrimaryDiagnosis.code} - {pair.indexPrimaryDiagnosis.description}
                            </div>
                            {pair.indexDischargeStatus === 'AMA' && (
                                <span className="mt-1 inline-flex text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 font-bold">
                                    AMA DISCHARGE
                                </span>
                            )}
                        </div>

                        {/* Readmission */}
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                            <div className="text-xs text-slate-400 mb-1">
                                Readmission ({pair.daysBetween}d later)
                            </div>
                            <div className="text-sm font-bold text-amber-800">
                                DRG {pair.readmitDRG}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {pair.readmitDRGDescription}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                {pair.readmitAdmissionDate} - {pair.readmitDischargeDate}
                            </div>
                            <div className="text-xs text-slate-400">
                                LOS: {pair.readmitLengthOfStay}d | {pair.readmitAdmissionType}
                            </div>
                            <div className="text-sm font-semibold text-amber-800 mt-1">
                                ${pair.readmitBilledAmount.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Dx: {pair.readmitPrimaryDiagnosis.code} - {pair.readmitPrimaryDiagnosis.description}
                            </div>
                        </div>
                    </div>

                    {/* Combined amount */}
                    <div className="mt-3 p-3 rounded-lg bg-slate-100 border border-slate-200 text-center">
                        <div className="text-xs text-slate-500 mb-0.5">
                            Combined Billed Amount
                        </div>
                        <div className="text-xl font-bold text-slate-900">
                            ${pair.combinedBilledAmount.toLocaleString()}
                        </div>
                        <div className="flex justify-center gap-3 mt-1 text-xs text-slate-500">
                            <span>
                                {pair.sameFacility ? 'Same Facility' : 'Different Facility'}
                            </span>
                            <span>|</span>
                            <span>
                                {pair.sameAttending ? 'Same Attending' : 'Different Attending'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Review Metrics */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Review Metrics
                    </h4>

                    {pair.clinicalRelatedness ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Clinical Relatedness
                                    </div>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${relatednessStyle(pair.clinicalRelatedness)}`}
                                    >
                                        {pair.clinicalRelatedness}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Preventability
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-lg font-bold text-slate-900">
                                            {pair.preventabilityScore}%
                                        </div>
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${
                                                    (pair.preventabilityScore ?? 0) > 60
                                                        ? 'bg-rose-500'
                                                        : (pair.preventabilityScore ?? 0) > 30
                                                          ? 'bg-amber-500'
                                                          : 'bg-emerald-500'
                                                }`}
                                                style={{
                                                    width: `${pair.preventabilityScore}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {pair.bundleSavings != null && pair.bundleSavings > 0 && (
                                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                        <div className="text-xs text-slate-400 mb-1">
                                            Bundle Savings
                                        </div>
                                        <div className="text-lg font-bold text-emerald-700">
                                            ${pair.bundleSavings.toLocaleString()}
                                        </div>
                                    </div>
                                )}
                                {pair.hrrpPenaltyRisk != null && pair.hrrpPenaltyRisk > 0 && (
                                    <div
                                        className={`p-3 rounded-lg border ${
                                            pair.hrrpPenaltyRisk > 50
                                                ? 'bg-rose-50 border-rose-200'
                                                : 'bg-amber-50 border-amber-200'
                                        }`}
                                    >
                                        <div className="text-xs text-slate-400 mb-1">
                                            HRRP Penalty Risk
                                        </div>
                                        <div
                                            className={`text-lg font-bold ${
                                                pair.hrrpPenaltyRisk > 50
                                                    ? 'text-rose-700'
                                                    : 'text-amber-700'
                                            }`}
                                        >
                                            {pair.hrrpPenaltyRisk}%
                                        </div>
                                        {pair.hrrpTargetCondition && (
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                Target: {pair.hrrpTargetCondition}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Flags */}
                            <div className="flex flex-wrap gap-1 mt-2">
                                {pair.hrrpTargetCondition && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                        HRRP: {pair.hrrpTargetCondition}
                                    </span>
                                )}
                                {pair.daysBetween <= 3 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                        Rapid Return (&le;3d)
                                    </span>
                                )}
                                {pair.indexDRG === pair.readmitDRG && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                                        Identical DRG
                                    </span>
                                )}
                                {pair.isPlannedReadmission && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                        Planned
                                    </span>
                                )}
                                {pair.indexDischargeStatus === 'AMA' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                        AMA Discharge
                                    </span>
                                )}
                                {pair.indexDischargeStatus === 'Transferred' && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                                        Transfer
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">
                            Review pending — run readmission review to see
                            metrics.
                        </p>
                    )}
                </div>
            </div>

            {/* Findings */}
            {hasFindings && (
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Review Findings ({pair.readmissionFindings!.length})
                    </h4>
                    <div className="space-y-3">
                        {pair.readmissionFindings!.map(
                            (finding: ReadmissionFinding, i: number) => (
                                <div
                                    key={i}
                                    className={`p-4 rounded-lg border ${severityStyle(finding.severity)}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-2 h-2 rounded-full ${severityDot(finding.severity)}`}
                                            />
                                            <span className="text-xs font-bold uppercase tracking-wide">
                                                {finding.severity}
                                            </span>
                                            <span className="text-xs opacity-60">
                                                {finding.ruleId}
                                            </span>
                                            <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded border border-current/10">
                                                {finding.category.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        {finding.financialImpact != null && (
                                            <span className="text-sm font-bold text-rose-700">
                                                ${Math.abs(finding.financialImpact).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm leading-relaxed mb-2">
                                        {finding.description}
                                    </p>
                                    <div className="text-xs opacity-75">
                                        <span className="font-semibold">Recommendation:</span>{' '}
                                        {finding.recommendation}
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Agent Summary + Confidence */}
            {pair.agentSummary && (
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Agent Summary
                            </h4>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {pair.agentSummary}
                            </p>
                        </div>
                        {pair.agentConfidence != null && (
                            <div className="ml-6 text-center min-w-[80px]">
                                <div className="text-xs text-slate-400 mb-1">
                                    Confidence
                                </div>
                                <div className="text-2xl font-bold text-slate-900">
                                    {pair.agentConfidence}%
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${
                                            pair.agentConfidence > 80
                                                ? 'bg-emerald-500'
                                                : pair.agentConfidence > 60
                                                  ? 'bg-amber-500'
                                                  : 'bg-rose-500'
                                        }`}
                                        style={{
                                            width: `${pair.agentConfidence}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
