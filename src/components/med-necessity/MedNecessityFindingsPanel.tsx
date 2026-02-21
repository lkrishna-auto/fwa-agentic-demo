'use client';

import { MedNecessityClaim, MedNecessityFinding, FindingSeverity } from '@/types';

interface MedNecessityFindingsPanelProps {
    claim: MedNecessityClaim;
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

const criteriaStatusStyle = (status: string) => {
    switch (status) {
        case 'Met':
        case 'Justified':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'Not Met':
        case 'Not Justified':
            return 'bg-rose-100 text-rose-700 border-rose-200';
        default:
            return 'bg-amber-100 text-amber-700 border-amber-200';
    }
};

export default function MedNecessityFindingsPanel({
    claim,
}: MedNecessityFindingsPanelProps) {
    const hasFindings =
        claim.medNecessityFindings && claim.medNecessityFindings.length > 0;
    const criteria = claim.criteriaAssessment;

    return (
        <div className="animate-fadeIn space-y-4">
            {/* Top row: Criteria Assessment + Clinical Details */}
            <div className="grid grid-cols-2 gap-4">
                {/* Criteria Assessment */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Medical Necessity Assessment
                    </h4>

                    {criteria ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Severity of Illness
                                    </div>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${criteriaStatusStyle(criteria.severityOfIllness)}`}
                                    >
                                        {criteria.severityOfIllness}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Intensity of Service
                                    </div>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${criteriaStatusStyle(criteria.intensityOfService)}`}
                                    >
                                        {criteria.intensityOfService}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Admission Criteria
                                    </div>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${criteriaStatusStyle(criteria.admissionCriteria)}`}
                                    >
                                        {criteria.admissionCriteria}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">
                                        Continued Stay
                                    </div>
                                    <span
                                        className={`inline-flex px-2 py-0.5 rounded text-xs font-bold border ${criteriaStatusStyle(criteria.continuedStay)}`}
                                    >
                                        {criteria.continuedStay}
                                    </span>
                                </div>
                            </div>

                            {/* Level of Care + Denial Risk */}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                {claim.recommendedLevelOfCare && (
                                    <div
                                        className={`p-3 rounded-lg border ${
                                            claim.recommendedLevelOfCare ===
                                            'Inpatient'
                                                ? 'bg-emerald-50 border-emerald-200'
                                                : 'bg-amber-50 border-amber-200'
                                        }`}
                                    >
                                        <div className="text-xs text-slate-400 mb-1">
                                            Recommended Level of Care
                                        </div>
                                        <div
                                            className={`text-sm font-bold ${
                                                claim.recommendedLevelOfCare ===
                                                'Inpatient'
                                                    ? 'text-emerald-700'
                                                    : 'text-amber-700'
                                            }`}
                                        >
                                            {claim.recommendedLevelOfCare}
                                        </div>
                                    </div>
                                )}
                                {claim.denialRisk != null && (
                                    <div
                                        className={`p-3 rounded-lg border ${
                                            claim.denialRisk > 60
                                                ? 'bg-rose-50 border-rose-200'
                                                : claim.denialRisk > 30
                                                  ? 'bg-amber-50 border-amber-200'
                                                  : 'bg-emerald-50 border-emerald-200'
                                        }`}
                                    >
                                        <div className="text-xs text-slate-400 mb-1">
                                            Denial Risk
                                        </div>
                                        <div
                                            className={`text-lg font-bold ${
                                                claim.denialRisk > 60
                                                    ? 'text-rose-700'
                                                    : claim.denialRisk > 30
                                                      ? 'text-amber-700'
                                                      : 'text-emerald-700'
                                            }`}
                                        >
                                            {claim.denialRisk}%
                                        </div>
                                        {claim.estimatedDenialAmount != null &&
                                            claim.estimatedDenialAmount > 0 && (
                                                <div className="text-xs text-rose-600 mt-0.5">
                                                    Exposure: $
                                                    {claim.estimatedDenialAmount.toLocaleString()}
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">
                            Review pending — run medical necessity assessment to
                            see criteria evaluation.
                        </p>
                    )}
                </div>

                {/* Clinical Details */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Clinical Details
                    </h4>
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-slate-400 text-xs mb-1">
                                    Admission
                                </div>
                                <div className="text-slate-700">
                                    {claim.admissionDate}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs mb-1">
                                    Discharge
                                </div>
                                <div className="text-slate-700">
                                    {claim.dischargeDate}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <div className="text-slate-400 text-xs mb-1">
                                    LOS
                                </div>
                                <div className="text-slate-700">
                                    {claim.lengthOfStay} days
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs mb-1">
                                    Type
                                </div>
                                <div className="text-slate-700">
                                    {claim.admissionType}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-400 text-xs mb-1">
                                    Discharge
                                </div>
                                <div className="text-slate-700">
                                    {claim.dischargeStatus}
                                </div>
                            </div>
                        </div>

                        {/* Vitals */}
                        <div>
                            <div className="text-slate-400 text-xs mb-1">
                                Admission Vitals
                            </div>
                            <div className="grid grid-cols-5 gap-1 text-xs">
                                <div className="bg-slate-50 rounded p-1.5 text-center">
                                    <div className="text-slate-400">BP</div>
                                    <div className="font-semibold text-slate-700">
                                        {claim.admissionVitals.bloodPressure}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded p-1.5 text-center">
                                    <div className="text-slate-400">HR</div>
                                    <div className="font-semibold text-slate-700">
                                        {claim.admissionVitals.heartRate}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded p-1.5 text-center">
                                    <div className="text-slate-400">Temp</div>
                                    <div className="font-semibold text-slate-700">
                                        {claim.admissionVitals.temperature}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded p-1.5 text-center">
                                    <div className="text-slate-400">RR</div>
                                    <div className="font-semibold text-slate-700">
                                        {claim.admissionVitals.respiratoryRate}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded p-1.5 text-center">
                                    <div className="text-slate-400">SpO2</div>
                                    <div className="font-semibold text-slate-700">
                                        {claim.admissionVitals.o2Saturation}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lab Values */}
                        <div>
                            <div className="text-slate-400 text-xs mb-1">
                                Lab Values
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {claim.admissionLabValues.map((lab) => (
                                    <span
                                        key={lab.name}
                                        className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                            lab.abnormal
                                                ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                                : 'bg-slate-50 text-slate-600 border-slate-100'
                                        }`}
                                    >
                                        {lab.name}: {lab.value}{' '}
                                        {lab.unit}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Resource Indicators */}
                        <div>
                            <div className="text-slate-400 text-xs mb-1">
                                Resource Utilization
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {claim.ivMedicationsRequired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                        IV Meds
                                    </span>
                                )}
                                {claim.icuAdmission && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                                        ICU
                                    </span>
                                )}
                                {claim.surgicalProcedure && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
                                        Surgery
                                    </span>
                                )}
                                {claim.telemetryRequired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                                        Telemetry
                                    </span>
                                )}
                                {claim.oxygenRequired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-medium">
                                        O2
                                    </span>
                                )}
                                {claim.isolationRequired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 font-medium">
                                        Isolation
                                    </span>
                                )}
                                {!claim.ivMedicationsRequired &&
                                    !claim.icuAdmission &&
                                    !claim.surgicalProcedure &&
                                    !claim.telemetryRequired &&
                                    !claim.oxygenRequired &&
                                    !claim.isolationRequired && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                                            No hospital-level services
                                        </span>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Findings */}
            {hasFindings && (
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        Review Findings ({claim.medNecessityFindings!.length})
                    </h4>
                    <div className="space-y-3">
                        {claim.medNecessityFindings!.map(
                            (finding: MedNecessityFinding, i: number) => (
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
                                                {finding.category.replace(
                                                    /_/g,
                                                    ' '
                                                )}
                                            </span>
                                        </div>
                                        {finding.financialImpact != null && (
                                            <span className="text-sm font-bold text-rose-700">
                                                $
                                                {Math.abs(
                                                    finding.financialImpact
                                                ).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm leading-relaxed mb-2">
                                        {finding.description}
                                    </p>
                                    <div className="text-xs opacity-75">
                                        <span className="font-semibold">
                                            Recommendation:
                                        </span>{' '}
                                        {finding.recommendation}
                                    </div>
                                </div>
                            )
                        )}
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
                                <div className="text-xs text-slate-400 mb-1">
                                    Confidence
                                </div>
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
                                        style={{
                                            width: `${claim.agentConfidence}%`,
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
