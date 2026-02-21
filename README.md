# FWA Agentic AI Demo

A Next.js application demonstrating an Agentic workflow for Fraud, Waste, and Abuse detection.

## Prerequisites
- Node.js 20.9.0 or later

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Generate Synthetic Data**
   This creates the mock database in `src/data/claims.json`.
   ```bash
   npx tsx scripts/generate_data.ts
   ```

3. **Run the Development Server**
   ```bash
   npm run dev
   ```

4. **Explore the App**
   - **Dashboard**: View high-level KPIs and risk trends.
   - **Claims Audit**: Go to the Claims page, select "Pending" claims, and click **"Run AI Audit"** to see the agent in action.

## Key Components
- `src/app/api/audit`: Simulates the AI Agent reasoning process.
- `src/components/claims`: Contains the interactive claims table.
- `src/data`: Stores the JSON-based "database".
