
import fs from 'fs';
import path from 'path';
import Header from '@/components/layout/Header';
import StatCard from '@/components/dashboard/StatCard';
import { Claim } from '@/types';
import Link from 'next/link';

async function getClaims(): Promise<Claim[]> {
    const filePath = path.join(process.cwd(), 'src/data/claims.json');
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        return [];
    }
}

export default async function Dashboard() {
    const claims = await getClaims();

    // Metrics
    const totalClaims = claims.length;
    const totalAmount = claims.reduce((acc, c) => acc + c.amount, 0);
    const flaggedClaims = claims.filter(c => c.status === 'Flagged' || (c.status === 'Pending' && c.riskScore > 70));
    const flaggedAmount = flaggedClaims.reduce((acc, c) => acc + c.amount, 0);
    const avgRisk = Math.round(claims.reduce((acc, c) => acc + c.riskScore, 0) / totalClaims);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            <Header title="Overview" />

            <main className="flex-1 overflow-y-auto p-8 max-w-[1600px] mx-auto w-full">
                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Volume"
                        value={`$${totalAmount.toLocaleString()}`}
                        icon="💰"
                        trend={{ value: 12, direction: 'up' }}
                        delay={0}
                    />
                    <StatCard
                        title="Risk Detected"
                        value={`$${flaggedAmount.toLocaleString()}`}
                        icon="🚨"
                        trend={{ value: 5, direction: 'down' }}
                        delay={100}
                    />
                    <StatCard
                        title="Pending Review"
                        value={claims.filter(c => c.status === 'Pending').length.toString()}
                        icon="⏳"
                        delay={200}
                    />
                    <StatCard
                        title="Avg. Risk Score"
                        value={avgRisk.toString()}
                        icon="🎯"
                        trend={{ value: 2, direction: 'up' }}
                        delay={300}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Chart Area (Mock) */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(6,24,44,0.05)]">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Risk Analysis Trends</h3>
                            <select className="bg-slate-50 border border-slate-200 text-slate-600 text-sm rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-blue-100">
                                <option>Last 30 Days</option>
                                <option>Last Quarter</option>
                            </select>
                        </div>

                        <div className="h-64 flex items-end space-x-3 px-4">
                            {[40, 65, 30, 80, 55, 90, 45, 60, 35, 75, 50, 85].map((h, i) => (
                                <div key={i} className="flex-1 group relative flex flex-col justify-end h-full">
                                    <div
                                        className={`w-full rounded-t-md transition-all duration-500 opacity-80 hover:opacity-100 group-hover:scale-y-105 origin-bottom ${h > 70 ? 'bg-gradient-to-t from-rose-500 to-rose-400' : 'bg-gradient-to-t from-blue-500 to-indigo-400'}`}
                                        style={{ height: `${h}%` }}
                                    ></div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-xs font-medium text-slate-400 mt-4 px-4 border-t border-slate-50 pt-4">
                            <span>Week 1</span>
                            <span>Week 2</span>
                            <span>Week 3</span>
                            <span>Week 4</span>
                        </div>
                    </div>

                    {/* Recent Alerts */}
                    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(6,24,44,0.05)] flex flex-col">
                        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-6">Priority Alerts</h3>
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {flaggedClaims.slice(0, 5).map(claim => (
                                <div key={claim.id} className="group flex items-start p-4 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-slate-50 transition-all cursor-pointer">
                                    <div className="mr-4 text-xl bg-rose-50 w-10 h-10 rounded-full flex items-center justify-center border border-rose-100 text-rose-600 group-hover:scale-110 transition-transform">⚠️</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-sm font-bold text-slate-800 truncate">{claim.providerName}</h4>
                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-medium">#{claim.id.split('-')[1]}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">High Risk Score: <span className="font-semibold text-rose-600">{claim.riskScore}</span></p>
                                        <Link href={`/claims`} className="text-xs text-blue-600 font-bold hover:text-blue-700 mt-2 inline-flex items-center group-hover:translate-x-1 transition-transform">
                                            Investigate →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                            {flaggedClaims.length === 0 && (
                                <div className="text-center text-slate-400 py-8">No high priority alerts.</div>
                            )}
                        </div>
                        <div className="mt-6 pt-0 text-center">
                            <Link href="/claims" className="block w-full py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">View All Actions</Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
