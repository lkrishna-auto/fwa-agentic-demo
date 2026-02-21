import fs from 'fs';
import path from 'path';
import Header from '@/components/layout/Header';
import StatCard from '@/components/dashboard/StatCard';
import DRGReviewTable from '@/components/drg-review/DRGReviewTable';
import { DRGClaim } from '@/types';

async function getDRGClaims(): Promise<DRGClaim[]> {
    const filePath = path.join(process.cwd(), 'src/data/drg-claims.json');
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch {
        return [];
    }
}

export default async function DRGReviewPage() {
    const claims = await getDRGClaims();

    const pendingCount = claims.filter(
        (c) => c.validationStatus === 'Pending'
    ).length;
    const reviewedClaims = claims.filter(
        (c) => c.validationStatus !== 'Pending'
    );
    const totalVariance = reviewedClaims.reduce(
        (sum, c) => sum + Math.abs(c.financialVariance ?? 0),
        0
    );
    const upcodedCount = claims.filter(
        (c) => c.validationStatus === 'Upcoded'
    ).length;
    const downcodedCount = claims.filter(
        (c) => c.validationStatus === 'Downcoded'
    ).length;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            <Header title="DRG Clinical Validation" />
            <main className="flex-1 overflow-y-auto p-8 max-w-[1600px] mx-auto w-full">
                <div className="mb-8 mt-2 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Inpatient DRG Review Queue
                        </h2>
                        <p className="text-slate-500 mt-1">
                            Validate MS-DRG assignments against clinical documentation.
                        </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Total Claims
                        </div>
                        <div className="text-3xl font-bold text-slate-900">
                            {claims.length}
                        </div>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <StatCard
                        title="Pending Review"
                        value={pendingCount}
                        icon="⏳"
                        delay={0}
                    />
                    <StatCard
                        title="Financial Variance"
                        value={totalVariance > 0 ? `$${totalVariance.toLocaleString()}` : '$0'}
                        icon="💲"
                        delay={100}
                    />
                    <StatCard
                        title="Upcoding Alerts"
                        value={upcodedCount}
                        icon="⚠️"
                        delay={200}
                    />
                    <StatCard
                        title="Revenue Opportunities"
                        value={downcodedCount}
                        icon="📈"
                        delay={300}
                    />
                </div>

                <DRGReviewTable initialClaims={claims} />
            </main>
        </div>
    );
}
