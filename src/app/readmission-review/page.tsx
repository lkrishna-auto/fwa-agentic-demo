import fs from 'fs';
import path from 'path';
import Header from '@/components/layout/Header';
import StatCard from '@/components/dashboard/StatCard';
import ReadmissionTable from '@/components/readmission/ReadmissionTable';
import { ReadmissionPair } from '@/types';

async function getReadmissionPairs(): Promise<ReadmissionPair[]> {
    const filePath = path.join(
        process.cwd(),
        'src/data/readmission-claims.json'
    );
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch {
        return [];
    }
}

export default async function ReadmissionReviewPage() {
    const pairs = await getReadmissionPairs();

    const pendingCount = pairs.filter(
        (p) => p.reviewStatus === 'Pending'
    ).length;
    const reviewedPairs = pairs.filter(
        (p) => p.reviewStatus !== 'Pending'
    );
    const preventableCount = pairs.filter(
        (p) => p.reviewStatus === 'Potentially Preventable'
    ).length;
    const bundleCount = pairs.filter(
        (p) => p.reviewStatus === 'Bundle Candidate'
    ).length;
    const totalBundleSavings = reviewedPairs.reduce(
        (sum, p) => sum + (p.bundleSavings ?? 0),
        0
    );
    const hrrpCount = pairs.filter(
        (p) => p.hrrpTargetCondition && !p.isPlannedReadmission
    ).length;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            <Header title="Readmission Review" />
            <main className="flex-1 overflow-y-auto p-8 max-w-[1600px] mx-auto w-full">
                <div className="mb-8 mt-2 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Readmission Review Queue
                        </h2>
                        <p className="text-slate-500 mt-1">
                            Evaluate readmission pairs for clinical relatedness,
                            preventability, and bundling opportunities.
                        </p>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                            Total Pairs
                        </div>
                        <div className="text-3xl font-bold text-slate-900">
                            {pairs.length}
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
                        title="Bundle Savings"
                        value={
                            totalBundleSavings > 0
                                ? `$${totalBundleSavings.toLocaleString()}`
                                : '$0'
                        }
                        icon="💲"
                        delay={100}
                    />
                    <StatCard
                        title="Preventable"
                        value={preventableCount + bundleCount}
                        icon="⚠️"
                        delay={200}
                    />
                    <StatCard
                        title="HRRP Target"
                        value={hrrpCount}
                        icon="🏥"
                        delay={300}
                    />
                </div>

                <ReadmissionTable initialPairs={pairs} />
            </main>
        </div>
    );
}
