console.log("[DisbursementStudio] src/App.tsx execution started");

import React, { useState, useEffect } from "react";

// TypeScript definitions matching SAPCONE DisburseFlow schema
interface Recipient {
  phone: string; // receivers.phone (external ID) - Contact channel for SMS
  id: string; // id - SAPCONE's own identifier for participant
  amount: string; // payments.amount - Value to be paid
  verification: string; // verification - Date of birth (DOB) checked during SEP-24
  paymentID: string; // paymentID - SAPCONE-side reference for reconciliation
  errors: {
    phone?: string;
    id?: string;
    amount?: string;
    verification?: string;
    paymentID?: string;
  };
}

// Decoded from the backend's JWT payload (see okello-backend LoginResponse claims).
interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface TeamUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  roles: string[];
}

const ALL_ROLES = [
  "owner",
  "financial_controller",
  "developer",
  "business",
  "initiator",
  "approver",
  "uploader",
  "finance_officer",
] as const;

// Decodes the JWT payload client-side (no verification needed — it only drives which UI
// elements render; the backend independently enforces every permission on each request).
function decodeJwtUser(token: string): CurrentUser | null {
  try {
    const payloadB64 = token.split(".")[1];
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/").padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    const user = payload.user;
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      roles: user.roles || [],
    };
  } catch {
    return null;
  }
}

// Matches the real backend's `data.Disbursement` response shape (see
// okello-backend/internal/data/disbursements.go).
interface DisbursementHistoryItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_amount: string;
  total_payments: number;
  asset?: { code: string };
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const getAuthToken = () => localStorage.getItem("token") || "";
const setAuthToken = (token: string) => localStorage.setItem("token", token);
const clearAuthToken = () => localStorage.removeItem("token");

// Stable per-browser identifier required by the backend's MFA device check.
const getDeviceId = () => {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
};

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(formatApiError(errorBody, response.statusText));
  }
  return response.json();
}

// The backend's httperror package puts the top-level message in `error`, with optional
// field-level detail in `extras` (e.g. {"roles": "the number of roles required is exactly one"})
// — surface both, since the top-level message alone (e.g. "Request invalid") is often useless.
function formatApiError(errorBody: any, fallback: string): string {
  const base = errorBody?.error || errorBody?.message || `API error: ${fallback}`;
  if (errorBody?.extras && typeof errorBody.extras === "object") {
    const details = Object.values(errorBody.extras).filter(Boolean).join("; ");
    if (details) return `${base}: ${details}`;
  }
  return base;
}

// Auth endpoints are unauthenticated (no Bearer token yet) and need the Device-ID header.
async function authApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Device-ID": getDeviceId(),
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatApiError(responseBody, response.statusText));
  }
  return responseBody;
}

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "bg-slate-200", width: "w-0" };
  const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
  if (score === 2) return { label: "Fair", color: "bg-amber-500", width: "w-2/4" };
  if (score === 3) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
}

function ResetPasswordView() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, reset_token: token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(body, res.statusText));
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-xs text-center">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">Invalid reset link</p>
          <p className="text-xs text-slate-500 mb-5">This link is missing a reset token. Please request a new password reset.</p>
          <a href="/" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">← Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
        <h1 className="text-xl font-bold tracking-wider text-slate-900 mb-1">SAPCONE</h1>
        <p className="text-sm text-slate-500 mb-6">Set a new password for your account</p>

        {done ? (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">Password updated</p>
            <p className="text-xs text-slate-500 mb-5">Your password has been changed. You can now sign in with your new credentials.</p>
            <a href="/" className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all text-sm">Sign in</a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-white border border-slate-300 text-slate-900 py-2 px-3 pr-10 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-1.5">
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                  </div>
                  <p className={`text-[10px] mt-0.5 font-semibold ${
                    strength.label === "Weak" ? "text-red-500" :
                    strength.label === "Fair" ? "text-amber-500" :
                    strength.label === "Good" ? "text-blue-500" : "text-emerald-600"
                  }`}>{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Confirm password</label>
              <input
                type={showPw ? "text" : "password"}
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full bg-white border text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${
                  mismatch ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
              {mismatch && <p className="text-[10px] text-red-500 mt-0.5 font-medium">Passwords do not match</p>}
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading || mismatch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
            <div className="text-center">
              <a href="/" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">← Back to sign in</a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Error Boundary to prevent blank screens in browser
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-12 bg-slate-900 text-slate-100 font-sans min-h-screen flex flex-col justify-center items-center">
          <div className="max-w-2xl w-full p-8 bg-red-950/20 border border-red-500/30 rounded-2xl">
            <h2 className="text-red-500 text-xl font-bold mt-0 mb-2">
              Something went wrong in the UI
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              The application crashed at runtime. Details below:
            </p>
            <pre className="bg-slate-950 p-4 rounded-xl text-red-400 overflow-x-auto text-xs font-mono mb-4">
              {this.state.error?.stack || this.state.error?.message}
            </pre>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white border-none rounded-lg cursor-pointer font-semibold transition-all"
            >
              Clear Storage & Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent = () => {
  console.log("[DisbursementStudio] AppContent rendering...");

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [recaptchaEnabled, setRecaptchaEnabled] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    fetchApi("/app-config")
      .then((config) => setRecaptchaEnabled(!config.recaptcha_disabled && !!config.recaptcha_site_key))
      .catch((err) => console.warn("Failed to fetch app-config", err));
  }, []);

  useEffect(() => {
    setCurrentUser(isAuthenticated ? decodeJwtUser(getAuthToken()) : null);
  }, [isAuthenticated]);

  const roles = currentUser?.roles || [];
  const canUpload = roles.some((r) => ["owner", "financial_controller", "initiator", "uploader"].includes(r));
  const canApprove = roles.some((r) => ["owner", "financial_controller", "approver"].includes(r));
  const canSubmit = roles.some((r) => ["owner", "financial_controller", "finance_officer"].includes(r));
  const canManageUsers = roles.includes("owner");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const result = await authApi("/login", {
        email: loginEmail,
        password: loginPassword,
        recaptcha_token: "",
      });
      if (result.token) {
        setAuthToken(result.token);
        setIsAuthenticated(true);
      } else {
        // No token in the response means the backend sent an MFA code instead.
        setMfaRequired(true);
      }
    } catch (err: any) {
      setAuthError(err.message || "Login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const result = await authApi("/mfa", {
        mfa_code: mfaCode,
        remember_me: true,
        recaptcha_token: "",
      });
      setAuthToken(result.token);
      setIsAuthenticated(true);
      setMfaRequired(false);
      setMfaCode("");
    } catch (err: any) {
      setAuthError(err.message || "MFA verification failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginEmail("");
    setLoginPassword("");
    setMfaRequired(false);
  };

  // State Management
  const [view, setView] = useState<"home" | "upload" | "approvals" | "submissions" | "history" | "team">(
    "home",
  );
  const [disbursementId, setDisbursementId] = useState<string | null>(null);
  const [distPublicKey, setDistPublicKey] = useState<string>("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [assetType, setAssetType] = useState<"USDC" | "XLM">("USDC");

  const [distBalance, setDistBalance] = useState<number>(0);
  const [xlmBalance, setXlmBalance] = useState<number>(0);
  const [selectedVaultAsset, setSelectedVaultAsset] = useState<"USDC" | "XLM">("USDC");

  // Real backend config needed to create a disbursement (wallet_id/asset_id are DB ids).
  const [assets, setAssets] = useState<{ id: string; code: string }[]>([]);
  const [wallets, setWallets] = useState<{ id: string; name: string }[]>([]);
  const [walletId, setWalletId] = useState<string>("");

  const [disbursementHistory, setDisbursementHistory] = useState<DisbursementHistoryItem[]>([]);

  // Approvals Queue (role: approver/owner/financial_controller)
  const [approvalsQueue, setApprovalsQueue] = useState<DisbursementHistoryItem[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState(false);

  // Submissions Queue (role: finance_officer/owner/financial_controller)
  const [submissionsQueue, setSubmissionsQueue] = useState<DisbursementHistoryItem[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submissionLogs, setSubmissionLogs] = useState<string[]>([]);
  const [submissionDone, setSubmissionDone] = useState(false);

  // Team Members (role: owner only)
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  // The backend accepts exactly one role per user (see validateRoles in
  // user_handler.go: "in the MVP, users should have only one role").
  const [newUserForm, setNewUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [teamError, setTeamError] = useState("");

  // Custom Toast Notification State
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Loading skeleton state
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  // Auto-dismiss helper for notifications
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
  };

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Load initial data from Go Backend
  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadInitialData() {
      setIsLoadingHistory(true);
      try {
        const [orgData, assetsData, walletsData] = await Promise.all([
          fetchApi("/organization"),
          fetchApi("/assets?enabled=true"),
          fetchApi("/wallets?enabled=true"),
        ]);
        setDistPublicKey(orgData.distribution_account_public_key || "");
        const usdc = assetsData.find((a: any) => a.code === "USDC");
        const xlm = assetsData.find((a: any) => a.code === "XLM");
        setDistBalance(usdc?.balance ? parseFloat(usdc.balance) : 0);
        setXlmBalance(xlm?.balance ? parseFloat(xlm.balance) : 0);
        setAssets(assetsData.map((a: any) => ({ id: a.id, code: a.code })));
        setWallets(walletsData.map((w: any) => ({ id: w.id, name: w.name })));
        if (walletsData.length > 0) setWalletId(walletsData[0].id);
      } catch (err) {
        console.warn("Failed to fetch organization/asset/wallet data from backend.", err);
      }

      try {
        const historyData = await fetchApi("/disbursements");
        setDisbursementHistory(historyData.data || []);
      } catch (err) {
        console.warn("Failed to fetch history from backend.", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadInitialData();
  }, [isAuthenticated]);

  // Validation function matching CSV rules
  const validateRecipientRow = (
    row: Partial<Recipient>,
    allRows: Partial<Recipient>[],
  ): Recipient["errors"] => {
    const errors: Recipient["errors"] = {};

    // Validate Phone (receivers.phone) — backend requires a leading "+" (E.164),
    // see rxPhone in the real backend's internal/utils/validation.go.
    if (!row.phone || row.phone.trim() === "") {
      errors.phone = "Phone number is required";
    } else {
      const phoneClean = row.phone.replace(/[\s\-()]/g, "");
      const phoneRegex = /^\+[1-9]\d{9,14}$/;
      if (!phoneRegex.test(phoneClean)) {
        errors.phone = "Invalid format. E.g. +254701234567";
      }
    }

    // Validate ID (external reference)
    if (!row.id || row.id.trim() === "") {
      errors.id = "External reference ID is required";
    } else {
      const duplicate = allRows.filter((r) => r.id === row.id).length > 1;
      if (duplicate) {
        errors.id = "Duplicate reference ID found";
      }
    }

    // Validate Amount (payments.amount)
    if (!row.amount || row.amount.trim() === "") {
      errors.amount = "Amount is required";
    } else {
      const amt = parseFloat(row.amount);
      if (isNaN(amt) || amt <= 0) {
        errors.amount = "Must be a positive number";
      }
    }

    // Validate Verification (DOB) — backend requires YYYY-MM-DD (Go's "2006-01-02"
    // layout, see ValidateDateOfBirthVerification in the real backend).
    if (!row.verification || row.verification.trim() === "") {
      errors.verification = "Verification DOB (YYYY-MM-DD) is required";
    } else {
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(row.verification.trim())) {
        errors.verification = "Format must be YYYY-MM-DD (e.g. 1987-12-01)";
      }
    }

    // Validate Payment ID
    if (!row.paymentID || row.paymentID.trim() === "") {
      errors.paymentID = "Internal paymentID reference is required";
    } else {
      const duplicate = allRows.filter((r) => r.paymentID === row.paymentID).length > 1;
      if (duplicate) {
        errors.paymentID = "Duplicate paymentID found";
      }
    }

    return errors;
  };

  // Sync draft to Go Backend API
  // Parses the phone,id,amount,verification,paymentID CSV client-side for immediate
  // display — the real backend's disbursement-creation response doesn't echo rows back.
  const parseCsvFile = (file: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const lines = String(reader.result)
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");
        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const cells = line.split(",").map((c) => c.trim());
          const row: Record<string, string> = {};
          headers.forEach((header, i) => {
            row[header] = cells[i] ?? "";
          });
          return row;
        });
        resolve(rows);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  // CSV upload handler: parses the file locally for the table, then creates the real
  // disbursement (with wallet_id/asset_id/verification_field/registration_contact_type)
  // via multipart POST /disbursements.
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileName(file.name);

    try {
      const rows = await parseCsvFile(file);
      const validated = rows.map((row) => {
        const rec = {
          phone: row.phone || "",
          id: row.id || "",
          amount: row.amount || "",
          verification: row.verification || "",
          paymentID: row.paymentID || "",
          errors: {},
        } as Recipient;
        rec.errors = validateRecipientRow(rec, rows as Partial<Recipient>[]);
        return rec;
      });

      const assetId = assets.find((a) => a.code === assetType)?.id;
      // The multipart handler reads a single "data" field containing the JSON
      // metadata (see postDisbursementWithInstructions in disbursement_handler.go) —
      // it does NOT read separate form fields per property.
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "data",
        JSON.stringify({
          name: file.name,
          asset_id: assetId,
          wallet_id: walletId,
          verification_field: "DATE_OF_BIRTH",
          registration_contact_type: "PHONE_NUMBER",
          receiver_registration_message_template:
            "You have received a payment from SAPCONE. Click the link to register and receive it.",
        }),
      );

      const result = await fetchApi("/disbursements", {
        method: "POST",
        body: formData,
      });

      setDisbursementId(result.id);
      setRecipients(validated);
      showNotification("success", "CSV uploaded and validated successfully by Go backend.");
    } catch (err: any) {
      showNotification("error", err.message || "Failed to upload and validate CSV.");
    } finally {
      setIsUploading(false);
    }
  };

  // Cell change updates and revalidates live. Row edits stay client-side only — the
  // real backend has no endpoint for incremental draft edits after upload.
  const handleCellChange = (
    index: number,
    field: keyof Omit<Recipient, "errors" | "status">,
    value: string,
  ) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };

    const revalidated = updated.map((rec) => {
      const errors = validateRecipientRow(rec, updated);
      return { ...rec, errors };
    });

    setRecipients(revalidated);
  };

  // Row operations
  const handleAddRow = () => {
    const newRow: Recipient = {
      phone: "+",
      id: `EXT-${Date.now().toString().slice(-4)}`,
      amount: "100",
      verification: "1990-01-01",
      paymentID: `PAY_${Date.now().toString().slice(-4)}`,
      errors: {
        phone: "Phone number required",
        verification: "Verification DOB required",
      },
    };
    const updated = [...recipients, newRow];
    setRecipients(updated);
  };

  const handleDeleteRow = (index: number) => {
    const updated = recipients.filter((_, idx) => idx !== index);
    const revalidated = updated.map((rec) => {
      const errors = validateRecipientRow(rec, updated);
      return { ...rec, errors };
    });
    setRecipients(revalidated);
  };

  const downloadTemplate = () => {
    const csvContent =
      "phone,id,amount,verification,paymentID\n+16042424000,4ba1,520,1987-12-01,PAY_01\n+16034568000,3ce2,600,1967-06-04,PAY_02\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sapcone_disburseflow_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasErrors = recipients.some((r) => Object.keys(r.errors).length > 0);
  const totalPayout = recipients.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const handleResetUpload = () => {
    setDisbursementId(null);
    setRecipients([]);
    setUploadedFileName("");
  };

  const handleClearLocalStorage = () => {
    try {
      localStorage.clear();
      showNotification("success", "Local session cleared. You'll need to sign in again.");
      handleLogout();
    } catch {
      showNotification("error", "Error clearing local storage.");
    }
  };

  // Approvals Queue: every READY disbursement, from any uploader, waiting on an approver.
  const fetchApprovalsQueue = async () => {
    setIsLoadingApprovals(true);
    try {
      const result = await fetchApi("/disbursements?status=ready");
      setApprovalsQueue(result.data || []);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to load approvals queue.");
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  // Approves one disbursement from the queue (segregation-of-duty sign-off) then refetches.
  const handleApproveRow = async (id: string) => {
    try {
      await fetchApi(`/disbursements/${id}/approve`, { method: "PATCH" });
      showNotification("success", "Disbursement approved successfully!");
      fetchApprovalsQueue();
    } catch (err: any) {
      showNotification("error", err.message || "Failed to approve disbursement.");
    }
  };

  // Submissions Queue: every APPROVED disbursement waiting on a finance officer.
  // NOTE: the real backend's status-filter validator doesn't accept "approved" (a gap in
  // its own whitelist), so we fetch unfiltered and filter client-side instead.
  const fetchSubmissionsQueue = async () => {
    setIsLoadingSubmissions(true);
    try {
      const result = await fetchApi("/disbursements");
      const all: DisbursementHistoryItem[] = result.data || [];
      setSubmissionsQueue(all.filter((d) => d.status === "APPROVED"));
    } catch (err: any) {
      showNotification("error", err.message || "Failed to load submissions queue.");
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  // Submits one approved disbursement to Stellar and polls its payments until they settle.
  const handleSubmitRow = async (id: string) => {
    setSubmittingId(id);
    setSubmissionLogs([]);
    setSubmissionDone(false);

    try {
      await fetchApi(`/disbursements/${id}/submit`, { method: "PATCH" });
      showNotification("success", "Disbursement execution initiated on Stellar.");

      // Poll real payment + disbursement status (there's no /logs endpoint on the
      // real backend — progress is derived from payment states instead).
      const pollInterval = setInterval(async () => {
        try {
          const paymentsData = await fetchApi(`/payments?disbursement_id=${id}`);
          const payments: any[] = paymentsData.data || [];
          setSubmissionLogs(
            payments.map(
              (p) => `[payment ${p.external_payment_id || p.id}] ${p.status}${p.stellar_transaction_id ? ` (tx: ${p.stellar_transaction_id})` : ""}`,
            ),
          );

          const statusData = await fetchApi(`/disbursements/${id}`);
          const anyFailed = payments.some((p) => p.status === "FAILED");
          const allSettled =
            payments.length > 0 && payments.every((p) => p.status === "SUCCESS" || p.status === "FAILED");

          if (statusData.status === "COMPLETED" || allSettled) {
            clearInterval(pollInterval);
            setSubmissionDone(true);
            showNotification(
              anyFailed ? "error" : "success",
              anyFailed
                ? "Disbursement execution completed with some failed payments."
                : "Disbursement execution completed successfully on Stellar!",
            );

            // Reload balances, history, and the submissions queue (this item drops off it)
            const [orgData, assetsData, historyData] = await Promise.all([
              fetchApi("/organization"),
              fetchApi("/assets?enabled=true"),
              fetchApi("/disbursements"),
            ]);
            setDistPublicKey(orgData.distribution_account_public_key || "");
            const usdc = assetsData.find((a: any) => a.code === "USDC");
            const xlm = assetsData.find((a: any) => a.code === "XLM");
            setDistBalance(usdc?.balance ? parseFloat(usdc.balance) : 0);
            setXlmBalance(xlm?.balance ? parseFloat(xlm.balance) : 0);
            const allDisbursements: DisbursementHistoryItem[] = historyData.data || [];
            setDisbursementHistory(allDisbursements);
            setSubmissionsQueue(allDisbursements.filter((d) => d.status === "APPROVED"));
          } else if (statusData.status === "PAUSED") {
            clearInterval(pollInterval);
            setSubmittingId(null);
            showNotification("error", "Disbursement execution paused on backend.");
          }
        } catch (err) {
          console.error("Error polling execution status", err);
        }
      }, 2000);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to execute disbursement.");
      setSubmittingId(null);
    }
  };

  // Team Members (owner only)
  const fetchTeamUsers = async () => {
    setIsLoadingTeam(true);
    try {
      const result = await fetchApi("/users");
      setTeamUsers(result.data || result || []);
    } catch (err: any) {
      showNotification("error", err.message || "Failed to load team members.");
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamError("");
    setIsCreatingUser(true);
    try {
      await fetchApi("/users", {
        method: "POST",
        body: JSON.stringify({
          first_name: newUserForm.firstName,
          last_name: newUserForm.lastName,
          email: newUserForm.email,
          roles: [newUserForm.role],
        }),
      });
      showNotification("success", `Invitation sent to ${newUserForm.email}.`);
      setNewUserForm({ firstName: "", lastName: "", email: "", role: "" });
      fetchTeamUsers();
    } catch (err: any) {
      setTeamError(err.message || "Failed to create user.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleToggleUserActive = async (userId: string, isActive: boolean) => {
    try {
      await fetchApi("/users/activation", {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, is_active: isActive }),
      });
      fetchTeamUsers();
    } catch (err: any) {
      showNotification("error", err.message || "Failed to update user activation.");
    }
  };

  // View-change data loading
  useEffect(() => {
    if (view === "approvals" && canApprove) fetchApprovalsQueue();
    if (view === "submissions" && canSubmit) fetchSubmissionsQueue();
    if (view === "team" && canManageUsers) fetchTeamUsers();
    // Fetch functions are re-created each render (not memoized); including them here
    // would just re-trigger this effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Prime the Home dashboard's stat counts as soon as we know the user's role.
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;
    if (canApprove) fetchApprovalsQueue();
    if (canSubmit) fetchSubmissionsQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentUser]);

  if (window.location.pathname === "/reset-password") {
    return <ResetPasswordView />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
          <h1 className="text-xl font-bold tracking-wider text-slate-900 mb-1">SAPCONE</h1>
          <p className="text-sm text-slate-500 mb-6">Sign in to DisburseFlow Studio</p>

          {!mfaRequired ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {recaptchaEnabled && (
                <p className="text-xs text-amber-600">
                  This backend has reCAPTCHA enabled; login may be rejected until the widget is
                  wired up.
                </p>
              )}
              {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm"
              >
                {authLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  MFA Code
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Check your email for the verification code.
                </p>
                <input
                  type="text"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="w-full bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm"
              >
                {authLoading ? "Verifying..." : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 shadow-xs gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-wider text-slate-900">SAPCONE</h1>
          {currentUser && (
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
              {currentUser.firstName} {currentUser.lastName} ·{" "}
              {currentUser.roles.map((r) => r.replace(/_/g, " ")).join(", ")}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center bg-slate-100 py-2.5 px-4 rounded-xl border border-slate-200">
          <div className="text-xs">
            <span className="text-slate-500 font-medium block">Distribution Account:</span>
            <div
              className="font-mono text-xs text-blue-600 cursor-pointer font-semibold hover:underline mt-0.5"
              onClick={() => {
                if (distPublicKey) {
                  navigator.clipboard.writeText(distPublicKey);
                  alert("Copied Stellar address!");
                }
              }}
            >
              {distPublicKey
                ? `${distPublicKey.slice(0, 8)}...${distPublicKey.slice(-8)}`
                : "Fetching address..."}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs">
            <span className={`font-bold block text-sm ${selectedVaultAsset === "USDC" ? "text-emerald-600" : "text-blue-600"}`}>
              {selectedVaultAsset === "USDC"
                ? `${(distBalance * 129).toLocaleString(undefined, { minimumFractionDigits: 2 })} Ksh`
                : `${(xlmBalance * 11.5).toLocaleString(undefined, { minimumFractionDigits: 2 })} Ksh`}
            </span>
            <select
              value={selectedVaultAsset}
              onChange={(e) => setSelectedVaultAsset(e.target.value as "USDC" | "XLM")}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USDC">USDC</option>
              <option value="XLM">XLM</option>
            </select>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main container */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-16 w-full flex-1">
        {/* Role-based navigation */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white border border-slate-200 p-2 rounded-2xl shadow-xs">
          {[
            { id: "home" as const, label: "Home", show: true },
            { id: "upload" as const, label: "New Disbursement", show: canUpload },
            { id: "approvals" as const, label: "Approvals", show: canApprove },
            { id: "submissions" as const, label: "Submissions", show: canSubmit },
            { id: "history" as const, label: "History", show: true },
            { id: "team" as const, label: "Team", show: canManageUsers },
          ]
            .filter((tab) => tab.show)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${view === tab.id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {tab.label}
              </button>
            ))}
        </div>

        {/* Home View */}
        {view === "home" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <h2 className="text-xl font-extrabold text-slate-900">
              Welcome, {currentUser?.firstName}
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-6">
              You're signed in as {currentUser?.roles.map((r) => r.replace(/_/g, " ")).join(", ")}.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {canUpload && (
                <button
                  onClick={() => setView("upload")}
                  className="text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-xl transition-all"
                >
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Uploader
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">New Disbursement →</div>
                  <div className="text-xs text-slate-500 mt-1">Upload a beneficiary CSV</div>
                </button>
              )}
              {canApprove && (
                <button
                  onClick={() => setView("approvals")}
                  className="text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-xl transition-all"
                >
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Approver
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {approvalsQueue.length} awaiting approval →
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Review READY disbursements</div>
                </button>
              )}
              {canSubmit && (
                <button
                  onClick={() => setView("submissions")}
                  className="text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-xl transition-all"
                >
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Finance Officer
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">
                    {submissionsQueue.length} ready to submit →
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Submit APPROVED disbursements</div>
                </button>
              )}
              {canManageUsers && (
                <button
                  onClick={() => setView("team")}
                  className="text-left bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 p-5 rounded-xl transition-all"
                >
                  <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    Owner
                  </div>
                  <div className="text-lg font-bold text-slate-900 mt-1">Team Members →</div>
                  <div className="text-xs text-slate-500 mt-1">Create and manage staff accounts</div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload View */}
        {view === "upload" && canUpload && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Phase 1: Populating the CSV
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Upload a beneficiary file or manually insert records.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-200 transition-all text-xs"
                  onClick={downloadTemplate}
                >
                  Download Template
                </button>
                <button
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-200 transition-all text-xs"
                  onClick={handleAddRow}
                >
                  Add Row
                </button>
              </div>
            </div>

            {recipients.length === 0 ? (
              <div>
                <div className="flex flex-wrap gap-4 mb-5">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Asset
                    </label>
                    <select
                      className="bg-white border border-slate-300 text-slate-900 py-1.5 px-3 rounded-md text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value as "USDC" | "XLM")}
                    >
                      <option value="USDC">USDC (Circle)</option>
                      <option value="XLM">XLM (Native)</option>
                    </select>
                  </div>
                  {wallets.length > 1 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">
                        Wallet
                      </label>
                      <select
                        className="bg-white border border-slate-300 text-slate-900 py-1.5 px-3 rounded-md text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        value={walletId}
                        onChange={(e) => setWalletId(e.target.value)}
                      >
                        {wallets.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center bg-slate-50 cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition-all flex flex-col items-center justify-center gap-3"
                  onClick={() => document.getElementById("csv-file-input")?.click()}
                >
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ display: "none" }}
                />
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="text-sm font-semibold text-slate-700">
                  {isUploading
                    ? "Uploading files..."
                    : uploadedFileName
                      ? `Active file: ${uploadedFileName}`
                      : "Click to select and upload a beneficiary CSV"}
                </div>
                <div className="text-xs text-slate-400">
                  Required Schema: phone, id, amount, verification, paymentID
                </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      Loaded Records
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {recipients.length}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      Total Draft Payout
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      ${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}{" "}
                      {assetType}
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
                    <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      Asset
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{assetType}</div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm mt-6">
                  <table className="w-full border-collapse text-left text-sm text-slate-700">
                    <thead>
                      <tr>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          paymentID
                        </th>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          phone (receivers.phone)
                        </th>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          id (SAPCONE ref)
                        </th>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          amount ({assetType})
                        </th>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          verification (DOB)
                        </th>
                        <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((rec, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-slate-50/50 transition-colors duration-150 ${Object.keys(rec.errors).length > 0 ? "bg-red-50/50 hover:bg-red-50" : ""}`}
                        >
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <input
                              type="text"
                              value={rec.paymentID}
                              className={`w-full bg-white border text-slate-900 py-1.5 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${rec.errors.paymentID ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                              onChange={(e) => handleCellChange(index, "paymentID", e.target.value)}
                            />
                            {rec.errors.paymentID && (
                              <span className="text-xs text-red-600 mt-1 block font-medium">
                                {rec.errors.paymentID}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <input
                              type="text"
                              value={rec.phone}
                              className={`w-full bg-white border text-slate-900 py-1.5 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${rec.errors.phone ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                              onChange={(e) => handleCellChange(index, "phone", e.target.value)}
                            />
                            {rec.errors.phone && (
                              <span className="text-xs text-red-600 mt-1 block font-medium">
                                {rec.errors.phone}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <input
                              type="text"
                              value={rec.id}
                              className={`w-full bg-white border text-slate-900 py-1.5 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${rec.errors.id ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                              onChange={(e) => handleCellChange(index, "id", e.target.value)}
                            />
                            {rec.errors.id && (
                              <span className="text-xs text-red-600 mt-1 block font-medium">
                                {rec.errors.id}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <input
                              type="text"
                              value={rec.amount}
                              className={`w-full bg-white border text-slate-900 py-1.5 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${rec.errors.amount ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                              onChange={(e) => handleCellChange(index, "amount", e.target.value)}
                            />
                            {rec.errors.amount && (
                              <span className="text-xs text-red-600 mt-1 block font-medium">
                                {rec.errors.amount}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <input
                              type="text"
                              value={rec.verification}
                              placeholder="YYYY-MM-DD"
                              className={`w-full bg-white border text-slate-900 py-1.5 px-3 rounded-md text-sm focus:outline-none focus:ring-2 ${rec.errors.verification ? "border-red-500 focus:ring-red-500/20" : "border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"}`}
                              onChange={(e) =>
                                handleCellChange(index, "verification", e.target.value)
                              }
                            />
                            {rec.errors.verification && (
                              <span className="text-xs text-red-600 mt-1 block font-medium">
                                {rec.errors.verification}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                            <button
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-2.5 rounded-md text-xs transition-all"
                              onClick={() => handleDeleteRow(index)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between mt-6">
                  <button
                    className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-200 transition-all text-sm"
                    onClick={handleResetUpload}
                  >
                    Clear List
                  </button>
                  {disbursementId && !hasErrors && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold py-2 px-4 rounded-lg">
                      ✓ Uploaded — now awaiting approval. An Approver will see it in their
                      Approvals queue.
                    </div>
                  )}
                  <button
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all text-sm"
                    onClick={() => setView("home")}
                  >
                    Back to Home →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Approvals Queue View */}
        {view === "approvals" && canApprove && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Approvals Queue</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Every READY disbursement waiting on an approver, from any uploader. You cannot
                  approve a disbursement you created yourself when approval workflow is enforced.
                </p>
              </div>
              <button
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-200 transition-all text-xs"
                onClick={fetchApprovalsQueue}
              >
                Refresh
              </button>
            </div>

            {isLoadingApprovals ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">Loading…</div>
            ) : approvalsQueue.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                Nothing waiting on approval right now.
              </div>
            ) : (
              <div className="space-y-3">
                {approvalsQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50 border border-slate-200 p-5 rounded-xl"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-3 items-center flex-wrap">
                        <span>ID: {item.id}</span>
                        <span>•</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">
                          {item.total_payments} Payouts ({item.asset?.code})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-extrabold text-sm text-emerald-600">
                        $
                        {parseFloat(item.total_amount || "0").toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {item.asset?.code}
                      </div>
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all text-xs"
                        onClick={() => handleApproveRow(item.id)}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submissions Queue View */}
        {view === "submissions" && canSubmit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-200 pb-5 mb-6 gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Submissions Queue</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Every APPROVED disbursement ready to execute on Stellar.
                </p>
              </div>
              <button
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold py-2 px-4 rounded-lg border border-slate-200 transition-all text-xs"
                onClick={fetchSubmissionsQueue}
              >
                Refresh
              </button>
            </div>

            {isLoadingSubmissions ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">Loading…</div>
            ) : submissionsQueue.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                Nothing approved and waiting on submission right now.
              </div>
            ) : (
              <div className="space-y-3">
                {submissionsQueue.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-50 border border-slate-200 p-5 rounded-xl"
                  >
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-xs text-slate-500 mt-1 flex gap-3 items-center flex-wrap">
                          <span>ID: {item.id}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-semibold">
                            {item.total_payments} Payouts ({item.asset?.code})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-extrabold text-sm text-emerald-600">
                          $
                          {parseFloat(item.total_amount || "0").toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}{" "}
                          {item.asset?.code}
                        </div>
                        <button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 text-xs"
                          disabled={submittingId === item.id}
                          onClick={() => handleSubmitRow(item.id)}
                        >
                          {submittingId === item.id ? "Submitting…" : "Submit"}
                        </button>
                      </div>
                    </div>

                    {submittingId === item.id && (
                      <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 max-h-[200px] overflow-y-auto shadow-inner">
                        <div className="space-y-1.5">
                          {submissionLogs.map((log, i) => (
                            <div key={i} className="leading-relaxed">
                              {log}
                            </div>
                          ))}
                          {!submissionDone && (
                            <div className="text-blue-400 animate-pulse">&gt; Polling queue...</div>
                          )}
                          {submissionDone && (
                            <div className="text-emerald-300 font-bold">✓ Settled.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {view === "history" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-5 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Disbursement History</h2>
                <p className="text-sm text-slate-500 mt-1">Every disbursement in the organization.</p>
              </div>
              <button
                className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-md text-xs transition-all"
                onClick={handleClearLocalStorage}
              >
                Clear Local Session
              </button>
            </div>
            <div className="space-y-3">
              {isLoadingHistory ? (
                // Pulse Skeleton Loader
                [1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="flex justify-between items-center bg-slate-50 border border-slate-200 p-5 rounded-xl animate-pulse"
                  >
                    <div className="w-1/2 space-y-2">
                      <div className="h-4 bg-slate-200 rounded-sm w-3/4"></div>
                      <div className="h-3 bg-slate-200 rounded-sm w-1/2"></div>
                    </div>
                    <div className="h-4 bg-slate-200 rounded-sm w-20"></div>
                  </div>
                ))
              ) : disbursementHistory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                  No disbursements yet.
                </div>
              ) : (
                disbursementHistory.map((item) => (
                  <div
                    className="flex justify-between items-center bg-slate-50 border border-slate-200 p-5 rounded-xl hover:shadow-md transition-all duration-200"
                    key={item.id}
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex gap-3 items-center">
                        <span>ID: {item.id}</span>
                        <span>•</span>
                        <span>{new Date(item.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-semibold">
                          {item.total_payments} Payouts ({item.asset?.code})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="font-extrabold text-sm text-emerald-600">
                        $
                        {parseFloat(item.total_amount || "0").toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}{" "}
                        {item.asset?.code}
                      </div>
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Team Members View */}
        {view === "team" && canManageUsers && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-8">
            <div className="border-b border-slate-200 pb-5 mb-6">
              <h2 className="text-xl font-extrabold text-slate-900">Team Members</h2>
              <p className="text-sm text-slate-500 mt-1">
                Create staff accounts and assign roles. New users get an email invitation to set
                their own password.
              </p>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8"
            >
              <input
                type="text"
                placeholder="First name"
                required
                value={newUserForm.firstName}
                onChange={(e) => setNewUserForm((p) => ({ ...p, firstName: e.target.value }))}
                className="bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="text"
                placeholder="Last name"
                required
                value={newUserForm.lastName}
                onChange={(e) => setNewUserForm((p) => ({ ...p, lastName: e.target.value }))}
                className="bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
                className="sm:col-span-2 bg-white border border-slate-300 text-slate-900 py-2 px-3 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="sm:col-span-2">
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  Role (a user can only have one)
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_ROLES.map((role) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() => setNewUserForm((p) => ({ ...p, role }))}
                      className={`text-xs font-semibold py-1.5 px-3 rounded-full border transition-all ${newUserForm.role === role ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-100"}`}
                    >
                      {role.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              {teamError && (
                <p className="sm:col-span-2 text-xs text-red-600 font-medium">{teamError}</p>
              )}
              <button
                type="submit"
                disabled={isCreatingUser || !newUserForm.role}
                className="sm:col-span-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm"
              >
                {isCreatingUser ? "Creating…" : "Create User"}
              </button>
            </form>

            {isLoadingTeam ? (
              <div className="text-center py-10 text-slate-400 text-sm font-medium">Loading…</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                <table className="w-full border-collapse text-left text-sm text-slate-700">
                  <thead>
                    <tr>
                      <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                        Name
                      </th>
                      <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                        Email
                      </th>
                      <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                        Roles
                      </th>
                      <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                        Status
                      </th>
                      <th className="bg-slate-50 text-slate-600 font-semibold py-3 px-4 border-b border-slate-200 text-xs uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                        <td className="py-3.5 px-4 border-b border-slate-200 align-middle font-medium">
                          {u.first_name} {u.last_name}
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                          {u.email}
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <span
                                key={r}
                                className="text-[10px] font-semibold py-0.5 px-2 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                              >
                                {r.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                          <span
                            className={`text-xs font-semibold py-1 px-2.5 rounded-full border ${u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 border-b border-slate-200 align-middle">
                          <button
                            className="text-xs font-semibold py-1 px-2.5 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-all"
                            onClick={() => handleToggleUserActive(u.id, !u.is_active)}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl bg-white border border-slate-200 border-l-4 ${notification.type === "success" ? "border-l-emerald-600 text-slate-800" : "border-l-red-600 text-slate-800"} transition-all duration-300 transform translate-y-0 shadow-slate-200/50 animate-fade-in-up`}
        >
          <div
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${notification.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
          >
            {notification.type === "success" ? "✓" : "!"}
          </div>
          <div className="text-sm font-semibold">{notification.message}</div>
        </div>
      )}
    </div>
  );
};

export const App = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};
