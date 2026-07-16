# Horizon Integration Details and Rationale (D-10)

**Product:** SAPCONE Cross-Border Disbursement System — Product 1: DisburseFlow  
**Scope:** Technical justification, location mapping, and integration mechanism for Horizon usage in the pushes of this week.  
**Status:** Approved for technical documentation.

---

## 1. Rationale: Why Horizon Was Used

The feature implementations pushed this week (specifically the three-step disbursement approval workflow and the custom recipient fields) rely entirely on Horizon. 

### Core Stellar Classic Compatibility
Horizon is the standard HTTP API server for the Stellar network. It provides interfaces to query ledger state, retrieve account details, inspect asset trustlines, and submit transactions. The current phase of the SAPCONE implementation (DisburseFlow) is focused on core Stellar Classic capabilities, namely the transfer of bulk USDC and XLM assets. It does not require executing custom on-chain logic, making Horizon the correct and most stable interface.

### Ledger History and Account Auditing
Horizon retains transaction histories, balance changes, and trustline allocations. To validate that a disbursement batch can successfully execute, the backend must verify the existence of the distribution account and its trustline configuration. Horizon provides the direct endpoints (such as `/accounts/{account_id}`) required for these validations.

### Separation from Smart Contract Execution (Stellar RPC)
Stellar RPC (Soroban RPC) is designed specifically for interacting with Soroban smart contracts. Because the custom workflow and receiver fields introduced this week do not involve smart contract deployment or invocation, Stellar RPC was not utilized.

---

## 2. Where Horizon Was Integrated

Horizon integration points modified or introduced in this week's commits include the following files:

### Go Backend Test Layer
*   **File**: [internal/services/disbursement_management_service_test.go](file:///home/bethwel/stellar-disbursement-platform-backend/internal/services/disbursement_management_service_test.go)
*   **Usage**: Employs `horizonclient.MockClient` to mock out live network queries during the validation of disbursement submissions and approvals.

### Frontend Environment Configuration
*   **File**: [frontend/src/vite-env.d.ts](file:///home/bethwel/stellar-disbursement-platform-backend/frontend/src/vite-env.d.ts)
*   **Usage**: Defines the global typescript interface for `REACT_APP_HORIZON_URL`, ensuring the frontend can configure its explorer links and network settings pointing to the testnet Horizon instance.

---

## 3. How Horizon Was Integrated

### Distribution Account Validation
During the validation phase of the three-step approval workflow, the Go backend queries the Horizon network to confirm the following criteria are met before a disbursement moves to the approved or submitted state:
1. The distribution account exists on-chain.
2. The account holds a trustline for the selected asset (e.g., USDC).
3. The account holds sufficient funds to cover the transaction costs and the disbursement totals.

### Mock Implementation in Tests
In the tests added this week, the Horizon client is mocked to simulate these network responses. The mock defines the distribution account public key and returning balances:

```go
mHorizonClient := &horizonclient.MockClient{}
defer mHorizonClient.AssertExpectations(t)

mHorizonClient.
    On("AccountDetail", horizonclient.AccountRequest{AccountID: distributionAccPubKey}).
    Return(horizon.Account{
        ID: distributionAccPubKey,
        Balances: []horizon.Balance{
            {
                Asset: horizon.Asset{
                    Type:   "credit_alphanum4",
                    Code:   "USDC",
                    Issuer: "GBBD47IF6LWK7P7MDEVFA2XGYXKR7LEJ7547SLP4AIGOD6AX5UT7MDEV",
                },
                Balance: "10000.0000000",
            },
        },
    }, nil)
```

This mock configuration is injected into the `DisbursementManagementService` instance via the `HorizonClient` struct field to run assertions against state transitions.
