
'use client';

import { useState } from 'react';
import { Claim, Status } from '@/types';
import { useRouter } from 'next/navigation';

interface ClaimsTableProps {
    initialClaims: Claim[];
}

export default function ClaimsTable({ initialClaims }: ClaimsTableProps) {
    const router = useRouter();
    const [claims, setClaims] = useState<Claim[]>(initialClaims);
    const [filteredStatus, setFilteredStatus] = useState<Status | 'All'>('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isAuditing, setIsAuditing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filteredClaims = claims.filter(c =>
        filteredStatus === 'All' ? true : c.status === filteredStatus
    );

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const runAudit = async () => {
        setIsAuditing(true);
        try {
            const res = await fetch('/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ claimIds: Array.from(selectedIds) }),
            });
            const data = await res.json();

            const updatedMap = new Map<string, Claim>(data.updatedClaims.map((c: Claim) => [c.id, c]));
            setClaims(prev => prev.map(c => updatedMap.get(c.id) ?? c));
            setSelectedIds(new Set());
            router.refresh();
        } catch (e) {
            console.error(e);
            alert('Audit failed');
        } finally {
            setIsAuditing(false);
        }
    };

    const getStatusStyle = (status: Status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100 ring-emerald-500/20';
            case 'Denied': return 'bg-slate-50 text-slate-700 border-slate-100 ring-slate-500/20';
            case 'Flagged': return 'bg-rose-50 text-rose-700 border-rose-100 ring-rose-500/20';
            case 'Pending': return 'bg-amber-50 text-amber-700 border-amber-100 ring-amber-500/20';
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            {/* Controls */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                <div className="flex space-x-1 p-1 bg-slate-100/50 rounded-xl">
                    {['All', 'Pending', 'Flagged', 'Approved'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilteredStatus(status as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${filteredStatus === status
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>

                {selectedIds.size > 0 && (
                    <button
                        onClick={runAudit}
                        disabled={isAuditing}
                        className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isAuditing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="font-medium">Running Agent...</span>
                            </>
                        ) : (
                            <>
                                <span>✨</span>
                                <span className="font-medium">Run AI Audit ({selectedIds.size})</span>
                            </>
                        )}
                    </button>
                )}
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
                                        if (e.target.checked) setSelectedIds(new Set(filteredClaims.map(c => c.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                    checked={filteredClaims.length > 0 && Array.from(selectedIds).length >= filteredClaims.length}
                                />
                            </th>
                            <th className="p-5 font-semibold">Claim ID</th>
                            <th className="p-5 font-semibold">Provider</th>
                            <th className="p-5 font-semibold">Service</th>
                            <th className="p-5 font-semibold">Amount</th>
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
                                    className={`group transition-all duration-200 cursor-pointer ${selectedIds.has(claim.id) ? 'bg-blue-50/30' : 'hover:bg-slate-50/80'
                                        }`}
                                    onClick={() => toggleSelection(claim.id)}
                                >
                                    <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(claim.id)}
                                            onChange={() => toggleSelection(claim.id)}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                        />
                                    </td>
                                    <td className="p-5 font-mono text-xs text-slate-500">{claim.id}</td>
                                    <td className="p-5">
                                        <div className="font-semibold text-slate-900">{claim.providerName}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{claim.providerId}</div>
                                    </td>
                                    <td className="p-5 text-slate-600">{claim.procedureCode}</td>
                                    <td className="p-5 font-medium text-slate-900">${claim.amount.toFixed(2)}</td>
                                    <td className="p-5">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${claim.riskScore > 70 ? 'bg-rose-500' : claim.riskScore > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${claim.riskScore}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-semibold ${claim.riskScore > 70 ? 'text-rose-600' : 'text-slate-600'}`}>{claim.riskScore}</span>
                                        </div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ring-1 ring-inset ${getStatusStyle(claim.status)}`}>
                                            {claim.status}
                                        </span>
                                    </td>
                                    <td className="p-5 text-right" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            className="text-slate-400 hover:text-blue-600 text-sm font-medium transition-colors"
                                            onClick={() => setExpandedId(expandedId === claim.id ? null : claim.id)}
                                        >
                                            {expandedId === claim.id ? 'Close' : 'View Details'}
                                        </button>
                                    </td>
                                </tr>
                                {expandedId === claim.id && (
                                    <tr className="bg-slate-50/50 border-b border-slate-100">
                                        <td colSpan={8} className="p-6">
                                            <div className="flex items-start space-x-6 animate-fadeIn">
                                                <div className="flex-1 bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Claim Details</h4>
                                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                                                        <div>
                                                            <div className="text-slate-400 text-xs mb-1">Beneficiary</div>
                                                            <div className="text-slate-900 font-medium">{claim.beneficiaryName}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400 text-xs mb-1">Beneficiary ID</div>
                                                            <div className="text-slate-900 font-medium">{claim.beneficiaryId}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-slate-400 text-xs mb-1">Service Date</div>
                                                            <div className="text-slate-900 font-medium">{claim.serviceDate}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {claim.aiReasoning ? (
                                                    <div className={`flex-1 p-5 rounded-xl border shadow-sm ${claim.status === 'Flagged' ? 'bg-rose-50 border-rose-100 shadow-rose-100' : 'bg-emerald-50 border-emerald-100 shadow-emerald-100'}`}>
                                                        <div className="flex items-center space-x-2 mb-3">
                                                            <span className="text-lg">{claim.status === 'Flagged' ? '🚨' : '✅'}</span>
                                                            <h4 className={`text-sm font-bold uppercase tracking-wide ${claim.status === 'Flagged' ? 'text-rose-800' : 'text-emerald-800'}`}>
                                                                AI Agent Analysis
                                                            </h4>
                                                        </div>
                                                        <p className={`text-sm leading-relaxed ${claim.status === 'Flagged' ? 'text-rose-800' : 'text-emerald-800'}`}>
                                                            {claim.aiReasoning}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex items-center justify-center p-8 border border-dashed border-slate-200 rounded-xl">
                                                        <p className="text-sm text-slate-400">No AI analysis has been run on this claim yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                        {filteredClaims.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <span className="text-4xl mb-3">🔍</span>
                                        <p className="text-sm font-medium">No claims found matching filters.</p>
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
