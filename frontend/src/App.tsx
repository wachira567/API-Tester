import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  FileJson,
  Home,
  Layers,
  Loader2,
  Menu,
  Play,
  Download,
  Link2,
  List,
  Sparkles,
  Settings,
  ShieldCheck,
  Grid3X3,
  Trash2,
  Workflow,
  Upload,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { jsPDF } from "jspdf";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { UserButton, useSignIn, useSignUp, useUser } from "@clerk/react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Show({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const signedIn = Boolean(user);
  if (when === "signed-in") {
    return signedIn ? <>{children}</> : null;
  }
  return signedIn ? null : <>{children}</>;
}

function clerkErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error &&
    "longMessage" in error &&
    typeof (error as { longMessage?: unknown }).longMessage === "string"
  ) {
    return (error as { longMessage: string }).longMessage;
  }

  if (typeof error === "object" && error && "errors" in error) {
    const maybeErrors = (error as { errors?: Array<{ message?: string }> })
      .errors;
    if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
      const first = maybeErrors.find((entry) => entry?.message)?.message;
      if (first) return first;
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function AuthLanding() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const { isLoaded: userLoaded } = useUser();
  const { signIn, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, fetchStatus: signUpFetchStatus } = useSignUp();
  const clerkBusy =
    !userLoaded ||
    signInFetchStatus === "fetching" ||
    signUpFetchStatus === "fetching";

  const finalizePendingSession = async () => {
    if (signIn.status === "complete") {
      const finalizeResult = await signIn.finalize();
      if (finalizeResult.error) {
        setAuthError(
          clerkErrorMessage(
            finalizeResult.error,
            "Could not finalize sign in.",
          ),
        );
        return false;
      }
      return true;
    }

    if (signUp.status === "complete") {
      const finalizeResult = await signUp.finalize();
      if (finalizeResult.error) {
        setAuthError(
          clerkErrorMessage(
            finalizeResult.error,
            "Could not finalize sign up.",
          ),
        );
        return false;
      }
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!userLoaded) return;
    void finalizePendingSession();
  }, [userLoaded, signIn.status, signUp.status]);

  const resetFlow = () => {
    setAuthError(null);
    setAuthMessage(null);
    setNeedsVerification(false);
    setVerificationCode("");
  };

  const submitSignIn = async () => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const signInResult = await signIn.password({ identifier, password });

      if (signInResult.error) {
        setAuthError(
          clerkErrorMessage(
            signInResult.error,
            "Sign in failed. Check your credentials.",
          ),
        );
        return;
      }

      if (await finalizePendingSession()) {
        return;
      }

      setAuthError(
        "Sign in requires an additional factor. Enable another strategy in Clerk settings or complete MFA.",
      );
    } catch (error) {
      setAuthError(
        clerkErrorMessage(error, "Sign in failed. Check your credentials."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSignUp = async () => {
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const createResult = await signUp.create({
        emailAddress: identifier,
      });
      if (createResult.error) {
        setAuthError(
          clerkErrorMessage(
            createResult.error,
            "Sign up failed. Please try again.",
          ),
        );
        return;
      }

      const passwordResult = await signUp.password({
        emailAddress: identifier,
        password,
      });
      if (passwordResult.error) {
        setAuthError(
          clerkErrorMessage(
            passwordResult.error,
            "Could not set your password. Please retry.",
          ),
        );
        return;
      }

      const sendCodeResult = await signUp.verifications.sendEmailCode();
      if (sendCodeResult.error) {
        setAuthError(
          clerkErrorMessage(
            sendCodeResult.error,
            "Could not send verification code.",
          ),
        );
        return;
      }

      setNeedsVerification(true);
      setAuthMessage(
        "A verification code was sent to your email. Enter it to activate your account.",
      );
    } catch (error) {
      setAuthError(
        clerkErrorMessage(error, "Sign up failed. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVerification = async () => {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const verifyResult = await signUp.verifications.verifyEmailCode({
        code: verificationCode,
      });
      if (verifyResult.error) {
        setAuthError(
          clerkErrorMessage(verifyResult.error, "Invalid verification code."),
        );
        return;
      }

      if (await finalizePendingSession()) {
        return;
      }

      setAuthError("Verification is incomplete. Please check your code.");
    } catch (error) {
      setAuthError(
        clerkErrorMessage(error, "Invalid verification code. Please retry."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const startOAuth = async (strategy: "oauth_google" | "oauth_github") => {
    setIsSubmitting(true);
    setAuthError(null);
    setAuthMessage(null);
    const redirectTo = window.location.origin;

    try {
      const result = await signIn.sso({
        strategy,
        redirectUrl: redirectTo,
        redirectCallbackUrl: redirectTo,
      });

      if (result.error) {
        setAuthError(
          clerkErrorMessage(result.error, "Could not start social sign in."),
        );
        return;
      }
    } catch (error) {
      setAuthError(clerkErrorMessage(error, "Could not start social sign in."));
    } finally {
      setIsSubmitting(false);
    }
  };
  const canSubmit = identifier.trim().length > 0 && password.trim().length >= 8;

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.2),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(34,197,94,0.14),transparent_32%),linear-gradient(165deg,#040711_0%,#071330_58%,#020617_100%)] px-4 py-10 text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2.4rem] border border-sky-200/10 bg-slate-950/55 backdrop-blur-2xl">
        <div className="grid md:grid-cols-[1.15fr_1fr]">
          <section className="relative border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200">
              Gavo API Tester
            </span>
            <h1 className="mt-6 text-4xl font-black leading-tight text-white md:text-5xl">
              Validate APIs with confidence.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 md:text-base">
              Personal workspaces for collections, environments, schemas, and
              run history. Sign in to continue with your isolated testing data.
            </p>
            <div className="mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Per-user isolated assets
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Schema-aware run diagnostics
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Credential profiles
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Run history and failure insights
              </div>
            </div>
          </section>

          <section className="p-8 md:p-10">
            <div className="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => {
                  setMode("signin");
                  resetFlow();
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  mode === "signin"
                    ? "bg-sky-400 text-slate-950"
                    : "text-slate-300 hover:text-white",
                )}
              >
                Sign in
              </button>
              <button
                onClick={() => {
                  setMode("signup");
                  resetFlow();
                }}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  mode === "signup"
                    ? "bg-emerald-300 text-slate-950"
                    : "text-slate-300 hover:text-white",
                )}
              >
                Create account
              </button>
            </div>

            <div className="space-y-4">
              {clerkBusy && (
                <div className="rounded-2xl border border-sky-300/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  Preparing secure authentication...
                </div>
              )}

              <label className="block text-sm text-slate-300">
                Email address
                <input
                  type="email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-sky-400/50"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-sky-400/50"
                  placeholder="At least 8 characters"
                />
              </label>

              {mode === "signup" && !needsVerification && (
                <label className="block text-sm text-slate-300">
                  Confirm password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50"
                    placeholder="Repeat password"
                  />
                </label>
              )}

              {mode === "signup" && needsVerification && (
                <label className="block text-sm text-slate-300">
                  Verification code
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(event) =>
                      setVerificationCode(event.target.value)
                    }
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-emerald-300/50"
                    placeholder="Enter email code"
                  />
                </label>
              )}

              {authError && (
                <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="rounded-2xl border border-emerald-200/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {authMessage}
                </div>
              )}

              <button
                onClick={() => {
                  if (mode === "signin") {
                    void submitSignIn();
                    return;
                  }
                  if (needsVerification) {
                    void submitVerification();
                    return;
                  }
                  void submitSignUp();
                }}
                disabled={
                  isSubmitting ||
                  !canSubmit ||
                  (mode === "signup" && needsVerification && !verificationCode)
                }
                className={cn(
                  "mt-2 w-full rounded-2xl px-5 py-3 text-sm font-bold text-slate-950 transition",
                  mode === "signin"
                    ? "bg-sky-300 hover:bg-sky-200"
                    : "bg-emerald-300 hover:bg-emerald-200",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                )}
              >
                {isSubmitting
                  ? "Working..."
                  : mode === "signin"
                    ? "Sign in"
                    : needsVerification
                      ? "Verify and continue"
                      : "Create account"}
              </button>

              <div className="relative py-1">
                <div className="h-px bg-white/10" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-slate-950 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  or continue with
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void startOAuth("oauth_google")}
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue with Google
                </button>
                <button
                  onClick={() => void startOAuth("oauth_github")}
                  disabled={isSubmitting}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue with GitHub
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface Item {
  name: string;
  filename: string;
}

interface Assertion {
  assertion: string;
  error: string | null;
  passed: boolean;
}

interface Execution {
  name: string;
  method: string;
  url: string;
  status: number | string;
  responseTime: number;
  expectedStatuses: number[];
  expectedResult: string;
  passed: boolean;
  expectedResponseBody: string | null;
  assertions: Assertion[];
  requestBody: string | null;
  responseBody: string | null;
  schemaValidation?: {
    configured: boolean;
    passed: boolean;
    error: string | null;
  };
}

interface Accuracy {
  totalExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  withExpectedStatus: number;
  withoutExpectedStatus: number;
  matchedExpectedStatus: number;
  mismatchedExpectedStatus: number;
}

interface AnalysisIssue {
  kind: NotificationKind;
  title: string;
  detail: string;
  resolution: string;
}

interface AnalysisSummary {
  totalRequests: number;
  requestsWithExpectedStatuses: number;
  requestsMissingExpectedStatuses: number;
  requestsWithExamples: number;
  requestsMissingExamples: number;
  requestsMissingAssertions: number;
  requestsWithSchema?: number;
  requestsMissingSchema?: number;
  requiredEnvironmentVariables?: number;
  missingEnvironmentVariables?: number;
  schemaConfigured?: boolean;
  resolvedBaseUrl: string;
}

interface SchemaItem {
  id: string;
  name: string;
  updatedAt?: string | null;
}

interface AnalysisResult {
  summary: AnalysisSummary;
  issues: AnalysisIssue[];
}

interface Stats {
  requests: { total: number; failed: number };
  assertions: { total: number; failed: number };
}

interface RunFailure {
  type: string;
  source: string;
  parent: string | null;
  error: string;
}

interface FailureSummary {
  total: number;
  items: RunFailure[];
}

interface CredentialProfile {
  id: string;
  name: string;
  role: string;
  username: string;
  password: string;
}

type NotificationKind = "info" | "success" | "warning" | "error";

interface NotificationItem {
  id: number;
  kind: NotificationKind;
  title: string;
  detail: string;
  resolution: string;
}

interface TestResults {
  stats: Stats;
  timings: any;
  accuracy?: Accuracy;
  analysis?: AnalysisResult;
  failures?: FailureSummary;
  executions: Execution[];
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

function formatPayloadForDisplay(payload: string | null): string {
  if (!payload) return "";
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function methodTone(method: string) {
  switch (method) {
    case "GET":
      return "bg-sky-500/15 text-sky-300 border-sky-500/20";
    case "POST":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
    case "PUT":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    case "PATCH":
      return "bg-violet-500/15 text-violet-300 border-violet-500/20";
    case "DELETE":
      return "bg-rose-500/15 text-rose-300 border-rose-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
  }
}

function statusTone(passed: boolean) {
  return passed
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
    : "bg-rose-500/15 text-rose-300 border-rose-500/20";
}

function notificationTone(kind: NotificationKind) {
  switch (kind) {
    case "success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
    case "warning":
      return "border-amber-500/20 bg-amber-500/10 text-amber-100";
    case "error":
      return "border-rose-500/20 bg-rose-500/10 text-rose-100";
    default:
      return "border-sky-500/20 bg-sky-500/10 text-sky-100";
  }
}

function buildTroubleshootingNotification(
  error: unknown,
  context: string,
): Omit<NotificationItem, "id"> {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (!error.response) {
      return {
        kind: "error",
        title: `${context} could not reach the backend`,
        detail: error.message || "The frontend could not complete the request.",
        resolution:
          "Check that API_SERVER_URL and VITE_API_BASE point to a running backend, then confirm the backend port is open and the service is alive.",
      };
    }

    if (status === 401 || status === 403) {
      return {
        kind: "warning",
        title: `${context} authentication failed`,
        detail:
          error.response.data?.message ||
          "The backend rejected the current credentials or token.",
        resolution:
          "Confirm username, password, bearer token, or API key values. If the flow uses login first, verify the login endpoint and auth variables in the environment file.",
      };
    }

    if (status === 404) {
      return {
        kind: "warning",
        title: `${context} endpoint not found`,
        detail:
          error.response.data?.message ||
          "The backend returned 404 for the request.",
        resolution:
          "Check the base URL, request path, trailing slashes, and the collection endpoint definition. Update the collection or the backend route if the endpoint moved.",
      };
    }

    if (status && status >= 500) {
      return {
        kind: "error",
        title: `${context} backend error`,
        detail:
          error.response.data?.message || `The backend returned ${status}.`,
        resolution:
          "Review backend logs, verify database connectivity, and ensure the environment variables required by the backend are configured correctly.",
      };
    }
  }

  return {
    kind: "error",
    title: `${context} failed`,
    detail:
      error instanceof Error
        ? error.message
        : "An unknown error occurred while running the request.",
    resolution:
      "Check the backend URL, environment configuration, collection filename, and network connectivity before trying again.",
  };
}

function uniqueNumericStatuses(values: unknown[] = []) {
  const out: number[] = [];
  const seen = new Set<number>();

  for (const value of values) {
    const code = Number(value);
    if (!Number.isFinite(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }

  return out;
}

function getLocalExpectedStatuses(item: any) {
  const responses = Array.isArray(item?.responses)
    ? item.responses
    : Array.isArray(item?.response)
      ? item.response
      : [];

  const statusCandidates = responses
    .map((response: any) => response && (response.code ?? response.status))
    .filter((value: unknown) => value !== undefined && value !== null);

  const events = Array.isArray(item?.event) ? item.event : [];
  for (const event of events) {
    const scriptLines = Array.isArray(event?.script?.exec)
      ? event.script.exec
      : [];
    const fullScript = scriptLines.join("\n");

    const oneOfMatches = [
      ...fullScript.matchAll(/oneOf\s*\(\s*\[([^\]]+)\]\s*\)/g),
    ];
    for (const match of oneOfMatches) {
      const nums = `${match[1] || ""}`
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry));
      statusCandidates.push(...nums);
    }

    const equalsMatches = [
      ...fullScript.matchAll(/to\.(?:eql|equal)\s*\(\s*(\d{3})\s*\)/g),
    ];
    for (const match of equalsMatches) {
      statusCandidates.push(Number(match[1]));
    }
  }

  return uniqueNumericStatuses(statusCandidates);
}

function getLocalExpectedBody(item: any) {
  const responses = Array.isArray(item?.responses)
    ? item.responses
    : Array.isArray(item?.response)
      ? item.response
      : [];

  const firstWithBody = responses.find(
    (response: any) =>
      typeof response?.body === "string" && response.body.trim() !== "",
  );
  return firstWithBody ? firstWithBody.body : null;
}

function flattenLocalCollectionItems(node: any, out: any[] = []) {
  if (!node || typeof node !== "object") return out;

  if (Array.isArray(node.item)) {
    for (const child of node.item) {
      flattenLocalCollectionItems(child, out);
    }
    return out;
  }

  if (node.request) {
    const method = `${node.request.method || ""}`.toUpperCase();
    const name = `${node.name || ""}`;
    out.push({
      method,
      name,
      expectedStatuses: getLocalExpectedStatuses(node),
      expectedResponseBody: getLocalExpectedBody(node),
      hasAssertions: Array.isArray(node?.event) && node.event.length > 0,
    });
  }

  return out;
}

function analyzeLocalCollection(
  collectionDoc: any,
  _environmentDoc: any,
  baseUrl: string,
  schemaConfigured: boolean,
): AnalysisResult {
  const items = flattenLocalCollectionItems(collectionDoc, []);
  const issues: AnalysisIssue[] = [];
  let missingExpectedStatuses = 0;
  let missingAssertions = 0;
  const requestsWithSchema = schemaConfigured ? items.length : 0;
  const requestsMissingSchema = schemaConfigured ? 0 : items.length;

  for (const item of items) {
    const expectedStatuses = item.expectedStatuses || [];
    if (expectedStatuses.length === 0) {
      missingExpectedStatuses += 1;
      issues.push({
        kind: "warning",
        title: `Missing expected status for ${item.method} ${item.name}`,
        detail:
          "This request can run, but the dashboard cannot compare it against a declared expected status code.",
        resolution:
          "Add a response example code or a test assertion such as pm.response.to.have.status(200).",
      });
    }

    if (!item.hasAssertions) {
      missingAssertions += 1;
    }
  }

  if (!baseUrl.trim()) {
    issues.push({
      kind: "error",
      title: "Base URL is missing",
      detail: "No backend base URL is set in the setup page.",
      resolution: "Enter the base URL before running the collection.",
    });
  }

  if (missingAssertions > 0) {
    issues.push({
      kind: "info",
      title: "Some requests do not have assertion scripts",
      detail:
        "The collection will still run, but assertion-based checks will be less precise for those steps.",
      resolution:
        "Add test scripts to the collection if you want more reliable validation.",
    });
  }

  if (!schemaConfigured) {
    issues.push({
      kind: "warning",
      title: "No validation schema selected",
      detail:
        "Schema validation is disabled for this run until a schema is selected.",
      resolution:
        "Create or choose a schema before running to validate response structure.",
    });
  }

  return {
    summary: {
      totalRequests: items.length,
      requestsWithExpectedStatuses: items.length - missingExpectedStatuses,
      requestsMissingExpectedStatuses: missingExpectedStatuses,
      requestsWithExamples: 0,
      requestsMissingExamples: 0,
      requestsMissingAssertions: missingAssertions,
      requestsWithSchema,
      requestsMissingSchema,
      requiredEnvironmentVariables: 0,
      missingEnvironmentVariables: 0,
      schemaConfigured,
      resolvedBaseUrl: baseUrl,
    },
    issues,
  };
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  const text = `${value ?? ""}`;
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function FlowGraph({
  executions,
  flowConnections,
  nodePositions,
  selectedIndex,
  onSelect,
  onNodePositionChange,
  linkSourceIndex,
  onStartLink,
  onCompleteLink,
}: {
  executions: Execution[];
  flowConnections: Record<number, number[]>;
  nodePositions: Record<number, { x: number; y: number }>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNodePositionChange: (index: number, pos: { x: number; y: number }) => void;
  linkSourceIndex: number | null;
  onStartLink: (sourceIndex: number) => void;
  onCompleteLink: (targetIndex: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const nodeWidth = 270;
  const nodeHeight = 108;
  const minCanvasWidth = 960;
  const canvasHeight = Math.max(
    360,
    ...Object.values(nodePositions).map((p) => p.y + nodeHeight + 40),
    260,
  );
  const canvasWidth = Math.max(
    minCanvasWidth,
    ...Object.values(nodePositions).map((p) => p.x + nodeWidth + 80),
  );

  const nodePos = executions.map((_, index) => {
    const lane = index % 2;
    const col = Math.floor(index / 2);
    return (
      nodePositions[index] || { x: 30 + col * 320, y: lane === 0 ? 24 : 188 }
    );
  });

  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX =
        event.clientX -
        rect.left +
        container.scrollLeft -
        dragOffsetRef.current.x;
      const nextY =
        event.clientY -
        rect.top +
        container.scrollTop -
        dragOffsetRef.current.y;

      onNodePositionChange(draggingIndex, {
        x: Math.max(10, Math.min(canvasWidth - nodeWidth - 10, nextX)),
        y: Math.max(10, nextY),
      });
    };

    const handleUp = () => {
      setDraggingIndex(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingIndex, onNodePositionChange, canvasWidth]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-auto rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-3"
    >
      <div
        className="relative"
        style={{ width: canvasWidth, minHeight: canvasHeight }}
      >
        <svg
          width={canvasWidth}
          height={canvasHeight}
          className="absolute inset-0"
        >
          {executions.flatMap((_, index) => {
            const fromIndexes = flowConnections[index] || [];
            return fromIndexes
              .filter(
                (fromIndex) => Number.isFinite(fromIndex) && fromIndex >= 0,
              )
              .map((fromIndex) => {
                const from = nodePos[fromIndex];
                const to = nodePos[index];
                if (!from || !to) return null;

                const startX = from.x + nodeWidth;
                const startY = from.y + nodeHeight / 2;
                const endX = to.x;
                const endY = to.y + nodeHeight / 2;
                const midX = (startX + endX) / 2;

                return (
                  <path
                    key={`edge-${fromIndex}-${index}`}
                    d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                    stroke="rgba(56,189,248,0.65)"
                    strokeWidth="2.2"
                    fill="none"
                    strokeDasharray="6 4"
                  />
                );
              })
              .filter(Boolean);
          })}

          {linkSourceIndex !== null && nodePos[linkSourceIndex] && (
            <circle
              cx={nodePos[linkSourceIndex].x + nodeWidth + 4}
              cy={nodePos[linkSourceIndex].y + nodeHeight / 2}
              r="6"
              fill="rgba(125,211,252,0.9)"
            />
          )}
        </svg>

        {executions.map((exec, index) => {
          const pos = nodePos[index];
          const active = selectedIndex === index;
          return (
            <div
              key={`node-${exec.name}-${index}`}
              onClick={() => onSelect(index)}
              className={cn(
                "absolute cursor-pointer rounded-[1.25rem] border p-3 text-left transition",
                active
                  ? "border-sky-400/60 bg-sky-500/15 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]"
                  : "border-white/10 bg-black/40 hover:bg-white/10",
              )}
              style={{
                width: nodeWidth,
                height: nodeHeight,
                left: pos.x,
                top: pos.y,
              }}
            >
              <button
                onMouseDown={(event) => {
                  event.stopPropagation();
                  const rect = (
                    event.currentTarget.parentElement as HTMLDivElement
                  ).getBoundingClientRect();
                  dragOffsetRef.current = {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                  };
                  setDraggingIndex(index);
                }}
                className="absolute -top-2 left-2 rounded-full border border-white/15 bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300"
                title="Drag node"
              >
                Drag
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onCompleteLink(index);
                }}
                className={cn(
                  "absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border transition",
                  linkSourceIndex !== null
                    ? "border-sky-300 bg-sky-400/80"
                    : "border-slate-500 bg-slate-700/80",
                )}
                title="Connect to this node"
              />

              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onStartLink(index);
                }}
                className={cn(
                  "absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border transition",
                  linkSourceIndex === index
                    ? "border-emerald-300 bg-emerald-400/85"
                    : "border-slate-500 bg-slate-700/80",
                )}
                title="Start connection from this node"
              />

              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase",
                    methodTone(exec.method),
                  )}
                >
                  {exec.method}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-black uppercase",
                    statusTone(exec.passed),
                  )}
                >
                  {exec.passed ? "PASS" : "FAIL"}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-bold text-white">
                {exec.name}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                {exec.expectedStatuses.length
                  ? `Expected ${exec.expectedStatuses.join(", ")} | Actual ${exec.status}`
                  : `Actual ${exec.status}`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/5 p-4 sm:p-5 backdrop-blur-xl shadow-[0_16px_60px_rgba(2,6,23,0.35)]">
      <div className="flex items-center gap-4">
        <div className={cn("rounded-2xl p-3 ring-1 ring-inset", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function SetupWizard({
  collections,
  environments,
  selectedCollection,
  selectedEnv,
  baseUrl,
  role,
  username,
  password,
  analysis,
  loading,
  onChooseCollection,
  onSelectEnv,
  onBaseUrlChange,
  onRoleChange,
  onUsernameChange,
  onPasswordChange,
  onImportCollectionFile,
  onImportEnvironmentFile,
  onRunCollection,
  onOpenDashboard,
}: {
  collections: Item[];
  environments: Item[];
  selectedCollection: Item | null;
  selectedEnv: Item | null;
  baseUrl: string;
  role: string;
  username: string;
  password: string;
  analysis: AnalysisResult | null;
  loading: boolean;
  onChooseCollection: (item: Item) => void;
  onSelectEnv: (item: Item | null) => void;
  onBaseUrlChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onImportCollectionFile: (file: File) => Promise<void>;
  onImportEnvironmentFile: (file: File) => Promise<void>;
  onRunCollection: () => Promise<void>;
  onOpenDashboard: () => void;
}) {
  const [collectionDraft, setCollectionDraft] = useState("");
  const [environmentDraft, setEnvironmentDraft] = useState("");

  const importDraft = async (kind: "collection" | "environment") => {
    const draft = kind === "collection" ? collectionDraft : environmentDraft;
    if (!draft.trim()) return;

    const file = new File([draft], `${kind}-draft-${Date.now()}.json`, {
      type: "application/json",
    });

    if (kind === "collection") {
      await onImportCollectionFile(file);
      setCollectionDraft("");
    } else {
      await onImportEnvironmentFile(file);
      setEnvironmentDraft("");
    }
  };

  const steps = [
    {
      title: "1. Load a collection",
      detail:
        "Upload a Postman collection JSON or paste one directly into the editor.",
      icon: FileJson,
    },
    {
      title: "2. Attach an environment",
      detail:
        "Pick an existing environment or import a JSON file with base_url, auth keys, and variables.",
      icon: Database,
    },
    {
      title: "3. Review preflight checks",
      detail:
        "The app validates missing environment variables and status expectations before run.",
      icon: TriangleAlert,
    },
    {
      title: "4. Add schema and run",
      detail:
        "Choose a validation schema, run the collection, then inspect status + schema verdicts.",
      icon: Play,
    },
  ];

  return (
    <section className="space-y-5 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300/80">
            Setup wizard
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">
            Add a collection, configure the environment, then run the tests
          </h3>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            This page gives you one structured place to upload a collection, add
            environment values, verify the preflight warnings, and launch the
            run once the data looks ready.
          </p>
        </div>

        <button
          onClick={onOpenDashboard}
          className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/10"
        >
          <ArrowRight className="h-4 w-4" />
          Go to dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                  <Icon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-black text-white">{step.title}</h4>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {step.detail}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-sky-300" />
            <h4 className="text-sm font-black text-white">
              Import a collection JSON
            </h4>
          </div>
          <label className="block rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-300">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              Upload file
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onImportCollectionFile(file);
                }
                event.currentTarget.value = "";
              }}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-sky-400"
            />
          </label>
          <textarea
            value={collectionDraft}
            onChange={(event) => setCollectionDraft(event.target.value)}
            placeholder='Paste a collection JSON here, then click "Import pasted collection".'
            className="min-h-[180px] w-full rounded-[1.5rem] border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
          />
          <button
            onClick={() => void importDraft("collection")}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-400 disabled:opacity-50"
            disabled={!collectionDraft.trim()}
          >
            Import pasted collection
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Select collection
              </span>
              <div className="relative">
                <select
                  value={selectedCollection?.filename || ""}
                  onChange={(event) => {
                    const item =
                      collections.find(
                        (entry) => entry.filename === event.target.value,
                      ) || null;
                    if (item) onChooseCollection(item);
                  }}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                >
                  <option value="">Choose a collection</option>
                  {collections.map((item) => (
                    <option key={item.filename} value={item.filename}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Select environment
              </span>
              <div className="relative">
                <select
                  value={selectedEnv?.filename || ""}
                  onChange={(event) => {
                    const item =
                      environments.find(
                        (entry) => entry.filename === event.target.value,
                      ) || null;
                    onSelectEnv(item);
                  }}
                  className="w-full appearance-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                >
                  <option value="">Run without a saved environment</option>
                  {environments.map((item) => (
                    <option key={item.filename} value={item.filename}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-violet-300" />
            <h4 className="text-sm font-black text-white">
              Import or edit an environment
            </h4>
          </div>
          <label className="block rounded-[1.5rem] border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-300">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
              Upload environment file
            </span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void onImportEnvironmentFile(file);
                }
                event.currentTarget.value = "";
              }}
              className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-violet-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-violet-400"
            />
          </label>

          <textarea
            value={environmentDraft}
            onChange={(event) => setEnvironmentDraft(event.target.value)}
            placeholder='Paste an environment JSON here, then click "Import pasted environment".'
            className="min-h-[180px] w-full rounded-[1.5rem] border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/15"
          />
          <button
            onClick={() => void importDraft("environment")}
            className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
            disabled={!environmentDraft.trim()}
          >
            Import pasted environment
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Base URL
              </span>
              <input
                value={baseUrl}
                onChange={(event) => onBaseUrlChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                placeholder="http://127.0.0.1:9000"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Role
              </span>
              <input
                value={role}
                onChange={(event) => onRoleChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                placeholder="admin"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Username
              </span>
              <input
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                placeholder="admin"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                placeholder="Test123!"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-300" />
            <h4 className="text-sm font-black text-white">Preflight summary</h4>
          </div>

          {analysis ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Requests"
                value={analysis.summary.totalRequests}
                icon={Activity}
                accent="bg-sky-500/15 text-sky-300 border-sky-500/20"
              />
              <MetricCard
                label="With expected status"
                value={analysis.summary.requestsWithExpectedStatuses}
                icon={CheckCircle2}
                accent="bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
              />
              <MetricCard
                label="Missing env vars"
                value={analysis.summary.missingEnvironmentVariables || 0}
                icon={TriangleAlert}
                accent="bg-amber-500/15 text-amber-300 border-amber-500/20"
              />
              <MetricCard
                label="Missing schema links"
                value={analysis.summary.requestsMissingSchema || 0}
                icon={Workflow}
                accent="bg-violet-500/15 text-violet-300 border-violet-500/20"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Select or import a collection to validate expected statuses,
              required environment variables, and schema readiness before run.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {(analysis?.issues || []).length > 0 ? (
              analysis?.issues.map((issue, index) => (
                <div
                  key={`${issue.title}-${index}`}
                  className={cn(
                    "rounded-2xl border p-4",
                    issue.kind === "error"
                      ? "border-rose-500/20 bg-rose-500/10"
                      : issue.kind === "warning"
                        ? "border-amber-500/20 bg-amber-500/10"
                        : "border-sky-500/20 bg-sky-500/10",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                    <div>
                      <p className="text-sm font-black text-white">
                        {issue.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/90">
                        {issue.detail}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-white/80">
                        <span className="font-black uppercase tracking-[0.22em]">
                          Fix:
                        </span>{" "}
                        {issue.resolution}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                No blocking warnings yet. The collection is ready for
                status-based and schema-based validation.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-4">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-sky-300" />
            <h4 className="text-sm font-black text-white">Run and feedback</h4>
          </div>
          <div className="space-y-3 text-sm leading-7 text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              {selectedCollection ? (
                <>
                  Current collection:{" "}
                  <span className="font-bold text-white">
                    {selectedCollection.name}
                  </span>
                </>
              ) : (
                "Choose or import a collection to continue."
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              {selectedEnv ? (
                <>
                  Current environment:{" "}
                  <span className="font-bold text-white">
                    {selectedEnv.name}
                  </span>
                </>
              ) : (
                "Environment is optional, but a saved environment makes runs repeatable."
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Base URL in use:{" "}
              <span className="font-bold text-white">
                {baseUrl || "not set"}
              </span>
            </div>
          </div>
          <button
            onClick={() => void onRunCollection()}
            disabled={loading || !selectedCollection}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-4 text-sm font-bold text-white shadow-[0_14px_40px_rgba(59,130,246,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {loading ? "Running" : "Run collection now"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { isLoaded, user } = useUser();
  const [collections, setCollections] = useState<Item[]>([]);
  const [environments, setEnvironments] = useState<Item[]>([]);
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>("");
  const [schemaNameDraft, setSchemaNameDraft] = useState(
    "Default response schema",
  );
  const [schemaContentDraft, setSchemaContentDraft] = useState(
    '{\n  "default": {\n    "type": "object"\n  },\n  "requests": {}\n}',
  );
  const [selectedCollection, setSelectedCollection] = useState<Item | null>(
    null,
  );
  const [selectedEnv, setSelectedEnv] = useState<Item | null>(null);
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [activePage, setActivePage] = useState<"setup" | "dashboard">("setup");
  const [flowViewMode, setFlowViewMode] = useState<"graph" | "list">("graph");
  const [flowNodePositions, setFlowNodePositions] = useState<
    Record<number, { x: number; y: number }>
  >({});
  const [linkSourceIndex, setLinkSourceIndex] = useState<number | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:9000");
  const [credentialProfiles, setCredentialProfiles] = useState<
    CredentialProfile[]
  >([
    {
      id: "cred-admin",
      name: "Admin",
      role: "admin",
      username: "admin",
      password: "Test123!",
    },
  ]);
  const [selectedCredentialProfileId, setSelectedCredentialProfileId] =
    useState("cred-admin");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [flowConnections, setFlowConnections] = useState<
    Record<number, number[]>
  >({});
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [collectionContentByFilename, setCollectionContentByFilename] =
    useState<Record<string, string>>({});
  const [environmentContentByFilename, setEnvironmentContentByFilename] =
    useState<Record<string, string>>({});

  const selectedCredentialProfile =
    credentialProfiles.find(
      (profile) => profile.id === selectedCredentialProfileId,
    ) || credentialProfiles[0];

  const authHeaders = {
    "x-user-id": user?.id || "local-guest",
    "x-user-email": user?.primaryEmailAddress?.emailAddress || "",
    "x-user-name": user?.fullName || user?.username || "",
  };

  const isMobile = windowWidth < 1024;
  const isSidebarOpen = isMobile ? mobileMenuOpen : desktopSidebarOpen;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileMenuOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchData = async () => {
      try {
        const [collRes, envRes, profileRes, schemaRes] = await Promise.all([
          axios.get(`${API_BASE}/collections`, { headers: authHeaders }),
          axios.get(`${API_BASE}/environments`, { headers: authHeaders }),
          axios.get(`${API_BASE}/credential-profiles`, {
            headers: authHeaders,
          }),
          axios.get(`${API_BASE}/schemas`, { headers: authHeaders }),
        ]);
        setCollections(collRes.data);
        setEnvironments(envRes.data);
        if (envRes.data.length > 0) setSelectedEnv(envRes.data[0]);

        const nextProfiles = Array.isArray(profileRes.data)
          ? profileRes.data
          : [];
        if (nextProfiles.length > 0) {
          setCredentialProfiles(nextProfiles);
          setSelectedCredentialProfileId(nextProfiles[0].id);
        }

        const nextSchemas = Array.isArray(schemaRes.data) ? schemaRes.data : [];
        setSchemas(nextSchemas);
        if (!selectedSchemaId && nextSchemas.length > 0) {
          setSelectedSchemaId(nextSchemas[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };

    fetchData();
  }, [isLoaded, user]);

  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0]);
    }
  }, [collections, selectedCollection]);

  useEffect(() => {
    if (!selectedCollection) {
      setAnalysis(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const collectionSource =
          collectionContentByFilename[selectedCollection.filename];
        if (collectionSource) {
          const environmentSource = selectedEnv
            ? environmentContentByFilename[selectedEnv.filename]
            : null;
          const collectionDoc = JSON.parse(collectionSource);
          const environmentDoc = environmentSource
            ? JSON.parse(environmentSource)
            : null;
          setAnalysis(
            analyzeLocalCollection(
              collectionDoc,
              environmentDoc,
              baseUrl.trim(),
              Boolean(selectedSchemaId),
            ),
          );
        } else {
          const response = await axios.get(`${API_BASE}/analyze`, {
            params: {
              filename: selectedCollection.filename,
              environmentFilename: selectedEnv?.filename,
              schemaId: selectedSchemaId || undefined,
              variableOverrides: {
                base_url: baseUrl.trim(),
                role: selectedCredentialProfile?.role || "",
                username: selectedCredentialProfile?.username?.trim() || "",
                password: selectedCredentialProfile?.password || "",
              },
            },
            headers: authHeaders,
            signal: controller.signal,
          });
          setAnalysis(response.data);
        }
      } catch (error) {
        if (
          !axios.isCancel(error) &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          console.error("Failed to analyze collection", error);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    selectedCollection,
    selectedEnv,
    baseUrl,
    selectedSchemaId,
    user,
    selectedCredentialProfile,
    collectionContentByFilename,
    environmentContentByFilename,
  ]);

  useEffect(() => {
    if (!results?.executions?.length) {
      setFlowConnections({});
      setFlowNodePositions({});
      setLinkSourceIndex(null);
      return;
    }

    setFlowConnections((current) => {
      const next: Record<number, number[]> = {};
      results.executions.forEach((_, index) => {
        next[index] = current[index] ?? (index === 0 ? [] : [index - 1]);
      });
      return next;
    });

    setFlowNodePositions((current) => {
      const stepX = 320;
      const laneY = [24, 188];
      const next: Record<number, { x: number; y: number }> = {};
      results.executions.forEach((_, index) => {
        const lane = index % 2;
        const col = Math.floor(index / 2);
        next[index] = current[index] || {
          x: 30 + col * stepX,
          y: laneY[lane],
        };
      });
      return next;
    });
  }, [results]);

  const syncCredentialProfile = async (profile: CredentialProfile) => {
    try {
      const response = await axios.post(
        `${API_BASE}/credential-profiles`,
        { profile },
        { headers: authHeaders },
      );
      if (
        Array.isArray(response.data?.items) &&
        response.data.items.length > 0
      ) {
        setCredentialProfiles(response.data.items);
      }
    } catch (error) {
      console.error("Failed to sync credential profile", error);
    }
  };

  const addCredentialProfile = async () => {
    const id = `cred-${Date.now()}`;
    const newProfile: CredentialProfile = {
      id,
      name: `Profile ${credentialProfiles.length + 1}`,
      role: "user",
      username: "",
      password: "",
    };
    setCredentialProfiles((current) => [...current, newProfile]);
    setSelectedCredentialProfileId(id);
    await syncCredentialProfile(newProfile);
  };

  const removeCredentialProfile = async (id: string) => {
    if (credentialProfiles.length <= 1) {
      pushNotification({
        kind: "warning",
        title: "At least one profile is required",
        detail: "The tester needs one active credential profile.",
        resolution: "Add another profile first, then remove this one.",
      });
      return;
    }
    setCredentialProfiles((current) =>
      current.filter((profile) => profile.id !== id),
    );
    if (selectedCredentialProfileId === id) {
      const fallback = credentialProfiles.find((profile) => profile.id !== id);
      if (fallback) setSelectedCredentialProfileId(fallback.id);
    }

    try {
      const response = await axios.delete(
        `${API_BASE}/credential-profiles/${encodeURIComponent(id)}`,
        { headers: authHeaders },
      );
      if (Array.isArray(response.data?.items)) {
        setCredentialProfiles(response.data.items);
      }
    } catch (error) {
      console.error("Failed to remove credential profile", error);
    }
  };

  const updateSelectedCredentialProfile = (
    field: keyof Omit<CredentialProfile, "id">,
    value: string,
  ) => {
    let updatedProfile: CredentialProfile | null = null;
    setCredentialProfiles((current) =>
      current.map((profile) => {
        if (profile.id !== selectedCredentialProfileId) return profile;
        updatedProfile = { ...profile, [field]: value };
        return updatedProfile;
      }),
    );

    if (updatedProfile) {
      void syncCredentialProfile(updatedProfile);
    }
  };

  const pushNotification = (item: Omit<NotificationItem, "id">) => {
    setNotifications((current) =>
      [
        { id: Date.now() + Math.floor(Math.random() * 1000), ...item },
        ...current,
      ].slice(0, 4),
    );
  };

  const dismissNotification = (id: number) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  };

  const saveSchemaDraft = async () => {
    try {
      const parsedSchema = JSON.parse(schemaContentDraft);
      const response = await axios.post(
        `${API_BASE}/schemas`,
        {
          name: schemaNameDraft.trim() || `Schema ${new Date().toISOString()}`,
          schema: parsedSchema,
        },
        { headers: authHeaders },
      );

      const items = Array.isArray(response.data?.items)
        ? response.data.items
        : [];
      setSchemas(items);
      if (response.data?.saved?.id) {
        setSelectedSchemaId(response.data.saved.id);
      }

      pushNotification({
        kind: "success",
        title: "Validation schema saved",
        detail:
          "Schema rules are now linked to your account and can be reused on future runs.",
        resolution:
          "Select this schema in setup or sidebar, then run to validate status and response structure.",
      });
    } catch (error) {
      pushNotification(buildTroubleshootingNotification(error, "Schema save"));
    }
  };

  const refreshAnalysis = async (
    collectionItem?: Item | null,
    envItem?: Item | null,
  ) => {
    const collection = collectionItem ?? selectedCollection;
    if (!collection) return null;

    try {
      const collectionSource = collectionContentByFilename[collection.filename];
      const environment = envItem ?? selectedEnv;

      if (collectionSource) {
        const environmentSource = environment
          ? environmentContentByFilename[environment.filename]
          : null;
        const collectionDoc = JSON.parse(collectionSource);
        const environmentDoc = environmentSource
          ? JSON.parse(environmentSource)
          : null;
        const localAnalysis = analyzeLocalCollection(
          collectionDoc,
          environmentDoc,
          baseUrl.trim(),
          Boolean(selectedSchemaId),
        );
        setAnalysis(localAnalysis);
        return localAnalysis;
      }

      const response = await axios.get(`${API_BASE}/analyze`, {
        params: {
          filename: collection.filename,
          environmentFilename: environment?.filename,
          schemaId: selectedSchemaId || undefined,
          variableOverrides: {
            base_url: baseUrl.trim(),
            role: selectedCredentialProfile?.role || "",
            username: selectedCredentialProfile?.username?.trim() || "",
            password: selectedCredentialProfile?.password || "",
          },
        },
        headers: authHeaders,
      });
      setAnalysis(response.data);
      return response.data as AnalysisResult;
    } catch (error) {
      console.error("Failed to fetch analysis", error);
      return null;
    }
  };

  const isCollectionRemovable = (filename: string) =>
    filename.startsWith("collections/") ||
    filename.startsWith("imported-collections/") ||
    filename.startsWith("db-collections/");

  const removeCollection = async (item: Item) => {
    if (!isCollectionRemovable(item.filename)) {
      pushNotification({
        kind: "info",
        title: "Collection is protected",
        detail: `${item.name} belongs to a protected source and cannot be deleted from this dashboard.`,
        resolution:
          "Duplicate the collection into collections/ or import your own version if you want it removable.",
      });
      return;
    }

    const isLocalOnly = Boolean(collectionContentByFilename[item.filename]);

    try {
      if (!isLocalOnly) {
        const response = await axios.delete(`${API_BASE}/collections`, {
          data: { filename: item.filename },
          headers: authHeaders,
        });
        setCollections(response.data.items || []);
      } else {
        setCollections((current) =>
          current.filter((entry) => entry.filename !== item.filename),
        );
      }

      setCollectionContentByFilename((current) => {
        const next = { ...current };
        delete next[item.filename];
        return next;
      });

      if (selectedCollection?.filename === item.filename) {
        setSelectedCollection(null);
        setResults(null);
        setExpandedId(null);
      }

      pushNotification({
        kind: "success",
        title: "Collection removed",
        detail: `${item.name} was removed from the tester list.`,
        resolution:
          "Import or add the collection again any time from the setup wizard.",
      });
    } catch (error) {
      pushNotification(
        buildTroubleshootingNotification(error, "Collection removal"),
      );
    }
  };

  const exportRows = (data: TestResults) =>
    data.executions.map((exec) => ({
      name: exec.name,
      method: exec.method,
      url: exec.url,
      expected: exec.expectedStatuses.length
        ? exec.expectedStatuses.join("|")
        : "",
      actual: exec.status,
      verdict: exec.passed ? "PASS" : "FAIL",
      responseTimeMs: exec.responseTime,
    }));

  const exportResultsAsJson = () => {
    if (!results) return;
    downloadTextFile(
      JSON.stringify(results, null, 2),
      `api-tester-report-${Date.now()}.json`,
      "application/json",
    );
  };

  const exportResultsAsCsv = () => {
    if (!results) return;
    const rows = exportRows(results);
    const headers = [
      "name",
      "method",
      "url",
      "expected",
      "actual",
      "verdict",
      "responseTimeMs",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) => csvEscape((row as Record<string, unknown>)[key]))
          .join(","),
      ),
    ].join("\n");

    downloadTextFile(
      csv,
      `api-tester-report-${Date.now()}.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const exportResultsAsExcel = () => {
    if (!results) return;
    const rows = exportRows(results);
    const tableRows = rows
      .map(
        (row) =>
          `<tr><td>${row.name}</td><td>${row.method}</td><td>${row.url}</td><td>${row.expected}</td><td>${row.actual}</td><td>${row.verdict}</td><td>${row.responseTimeMs}</td></tr>`,
      )
      .join("");

    const html = `\n      <html><head><meta charset="utf-8" /></head><body>\n      <table border="1"><tr><th>Name</th><th>Method</th><th>URL</th><th>Expected</th><th>Actual</th><th>Verdict</th><th>Response Time (ms)</th></tr>${tableRows}</table>\n      </body></html>\n    `;
    downloadTextFile(
      html,
      `api-tester-report-${Date.now()}.xls`,
      "application/vnd.ms-excel",
    );
  };

  const exportResultsAsPdf = () => {
    if (!results) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let cursorY = 40;

    doc.setFontSize(16);
    doc.text("API Tester Report", 40, cursorY);
    cursorY += 20;

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toISOString()}`, 40, cursorY);
    cursorY += 24;

    for (const row of exportRows(results)) {
      const line = `${row.verdict} | ${row.method} | ${row.name} | expected ${row.expected || "none"} | actual ${row.actual}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - 80);
      if (cursorY > 770) {
        doc.addPage();
        cursorY = 40;
      }
      doc.text(wrapped, 40, cursorY);
      cursorY += wrapped.length * 12 + 6;
    }

    doc.save(`api-tester-report-${Date.now()}.pdf`);
  };

  const importJsonFile = async (
    kind: "collection" | "environment",
    file: File,
  ) => {
    const content = await file.text();
    JSON.parse(content);

    try {
      const response = await axios.post(
        `${API_BASE}/import`,
        {
          kind,
          filename: file.name,
          content,
        },
        {
          headers: authHeaders,
        },
      );

      const importedFilename = response.data?.imported?.filename;
      const importedName = response.data?.imported?.name;

      if (kind === "collection") {
        const nextCollections = response.data?.items || [];
        setCollections(nextCollections);
        const importedItem =
          nextCollections.find(
            (entry: Item) => entry.filename === importedFilename,
          ) ||
          (importedFilename
            ? {
                filename: importedFilename,
                name: importedName || file.name.replace(/\.json$/i, ""),
              }
            : null);
        if (importedItem) {
          setSelectedCollection(importedItem);
          setActivePage("dashboard");
          await refreshAnalysis(importedItem, selectedEnv);
        }
      } else {
        const nextEnvironments = response.data?.items || [];
        setEnvironments(nextEnvironments);
        const importedItem =
          nextEnvironments.find(
            (entry: Item) => entry.filename === importedFilename,
          ) ||
          (importedFilename
            ? {
                filename: importedFilename,
                name: importedName || file.name.replace(/\.json$/i, ""),
              }
            : null);
        if (importedItem) {
          setSelectedEnv(importedItem);
          await refreshAnalysis(selectedCollection, importedItem);
        }
      }

      pushNotification({
        kind: "success",
        title: `${kind === "collection" ? "Collection" : "Environment"} imported`,
        detail: `${file.name} was imported through backend endpoints and added to the library.`,
        resolution:
          "Select it from the wizard or sidebar, then run the collection when ready.",
      });
      return;
    } catch (backendError) {
      const parsed = JSON.parse(content);
      const localFilename =
        `${kind === "collection" ? "local-collection" : "local-environment"}-${Date.now()}-${file.name}`.replace(
          /[^a-zA-Z0-9._/-]+/g,
          "-",
        );
      const importedItem = {
        name: file.name.replace(/\.json$/i, ""),
        filename: `${kind === "collection" ? "collections" : "environments"}/${localFilename.endsWith(".json") ? localFilename : `${localFilename}.json`}`,
      };

      if (kind === "collection") {
        setCollections((current) => {
          const filtered = current.filter(
            (entry) => entry.filename !== importedItem.filename,
          );
          return [...filtered, importedItem];
        });
        setCollectionContentByFilename((current) => ({
          ...current,
          [importedItem.filename]: JSON.stringify(parsed, null, 2),
        }));
        setSelectedCollection(importedItem);
        setActivePage("dashboard");
        await refreshAnalysis(importedItem, selectedEnv);
      } else {
        setEnvironments((current) => {
          const filtered = current.filter(
            (entry) => entry.filename !== importedItem.filename,
          );
          return [...filtered, importedItem];
        });
        setEnvironmentContentByFilename((current) => ({
          ...current,
          [importedItem.filename]: JSON.stringify(parsed, null, 2),
        }));
        setSelectedEnv(importedItem);
        await refreshAnalysis(selectedCollection, importedItem);
      }

      pushNotification({
        kind: "warning",
        title: "Imported with local fallback",
        detail: `${file.name} was loaded locally because backend import was unavailable.`,
        resolution:
          "Start the backend import endpoint if you want persistent storage across sessions.",
      });
      console.error(
        "Backend import failed; local fallback used.",
        backendError,
      );
    }
  };

  const runTest = async () => {
    if (!selectedCollection) return;

    if (!selectedSchemaId) {
      pushNotification({
        kind: "warning",
        title: "Validation schema is required",
        detail: "Pick or create a schema before running this collection.",
        resolution:
          "Use the setup schema panel to save a schema, then select it and rerun.",
      });
      return;
    }

    if (!baseUrl.trim()) {
      pushNotification({
        kind: "warning",
        title: "Base URL is missing",
        detail:
          "The tester needs a backend base URL before it can run collections.",
        resolution:
          "Set the backend URL in the sidebar, for example http://127.0.0.1:9000 or your live API host, then rerun the collection.",
      });
      return;
    }

    setLoading(true);
    setResults(null);
    setExpandedId(null);
    setActivePage("dashboard");

    const currentAnalysis = await refreshAnalysis();
    if (currentAnalysis?.issues?.length) {
      currentAnalysis.issues.forEach((issue) => {
        pushNotification(issue);
      });
    }

    try {
      const collectionSource =
        collectionContentByFilename[selectedCollection.filename];
      const environmentSource = selectedEnv
        ? environmentContentByFilename[selectedEnv.filename]
        : null;

      const response = await axios.post(
        `${API_BASE}/run-test`,
        {
          filename: selectedCollection.filename,
          environmentFilename: selectedEnv?.filename,
          schemaId: selectedSchemaId || undefined,
          variableOverrides: {
            base_url: baseUrl.trim(),
            role: selectedCredentialProfile?.role || "",
            username: selectedCredentialProfile?.username?.trim() || "",
            password: selectedCredentialProfile?.password || "",
          },
          collectionContent: collectionSource,
          environmentContent: environmentSource,
        },
        {
          headers: authHeaders,
        },
      );
      setResults(response.data);
    } catch (error) {
      pushNotification(
        buildTroubleshootingNotification(error, "Collection run"),
      );
      console.error("Test run failed", error);
    } finally {
      setLoading(false);
    }
  };

  const selectCollection = (item: Item) => {
    setSelectedCollection(item);
    setResults(null);
    setExpandedId(null);
    setActivePage("dashboard");
    if (isMobile) setMobileMenuOpen(false);
  };

  const resetHome = () => {
    setSelectedCollection(null);
    setResults(null);
    setExpandedId(null);
    setActivePage("setup");
    if (isMobile) setMobileMenuOpen(false);
  };

  const headerStats = results
    ? [
        {
          label: "Requests",
          value: results.stats.requests.total,
          icon: Activity,
          accent: "bg-sky-500/15 text-sky-300 border-sky-500/20",
        },
        {
          label: "Match",
          value: results.accuracy?.passedExecutions ?? 0,
          icon: CheckCircle2,
          accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
        },
        {
          label: "Mismatch",
          value: results.accuracy?.failedExecutions ?? 0,
          icon: XCircle,
          accent: "bg-rose-500/15 text-rose-300 border-rose-500/20",
        },
      ]
    : [];

  const selectedFlowNodeIndex =
    results && results.executions.length > 0
      ? expandedId !== null
        ? expandedId
        : 0
      : null;

  const selectedFlowNode =
    selectedFlowNodeIndex !== null && results
      ? results.executions[selectedFlowNodeIndex]
      : null;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthLanding />;
  }

  if (activePage === "setup") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(180deg,#0f172a_0%,#08101f_100%)] text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col lg:flex-row">
          {isMobile && isSidebarOpen && (
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden"
            />
          )}

          {isSidebarOpen && (
            <aside className="fixed inset-y-0 left-0 z-50 w-[88%] max-w-sm border-r border-white/10 bg-slate-950/90 px-4 py-4 shadow-[20px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl lg:static lg:flex lg:w-[360px] lg:flex-col lg:px-5 lg:py-5">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300/80">
                      API Tester
                    </p>
                    <h1 className="text-lg font-black text-white">Setup</h1>
                    <p className="text-xs text-slate-400">
                      Import, configure, and run
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      isMobile
                        ? setMobileMenuOpen(false)
                        : setDesktopSidebarOpen(false)
                    }
                    className="ml-auto rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                    aria-label="Close sidebar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setActivePage("setup")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-left text-sm font-semibold text-sky-200"
                  >
                    <FileJson className="h-4 w-4" />
                    Setup wizard
                  </button>
                  <button
                    onClick={() => setActivePage("dashboard")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    <Home className="h-4 w-4" />
                    Dashboard
                  </button>
                </div>
              </div>
            </aside>
          )}

          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    isMobile
                      ? setMobileMenuOpen(true)
                      : setDesktopSidebarOpen(true)
                  }
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200 transition hover:bg-white/10"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Setup menu
                </p>
                <Show when="signed-in">
                  <div className="ml-auto rounded-2xl border border-white/10 bg-white/5 p-1">
                    <UserButton />
                  </div>
                </Show>
              </div>

              <SetupWizard
                collections={collections}
                environments={environments}
                selectedCollection={selectedCollection}
                selectedEnv={selectedEnv}
                baseUrl={baseUrl}
                role={selectedCredentialProfile?.role || ""}
                username={selectedCredentialProfile?.username || ""}
                password={selectedCredentialProfile?.password || ""}
                analysis={analysis}
                loading={loading}
                onChooseCollection={(item) => {
                  setSelectedCollection(item);
                  setResults(null);
                  setExpandedId(null);
                  void refreshAnalysis(item, selectedEnv);
                }}
                onSelectEnv={(item) => {
                  setSelectedEnv(item);
                  void refreshAnalysis(selectedCollection, item);
                }}
                onBaseUrlChange={setBaseUrl}
                onRoleChange={(value) =>
                  updateSelectedCredentialProfile("role", value)
                }
                onUsernameChange={(value) =>
                  updateSelectedCredentialProfile("username", value)
                }
                onPasswordChange={(value) =>
                  updateSelectedCredentialProfile("password", value)
                }
                onImportCollectionFile={(file) =>
                  importJsonFile("collection", file)
                }
                onImportEnvironmentFile={(file) =>
                  importJsonFile("environment", file)
                }
                onRunCollection={runTest}
                onOpenDashboard={() => setActivePage("dashboard")}
              />

              <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-300" />
                  <h3 className="text-base font-black text-white">
                    Validation schema
                  </h3>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Step 3 in your flow: attach a JSON schema so response
                  structure is validated in addition to status checks.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                      Select saved schema
                    </label>
                    <div className="relative">
                      <select
                        value={selectedSchemaId}
                        onChange={(e) => setSelectedSchemaId(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/15"
                      >
                        <option value="">No schema selected</option>
                        {schemas.map((schema) => (
                          <option key={schema.id} value={schema.id}>
                            {schema.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                      Schema name
                    </label>
                    <input
                      value={schemaNameDraft}
                      onChange={(e) => setSchemaNameDraft(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/15"
                      placeholder="Default response schema"
                    />
                  </div>
                </div>

                <textarea
                  value={schemaContentDraft}
                  onChange={(e) => setSchemaContentDraft(e.target.value)}
                  className="mt-4 min-h-[220px] w-full rounded-[1.5rem] border border-white/10 bg-black/30 p-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/15"
                  placeholder='{"default":{"type":"object"},"requests":{"GET::Health":{"type":"object"}}}'
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => void saveSchemaDraft()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-400"
                  >
                    <Upload className="h-4 w-4" />
                    Save schema
                  </button>
                  <button
                    onClick={() => setActivePage("dashboard")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Continue to run
                  </button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),linear-gradient(180deg,#0f172a_0%,#08101f_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col lg:flex-row">
        <AnimatePresence>
          {isMobile && isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm lg:hidden"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={isMobile ? { x: -320 } : { opacity: 1, x: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={isMobile ? { x: -320 } : { opacity: 1 }}
              transition={{ type: "spring", damping: 26, stiffness: 230 }}
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-[88%] max-w-sm border-r border-white/10 bg-slate-950/90 px-4 py-4 shadow-[20px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl lg:static lg:z-auto lg:flex lg:w-[360px] lg:flex-col lg:px-5 lg:py-5",
                isMobile ? "overflow-y-auto" : "overflow-y-auto",
              )}
            >
              <div className="mb-4 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-3 lg:hidden">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-500/15 p-2 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold tracking-tight text-white">
                      API Tester
                    </p>
                    <p className="text-[11px] text-slate-400">Mobile menu</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="hidden items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/5 p-4 lg:flex">
                <button
                  onClick={resetHome}
                  className="flex items-center gap-3 text-left"
                >
                  <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-sky-300/80">
                      API
                    </p>
                    <h1 className="text-lg font-black text-white">
                      API Tester
                    </h1>
                  </div>
                </button>
                <button
                  onClick={() => setDesktopSidebarOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4 lg:mt-5">
                <button
                  onClick={() => setActivePage("setup")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-slate-300 transition hover:bg-white/8"
                >
                  <FileJson className="h-4 w-4" />
                  <span className="text-sm font-semibold">Setup wizard</span>
                </button>

                <button
                  onClick={resetHome}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
                    !selectedCollection
                      ? "border-sky-500/25 bg-sky-500/10 text-sky-200"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8",
                  )}
                >
                  <Home className="h-4 w-4" />
                  <span className="text-sm font-semibold">Home dashboard</span>
                </button>

                <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                    <Database className="h-3.5 w-3.5" />
                    Collections
                  </div>
                  <div className="space-y-2">
                    {collections.map((coll) => (
                      <div
                        key={coll.filename}
                        className={cn(
                          "flex items-center gap-2 rounded-2xl border px-2 py-2 transition",
                          selectedCollection?.filename === coll.filename
                            ? "border-sky-500/25 bg-sky-500/10"
                            : "border-white/10 bg-slate-950/20",
                        )}
                      >
                        <button
                          onClick={() => selectCollection(coll)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-2 py-2 text-left text-slate-200"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {coll.name}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        </button>
                        {isCollectionRemovable(coll.filename) && (
                          <button
                            onClick={() => void removeCollection(coll)}
                            className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2 text-rose-200 transition hover:bg-rose-500/20"
                            title="Remove collection"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {collections.length === 0 && (
                      <p className="px-2 py-2 text-xs italic text-slate-500">
                        No collections found.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                    <Settings className="h-3.5 w-3.5" />
                    Active config
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Environment
                      </label>
                      <div className="relative">
                        <select
                          value={selectedEnv?.filename || ""}
                          onChange={(e) =>
                            setSelectedEnv(
                              environments.find(
                                (env) => env.filename === e.target.value,
                              ) || null,
                            )
                          }
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                        >
                          {environments.map((env) => (
                            <option key={env.filename} value={env.filename}>
                              {env.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Base URL
                      </label>
                      <input
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                        placeholder="http://127.0.0.1:9000"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Validation schema
                      </label>
                      <div className="relative">
                        <select
                          value={selectedSchemaId}
                          onChange={(e) => setSelectedSchemaId(e.target.value)}
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/15"
                        >
                          <option value="">No schema selected</option>
                          {schemas.map((schema) => (
                            <option key={schema.id} value={schema.id}>
                              {schema.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Credential profile
                      </label>
                      <div className="relative">
                        <select
                          value={selectedCredentialProfileId}
                          onChange={(e) =>
                            setSelectedCredentialProfileId(e.target.value)
                          }
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 pr-10 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                        >
                          {credentialProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name} ({profile.role || "role"})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={addCredentialProfile}
                          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          Add profile
                        </button>
                        <button
                          onClick={() =>
                            removeCredentialProfile(selectedCredentialProfileId)
                          }
                          className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Remove profile
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                          Profile label
                        </label>
                        <input
                          value={selectedCredentialProfile?.name || ""}
                          onChange={(e) =>
                            updateSelectedCredentialProfile(
                              "name",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                          placeholder="Admin"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                          Role
                        </label>
                        <input
                          value={selectedCredentialProfile?.role || ""}
                          onChange={(e) =>
                            updateSelectedCredentialProfile(
                              "role",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                          placeholder="admin"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                          Username
                        </label>
                        <input
                          value={selectedCredentialProfile?.username || ""}
                          onChange={(e) =>
                            updateSelectedCredentialProfile(
                              "username",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                          placeholder="admin"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                          Password
                        </label>
                        <input
                          type="password"
                          value={selectedCredentialProfile?.password || ""}
                          onChange={(e) =>
                            updateSelectedCredentialProfile(
                              "password",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                          placeholder="Test123!"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-4 lg:px-6 lg:py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-5">
            <header className="sticky top-0 z-20 rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl lg:relative lg:top-auto">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200 transition hover:bg-white/10 lg:hidden"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  <button
                    onClick={() => setDesktopSidebarOpen((current) => !current)}
                    className="hidden items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-200 transition hover:bg-white/10 lg:inline-flex"
                    aria-label="Toggle sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>

                  <div className="hidden rounded-3xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-300 lg:flex">
                    <ShieldCheck className="h-7 w-7" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-sky-300/80">
                      API Tester
                    </p>
                    <h2 className="mt-1 truncate text-2xl font-black text-white lg:text-3xl">
                      {selectedCollection
                        ? selectedCollection.name
                        : "Select a collection to inspect flows"}
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
                      A responsive flow explorer that shows expected status,
                      actual response, and endpoint verdicts clearly for both
                      users and developers.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
                  <Show when="signed-in">
                    <div className="self-start rounded-2xl border border-white/10 bg-white/5 p-1">
                      <UserButton />
                    </div>
                  </Show>
                  {selectedEnv && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                        Environment
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {selectedEnv.name}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={runTest}
                    disabled={loading || !selectedCollection}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-4 text-sm font-bold text-white shadow-[0_14px_40px_rgba(59,130,246,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {loading ? "Running" : "Run collection"}
                  </button>
                </div>
              </div>

              {!selectedCollection && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    label="Collections loaded"
                    value={collections.length}
                    icon={Database}
                    accent="bg-slate-500/15 text-slate-200 border-slate-500/20"
                  />
                  <MetricCard
                    label="Environments loaded"
                    value={environments.length}
                    icon={Layers}
                    accent="bg-violet-500/15 text-violet-200 border-violet-500/20"
                  />
                  <MetricCard
                    label="Ready to run"
                    value={selectedEnv ? 1 : 0}
                    icon={CheckCircle2}
                    accent="bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
                  />
                </div>
              )}
            </header>

            {selectedCollection && results && (
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {headerStats.map((item) => (
                  <MetricCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    icon={item.icon}
                    accent={item.accent}
                  />
                ))}
                <MetricCard
                  label="Steps in trail"
                  value={results.executions.length}
                  icon={Layers}
                  accent="bg-amber-500/15 text-amber-200 border-amber-500/20"
                />
              </section>
            )}

            {selectedCollection &&
              results?.failures &&
              results.failures.total > 0 && (
                <section className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-amber-200" />
                    <h4 className="text-sm font-black text-amber-100">
                      Run diagnostics ({results.failures.total} postman/newman
                      failure{results.failures.total > 1 ? "s" : ""})
                    </h4>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {results.failures.items.map((failure, index) => (
                      <div
                        key={`${failure.source}-${index}`}
                        className="rounded-2xl border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-200"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">
                          {failure.type}
                        </p>
                        <p className="mt-1 font-bold text-white">
                          {failure.source}
                        </p>
                        {failure.parent && (
                          <p className="text-xs text-slate-400">
                            Step: {failure.parent}
                          </p>
                        )}
                        <p className="mt-2 text-xs leading-6 text-slate-300">
                          {failure.error}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            {notifications.length > 0 && (
              <section className="space-y-3">
                {notifications.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-[1.5rem] border p-4 shadow-[0_16px_50px_rgba(2,6,23,0.3)] backdrop-blur-xl",
                      notificationTone(item.kind),
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-sm font-black">{item.title}</h4>
                          <button
                            onClick={() => dismissNotification(item.id)}
                            className="self-start rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/80 transition hover:bg-white/15"
                          >
                            Dismiss
                          </button>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/90">
                          {item.detail}
                        </p>
                        <p className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3 text-xs leading-6 text-white/90">
                          <span className="font-black uppercase tracking-[0.24em] text-white/70">
                            Resolution:
                          </span>{" "}
                          {item.resolution}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </section>
            )}

            {selectedCollection && results && (
              <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                        Flow map
                      </p>
                      <h3 className="mt-1 text-lg font-black text-white">
                        Editable node connections for this collection
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Adjust how requests connect to each other if the
                        collection order or dependencies are wrong.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setFlowViewMode("graph")}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] transition",
                          flowViewMode === "graph"
                            ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-slate-950/30 text-slate-200 hover:bg-white/10",
                        )}
                      >
                        <Grid3X3 className="h-3.5 w-3.5" /> Graph
                      </button>
                      <button
                        onClick={() => setFlowViewMode("list")}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.2em] transition",
                          flowViewMode === "list"
                            ? "border-sky-400/40 bg-sky-500/20 text-sky-200"
                            : "border-white/10 bg-slate-950/30 text-slate-200 hover:bg-white/10",
                        )}
                      >
                        <List className="h-3.5 w-3.5" /> List
                      </button>
                      <button
                        onClick={() => {
                          const next: Record<number, number[]> = {};
                          results.executions.forEach((_, index) => {
                            next[index] = index === 0 ? [] : [index - 1];
                          });
                          setFlowConnections(next);
                        }}
                        className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/10"
                      >
                        Auto-link sequence
                      </button>
                    </div>
                  </div>

                  {flowViewMode === "graph" && (
                    <div className="mt-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs leading-6 text-sky-100">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Link2 className="h-3.5 w-3.5" />
                        Drag nodes to reposition. Use the right edge handle to
                        start a curved connection and the left edge handle on
                        another node to complete it.
                      </span>
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_0.9fr]">
                    <div>
                      {flowViewMode === "graph" ? (
                        <FlowGraph
                          executions={results.executions}
                          flowConnections={flowConnections}
                          nodePositions={flowNodePositions}
                          selectedIndex={selectedFlowNodeIndex}
                          onSelect={(index) => setExpandedId(index)}
                          onNodePositionChange={(index, pos) =>
                            setFlowNodePositions((current) => ({
                              ...current,
                              [index]: pos,
                            }))
                          }
                          linkSourceIndex={linkSourceIndex}
                          onStartLink={(sourceIndex) =>
                            setLinkSourceIndex((current) =>
                              current === sourceIndex ? null : sourceIndex,
                            )
                          }
                          onCompleteLink={(targetIndex) => {
                            if (
                              linkSourceIndex === null ||
                              linkSourceIndex === targetIndex
                            ) {
                              return;
                            }
                            setFlowConnections((current) => {
                              const existing = current[targetIndex] || [];
                              if (existing.includes(linkSourceIndex)) {
                                return current;
                              }
                              return {
                                ...current,
                                [targetIndex]: [...existing, linkSourceIndex],
                              };
                            });
                            setLinkSourceIndex(null);
                          }}
                        />
                      ) : (
                        <div className="overflow-auto rounded-[1.5rem] border border-white/10 bg-slate-950/35">
                          <table className="w-full min-w-[560px] text-left text-sm text-slate-200">
                            <thead className="bg-white/5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                              <tr>
                                <th className="px-3 py-3">Node</th>
                                <th className="px-3 py-3">Method</th>
                                <th className="px-3 py-3">Expected</th>
                                <th className="px-3 py-3">Actual</th>
                                <th className="px-3 py-3">Depends on</th>
                                <th className="px-3 py-3">Verdict</th>
                              </tr>
                            </thead>
                            <tbody>
                              {results.executions.map((row, index) => (
                                <tr
                                  key={`${row.name}-${index}-list`}
                                  className="border-t border-white/10 hover:bg-white/5"
                                  onClick={() => setExpandedId(index)}
                                >
                                  <td className="px-3 py-3 font-semibold">
                                    {index + 1}. {row.name}
                                  </td>
                                  <td className="px-3 py-3">{row.method}</td>
                                  <td className="px-3 py-3">
                                    {row.expectedStatuses.join(", ") || "None"}
                                  </td>
                                  <td className="px-3 py-3">{row.status}</td>
                                  <td className="px-3 py-3">
                                    {(flowConnections[index] || []).length === 0
                                      ? "Start"
                                      : (flowConnections[index] || [])
                                          .map(
                                            (parentIndex) =>
                                              `${parentIndex + 1}. ${results.executions[parentIndex]?.name || "Unknown"}`,
                                          )
                                          .join(" | ")}
                                  </td>
                                  <td className="px-3 py-3">
                                    <span
                                      className={cn(
                                        "rounded-full border px-2 py-1 text-[10px] font-black uppercase",
                                        statusTone(row.passed),
                                      )}
                                    >
                                      {row.passed ? "PASS" : "FAIL"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4">
                      {selectedFlowNode && selectedFlowNodeIndex !== null ? (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                            Node inspector
                          </p>
                          <h4 className="mt-2 text-sm font-black text-white">
                            {selectedFlowNodeIndex + 1}. {selectedFlowNode.name}
                          </h4>
                          <p className="mt-1 break-all text-xs text-slate-400">
                            {selectedFlowNode.url}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase",
                                methodTone(selectedFlowNode.method),
                              )}
                            >
                              {selectedFlowNode.method}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase",
                                statusTone(selectedFlowNode.passed),
                              )}
                            >
                              {selectedFlowNode.passed ? "PASS" : "FAIL"}
                            </span>
                          </div>

                          <label className="mt-4 block">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                              Add parent node
                            </span>
                            <select
                              value=""
                              onChange={(e) => {
                                const value = e.target.value;
                                const next =
                                  value === "" ? null : Number(value);
                                if (next === null || Number.isNaN(next)) return;
                                setFlowConnections((current) => ({
                                  ...current,
                                  [selectedFlowNodeIndex]: Array.from(
                                    new Set([
                                      ...(current[selectedFlowNodeIndex] || []),
                                      next,
                                    ]),
                                  ),
                                }));
                              }}
                              className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-sky-500/40 focus:ring-2 focus:ring-sky-500/15"
                            >
                              <option value="">Select parent node</option>
                              {results.executions.map(
                                (candidate, candidateIndex) => (
                                  <option
                                    key={`${candidate.name}-${candidateIndex}`}
                                    value={candidateIndex}
                                    disabled={
                                      candidateIndex === selectedFlowNodeIndex
                                    }
                                  >
                                    {candidateIndex + 1}. {candidate.name}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>

                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-300">
                            <p className="font-bold uppercase tracking-[0.22em] text-slate-500">
                              Current parent links
                            </p>
                            {(flowConnections[selectedFlowNodeIndex] || [])
                              .length === 0 ? (
                              <p className="mt-2 text-slate-400">
                                No parent nodes. This node can start a branch.
                              </p>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(
                                  flowConnections[selectedFlowNodeIndex] || []
                                ).map((parentIndex) => (
                                  <button
                                    key={`parent-${selectedFlowNodeIndex}-${parentIndex}`}
                                    onClick={() => {
                                      setFlowConnections((current) => ({
                                        ...current,
                                        [selectedFlowNodeIndex]: (
                                          current[selectedFlowNodeIndex] || []
                                        ).filter(
                                          (entry) => entry !== parentIndex,
                                        ),
                                      }));
                                    }}
                                    className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-rose-500/20"
                                  >
                                    {parentIndex + 1}.{" "}
                                    {results.executions[parentIndex]?.name ||
                                      "Unknown"}{" "}
                                    ×
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs text-slate-300">
                            <div className="flex items-center justify-between">
                              <span className="font-bold uppercase tracking-[0.22em] text-slate-500">
                                Actual
                              </span>
                              <span className="font-black text-white">
                                {selectedFlowNode.status}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="font-bold uppercase tracking-[0.22em] text-slate-500">
                                Expected
                              </span>
                              <span className="font-black text-white">
                                {selectedFlowNode.expectedStatuses.length
                                  ? selectedFlowNode.expectedStatuses.join(", ")
                                  : "None"}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-slate-400">
                          Select a node from the flow canvas to inspect or
                          rewire dependencies.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Scalability guide
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">
                      How to add new systems and collections
                    </h3>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        1. Add the new Postman collection JSON to{" "}
                        <span className="font-bold text-white">postman/</span>{" "}
                        or{" "}
                        <span className="font-bold text-white">
                          collections/
                        </span>
                        .
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        2. Add a matching environment JSON with the backend URL,
                        auth token, username/password, IDs, and any custom
                        variables.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        3. If the new system has different login keys or token
                        names, update the sidebar config and the environment
                        variable names used by that collection.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        4. Run the collection, then edit the node connections in
                        the flow map if the request order or dependency wiring
                        is different.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        5. Keep one shared base URL per system and use separate
                        environments for local, staging, and production.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      Helpful errors
                    </p>
                    <h3 className="mt-1 text-lg font-black text-white">
                      What error notifications mean
                    </h3>
                    <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">
                          Missing backend URL:
                        </span>{" "}
                        Set the base URL in the sidebar before running a
                        collection.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">401/403:</span>{" "}
                        Check the login credentials, bearer token, or API key
                        values in the environment.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">404:</span> Check
                        the collection endpoint path, trailing slashes, and the
                        backend route name.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">5xx:</span> Check
                        backend logs, database connectivity, and required env
                        vars on the backend server.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">Timeout:</span>{" "}
                        Increase request timeout in Postman scripts, verify API
                        latency, and inspect network stability between runner
                        and API.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">
                          Parse/JSON:
                        </span>{" "}
                        Confirm response bodies are valid JSON before parsing in
                        tests and ensure request payloads are valid JSON.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                        <span className="font-bold text-white">TLS/SSL:</span>{" "}
                        Validate certificate chain, host name, and local CA
                        trust settings for secure endpoints.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!selectedCollection ? (
              <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_0.9fr]">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-sky-500/15 p-3 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                        Overview
                      </p>
                      <h3 className="text-xl font-black text-white">
                        Choose a collection from the menu
                      </h3>
                    </div>
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300/90">
                    The new layout is designed to be readable on mobile and
                    desktop. The menu stays easy to reach, and each endpoint
                    shows expected status, actual status, request payload,
                    response payload, and the final verdict.
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        Mobile menu
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Tap the hamburger icon on phones to open the drawer and
                        switch collections/configs.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        Endpoint verdicts
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        Each step displays PASS only when the actual status
                        matches the expected one for that flow.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                    Quick start
                  </p>
                  <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                    <li className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                      1. Open the mobile menu or the left sidebar.
                    </li>
                    <li className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                      2. Pick a collection and environment.
                    </li>
                    <li className="rounded-2xl border border-white/10 bg-slate-950/25 p-4">
                      3. Run the collection and inspect each endpoint row.
                    </li>
                  </ol>
                </div>
              </section>
            ) : (
              <section className="flex flex-col gap-5">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                        Selected flow
                      </p>
                      <h3 className="mt-2 text-xl font-black text-white">
                        {selectedCollection.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Endpoint details, request body, expected response, and
                        actual response are shown for every step.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300">
                        {selectedCredentialProfile?.name || "Credential"} (
                        {selectedCredentialProfile?.role || "role"})
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300">
                        {selectedEnv?.name || "Default environment"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300">
                        {schemas.find(
                          (schema) => schema.id === selectedSchemaId,
                        )?.name || "No schema"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300">
                        {baseUrl}
                      </span>
                      {results && (
                        <>
                          <button
                            onClick={exportResultsAsJson}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <Download className="h-3.5 w-3.5" /> JSON
                          </button>
                          <button
                            onClick={exportResultsAsCsv}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <Download className="h-3.5 w-3.5" /> CSV
                          </button>
                          <button
                            onClick={exportResultsAsExcel}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <Download className="h-3.5 w-3.5" /> Excel
                          </button>
                          <button
                            onClick={exportResultsAsPdf}
                            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {loading && (
                    <div className="rounded-[1.5rem] border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200">
                      Running collection now. The dashboard is processing Newman
                      results...
                    </div>
                  )}

                  {results?.executions.map((exec, idx) => (
                    <motion.article
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={`${exec.name}-${idx}`}
                      className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/5 shadow-[0_18px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(expandedId === idx ? null : idx)
                        }
                        className="flex w-full flex-col gap-4 p-4 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]",
                                methodTone(exec.method),
                              )}
                            >
                              {exec.method}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]",
                                statusTone(exec.passed),
                              )}
                            >
                              {exec.passed ? "PASS" : "FAIL"}
                            </span>
                          </div>
                          <h4 className="mt-3 truncate text-base font-bold text-white sm:text-lg">
                            {exec.name}
                          </h4>
                          <p className="mt-1 break-all text-xs text-slate-400">
                            {exec.url}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                              Actual
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-sm font-black",
                                exec.passed
                                  ? "text-emerald-300"
                                  : "text-rose-300",
                              )}
                            >
                              {exec.status}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                              Expected
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-200">
                              {exec.expectedStatuses.length
                                ? exec.expectedStatuses.join(", ")
                                : "Not specified"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-950/30 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
                              Schema
                            </p>
                            <p
                              className={cn(
                                "mt-1 text-sm font-black",
                                exec.schemaValidation?.configured
                                  ? exec.schemaValidation?.passed
                                    ? "text-emerald-300"
                                    : "text-rose-300"
                                  : "text-slate-300",
                              )}
                            >
                              {exec.schemaValidation?.configured
                                ? exec.schemaValidation?.passed
                                  ? "PASS"
                                  : "FAIL"
                                : "Not set"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <span>{exec.responseTime}ms</span>
                            {expandedId === idx ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedId === idx && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/10 bg-slate-950/35 px-4 py-5 sm:px-6"
                          >
                            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                  Expected result
                                </p>
                                <p className="mt-3 text-sm leading-7 text-slate-200">
                                  {exec.expectedResult}
                                </p>
                                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
                                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                    Verdict
                                  </p>
                                  <p
                                    className={cn(
                                      "mt-2 text-sm font-bold",
                                      exec.passed
                                        ? "text-emerald-300"
                                        : "text-rose-300",
                                    )}
                                  >
                                    {exec.passed
                                      ? `PASS - Got ${exec.status} and it matches expected status code(s) ${exec.expectedStatuses.join(", ")}.`
                                      : `FAIL - Got ${exec.status} but expected ${exec.expectedStatuses.join(", ")}.`}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                  Request payload
                                </p>
                                <pre className="mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-[11px] leading-6 text-slate-300">
                                  {exec.requestBody
                                    ? formatPayloadForDisplay(exec.requestBody)
                                    : "// No request body"}
                                </pre>
                              </div>

                              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                  Actual response
                                </p>
                                <pre
                                  className={cn(
                                    "mt-3 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border p-4 text-[11px] leading-6",
                                    exec.passed
                                      ? "border-white/10 bg-slate-950/40 text-slate-300"
                                      : "border-rose-500/20 bg-rose-500/10 text-rose-100",
                                  )}
                                >
                                  {exec.responseBody
                                    ? formatPayloadForDisplay(exec.responseBody)
                                    : "// No response body"}
                                </pre>
                                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                  Expected response sample
                                </p>
                                <pre className="mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-[11px] leading-6 text-slate-300">
                                  {exec.expectedResponseBody
                                    ? formatPayloadForDisplay(
                                        exec.expectedResponseBody,
                                      )
                                    : "// No example response in collection"}
                                </pre>
                              </div>
                            </div>

                            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-sky-500/10 p-4">
                              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-200/80">
                                Expected vs actual
                              </p>
                              <p className="mt-2 text-sm leading-7 text-slate-200">
                                {exec.passed
                                  ? `Expected and actual status codes match. The flow is behaving as defined for ${exec.name}.`
                                  : `Expected status did not match the real response. Review the response body and the collection assertion for ${exec.name}.`}
                              </p>
                              {exec.schemaValidation?.configured &&
                                !exec.schemaValidation.passed && (
                                  <p className="mt-2 text-xs leading-6 text-rose-200">
                                    Schema mismatch:{" "}
                                    {exec.schemaValidation.error}
                                  </p>
                                )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  ))}

                  {!results && !loading && (
                    <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center backdrop-blur-xl">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/20">
                        <Activity className="h-7 w-7" />
                      </div>
                      <h3 className="mt-5 text-xl font-black text-white">
                        Ready to inspect flows
                      </h3>
                      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-400">
                        Pick a collection, run it, and each endpoint will show
                        the expected status, actual status, request payload,
                        response payload, and pass/fail verdict.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
