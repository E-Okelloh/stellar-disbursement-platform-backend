# DisburseFlow API & Role-Based Access Control (RBAC) Reference (D-5)

**Product:** SAPCONE Cross-Border Disbursement System — Product 1: DisburseFlow  
**Status:** Verified directly from the active router registration in the Stellar Disbursement Platform backend source code (`internal/serve/serve.go`).

---

## 1. Core Authorization Mechanisms

The SDP backend enforces security using two layers of middleware on each request:
1. **`AnyRoleMiddleware`**: Restricts the endpoint to specific, predefined user roles.
2. **`RequirePermission`**: Restricts the endpoint based on a set of core API permissions (claims) mapped to the user token.

---

## 2. User Roles & Descriptions

| Role | Name in Code | Description |
| :--- | :--- | :--- |
| **Owner** | `owner` | Administrative role with full permissions, including user management, role assignments, and key configuration. |
| **Financial Controller** | `financial_controller` | Has all of the Owner's operational capabilities, except for user management (creating users, changing roles, activation). |
| **Developer** | `developer` | Focuses on technical configuration: manages wallets, assets, and has access to platform statistics. |
| **Business** | `business` | A read-only operational role. Can view payments, disbursements, and wallets, but cannot access user management. |
| **Initiator** | `initiator` | Can create and save disbursement drafts (CSV uploads, instructions) but is mutually exclusive with `approver`. |
| **Field Co-ordinator** | `field_coordinator` | Can change status, approve, and finalize disbursements, but cannot create or upload new ones. |
| **Field Officer** | `field_officer` | Specialized role restricted to creating disbursement drafts via CSV file uploads. |
| **Finance Officer** | `finance_officer` | Authorizes the final on-chain execution/submission of approved disbursements to the Stellar network. |

---

## 3. Endpoints Access Mapping

The following table details all authenticated API routes, the handler classes processing the request, and the exact roles and permissions required:

### Administrative & Configuration Endpoints

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/api-keys` | `GET`, `POST`, `PATCH`, `DELETE` | `APIKeyHandler` | `WriteAll` | `owner`, `developer` |
| `/assets` | `GET` | `AssetsHandler` | `ReadAll` | *All Roles* |
| `/assets` | `POST`, `DELETE` | `AssetsHandler` | `WriteAll` | `owner`, `financial_controller`, `developer` |
| `/wallets` | `GET` | `WalletsHandler` | `ReadWallets` | *All Roles* |
| `/wallets` | `POST`, `PATCH`, `DELETE` | `WalletsHandler` | `WriteWallets` | `owner`, `developer` |

### User & Profile Management

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/users` | `GET` | `UserHandler` | `ReadUsers` | `owner` |
| `/users/roles` | `GET` | `ListRolesHandler` | `ReadUsers` | `owner` |
| `/users` | `POST` | `UserHandler` | `WriteUsers` | `owner` |
| `/users/roles` | `PATCH` | `UserHandler` | `WriteUsers` | `owner` |
| `/users/activation` | `PATCH` | `UserHandler` | `WriteUsers` | `owner` |
| `/profile` | `GET`, `PATCH` | `ProfileHandler` | `ReadAll` / `WriteAll` | *All Roles* |
| `/profile/reset-password` | `PATCH` | `ProfileHandler` | `WriteAll` | *All Roles* |
| `/refresh-token` | `POST` | `RefreshTokenHandler` | `ReadAll` | *Any Authenticated User* |

### Organization & Integration Endpoints

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/organization` | `GET` | `ProfileHandler` | `ReadOrganization` | *All Roles* |
| `/organization` | `PATCH` | `ProfileHandler` | `WriteOrganization` | `owner`, `financial_controller` |
| `/organization/circle-config`| `PATCH` | `CircleConfigHandler` | `WriteOrganization` | `owner` |
| `/bridge-integration` | `GET` | `BridgeIntegrationHandler` | `ReadOrganization` | *All Roles* |
| `/bridge-integration` | `PATCH` | `BridgeIntegrationHandler` | `WriteOrganization` | `owner`, `financial_controller` |
| `/balances` | `GET` | `BalancesHandler` | `ReadAll` | *Any Authenticated User* |
| `/statistics` | `GET` | `StatisticsHandler` | `ReadStatistics` | *All Roles* |

### Disbursements (Payout Batches)

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/disbursements` | `GET` | `DisbursementHandler` | `ReadDisbursements` | `owner`, `financial_controller`, `business`, `initiator`, `approver`, `uploader`, `finance_officer` |
| `/disbursements/{id}` | `GET` | `DisbursementHandler` | `ReadDisbursements` | `owner`, `financial_controller`, `business`, `initiator`, `approver`, `uploader`, `finance_officer` |
| `/disbursements` | `POST`, `DELETE` | `DisbursementHandler` | `WriteDisbursements` | `owner`, `financial_controller`, `initiator`, `uploader` |
| `/disbursements/{id}/instructions` | `POST` | `DisbursementHandler` | `WriteDisbursements` | `owner`, `financial_controller`, `initiator`, `uploader` |
| `/disbursements/{id}/status` | `PATCH` | `DisbursementHandler` | `WriteDisbursements` | `owner`, `financial_controller`, `approver` |
| `/disbursements/{id}/approve` | `PATCH` | `DisbursementHandler` | `WriteDisbursements` | `owner`, `financial_controller`, `approver` |
| `/disbursements/{id}/submit` | `PATCH` | `DisbursementHandler` | `WriteDisbursements` | `owner`, `financial_controller`, `finance_officer` |

### Payments (Individual Transactions)

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/payments` | `GET`, `GET /{id}` | `PaymentsHandler` | `ReadPayments` | `owner`, `financial_controller`, `business`, `initiator`, `approver`, `uploader`, `finance_officer` |
| `/payments` | `POST` | `PaymentsHandler` | `WritePayments` | `owner`, `financial_controller`, `business` |
| `/payments/retry` | `PATCH` | `PaymentsHandler` | `WritePayments` | `owner`, `financial_controller`, `business` |
| `/payments/{id}/status` | `PATCH` | `PaymentsHandler` | `WritePayments` | `owner`, `financial_controller` |

### Receivers (Beneficiaries)

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/receivers/verification-types` | `GET` | `ReceiverHandler` | `ReadReceivers` | *All Roles* |
| `/receivers` | `GET`, `GET /{id}` | `ReceiverHandler` | `ReadReceivers` | `owner`, `financial_controller`, `business`, `initiator`, `approver`, `uploader`, `finance_officer` |
| `/receivers` | `POST` | `ReceiverHandler` | `WriteReceivers` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/receivers/{id}` | `PATCH` | `UpdateReceiverHandler` | `WriteReceivers` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/receivers/{receiver_id}/wallets/{receiver_wallet_id}` | `PATCH` | `ReceiverWalletsHandler` | `WriteReceivers` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/receivers/wallets/{receiver_wallet_id}` | `PATCH` | `ReceiverWalletsHandler` | `WriteReceivers` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/receivers/wallets/{receiver_wallet_id}/status` | `PATCH` | `ReceiverWalletsHandler` | `WriteReceivers` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/registration-contact-types` | `GET` | `RegistrationContactTypesHandler` | `ReadAll` | *All Roles* |

### Reporting & Data Export

| Endpoint Route | Method | Handler | Required Permission | Allowed Roles |
| :--- | :--- | :--- | :--- | :--- |
| `/exports/disbursements` | `GET` | `ExportHandler` | `ReadExports` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/exports/payments` | `GET` | `ExportHandler` | `ReadExports` | `owner`, `financial_controller`, `approver`, `initiator` |
| `/exports/receivers` | `GET` | `ExportHandler` | `ReadExports` | `owner`, `financial_controller`, `approver`, `initiator` |
