'use client';

import { DRGClaim, DRGValidationFinding, FindingSeverity } from '@/types';

interface DRGFindingsPanelProps {
    claim: DRGClaim;
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

export default function DRGFindingsPanel({ claim }: DRGFindingsPanelProps) {
    const hasFindings = claim.agentFindings && claim.agentFindings.length > 0;
    const hasExpectedDRG = claim.expectedDRG && claim.expectedDRG !== claim.assignedDRG;
    const variance = claim.financialVariance ?? 0;

    return (
        <div className="animate-fadeIn space-y-4">
            {/* Top row: DRG Comparison + Diagnoses */}
            <div className="grid grid-cols-2 gap-4">
                {/* DRG Comparison */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        DRG Assignment Review
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Assigned */}
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="text-xs text-slate-400 mb-1">Assigned DRG</div>
                            <div className="text-lg font-bold text-slate-900">
                                {claim.assignedDRG}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                {claim.assignedDRGDescription}
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                Weight: {claim.assignedDRGWeight.toFixed(4)}
                            </div>
                            <div className="text-sm font-semibold text-slate-700">
                                ${claim.billedAmount.toLocaleString()}
                            </div>
                        </div>

                        {/* Expected */}
                        {hasExpectedDRG ? (
                            <div
                                className={`p-3 rounded-lg border ${
                                    variance > 0
                                        ? 'bg-emerald-50 border-emerald-200'
                                        : 'bg-rose-50 border-rose-200'
                                }`}
                            >
                                <div className="text-xs text-slate-400 mb-1">Expected DRG</div>
                                <div
                                    className={`text-lg font-bold ${
                                        variance > 0 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                >
                                    {claim.expectedDRG}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                    {claim.expectedDRGDescription}
                                </div>
                                <div className="mt-2 text-xs text-slate-400">
                                    Weight: {claim.expectedDRGWeight?.toFixed(4)}
                                </div>
                                <div
                                    className={`text-sm font-semibold ${
                                        variance > 0 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                >
                                    ${claim.expectedReimbursement?.toLocaleString()}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                                <div className="text-xs text-slate-400 mb-1">Expected DRG</div>
                                <div className="text-lg font-bold text-emerald-700">
                                    {claim.assignedDRG}
                                </div>
                                <div className="text-xs text-emerald-600 mt-1">
                                    No change — assignment validated
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Financial variance */}
                    {variance !== 0 && (
                        <div
                            className={`mt-3 p-3 rounded-lg text-center ${
                                variance > 0
                                    ? 'bg-emerald-100 border border-emerald-200'
                                    : 'bg-rose-100 border border-rose-200'
                            }`}
                        >
                            <div className="text-xs text-slate-500 mb-0.5">
                                Financial Variance
                            </div>
                            <div
                                className={`text-xl font-bold ${
                                    variance > 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                            >
                                {variance > 0 ? '+' : ''}${variance.toLocaleString()}
                            </div>
                            <div
                                className={`text-xs mt-0.5 ${
                                    variance > 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                            >
                                {variance > 0
                                    ? 'Potential missed revenue (downcoded)'
                                    : 'Potential overbilling (upcoded)'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Clinical Details */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Clinical Details
                    </h4>
                    <div className="space-y-3 text-sm">
                        <div>
                            <div className="text-slate-400 text-xs mb-1">Patient</div>
                            <div className="text-slate-900 font-medium">
                                {claim.beneficiaryName} ({claim.beneficiaryId})
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-slate-400 text-xs mb-1">Admission</div>
                                <div className="text-slate-700">{claim.admissionDate}</div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs mb-1">Discharge</div>
                                <div className="text-slate-700">{claim.dischargeDate}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-slate-400 text-xs mb-1">LOS</div>
                                <div className="text-slate-700">{claim.lengthOfStay} days</div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs mb-1">Type</div>
                                <div className="text-slate-700">{claim.admissionType}</div>
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-400 text-xs mb-1">Principal Dx</div>
                            <div className="text-slate-900 font-medium text-xs">
                                {claim.primaryDiagnosis.code}: {claim.primaryDiagnosis.description}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-400 text-xs mb-1">
                                Secondary Dx ({claim.secondaryDiagnoses.length})
                            </div>
                            {claim.secondaryDiagnoses.map((dx) => (
                                <div
                                    key={dx.code}
                                    className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5"
                                >
                                    <span>
                                        {dx.code}: {dx.description}
                                    </span>
                                    {dx.isMCC && (
                                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                                            MCC
                                        </span>
                                    )}
                                    {dx.isCC && !dx.isMCC && (
                                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">
                                            CC
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Findings */}
            {hasFindings && (
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Validation Findings ({claim.agentFindings!.length})
                    </h4>
                    <div className="space-y-3">
                        {claim.agentFindings!.map((finding: DRGValidationFinding, i: number) => (
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
                                    </div>
                                    {finding.financialImpact != null && (
                                        <span
                                            className={`text-sm font-bold ${
                                                finding.financialImpact > 0
                                                    ? 'text-emerald-700'
                                                    : 'text-rose-700'
                                            }`}
                                        >
                                            {finding.financialImpact > 0 ? '+' : ''}$
                                            {Math.abs(finding.financialImpact).toLocaleString()}
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
                        ))}
                    </div>
                </div>
            )}

            {/* Agent Summary + Confidence */}
            {claim.agentSummary && (
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                Agent Summary
                            </h4>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {claim.agentSummary}
                            </p>
                        </div>
                        {claim.agentConfidence != null && (
                            <div className="ml-6 text-center min-w-[80px]">
                                <div className="text-xs text-slate-400 mb-1">Confidence</div>
                                <div className="text-2xl font-bold text-slate-900">
                                    {claim.agentConfidence}%
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${
                                            claim.agentConfidence > 80
                                                ? 'bg-emerald-500'
                                                : claim.agentConfidence > 60
                                                  ? 'bg-amber-500'
                                                  : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${claim.agentConfidence}%` }}
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
