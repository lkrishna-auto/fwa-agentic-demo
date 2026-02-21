'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReadmissionPair, ReadmissionReviewStatus } from '@/types';
import ReadmissionFindingsPanel from './ReadmissionFindingsPanel';

interface ReadmissionTableProps {
    initialPairs: ReadmissionPair[];
}

type FilterStatus = ReadmissionReviewStatus | 'All';

const getStatusStyle = (status: ReadmissionReviewStatus) => {
    switch (status) {
        case 'Clinically Related':
            return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/20';
        case 'Not Related':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-500/20';
        case 'Planned':
            return 'bg-blue-50 text-blue-700 border-blue-100 ring-blue-500/20';
        case 'Potentially Preventable':
            return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/20';
        case 'Bundle Candidate':
            return 'bg-purple-50 text-purple-700 border-purple-100 ring-purple-500/20';
        case 'Pending':
            return 'bg-slate-50 text-slate-600 border-slate-100 ring-slate-500/20';
    }
};

export default function ReadmissionTable({
    initialPairs,
}: ReadmissionTableProps) {
    const router = useRouter();
    const [pairs, setPairs] = useState<ReadmissionPair[]>(initialPairs);
    const [filteredStatus, setFilteredStatus] = useState<FilterStatus>('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isReviewing, setIsReviewing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredPairs = pairs.filter((p) =>
        filteredStatus === 'All'
            ? true
            : p.reviewStatus === filteredStatus
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
                    : pairs
                          .filter((p) => p.reviewStatus === 'Pending')
                          .map((p) => p.id);

            const res = await fetch('/api/readmission-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pairIds: ids }),
            });
            const data = await res.json();

            const updatedMap = new Map(
                data.updatedPairs.map((p: ReadmissionPair) => [p.id, p])
            );
            setPairs((prev) =>
                prev.map(
                    (p) =>
                        (updatedMap.get(p.id) as ReadmissionPair) || p
                )
            );
            setSelectedIds(new Set());
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('Readmission review failed');
        } finally {
            setIsReviewing(false);
        }
    };

    const pendingCount = pairs.filter(
        (p) => p.reviewStatus === 'Pending'
    ).length;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Controls */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex space-x-1 p-1 bg-slate-100/50 rounded-xl overflow-x-auto">
                    {(
                        [
                            'All',
                            'Pending',
                            'Potentially Preventable',
                            'Bundle Candidate',
                            'Clinically Related',
                            'Not Related',
                            'Planned',
                        ] as FilterStatus[]
                    ).map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilteredStatus(status)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
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
                    className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ml-3 flex-shrink-0"
                >
                    {isReviewing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span className="font-medium">
                                Reviewing...
                            </span>
                        </>
                    ) : (
                        <>
                            <span>🔄</span>
                            <span className="font-medium">
                                Run Readmission Review
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
                                                    filteredPairs.map((p) => p.id)
                                                )
                                            );
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={
                                        filteredPairs.length > 0 &&
                                        selectedIds.size >= filteredPairs.length
                                    }
                                />
                            </th>
                            <th className="p-5 font-semibold">Pair ID</th>
                            <th className="p-5 font-semibold">Patient</th>
                            <th className="p-5 font-semibold">Index DRG</th>
                            <th className="p-5 font-semibold">Readmit DRG</th>
                            <th className="p-5 font-semibold">Days</th>
                            <th className="p-5 font-semibold">Combined $</th>
                            <th className="p-5 font-semibold">Risk Score</th>
                            <th className="p-5 font-semibold">Status</th>
                            <th className="p-5"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredPairs.map((pair) => (
                            <>
                                <tr
                                    key={pair.id}
                                    className={`group transition-all duration-200 cursor-pointer ${
                                        selectedIds.has(pair.id)
                                            ? 'bg-blue-50/30'
                                            : 'hover:bg-slate-50/80'
                                    }`}
                                    onClick={() => toggleSelection(pair.id)}
                                >
                                    <td
                                        className="p-5 text-center"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(pair.id)}
                                            onChange={() =>
                                                toggleSelection(pair.id)
                                            }
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                        />
                                    </td>
                                    <td className="p-5 font-mono text-xs text-slate-500">
                                        {pair.id}
                                    </td>
                                    <td className="p-5">
                                        <div className="font-semibold text-slate-900">
                                            {pair.indexBeneficiaryName}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {pair.indexProviderName}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-semibold text-slate-900">
                                            {pair.indexDRG}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate">
                                            {pair.indexDRGDescription}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <div className={`font-semibold ${pair.indexDRG === pair.readmitDRG ? 'text-rose-600' : 'text-slate-900'}`}>
                                            {pair.readmitDRG}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5 max-w-[140px] truncate">
                                            {pair.readmitDRGDescription}
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span
                                            className={`text-sm font-bold ${
                                                pair.daysBetween <= 3
                                                    ? 'text-rose-600'
                                                    : pair.daysBetween <= 7
                                                      ? 'text-amber-600'
                                                      : 'text-slate-700'
                                            }`}
                                        >
                                            {pair.daysBetween}d
                                        </span>
                                    </td>
                                    <td className="p-5 font-medium text-slate-900">
                                        ${pair.combinedBilledAmount.toLocaleString()}
                                    </td>
                                    <td className="p-5">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        pair.riskScore > 70
                                                            ? 'bg-rose-500'
                                                            : pair.riskScore > 40
                                                              ? 'bg-amber-500'
                                                              : 'bg-emerald-500'
                                                    }`}
                                                    style={{
                                                        width: `${pair.riskScore}%`,
                                                    }}
                                                />
                                            </div>
                                            <span
                                                className={`text-xs font-semibold ${
                                                    pair.riskScore > 70
                                                        ? 'text-rose-600'
                                                        : 'text-slate-600'
                                                }`}
                                            >
                                                {pair.riskScore}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span
                                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ring-1 ring-inset ${getStatusStyle(pair.reviewStatus)}`}
                                        >
                                            {pair.reviewStatus}
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
                                                    expandedId === pair.id
                                                        ? null
                                                        : pair.id
                                                )
                                            }
                                        >
                                            {expandedId === pair.id
                                                ? 'Close'
                                                : 'Details'}
                                        </button>
                                    </td>
                                </tr>
                                {expandedId === pair.id && (
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <td colSpan={10} className="p-6">
                                            <ReadmissionFindingsPanel
                                                pair={pair}
                                            />
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {filteredPairs.length === 0 && (
                            <tr>
                                <td colSpan={10} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <span className="text-4xl mb-3">🔄</span>
                                        <p className="text-sm font-medium">
                                            No readmission pairs found matching filters.
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
