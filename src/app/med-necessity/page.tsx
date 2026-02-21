import fs from 'fs';
import path from 'path';
import Header from '@/components/layout/Header';
import StatCard from '@/components/dashboard/StatCard';
import MedNecessityTable from '@/components/med-necessity/MedNecessityTable';
import { MedNecessityClaim } from '@/types';

async function getMedNecessityClaims(): Promise<MedNecessityClaim[]> {
    const filePath = path.join(
        process.cwd(),
        'src/data/med-necessity-claims.json'
    );
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch {
        return [];
    }
}

export default async function MedNecessityPage() {
    const claims = await getMedNecessityClaims();

    const pendingCount = claims.filter(
        (c) => c.medNecessityStatus === 'Pending'
    ).length;
    const reviewedClaims = claims.filter(
        (c) => c.medNecessityStatus !== 'Pending'
    );
    const doesNotMeetCount = claims.filter(
        (c) => c.medNecessityStatus === 'Does Not Meet'
    ).length;
    const observationCount = claims.filter(
        (c) => c.medNecessityStatus === 'Observation'
    ).length;
    const totalDenialExposure = reviewedClaims.reduce(
        (sum, c) => sum + (c.estimatedDenialAmount ?? 0),
        0
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            <Header title="Medical Necessity Review" />
            <main className="flex-1 overflow-y-auto p-8 max-w-[1600px] mx-auto w-full">
                <div className="mb-8 mt-2 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Inpatient Medical Necessity Queue
                        </h2>
                        <p className="text-slate-500 mt-1">
                            Evaluate inpatient admissions against medical
                            necessity criteria.
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
                        title="Denial Exposure"
                        value={
                            totalDenialExposure > 0
                                ? `$${totalDenialExposure.toLocaleString()}`
                                : '$0'
                        }
                        icon="💲"
                        delay={100}
                    />
                    <StatCard
                        title="Does Not Meet"
                        value={doesNotMeetCount}
                        icon="🚫"
                        delay={200}
                    />
                    <StatCard
                        title="Observation Candidates"
                        value={observationCount}
                        icon="👁️"
                        delay={300}
                    />
                </div>

                <MedNecessityTable initialClaims={claims} />
            </main>
        </div>
    );
}
