# DisburseFlow: Custom Stellar Disbursement Platform (SDP) Integration and Extension Architecture

**Program:** GIVE Kenya Stellar Impact Studio  
**Date:** July 16, 2026  
**Document version:** 1.0.0  
**Status:** Released  

---

## 1. Project Context and Purpose

Sustainable Approaches for Community Empowerment (SAPCONE) is a non-governmental organization conducting cash transfer programs in border regions and remote communities throughout Kenya, Uganda, Ethiopia, and South Sudan. Although traditional banking and mobile money options function adequately inside domestic urban corridors, they fail to resolve the logistical complexity, high cost, and security risks associated with cross-border cash delivery and distributions to phone-less beneficiaries.

**DisburseFlow** is a custom solution built on the open-source **Stellar Disbursement Platform (SDP)**. DisburseFlow allows bulk disbursements of stablecoins (USDC) on the Stellar network with real-time transactional transparency, automated retries, and high-security audit controls. This documentation outlines the system architecture, the technology stack, the role of specific engineering tools, the custom 3-phase workflow adjustments, and the designs proposed to resolve field-operational gaps.

---

## 2. Technology Stack and Tool Rationale

The project is structured as an integrated monorepo split into `backend` and `frontend` workspaces to enable simultaneous development and unified deployment.

### 2.1 Backend Workspace (Go/PostgreSQL/TSS)
* **Programming Language (Go):** The backend is written in Go (version 1.21+). Go was chosen for its strong static typing, fast execution speeds, native compilation, and powerful concurrency model. Go is also the native language of the Stellar SDK, making it the standard choice for building services interfacing with Stellar core nodes and Horizon endpoints.
* **Database (PostgreSQL 14+):** Relational storage is used to track disbursements, payments, receivers, tenants, and state-machine transitions. Postgres ensures transactional safety, data consistency across relational schemas, and allows clean partition segregation for multi-tenancy.
* **Transaction Submission Service (TSS):** A dedicated background Go process that queries the payment database for pending entries, signs them using cryptographic channel account keys, and submits them to the blockchain. Using channel accounts allows multiple transactions to run in parallel without transaction sequence conflicts.
* **Stellar Horizon REST API:** The interface through which the SDP queries ledger balances, sets up receiver trustlines, and broadcasts transaction envelopes.

### 2.2 Frontend Workspace (React/TypeScript/Tailwind CSS)
* **Framework (React & TypeScript):** The admin dashboard is built with React. TypeScript guarantees static type safety and structural clarity across UI components, minimizing runtime errors during state changes and API consumption.
* **Styling (Tailwind CSS):** Provides rapid, utility-first styling to create responsive layouts. Custom brand values have been mapped directly to Tailwind variables to maintain brand alignment with SAPCONE design guidelines.
* **Bundler & Server (Vite):** Utilized for fast hot module replacement (HMR) and optimized production compilation.

### 2.3 Containerization and Development Tools
* **Docker & Docker Compose:** Containerizes the database, API handlers, TSS daemon, and local frontend to guarantee environment consistency across development and production platforms.
* **Make/Makefile:** Used to automate build scripts, environment setup, database migrations, and key generation.

---

## 3. The Aligned 3-Phase Custom Workflow

DisburseFlow enforces segregation of duties by dividing the disbursement pipeline into three distinct phases with restricted access control. The state transitions are managed by the status machine defined in [dibursements_state_machine.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/dibursements_state_machine.go):

```
DRAFT ──(POST /disbursements)──→ READY ──(PATCH /approve)──→ APPROVED ──(PATCH /submit)──→ STARTED ──→ COMPLETED
```

### 3.1 Phase 1: Upload and Validation (DRAFT → READY)
* **Actor:** `Uploader`, `Initiator`, `Owner`, `FinancialController` (roles configured in [roles.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/roles.go)).
* **Action:** The user uploads a CSV containing receiver details (phone number, external reference ID, amount, and verification credentials).
* **System Process:** The Go backend validates the CSV structure, checks phone formatting against the E.164 standard, verifies the uniqueness of external IDs, and validates that the selected asset (USDC or XLM) is supported. The disbursement status changes to `READY`.

### 3.2 Phase 2: Review and Approval (READY → APPROVED)
* **Actor:** `Approver`, `Owner`, `FinancialController`.
* **Action:** An independent manager reviews the upload details. If approved, the status is set to `APPROVED`.
* **Security Control:** When `is_approval_required` is enabled in the organization settings, the system enforces mutual exclusivity: the user who uploaded the CSV cannot approve the same disbursement batch.

### 3.3 Phase 3: Submission and Settlement (APPROVED → STARTED)
* **Actor:** `FinanceOfficer`, `Owner`, `FinancialController`.
* **Action:** The officer submits the batch for execution.
* **System Process:** The status changes to `STARTED`. The Go TSS background daemon polls the payments queue, groups rows, signs Stellar transaction envelopes using channel accounts, and broadcasts them to the Horizon endpoint.

---

## 4. Key Code Files and Implementation Architecture

Developers modifying the DisburseFlow codebase should reference the following files:

* **[roles.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/roles.go):** Defines user roles and validation logic for mutual exclusivity.
* **[dibursements_state_machine.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/dibursements_state_machine.go):** Controls valid transition paths for disbursements (e.g., preventing direct transitions from `READY` to `STARTED` when approvals are enabled).
* **[disbursement_management_service.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/services/disbursement_management_service.go):** Orchestrates core operations such as `ApproveDisbursement()`, `SubmitDisbursement()`, and legacy compatibility checks.
* **[App.tsx](file:///home/bethwel/stellar-disbursement-platform-frontend/frontend/src/App.tsx):** Coordinates the React frontend, local storage caches, and UI views representing the three workflow phases.
* **[index.css](file:///home/bethwel/stellar-disbursement-platform-frontend/frontend/src/index.css):** Contains the custom color themes, baseline HTML overrides, and transition animations for interactive dashboard elements.

---

## 5. Architectural Gap Analysis and Extension Layer Designs

The standard Stellar Disbursement Platform relies on SMS delivery and non-custodial wallet setups on smartphones. To support remote, phone-less beneficiaries and manual proxies, the following extensions are defined:

### 5.1 LastMile Extension: Phone-Less Beneficiaries
For recipients who do not own a phone, DisburseFlow uses the **LastMile** extension:
1. **QR Code Reference Cards:** Phone-less beneficiaries receive physical cards encoded with their system identifier.
2. **In-Person Verification:** SAPCONE field staff verify the receiver's identity in the field using a dedicated mobile agent app.
3. **OTP Bypass Endpoint:** The app calls a specialized API endpoint (`POST /api/v1/receivers/register-in-person`), which registers the receiver wallet directly without a phone verification step.

#### 5.1.1 Custody Decisions
* **Option A (Individual Accounts):** Each phone-less receiver gets a unique on-chain Stellar public key. This is the preferred design for auditable on-chain proof.
* **Option B (Pooled Accounts):** Payouts are routed to a shared pool account, with individual transactions mapped to recipients using the Stellar memo field.

### 5.2 LastMile Extension: Proxy Handover Verification
When funds are distributed to community gatekeepers (proxies), the handover is tracked via two tables:
* **`sdp_proxies`:** Stores proxy identity data and wallet addresses.
* **`sdp_proxy_deliveries`:** Records physical handovers, tracking beneficiary QR scans, coordinates, and timestamps.

#### 5.2.1 Anchoring and Security Gaps
* **On-Chain Anchoring:** Delivery receipts can be logged via a standard Stellar memo transaction (cost-effective but logic is checked off-chain) or a Soroban smart contract (enforces validation rules in code, but carries gas fees).
* **Sequence Risk:** The current sequence distributes USDC to the proxy before the physical handover is validated. Escrowing funds in a Soroban smart contract—where assets are only released to the proxy's wallet after scanning the beneficiary's QR card—is under review to mitigate default risk.

### 5.3 OpenLedger Extension: Public Donor Audits
Because standard SDP dashboards require authentication and contain personally identifiable information (PII), **OpenLedger** acts as a public-facing, read-only portal. OpenLedger queries transaction batches from the database and confirms their settlement on the public Stellar ledger, allowing donors to audit payouts without violating privacy rules.

---

## 6. Critical Security Fixes and Recent Code Updates

During recent integration reviews, five logic and security corrections were merged into the backend branch:

1. **Legacy Status Endpoint Bypass:** Previously, the legacy `PATCH /disbursements/{id}/status` endpoint bypassed the `APPROVED` requirement and allowed direct `READY → STARTED` transitions. This has been corrected in [disbursement_management_service.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/services/disbursement_management_service.go), making the approval step mandatory whenever `IsApprovalRequired` is enabled.
2. **Submit Path Gatekeeping:** The `SubmitDisbursement()` function has been updated to explicitly require a status check of `ApprovedDisbursementStatus` to prevent finance officers from executing unapproved disbursements.
3. **Finance Officer Views:** The `FinanceOfficer` role has been added to the authorized access list in `GetBusinessOperationRoles()` inside [roles.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/roles.go), enabling these users to view the disbursements they need to submit.
4. **Codebase Standardization:** Restored `gofmt` compliance, standard tab indentations, and standard doc comments in [roles.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/roles.go).
5. **Test Regression Suite:** Created robust service and handler test cases to cover approval flows, role validation checks, and state machine transitions.
