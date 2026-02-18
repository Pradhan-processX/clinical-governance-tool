# Installation Guide

## Prerequisites

### 1. Install Node.js
Download and install Node.js 18+ from: https://nodejs.org/en/download
- Choose the Windows Installer (.msi) - LTS version
- Run the installer and follow prompts
- Restart your terminal/VS Code after installation
- Verify: `node --version` and `npm --version`

### 2. Create SQL Server Database
In SSMS, run:
```sql
CREATE DATABASE ClinicalGovernance;
```

### 3. Get Azure OpenAI credentials
From Azure AI Foundry:
- Endpoint URL
- API Key
- Deployment name (e.g. gpt-4o)

## Setup Steps

### Step 1: Configure environment
Copy `.env.example` to `.env.local` and fill in your values:
```
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-06-01

DB_SERVER=your-server-name-or-ip
DB_DATABASE=ClinicalGovernance
DB_USER=your-username
DB_PASSWORD=your-password
DB_PORT=1433
DB_TRUST_SERVER_CERTIFICATE=true
```

### Step 2: Install dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### Step 3: Start the development server
```bash
npm run dev
```
The app will be running at http://localhost:3000

### Step 4: Create database tables and seed data
With the server running, open your browser and navigate to:
```
POST http://localhost:3000/api/setup
```

Or use curl/PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/setup" -Method POST
```

Or use a REST client (e.g. Thunder Client in VS Code) to POST to `/api/setup`

This will:
- Create all database tables
- Seed 3 fall scenarios with their checklists

### Step 5: Verify setup
1. Go to http://localhost:3000/admin/scenarios — you should see 3 fall scenarios
2. Go to http://localhost:3000/evaluate — paste a test note and click Evaluate
3. Go to http://localhost:3000/batch — upload a Manad Excel export

## Testing

### Sample progress note for /evaluate:
```
Resident found on floor in bedroom at 14:35. RN Smith found Mrs Jones lying on her right side beside the bed. Resident unable to recall how she got there. No visible injuries noted. Obs taken: BP 128/72, HR 82, O2 98%. Pain score 0/10. Resident able to move all limbs. Incident report completed (RiskMan #45231). Dr Williams notified at 14:45 and reviewed resident at 15:00. NOK (daughter) notified at 15:10. Falls risk reassessment completed - score increased to 18. Care plan updated to include 2-hourly checks and bed sensor.
```

## File Structure
See the CLAUDE.md in this folder for the complete project specification.
