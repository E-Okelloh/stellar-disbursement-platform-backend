# Sapcone Integration and Development Guide

This monorepo integrates the **Sapcone Frontend** (React/Tailwind) and the **Sapcone Backend** (Go/PostgreSQL/TSS) into a single, cohesive workflow workspace.

---

## 1. Directory Structure

```
sapcone/
├── frontend/               # React and Tailwind UI application workspace
│   ├── src/                # UI source files (App.tsx, index.tsx, etc.)
│   ├── Dockerfile          # Multi-stage production build (builds HTML & Nginx)
│   └── BACKEND_INTEGRATION.md # Frontend-specific backend integration details
│
└── backend/                # Go APIs, TSS daemon, migrations & tools
    ├── dev/                # Docker compose files and local configs
    │   ├── docker-compose-frontend.yml # Frontend service config (points to local build)
    │   └── docker-compose-sdp.yml      # DB, sdp-api, and demo-wallet config
    ├── tools/sdp-setup/    # Go setup wizard to configure keypairs & .env
    └── WORKFLOW.md         # Go backend status machine and role specification
```

---

## 2. Integrated Docker Development Environment

The frontend is now fully integrated into the backend's developer Docker Compose environment. 

In [backend/dev/docker-compose-frontend.yml](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/dev/docker-compose-frontend.yml), the `sdp-frontend` service is configured to build the local frontend folder:
```yaml
  sdp-frontend:
    build:
      context: ../../frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    volumes:
      - ./env-config-${NETWORK_TYPE:-testnet}.js:/usr/share/nginx/html/settings/env-config.js
```

### Starting the Integrated Stack

To launch all services (DB, API, TSS, Local Frontend, and Demo Wallet) and fund testnet distribution accounts, run the setup wizard from the `backend` folder:

```bash
cd backend
make setup
```

The wizard will:
1. Generate keypairs for SEP-10 and distribution accounts.
2. Fund the accounts with XLM/USDC on Stellar Testnet.
3. Write `backend/dev/.env`.
4. Build the local frontend workspace from the `frontend/` folder.
5. Deploy all containers via Docker Compose.
6. Create default tenants (e.g. `bluecorp.stellar.local:3000`) and seed a default owner user.

---

## 3. CSP and Port Mapping

- **Frontend Application**: Served on `http://localhost:3000` (or `https://<tenant>.stellar.local:3443` if using HTTPS).
- **Backend API Service**: Runs on `http://localhost:8000`.
- **API URL Configuration**:
  - The frontend accesses the API using the `API_URL` constant defined in [frontend/src/App.tsx](file:///home/bethwel/stellar-disbursement-platform-frontend/frontend/src/App.tsx).
  - In local development (outside Docker), it defaults to `http://localhost:8000`.
  - In Docker, Nginx mounts `backend/dev/env-config-*.js` to `/usr/share/nginx/html/settings/env-config.js` to dynamically inject `API_URL: "http://localhost:8000"` at runtime.

---

## 4. Aligned 3-Phase Custom Workflow

The frontend and Go backend communicate via the following aligned HTTP endpoints:

```
Uploader (POST)          Approver (PATCH)        FinanceOfficer (PATCH)
      │                         │                         │
      ▼                         ▼                         ▼
DRAFT ──→ READY ──────────────→ APPROVED ──────────────→ STARTED ──→ COMPLETED
  (POST /disbursements)   (PATCH /{id}/approve)     (PATCH /{id}/submit)
```

### Step 1: Upload (DRAFT → READY)
- **Actor Role**: `Uploader` (or `Owner`, `FinancialController`)
- **API Call**: `POST /disbursements`
- **Action**: Uploads the beneficiary `.csv` payload containing target accounts, amounts, and birthdate verifications.

### Step 2: Verification & Approval (READY → APPROVED)
- **Actor Role**: `Approver` (or `Owner`, `FinancialController`)
- **API Call**: `PATCH /disbursements/{id}/approve`
- **Action**: Queries OTP/DOB matches, validates beneficiary identities, and signs off.

### Step 3: Execution & Settlement (APPROVED → STARTED)
- **Actor Role**: `FinanceOfficer` (or `Owner`, `FinancialController`)
- **API Call**: `PATCH /disbursements/{id}/submit`
- **Action**: Initiates the on-chain execution sequence. The background Transaction Submission Service (TSS) daemon polls the database, signs transaction envelopes, and submits payments to the Stellar ledger network.

---

## 5. Local Setup Outside Docker (Development Mode)

If you prefer to run services individually without Docker:

### A. Run PostgreSQL
Ensure a Postgres database is running locally on port `5432`.

### B. Run Go Backend
From the `backend` folder:
```bash
go run main.go serve --env-file ./dev/.env --database-url "postgres://postgres@localhost:5432/sdp_mtn?sslmode=disable"
```

### C. Run React Frontend (Vite)
From the `frontend` folder:
```bash
npm install
npm run start
```
The React development server will start on port `3000` (or `3001`), automatically proxying API calls to the local Go backend running at `http://localhost:8000`.
