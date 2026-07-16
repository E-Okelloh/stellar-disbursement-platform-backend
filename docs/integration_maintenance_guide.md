# DisburseFlow Integration & Maintenance Guide (D-6)

**Product:** SAPCONE Cross-Border Disbursement System — Product 1: DisburseFlow  
**Status:** Comprehensive guide detailing the backend-frontend integration, custom database extensions, and technical maintenance procedures.

---

## 1. System Architecture & Components

The SAPCONE Cross-Border Disbursement System is built on a split architecture combining a Go backend stack and a React frontend. The primary backend services run on the **Stellar Disbursement Platform (SDP)**, consisting of:

```mermaid
graph TD
    Client[React Frontend] -->|REST APIs + JWT| GoAPI[Go SDP API Service (Port 8000)]
    GoAPI -->|PostgreSQL sdp_ Schema| Postgres[(PostgreSQL DB Port 5432)]
    TSS[Go TSS Daemon] -->|Polls payments table| Postgres
    TSS -->|Signs & Broadcasts| Horizon[Stellar Horizon Node]
    GoAPI -->|Triggers SMS| SMSGateway[SMS Gateway (Dry-run locally)]
```

*   **Go SDP API Service**: Exposes REST endpoints to manage disbursements, user roles, beneficiaries, and system configurations.
*   **Transaction Submission Service (TSS)**: A daemon that polls Postgres for approved payments, signs transactions using channel accounts, and broadcasts them to the Stellar network.
*   **Postgres Database**: Contains separate schemas for administrative settings (`admin`), authorization (`auth`), transaction submissions (`tss`), and the core platform (`sdp`).
*   **Vite Dev Server (Port 3001)**: Serves the React SPA at `/app/` and the public landing page at `/` during local development.

---

## 2. SAPCONE Custom Fork Extensions (Complete Reference)

To capture beneficiary identity and local cash-out currencies required by SAPCONE, the standard SDP database schema and Go models were extended to support `recipient_name` and `currency_type`.

### A. Database Layer
*   **Migration File**: [db/migrations/sdp-migrations/2026-07-15.0-add-sapcone-receiver-fields.sql](file:///home/bethwel/stellar-disbursement-platform-backend/db/migrations/sdp-migrations/2026-07-15.0-add-sapcone-receiver-fields.sql)
*   **Operation**: Alters the `receivers` table to add nullable columns:
    ```sql
    ALTER TABLE receivers ADD COLUMN recipient_name TEXT;
    ALTER TABLE receivers ADD COLUMN currency_type TEXT;
    ```

### B. Backend Data Models (Go)
*   **Receiver Models**: Extended in [internal/data/receivers.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/data/receivers.go) and [internal/data/disbursement_receivers.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/data/disbursement_receivers.go) to bind these columns:
    ```go
    RecipientName string `json:"recipient_name,omitempty" db:"recipient_name"`
    CurrencyType  string `json:"currency_type,omitempty" db:"currency_type"`
    ```
*   **SQL Insert Query**: The `Insert()` method inside `receivers.go` was updated to bind the new Go fields to the database parameters.

### C. CSV Parsing & Import
*   **Instruction Schema**: In [internal/data/disbursement_instructions.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/data/disbursement_instructions.go), the `DisbursementInstruction` struct was mapped to parse custom columns from uploaded CSVs:
    ```go
    RecipientName string `csv:"RecipientName"`
    CurrencyType  string `csv:"CurrencyType"`
    ```
*   **Instruction Processor**: Resolves the incoming instructions and wires `RecipientName` and `CurrencyType` properties into the receiver record if a new beneficiary is created during the upload.

### D. Reporting & Exports
*   **Exports Handler**: The `/exports/receivers` endpoint was updated (along with [internal/serve/httphandler/export_handler_test.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/serve/httphandler/export_handler_test.go)) to include "RecipientName" and "CurrencyType" in exported CSV reports.

---

## 3. Organizational Roles Mapping (RBAC)

The system uses a strict set of hardcoded technical role strings. Documented below is how SAPCONE's human organizational designations map to the underlying technical identifiers:

| Human Designation (Design) | Code Identifier (Technical) | System Permissions |
| :--- | :--- | :--- |
| **Field Officer** | `uploader` | Uploads raw CSV files to create disbursement drafts; has no approve or submit capabilities. |
| **Field Coordinator** | `approver` | Reviews disbursement drafts, checks beneficiary KYC/DOB status, and shifts status to approved/ready. |
| **Finance Officer** | `finance_officer` | Signs off on approved disbursement batches, triggering the TSS daemon to broadcast transactions to Stellar. |

> [!CAUTION]
> **Warning for Future Maintainers**: Do **NOT** rename the strings `"uploader"` and `"approver"` in the source code or database tables. The backend logic, database check constraints, and React permission flags (`canUpload`, `canApprove`) depend strictly on these exact technical strings.

---

## 4. Maintenance Procedures & CLI Commands

### Running the Environment Locally

If you need to test code modifications locally:
1.  **Stop conflicting Docker containers**:
    ```bash
    docker stop sdp-sdp-api-1
    ```
2.  **Start the Go API Server**:
    ```bash
    go run main.go serve --env-file ./dev/.env.default --database-url "postgres://postgres@localhost:5432/sdp_mtn?sslmode=disable"
    ```
3.  **Start the Frontend Dev Server**:
    ```bash
    cd frontend && yarn start
    ```

### Managing Database Migrations

When schema changes are required, use the CLI's native command structures:

*   **View Migration Status**:
    ```bash
    go run main.go db sdp migrate status
    ```
*   **Apply Pending Migrations**:
    ```bash
    go run main.go db sdp migrate up --all
    ```
*   **Rollback Last Migration**:
    ```bash
    go run main.go db sdp migrate down 1
    ```

---

## 5. Guidelines for Future Schema Extensions

To extend DisburseFlow with new fields (e.g., adding proxy identifiers for **LastMile**):

1.  **Create Migration**: Place a new `.sql` file in [db/migrations/sdp-migrations/](file:///home/bethwel/stellar-disbursement-platform-backend/db/migrations/sdp-migrations/). Follow the numbering convention: `YYYY-MM-DD.N-description.sql`.
2.  **Update Go Structs**: Find the matching model in `internal/data/` and add the new properties with their JSON and database tags.
3.  **Update SQL Queries**: Ensure that your new properties are added to `INSERT`, `UPDATE`, and `SELECT` query strings inside the model methods.
4.  **Extend CSV Schema** (if imported): Update [internal/data/disbursement_instructions.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/data/disbursement_instructions.go) to register the new CSV column header.
5.  **Test Coverage**: Write unit test cases (similar to [internal/data/receivers_test.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/data/receivers_test.go)) ensuring that the fields persist, read back, and validation rules reject malformed inputs.
