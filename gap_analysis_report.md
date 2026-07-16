# Gap Analysis Report: Stellar Disbursement Platform (SDP) Integration for SAPCONE

**Program:** GIVE Kenya Stellar Impact Studio  
**Date:** July 16, 2026  
**Author:** Lead Systems Architect  
**Status:** Draft for Review (Phase One Research Boundary)  

---

## 1. Executive Summary

This Gap Analysis Report provides a detailed assessment of the alignment between the Stellar Disbursement Platform (SDP) and the field-level humanitarian operational requirements of Sustainable Approaches for Community Empowerment (SAPCONE). 

SAPCONE operates cash transfer and humanitarian programs across underserved corridors in Kenya, Uganda, Ethiopia, and South Sudan. While mobile-money networks and digital banking provide robust disbursement mechanisms within urbanized areas of Kenya, cross-border payments and remote geographic zones (such as Turkana County and Kakuma refugee populations) continue to rely on insecure, manual, and high-liability cash transport procedures. 

To address these vulnerabilities, SAPCONE is pilot-testing the deployment of the Stellar Disbursement Platform (SDP)—a production-grade, open-source bulk payments engine powered by the Stellar network. The goal of this report is to map SDP's native capabilities to SAPCONE's field operations, identify structural deficiencies (gaps) in the platform's out-of-the-box architecture, and outline technical proposals to resolve these gaps through targeted extension modules.

---

## 2. Operational Realities and System Context

### 2.1 Geographic Reach and Corridor Challenges
SAPCONE runs programs in geographically challenging, under-banked, and conflict-affected regions:
* **Domestic Corridor (Turkana County, Kakuma, Kenya):** A strong ecosystem of Safaricom M-Pesa mobile money and Equity Bank transfers exists. However, it is restricted by phone ownership rates and national border boundaries.
* **Cross-Border Corridors (Uganda, South Sudan, and Ethiopia):** Financial infrastructure breaks down. SAPCONE finance officers are forced to physically transport cash across borders to execution sites, bearing personal security risks, exchange rate volatility, and a high administrative reconciliation burden.

### 2.2 Current Payment and Delivery Mechanisms
1. **Registered Mobile Users (Kenya):** Managed via bulk CSV file uploads sent to M-Pesa/Equity Bank. This path functions efficiently but operates in silos.
2. **Phone-Less and Offline Beneficiaries:** A significant portion of SAPCONE's recipient base does not own a smartphone or basic mobile phone. These participants must receive funds through physical cash handovers.
3. **Proxy Delivery:** For phone-less recipients, SAPCONE utilizes community gatekeepers (proxies) to collect cash on behalf of the beneficiaries. Notifications are sent via SMS to the proxies two to three days in advance. Handover verification is manual and paper-based, relying on handwritten signatures, thumbprints, and stamps from local area chiefs. SAPCONE has identified systemic reporting gaps in this process, highlighting the need for a digital tracking system.
4. **Donor Reporting:** Current compliance requirements are met by providing certified Equity Bank statements. While donors do not yet require real-time or per-participant ledger audits, industry expectations are moving toward decentralized verification.

---

## 3. Stellar Disbursement Platform (SDP) Standard Capabilities

The Stellar Disbursement Platform is a suite of microservices designed to coordinate bulk stablecoin (USDC) payments. It is composed of three primary operational components:

* **SDP Core Service (Go API):** Manages administrative portals, tenant provisioning, receiver registration endpoints, and SEP-24 interactive flows.
* **Transaction Submission Service (TSS) (Go Daemon):** Polls the database, builds transactions, handles channel-account sequence numbers, signs transaction envelopes, and broadcasts them to Horizon.
* **Dashboard Frontend (React/TypeScript):** The admin UI used by finance officers to create and monitor disbursements.

### 3.1 The Standard Receiver Flow
The standard SDP receiver flow is built on the assumption of ubiquitous mobile and smartphone ownership:
1. **Disbursement Creation:** A finance officer uploads a CSV containing phone numbers, external IDs, amounts, and a KYC verification value (such as Date of Birth).
2. **SMS Invitation:** The SDP triggers an SMS (via Twilio or AWS SNS) containing a signed deep link to the recipient's phone number.
3. **SEP-24 Registration:** The recipient clicks the link, which opens the Stellar Demo Wallet or an equivalent non-custodial wallet application. This initiates a SEP-10 cryptographic handshake, followed by an interactive SEP-24 webview hosted by the SDP.
4. **KYC Verification:** The receiver enters their phone number, receives a one-time password (OTP), and submits the CSV-matching verification value (such as Date of Birth).
5. **On-Chain Settlement:** Upon successful validation, the TSS detects the registration, creates the recipient's wallet, establishes a USDC trustline, signs the transaction, and submits it to Horizon. Funds are settled within seconds.
6. **Cash-Out:** The receiver utilizes local off-ramp integrations within their wallet to swap USDC for physical cash or local bank deposits.

---

## 4. Implemented Custom Workflow (DisburseFlow)

To align the SDP with standard financial control standards, SAPCONE has implemented a three-step role-based disbursement flow that enforces segregation of duties. This configuration replaces the single-step direct execution model.

The transition pipeline is managed through the status machine in [dibursements_state_machine.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/dibursements_state_machine.go):

```
[ DRAFT ] ──(Upload CSV)──→ [ READY ] ──(Approver signs)──→ [ APPROVED ] ──(Finance Officer submits)──→ [ STARTED ] ──→ [ COMPLETED ]
```

### 4.1 Step 1: Upload (DRAFT → READY)
* **API Endpoint:** `POST /api/v1/disbursements`
* **Authorized Roles:** `Uploader`, `Initiator`, `Owner`, `FinancialController` (defined in [roles.go](file:///home/bethwel/stellar-disbursement-platform-frontend/backend/internal/data/roles.go))
* **Action:** Parses the beneficiary CSV, checks E.164 phone formats, validates asset codes, and sets the disbursement status to `READY`.

### 4.2 Step 2: Verification and Approval (READY → APPROVED)
* **API Endpoint:** `PATCH /api/v1/disbursements/{id}/approve`
* **Authorized Roles:** `Approver`, `Owner`, `FinancialController`
* **Action:** An independent manager reviews the disbursement metadata. If valid, they transition the state to `APPROVED`. 
* **Control Mechanism:** If `is_approval_required` is enabled in the database, the system blocks the same user who created the draft from approving it, preventing internal collusive fraud.

### 4.3 Step 3: Execution and Settlement (APPROVED → STARTED)
* **API Endpoint:** `PATCH /api/v1/disbursements/{id}/submit`
* **Authorized Roles:** `FinanceOfficer`, `Owner`, `FinancialController`
* **Action:** Triggers the Go TSS daemon to begin processing the payments, signing ledger envelopes, and submitting them to the Stellar network.

---

## 5. Gap Analysis Matrix

The table below outlines the comparison between SAPCONE's requirements and standard SDP features, categorizing the proposed solutions:

| Requirement | SDP Out-of-the-Box Feature | Identified Gap | Proposed Product / Module | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Bulk USDC Payouts** | Supported via CSV upload to Core API and TSS. | None. Core execution maps directly to requirements. | **DisburseFlow** (Core SDP) | Implemented & Verified |
| **Segregation of Duties** | Historically single-step execution. | Needed independent roles for CSV Upload, Approval, and Submission. | **DisburseFlow** (Core SDP) | Implemented & Verified |
| **Phone-Less Registration** | Requires smartphone, phone number, and SMS reception for SEP-24. | Cannot register beneficiaries who do not own a phone. | **LastMile** (Extension) | Proposed Design |
| **Proxy Handover Verification** | No native concept of proxies, physical receipt, or handovers. | Cannot verify if a proxy distributed funds to the end beneficiary. | **LastMile** (Extension) | Proposed Design |
| **Donor Audit Access** | Admin dashboard is login-gated; no public-facing audit portal. | Donors require a read-only, non-authenticated portal to audit disbursements. | **OpenLedger** (Extension) | Proposed Design |
| **USSD Integration** | Relies on mobile app webviews and internet connectivity. | Basic phone users cannot access interactive smartphone flows. | **Project Propel** (USSD) | Deferred (Pending Aggregator Agreements) |

---

## 6. Technical Designs for Gap Resolution

### 6.1 LastMile: Registration for Phone-Less Beneficiaries

#### 6.1.1 The Challenge
Standard SDP requires a phone number or email address to trigger an SMS invitation. If a beneficiary has no phone, they cannot receive the deep link, complete the SEP-10 handshake, or submit KYC details via SEP-24.

#### 6.1.2 The Proposed Solution
Develop a field-agent registration portal within the **LastMile** extension. Under this model:
1. **Reference Card Generation:** Every phone-less beneficiary is issued a physical reference card containing a unique QR code representing their registration ID.
2. **In-Person Registration:** A SAPCONE field officer logs into the mobile agent app using a secure staff authentication token.
3. **Bypass OTP:** The agent scans the QR code, enters the beneficiary's KYC data (such as Date of Birth), and manually verifies their identity.
4. **Registration Bypass Endpoint:** The client submits the registration data to a new endpoint `POST /api/v1/receivers/register-in-person` in the Core API. This bypasses the SMS/OTP validation loop and registers the wallet state directly.

#### 6.1.3 Custody Model Contention
A key architectural decision centers on the custodial structure for phone-less receivers:

```
Option A: Individual Stellar Accounts
[Receiver 1] ──→ Stellar Account A (USDC Trustline)
[Receiver 2] ──→ Stellar Account B (USDC Trustline)
* Higher creation cost (0.5 XLM reserve per account + trustline fees).
* Complete ledger-level segregation.

Option B: Pooled Shared Account
                 ┌──→ Memo: Recipient_ID_1
[Shared Account] ├──→ Memo: Recipient_ID_2
                 └──→ Memo: Recipient_ID_3
* Single Stellar account; zero account creation overhead.
* Relies on off-chain databases to map payouts via transaction memos.
```

* **Option A (Individual Stellar Accounts):** Every phone-less recipient is assigned a unique on-chain public key. The database registers a corresponding record in the `receiver_wallets` table.
* **Option B (Pooled Account with Memo Mapping):** Payouts are routed to a shared pool account managed by SAPCONE. Individual transfers are distinguished by unique Stellar transaction memo fields.
* **Recommendation:** Option A is the preferred working assumption to maintain a clean on-chain audit trail and ensure compliance with donor expectations.

---

### 6.2 LastMile: Proxy Handover Verification

#### 6.2.1 The Challenge
When payments are sent to a community gatekeeper (proxy) on behalf of phone-less recipients, the standard SDP cannot trace the secondary physical handover. There is no mechanism to verify if the physical cash reached the target beneficiary.

#### 6.2.2 The Proposed Solution
Integrate a proxy management database and QR scan confirmation pipeline. Two new tables must be added to the database schema, as defined in [BACKEND_INTEGRATION.md](file:///home/bethwel/stellar-disbursement-platform-frontend/frontend/BACKEND_INTEGRATION.md):
1. **`sdp_proxies`**: Maps proxy personal identities, national IDs, and mobile wallet addresses.
2. **`sdp_proxy_deliveries`**: Tracks individual payment rows assigned to proxies, capturing card reference scans, timestamps, and Stellar confirmation transaction hashes.

```
1. Proxy receives USDC on-chain
2. Proxy distributes physical cash to Beneficiary
3. Proxy scans Beneficiary's QR card via LastMile mobile app
4. App posts transaction: API signs and broadcasts anchoring transaction to Stellar ledger
```

#### 6.2.3 Technical Contention Points
* **Anchoring Mechanism:**
  * *Option A (Memo Transactions):* A simple transaction is written to the Stellar ledger with the `delivery_event_id` in the memo field. This is cost-effective but does not enforce logical checks on-chain.
  * *Option B (Soroban Smart Contracts):* A smart contract manages escrowed funds, releasing them to the proxy's wallet only when a cryptographic proof of the beneficiary's QR scan is submitted. This enforces the verification logic on-chain but adds gas fees and development complexity.
* **Sequence Risk:**
  The current design allows the proxy to receive USDC *before* physical cash distribution is verified. The subsequent QR scan merely records a claim after the fact. If a proxy defaults, SAPCONE has no programmatic recourse. An alternative design—where funds are held in a smart contract escrow and released to the proxy only upon scanning the beneficiary's QR card—is under evaluation to address this risk.

---

### 6.3 OpenLedger: Donor-Facing Public Audit Portal

#### 6.3.1 The Challenge
The standard SDP dashboard requires authentication and contains personally identifiable information (PII) such as phone numbers, emails, and KYC data. SAPCONE cannot grant direct access to external donors due to data privacy regulations.

#### 6.3.2 The Proposed Solution
Develop **OpenLedger**, an independent, read-only public web application. OpenLedger queries the SDP database and the public Stellar ledger to display:
* Transaction batch hashes.
* Aggregated disbursement amounts.
* Anonymized delivery logs (for example, showing that beneficiary `ID: 4ba1` received their payment via proxy `ID: prx-99` at a specific timestamp).
* Live ledger status proofs retrieved from the Horizon endpoint, validating that stablecoins were moved.

---

## 7. Open Engineering and Architectural Questions

Before executing a live pilot deployment, three key architectural decisions must be resolved:

1. **Custody Selection:** Will SAPCONE utilize individual accounts (Option A) or pooled accounts (Option B) for phone-less beneficiaries? The choice affects database scaling and on-chain reserve management.
2. **Anchoring Method:** Will proxy handovers be anchored using Stellar memo fields or a Soroban smart contract?
3. **Escrow Sequence Control:** Should funds be pre-funded directly to the proxy (relying on post-hoc auditing) or locked in an escrow contract (released only upon QR scan validation)?

---

## 8. Next Steps and Roadmap

1. **Testnet Deployment:** Deploy the standard SDP stack inside the Docker Compose integration environment.
2. **Simulate Standard Flows:** Execute a test run using the sample CSV dataset containing synthetic beneficiary records:
   * Record `PAY_01` (Phone: `+16042424000`, Amount: `520 XLM/USDC`)
   * Record `PAY_02` (Phone: `+16034568000`, Amount: `600 XLM/USDC`)
   * Record `PAY_03` (Phone: `+16045638000`, Amount: `800 XLM/USDC`)
   * Record `PAY_04` (Phone: `+16022348000`, Amount: `700 XLM/USDC`)
3. **Develop LastMile Prototypes:** Implement the database migrations for `sdp_proxies` and `sdp_proxy_deliveries`, then build mock endpoints for the QR scanning application.
4. **Donor Review:** Present the OpenLedger data model to donors to confirm if the proposed anonymized on-chain audit trail meets verification standards.
