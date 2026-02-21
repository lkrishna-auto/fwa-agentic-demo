# FWA Sentinel - Payment Integrity Agentic Demo

A Next.js application demonstrating Agentic AI workflows for healthcare Payment Integrity — covering Fraud, Waste, and Abuse (FWA) detection across four specialized review agents.

## Agents

| Agent | Route | Description |
|-------|-------|-------------|
| **Claims Audit** | `/claims` | Basic FWA claims screening and risk scoring |
| **DRG Clinical Validation** | `/drg-review` | MS-DRG assignment review with 13 clinical rules (sepsis, cardiovascular, respiratory) |
| **Medical Necessity Review** | `/med-necessity` | Inpatient admission criteria evaluation with 10 rules (SI, IS, admission criteria, LOS) |
| **Readmission Review** | `/readmission-review` | Clinical relatedness, preventability, and DRG bundling analysis with 12 rules |

Each agent uses a **pluggable backend architecture** — rule-based by default, with a one-line swap to Claude LLM integration.

## Prerequisites

- Node.js 20.9.0 or later
- Docker (optional, for containerized deployment)

## Getting Started

### Local Development

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

4. **Open the App**
   Navigate to [http://localhost:3000](http://localhost:3000).

### Docker

1. **Build the image**
   ```bash
   docker build -t fwa-sentinel .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 fwa-sentinel
   ```

3. **Open the App**
   Navigate to [http://localhost:3000](http://localhost:3000).

## Explore the App

- **Dashboard** (`/`): High-level KPIs and risk trends.
- **Claims Audit** (`/claims`): Select "Pending" claims and click **"Run AI Audit"**.
- **DRG Review** (`/drg-review`): Validate MS-DRG assignments against clinical documentation.
- **Med Necessity** (`/med-necessity`): Evaluate inpatient admissions against medical necessity criteria.
- **Readmissions** (`/readmission-review`): Analyze readmission pairs for clinical relatedness and preventability.

## Project Structure

```
agents/                    # Agent backends (prompts, rules, orchestrators)
  drg-*.ts                 # DRG Clinical Validation agent
  med-necessity-*.ts       # Medical Necessity Review agent
  readmission-*.ts         # Readmission Review agent
src/
  app/                     # Next.js App Router pages and API routes
    api/audit/             # Claims audit API
    api/drg-review/        # DRG review API
    api/med-necessity/     # Medical necessity API
    api/readmission-review/ # Readmission review API
  components/              # React UI components
  data/                    # Synthetic claims data (JSON flat-file DB)
  types/                   # TypeScript type definitions
```

## Key Design Decisions

- **Flat-file JSON database** — no external DB required; data persists via `fs.readFileSync`/`writeFileSync`
- **Pluggable `AgentBackend` interface** — swap `RuleBasedBackend` for `ClaudeBackend` without changing API routes or UI
- **Deterministic rules engine** — each agent has pure-function validation rules that run without an LLM
- **Prompt templates** — structured prompts ready for LLM integration via Anthropic SDK
