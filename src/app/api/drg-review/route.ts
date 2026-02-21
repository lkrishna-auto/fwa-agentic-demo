import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DRGClaim } from '@/types';
import { DRGValidationAgent } from '../../../../agents/drg-validation-agent';

// Simulate initial agent "thinking" delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const body = await request.json();
    const { claimIds } = body;

    if (!claimIds || !Array.isArray(claimIds)) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'src/data/drg-claims.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    let claims: DRGClaim[] = JSON.parse(fileContents);

    // Simulate agent initialization
    await delay(1500);

    const agent = new DRGValidationAgent();
    const claimsToProcess = claims.filter((c) => claimIds.includes(c.id));
    const results = await agent.reviewBatch(claimsToProcess);

    // Merge results back into claims
    const resultMap = new Map(results.map((r) => [r.claimId, r]));
    const updatedClaims: DRGClaim[] = [];

    claims = claims.map((claim) => {
        const result = resultMap.get(claim.id);
        if (result) {
            const updated: DRGClaim = {
                ...claim,
                validationStatus: result.validationStatus,
                expectedDRG: result.expectedDRG,
                expectedDRGDescription: result.expectedDRGDescription,
                expectedDRGWeight: result.expectedDRGWeight,
                expectedReimbursement: result.expectedReimbursement,
                financialVariance: result.financialVariance,
                agentFindings: result.agentFindings,
                agentSummary: result.agentSummary,
                agentConfidence: result.agentConfidence,
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
        message: 'DRG review complete',
        processedCount: updatedClaims.length,
        updatedClaims,
    });
}
