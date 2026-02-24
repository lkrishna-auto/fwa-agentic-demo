import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Claim } from '@/types';
import { OutlierDetectionAgent } from '../../../../agents/outlier-detection-agent';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST() {
    const filePath = path.join(process.cwd(), 'src/data/claims.json');
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const claims: Claim[] = JSON.parse(fileContents);

    // Simulate agent initialization
    await delay(1200);

    const agent = new OutlierDetectionAgent();
    const report = await agent.analyzeAll(claims);

    return NextResponse.json(report);
}
