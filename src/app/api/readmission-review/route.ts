import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ReadmissionPair } from '@/types';
import { ReadmissionAgent } from '../../../../agents/readmission-agent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const body = await request.json();
    const { pairIds } = body;

    if (!pairIds || !Array.isArray(pairIds)) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const filePath = path.join(
        process.cwd(),
        'src/data/readmission-claims.json'
    );
    const fileContents = fs.readFileSync(filePath, 'utf8');
    let pairs: ReadmissionPair[] = JSON.parse(fileContents);

    // Simulate agent initialization
    await delay(1500);

    const agent = new ReadmissionAgent();
    const pairsToProcess = pairs.filter((p) => pairIds.includes(p.id));
    const results = await agent.reviewBatch(pairsToProcess);

    // Merge results back
    const resultMap = new Map(results.map((r) => [r.pairId, r]));
    const updatedPairs: ReadmissionPair[] = [];

    pairs = pairs.map((pair) => {
        const result = resultMap.get(pair.id);
        if (result) {
            const updated: ReadmissionPair = {
                ...pair,
                reviewStatus: result.reviewStatus,
                clinicalRelatedness: result.clinicalRelatedness,
                preventabilityScore: result.preventabilityScore,
                readmissionFindings: result.readmissionFindings,
                agentSummary: result.agentSummary,
                agentConfidence: result.agentConfidence,
                bundleSavings: result.bundleSavings,
                hrrpPenaltyRisk: result.hrrpPenaltyRisk,
                riskScore: result.riskScore,
                reviewedAt: result.processedAt,
            };
            updatedPairs.push(updated);
            return updated;
        }
        return pair;
    });

    fs.writeFileSync(filePath, JSON.stringify(pairs, null, 2));

    return NextResponse.json({
        message: 'Readmission review complete',
        processedCount: updatedPairs.length,
        updatedPairs,
    });
}
