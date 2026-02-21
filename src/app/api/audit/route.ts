
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Claim } from '@/types';

// Simulate AI processing delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
    const body = await request.json();
    const { claimIds } = body;

    if (!claimIds || !Array.isArray(claimIds)) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'src/data/claims.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    let claims: Claim[] = JSON.parse(fileContents);

    // Simulate Agent "Thinking"
    await delay(1500);

    const updatedClaims: Claim[] = [];

    claims = claims.map(claim => {
        if (claimIds.includes(claim.id)) {
            // Logic: If pre-flagged risk is high or status was pending, finalize it.
            // If it was already "Suspicious" in our generation logic (hidden in status pending), 
            // we reveal it now.

            let newStatus = claim.status;
            let newReasoning = claim.aiReasoning;

            if (claim.status === 'Pending') {
                if (claim.riskScore > 50) {
                    newStatus = 'Flagged';
                    if (!newReasoning) {
                        newReasoning = "AI Analysis: Anomalous billing pattern detected matching known fraud vectors.";
                    }
                } else {
                    newStatus = 'Approved';
                    newReasoning = "AI Analysis: Claim falls within normal variance parameters.";
                }
            }

            const updated = { ...claim, status: newStatus, aiReasoning: newReasoning };
            updatedClaims.push(updated);
            return updated;
        }
        return claim;
    });

    fs.writeFileSync(filePath, JSON.stringify(claims, null, 2));

    return NextResponse.json({
        message: 'Audit complete',
        processedCount: updatedClaims.length,
        updatedClaims
    });
}
