# DisburseFlow Gap Analysis (D-4)

**Product:** SAPCONE Cross-Border Disbursement System — Product 1: DisburseFlow  
**Status:** Populated from a real, running Stellar Disbursement Platform testnet instance and verified fork extension — not a hypothesis document.  
**Authority:** Per PRD Part A.5, this document governs all extension work across DisburseFlow, LastMile, and OpenLedger.

---

## How to Read This Table
* **SDP provides** — confirmed working as shipped, no changes needed.
* **Fork-extends** — gap confirmed; DisburseFlow's fork adds this.
* **Out-of-scope** — explicitly deferred, per PRD Part A.6 or Part D (Project Propel).
* **Evidence column** cites what was actually observed, not assumed — either a real test run, a source-code read, or a specific error surfaced during testing.

---

## Core Payment Requirements

| Requirement | Classification | Evidence |
| :--- | :--- | :--- |
| **Bulk USDC payment from CSV, individually tracked** | SDP-provides | Confirmed via real test disbursements (4-row and 12-row SAPCONE-shaped batches), uploaded and processed through the live dashboard. |
| **Payment status dashboard** | SDP-provides | Confirmed live — Disbursements list view showed batch name, totals, status, success/fail counts without modification. |
| **Recipient registration via phone + OTP (SEP-24)** | SDP-provides | Standard flow confirmed against technical guide Section 5.1; not independently re-tested end-to-end tonight, but no gap identified in the registration mechanism itself. |
| **Direct wallet address payment (bypass SEP-24)** | SDP-provides | Confirmed present in source (`walletAddress`, `walletAddressMemo` fields in `DisbursementInstruction` struct) — not yet live-tested. |
| **CSV validation (phone format, date format)** | SDP-provides | Confirmed via real rejected upload — SDP enforces E.164 phone format and YYYY-MM-DD date of birth format, with clear per-row error messages. |
| **Settlement asset (USDC vs XLM)** | Correction, not a gap | A test batch initially settled in XLM due to a testnet default rather than a deliberate choice; corrected to USDC, matching every project document's stated asset. Flag for anyone else running early tests: confirm asset selection explicitly per disbursement. |

---

## SAPCONE-Specific Extension (Built & Verified)

| Requirement | Classification | Evidence |
| :--- | :--- | :--- |
| **Capture recipient name and local cash-out currency (KES, UGX, etc.) alongside standard SDP receiver data** | Fork-extends — **COMPLETE** | New migration (`db/migrations/sdp-migrations/2026-07-15.0-add-sapcone-receiver-fields.sql`) adds `recipient_name`, `currency_type` (nullable) to `receivers`. Extended `Receiver`, `ReceiverInsert`, and `DisbursementReceiver` structs; fixed `Insert()` SQL parameter mismatch; wired CSV parsing (`RecipientName`, `Currency type` columns). Verified end-to-end: real CSV uploaded through the live dashboard, values confirmed present via direct database query, not just a compiling build. Not upstreamable — SAPCONE-specific reporting fields, per Section 9.5's distinction. |

---

## Confirmed Gaps — LastMile Scope

| Requirement | Classification | Evidence |
| :--- | :--- | :--- |
| **Registration for beneficiaries with no phone at all** | Fork-extends (LastMile) | Confirmed structurally: `receivers` table has a hard CHECK constraint (`receiver_contact_check`) requiring a phone number or email — a phone-less beneficiary cannot exist as a standard receiver record under the current schema. This is a concrete, code-level confirmation of the gap, not just a documented assumption. |
| **Proxy delivery confirmation** | Fork-extends (LastMile) | No native SDP concept of a proxy or physical handover exists in the schema or API; confirmed by inspection of `internal/data/` — no proxy or delivery-confirmation tables present anywhere in the base schema. |

---

## Confirmed Gap — OpenLedger Scope

| Requirement | Classification | Evidence |
| :--- | :--- | :--- |
| **Public, donor-facing, no-login payment verification portal** | Fork-extends (OpenLedger) | SDP dashboard is internal, login-gated (confirmed via `/login` requirement on every dashboard endpoint tested tonight); no public view exists in the shipped product. |

---

## Resolved Without Building Anything

| Requirement | Classification | Evidence |
| :--- | :--- | :--- |
| **Reconciling disbursement batches into SAPCONE's QuickBooks** | No gap — confirmed via live screenshot | SAPCONE's finance process only requires a manual entry of one summary line per batch (batch reference, total, date). The stock SDP disbursement summary view already displays a human-readable batch name, total amount, date, and status — sufficient for manual transcription. No fork work needed; documented here so it isn't mistakenly re-scoped later. |

---

## Open — Not Yet Resolved, Needs Explicit Answers Before Further Fork Work

> [!WARNING]
> The following issues must be resolved before proceeding with further implementation or extension of the fork.

| Question | Why it Matters | Status |
| :--- | :--- | :--- |
| **Connectivity reliability for phone-owning beneficiaries in Turkana / cross-border sites** | The current phone-vs-no-phone gap table assumes "has a phone" = "SEP-24 will work." Field Officer input suggests this isn't guaranteed — a beneficiary can own a phone and still fail SEP-24 due to signal/data issues. This population currently has no fallback path. | Unresolved. Needs a direct answer from the SAPCONE validation session (D-3), not an assumption. Candidate fixes: extended OTP/session timeout for known low-connectivity zones, or routing persistent-failure cases into the LastMile no-phone path as a fallback. |
| **Custody model for no-phone receivers: one Stellar account per receiver vs. pooled accounts distinguished by memo** | Changes the shape of the `receiver_wallets` extension LastMile builds against. Building against the wrong assumption means re-architecting later. | Unresolved — flagged contention point, per Flow-of-Funds Design Brief Question 1. Treat any registration extension work as a working assumption (Option A: one account per receiver) until closed. |
| **Anchoring mechanism for proxy delivery confirmation: memo transaction vs. Soroban contract** | A memo transaction is cheap but only proves a record existed at a point in time (and memo uniqueness isn't currently enforced anywhere in the codebase); a Soroban contract can actually hold funds and gate release in code. These prove different things to a donor reading OpenLedger. | Unresolved — flagged contention point. LastMile teams should build one working approach each and compare rather than settling this in the abstract, per the technical guide's own recommendation. |
| **Sequence risk in proxy delivery — a proxy could currently receive funds before beneficiary handover is confirmed** | As designed, a card scan records a claimed handover, not a control that prevents a false one. This materially affects what OpenLedger can honestly claim to verify. | Unresolved. Must be closed before proxy delivery is presented as a verifiable control rather than an after-the-fact log. |
| **Horizon vs. Stellar RPC for transaction submission/queries** | RPC enables Soroban contract interaction (relevant if the anchoring decision above goes that way) but has materially shorter history retention than Horizon, which could break OpenLedger's ability to show older settled payments. | Deliberately parked. Do not implement without this document being updated first — this touches core SDP integration, not an extension point. |

---

## Explicitly Out of Scope for Studio (per PRD Part A.6)
* Mainnet deployment — testnet only
* USSD channel — requires aggregator agreements, deferred to Project Propel
* Live off-ramp / cash-out — sandbox/simulated only
* Ethiopia and South Sudan corridor handling
* Full role-based access control beyond SDP defaults

---

## What This Document Unlocks
Per the acceptance walkthrough definition in PRD Part B.1, this document — together with the live 50-payment test run and the demonstrated fork extension (SAPCONE receiver fields) — satisfies the three components of the DisburseFlow acceptance walkthrough:
1.  ✅ **Live testnet SDP instance** executing a SAPCONE-shaped disbursement
2.  ✅ **Gap analysis presented**, every requirement mapped
3.  ✅ **At least one fork extension** demonstrated working (`recipient_name`/`currency_type`, verified end-to-end)

> [!IMPORTANT]
> Still needed before Studio close-out: the formal SAPCONE validation session (D-3) to resolve the four open items above — none of them should be answered by assumption.
