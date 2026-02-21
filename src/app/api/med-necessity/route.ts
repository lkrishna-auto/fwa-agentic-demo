import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { MedNecessityClaim } from '@/types';
import { MedNecessityAgent } from '../../../../agents/med-necessity-agent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const body = await request.json();
    const { claimIds } = body;

    if (!claimIds || !Array.isArray(claimIds)) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const filePath = path.join(
        process.cwd(),
        'src/data/med-necessity-claims.json'
    );
    const fileContents = fs.readFileSync(filePath, 'utf8');
    let claims: MedNecessityClaim[] = JSON.parse(fileContents);

    // Simulate agent initialization
    await delay(1500);

    const agent = new MedNecessityAgent();
    const claimsToProcess = claims.filter((c) => claimIds.includes(c.id));
    const results = await agent.reviewBatch(claimsToProcess);

    // Merge results back into claims
    const resultMap = new Map(results.map((r) => [r.claimId, r]));
    const updatedClaims: MedNecessityClaim[] = [];

    claims = claims.map((claim) => {
        const result = resultMap.get(claim.id);
        if (result) {
            const updated: MedNecessityClaim = {
                ...claim,
                medNecessityStatus: result.medNecessityStatus,
                recommendedLevelOfCare: result.recommendedLevelOfCare,
                criteriaAssessment: result.criteriaAssessment,
                medNecessityFindings: result.medNecessityFindings,
                agentSummary: result.agentSummary,
                agentConfidence: result.agentConfidence,
                denialRisk: result.denialRisk,
                estimatedDenialAmount: result.estimatedDenialAmount,
                riskScore: result.riskScore,
                reviewedAt: result.processedAt,
            };
            updatedClaims.push(updated);
            return updated;
        }
        return claim;
    });

    fs.writeFileSync(filePath, JSON.stringify(claims, null, 2));

    return NextResponse.json({
        message: 'Medical necessity review complete',
        processedCount: updatedClaims.length,
        updatedClaims,
    });
}
