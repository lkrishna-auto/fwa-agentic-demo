
import fs from 'fs';
import path from 'path';

// Types
type Status = 'Pending' | 'Approved' | 'Denied' | 'Flagged';

interface Claim {
    id: string;
    providerId: string;
    providerName: string;
    beneficiaryId: string;
    beneficiaryName: string;
    serviceDate: string;
    procedureCode: string;
    amount: number;
    status: Status;
    riskScore: number;
    aiReasoning?: string;
    flaggedDate?: string;
}

// Data Arrays
const PROVIDERS = [
    { id: 'PRV-001', name: 'General Hospital' },
    { id: 'PRV-002', name: 'City Clinic' },
    { id: 'PRV-003', name: 'Dr. Smith & Associates' },
    { id: 'PRV-004', name: 'Wellness Center' },
    { id: 'PRV-005', name: 'Urgent Care North' },
    // High risk providers
    { id: 'PRV-999', name: 'Discount Meds (Suspicious)' },
];

const BENEFICIARIES = Array.from({ length: 20 }, (_, i) => ({
    id: `BEN-${1000 + i}`,
    name: `Patient ${String.fromCharCode(65 + i)}`,
}));

const PROCEDURE_CODES = [
    { code: '99213', desc: 'Office Visit Level 3', baseCost: 100 },
    { code: '99214', desc: 'Office Visit Level 4', baseCost: 150 },
    { code: '99215', desc: 'Office Visit Level 5', baseCost: 200 },
    { code: '71045', desc: 'Chest X-Ray', baseCost: 80 },
    { code: '85025', desc: 'Blood Count', baseCost: 50 },
];

// Helper to get random item
const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate claims
const generateClaims = (count: number): Claim[] => {
    const claims: Claim[] = [];

    for (let i = 0; i < count; i++) {
        const isFraud = Math.random() < 0.15; // 15% chance of potential fraud pattern
        const provider = isFraud && Math.random() > 0.5 ? PROVIDERS[5] : getRandom(PROVIDERS);
        const beneficiary = getRandom(BENEFICIARIES);
        const procedure = getRandom(PROCEDURE_CODES);

        // Amount variation
        const amount = procedure.baseCost + Math.floor(Math.random() * 50);

        let status: Status = 'Pending';
        let riskScore = Math.floor(Math.random() * 40); // Base low risk
        let aiReasoning: string | undefined;

        // Inject Fraud Patterns
        if (isFraud) {
            riskScore = 60 + Math.floor(Math.random() * 40); // 60-99
            status = 'Pending'; // Start as pending, to be caught by "AI Consumer"

            // Simulate patterns
            const fraudType = Math.random();
            if (fraudType < 0.33) {
                aiReasoning = 'Potential upcoding detected: Service duration mismatch with code.';
            } else if (fraudType < 0.66) {
                aiReasoning = 'Duplicate claim: Similar service billed within 24 hours.';
            } else {
                aiReasoning = 'Provider outlier: High frequency of high-cost procedures.';
            }
        }

        // Some already processed
        if (!isFraud && Math.random() > 0.5) {
            status = 'Approved';
            riskScore = Math.floor(Math.random() * 20);
        }

        claims.push({
            id: `CLM-${2024000 + i}`,
            providerId: provider.id,
            providerName: provider.name,
            beneficiaryId: beneficiary.id,
            beneficiaryName: beneficiary.name,
            serviceDate: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            procedureCode: procedure.code,
            amount: Number(amount.toFixed(2)),
            status,
            riskScore,
            // We store the "potential" reasoning, but in a real app this might be generated on the fly.
            // For the demo, we'll pre-calculate it but hide it until "analyzed" if status is Pending.
            aiReasoning: isFraud ? aiReasoning : undefined,
        });
    }
    return claims;
};

// Main execution
const TARGET_FILE_JSON = path.join(process.cwd(), 'src/data/claims.json');
const TARGET_FILE_CSV = path.join(process.cwd(), 'src/data/claims.csv');
const claimsData = generateClaims(50);

fs.writeFileSync(TARGET_FILE_JSON, JSON.stringify(claimsData, null, 2));
console.log(`Generated ${claimsData.length} claims to ${TARGET_FILE_JSON}`);

// Generate CSV
const headers = Object.keys(claimsData[0]).join(',');
const rows = claimsData.map(claim =>
    Object.values(claim).map(value => {
        if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
        return value;
    }).join(',')
);
const csvContent = [headers, ...rows].join('\n');

fs.writeFileSync(TARGET_FILE_CSV, csvContent);
console.log(`Generated CSV export to ${TARGET_FILE_CSV}`);
