
import fs from 'fs';
import path from 'path';
import Header from '@/components/layout/Header';
import ClaimsTable from '@/components/claims/ClaimsTable';
import { Claim } from '@/types';

async function getClaims(): Promise<Claim[]> {
    const filePath = path.join(process.cwd(), 'src/data/claims.json');
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        return [];
    }
}

export default async function ClaimsPage() {
    const claims = await getClaims();

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            <Header title="Claims Audit" />
            <main className="flex-1 overflow-y-auto p-8 max-w-[1600px] mx-auto w-full">
                <div className="mb-8 mt-2 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Claims Queue</h2>
                        <p className="text-slate-500 mt-1">Review and audit pending claims using the AI agent.</p>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pending Review</div>
                        <div className="text-3xl font-bold text-slate-900">{claims.filter(c => c.status === 'Pending').length}</div>
                    </div>
                </div>

                <ClaimsTable initialClaims={claims} />
            </main>
        </div>
    );
}
