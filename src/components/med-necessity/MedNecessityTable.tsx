'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MedNecessityClaim, MedNecessityStatus } from '@/types';
import MedNecessityFindingsPanel from './MedNecessityFindingsPanel';

interface MedNecessityTableProps {
    initialClaims: MedNecessityClaim[];
}

type FilterStatus = MedNecessityStatus | 'All';

const getStatusStyle = (status: MedNecessityStatus) => {
    switch (status) {
        case 'Meets Criteria':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-500/20';
        case 'Does Not Meet':
            return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/20';
        case 'Observation':
            return 'bg-blue-50 text-blue-700 border-blue-100 ring-blue-500/20';
        case 'Queried':
            return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/20';
        case 'Pending':
            return 'bg-slate-50 text-slate-600 border-slate-100 ring-slate-500/20';
    }
};

export default function MedNecessityTable({
    initialClaims,
}: MedNecessityTableProps) {
    const router = useRouter();
    const [claims, setClaims] = useState<MedNecessityClaim[]>(initialClaims);
    const [filteredStatus, setFilteredStatus] = useState<FilterStatus>('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isReviewing, setIsReviewing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredClaims = claims.filter((c) =>
        filteredStatus === 'All'
            ? true
            : c.medNecessityStatus === filteredStatus
    );

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const runReview = async () => {
        setIsReviewing(true);
        try {
            const ids =
                selectedIds.size > 0
                    ? Array.from(selectedIds)
                    : claims
                          .filter((c) => c.medNecessityStatus === 'Pending')
                          .map((c) => c.id);

            const res = await fetch('/api/med-necessity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimIds: ids }),
            });
            const data = await res.json();

            const updatedMap = new Map(
                data.updatedClaims.map((c: MedNecessityClaim) => [c.id, c])
            );
            setClaims((prev) =>
                prev.map(
                    (c) =>
                        (updatedMap.get(c.id) as MedNecessityClaim) || c
                )
            );
            setSelectedIds(new Set());
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('Medical necessity review failed');
        } finally {
            setIsReviewing(false);
        }
    };

    const pendingCount = claims.filter(
        (c) => c.medNecessityStatus === 'Pending'
    ).length;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Controls */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex space-x-1 p-1 bg-slate-100/50 rounded-xl">
                    {(
                        [
                            'All',
                            'Pending',
                            'Meets Criteria',
                            'Does Not Meet',
                            'Observation',
                            'Queried',
                        ] as FilterStatus[]
                    ).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilteredStatus(status)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                filteredStatus === status
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                <button
                    onClick={runReview}
                    disabled={
                        isReviewing ||
                        (selectedIds.size === 0 && pendingCount === 0)
                    }
                    className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isReviewing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="font-medium">
                                Reviewing Claims...
                            </span>
                        </>
                    ) : (
                        <>
                            <span>🔍</span>
                            <span className="font-medium">
                                Run Med Necessity Review
                                {selectedIds.size > 0
                                    ? ` (${selectedIds.size})`
                                    : pendingCount > 0
                                      ? ` (${pendingCount} pending)`
                                      : ''}
                            </span>
                        </>
                    )}
                </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100">
                        <tr>
                            <th className="p-5 w-14 text-center">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                    onChange={(e) => {
                                        if (e.target.checked)
                                            setSelectedIds(
                                                new Set(
                                                    filteredClaims.map(
                                                        (c) => c.id
                                                    )
                                                )
                                            );
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={
                                        filteredClaims.length > 0 &&
                                        selectedIds.size >=
                                            filteredClaims.length
                                    }
                                />
                            </th>
                            <th className="p-5 font-semibold">Claim ID</th>
                            <th className="p-5 font-semibold">Patient</th>
                            <th className="p-5 font-semibold">Provider</th>
                            <th className="p-5 font-semibold">DRG</th>
                            <th className="p-5 font-semibold">Billed</th>
                            <th className="p-5 font-semibold">LOS</th>
                            <th className="p-5 font-semibold">Risk Score</th>
                            <th className="p-5 font-semibold">Status</th>
                            <th className="p-5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredClaims.map((claim) => (
                            <>
                                <tr
                                    key={claim.id}
                                    className={`group transition-all duration-200 cursor-pointer ${
                                        selectedIds.has(claim.id)
                                            ? 'bg-blue-50/30'
                                            : 'hover:bg-slate-50/80'
                                    }`}
                                    onClick={() => toggleSelection(claim.id)}
                                >
                                    <td
                                        className="p-5 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(claim.id)}
                                            onChange={() =>
                                                toggleSelection(claim.id)
                                            }
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                        />
                                    </td>
                                    <td className="p-5 font-mono text-xs text-slate-500">
                                        {claim.id}
                                    </td>
                                    <td className="p-5">
                                        <div className="font-semibold text-slate-900">
                                            {claim.beneficiaryName}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {claim.beneficiaryId}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="text-slate-700">
                                            {claim.providerName}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {claim.attendingSpecialty}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-semibold text-slate-900">
                                            DRG {claim.assignedDRG}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate">
                                            {claim.assignedDRGDescription}
                                        </div>
                                    </td>
                                    <td className="p-5 font-medium text-slate-900">
                                        $
                                        {claim.billedAmount.toLocaleString()}
                                    </td>
                                    <td className="p-5 text-slate-700">
                                        {claim.lengthOfStay}d
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        claim.riskScore > 70
                                                            ? 'bg-rose-500'
                                                            : claim.riskScore >
                                                                40
                                                              ? 'bg-amber-500'
                                                              : 'bg-emerald-500'
                                                    }`}
                                                    style={{
                                                        width: `${claim.riskScore}%`,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className={`text-xs font-semibold ${
                                                    claim.riskScore > 70
                                                        ? 'text-rose-600'
                                                        : 'text-slate-600'
                                                }`}
                                            >
                                                {claim.riskScore}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span
                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ring-1 ring-inset ${getStatusStyle(claim.medNecessityStatus)}`}
                                        >
                                            {claim.medNecessityStatus}
                                        </span>
                                    </td>
                                    <td
                                        className="p-5 text-right"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            className="text-slate-400 hover:text-blue-600 text-sm font-medium transition-colors"
                                            onClick={() =>
                                                setExpandedId(
                                                    expandedId === claim.id
                                                        ? null
                                                        : claim.id
                                                )
                                            }
                                        >
                                            {expandedId === claim.id
                                                ? 'Close'
                                                : 'Details'}
                                        </button>
                                    </td>
                                </tr>
                                {expandedId === claim.id && (
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <td colSpan={10} className="p-6">
                                            <MedNecessityFindingsPanel
                                                claim={claim}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {filteredClaims.length === 0 && (
                            <tr>
                                <td
                                    colSpan={10}
                                    className="p-12 text-center"
                                >
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <span className="text-4xl mb-3">
                                            🔍
                                        </span>
                                        <p className="text-sm font-medium">
                                            No claims found matching filters.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
