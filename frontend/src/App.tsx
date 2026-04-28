import { useEffect, useRef, useState, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  Database,
  Loader2,
  Play,
  XCircle,
  GripVertical,
  Plus,
  Clock,
  X,
  Zap,
  Copy,
  Terminal,
  Globe,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  AuthenticateWithRedirectCallback,
  useClerk,
  useSignIn,
  useSignUp,
  useUser,
} from "@clerk/react";
import Sidebar from "./components/Sidebar";
import { ProjectGrid } from "./components/ProjectGrid";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  const clerk = useClerk();
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
    const origin = window.location.origin;

    try {
      await clerk.client?.signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: origin,
      });
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
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2.4rem] border border-indigo-200/10 bg-slate-950/55 backdrop-blur-2xl">
        <div className="grid md:grid-cols-[1.15fr_1fr]">
          <section className="relative border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-300/30 bg-indigo-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-200">
              Nexus API Explorer
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
                    ? "bg-indigo-400 text-slate-950"
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
                <div className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
                  Preparing secure authentication...
                </div>
              )}

              <label className="block text-sm text-slate-300">
                Email address
                <input
                  type="email"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-indigo-400/50"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block text-sm text-slate-300">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/15 bg-slate-900/70 px-4 py-3 text-white outline-none transition focus:border-indigo-400/50"
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
                    ? "bg-indigo-300 hover:bg-indigo-200"
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
  source: string;
  updatedAt?: string;
  parent_collection_key?: string;
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
  nexusMetadata?: Record<string, any>;
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

const API_BASE = import.meta.env.VITE_API_BASE || "/api";



function methodTone(method: string) {
  switch (method) {
    case "GET":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/20";
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
  theme,
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
  theme: "dark" | "light";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const nodeWidth = 280;
  const nodeHeight = 140;
  
  const canvasWidth = Math.max(
    1200,
    ...Object.values(nodePositions).map((p) => p.x + nodeWidth + 100)
  );
  const canvasHeight = Math.max(
    800,
    ...Object.values(nodePositions).map((p) => p.y + nodeHeight + 100)
  );

  useEffect(() => {
    if (draggingIndex === null) return;
    const handleMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const nextX = event.clientX - rect.left + container.scrollLeft - dragOffsetRef.current.x;
      const nextY = event.clientY - rect.top + container.scrollTop - dragOffsetRef.current.y;
      onNodePositionChange(draggingIndex, { x: Math.max(0, nextX), y: Math.max(0, nextY) });
    };
    const handleUp = () => setDraggingIndex(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingIndex, onNodePositionChange]);

  return (
    <div ref={containerRef} className={cn(
      "relative h-[calc(100vh-280px)] w-full overflow-auto rounded-[3rem] border backdrop-blur-3xl shadow-inner custom-scrollbar",
      theme === "dark" ? "border-white/5 bg-slate-950/40" : "border-slate-200 bg-white"
    )}>
      <div className="absolute inset-0 opacity-10" style={{ 
        backgroundImage: theme === "dark" 
          ? 'radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.15) 1.5px, transparent 0)' 
          : 'radial-gradient(circle at 1.5px 1.5px, rgba(0,0,0,0.1) 1.5px, transparent 0)', 
        backgroundSize: '48px 48px' 
      }} />
      <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
        <svg width={canvasWidth} height={canvasHeight} className="absolute inset-0 pointer-events-none overflow-visible">
          {executions.flatMap((_, index) => {
            const fromIndexes = flowConnections[index] || [];
            return fromIndexes.map((fromIndex) => {
              const from = nodePositions[fromIndex];
              const to = nodePositions[index];
              if (!from || !to) return null;
              const startX = from.x + nodeWidth;
              const startY = from.y + nodeHeight / 2;
              const endX = to.x;
              const endY = to.y + nodeHeight / 2;
              const cp1X = startX + (endX - startX) * 0.4;
              const cp2X = startX + (endX - startX) * 0.6;
              return (
                <path
                  key={`edge-${fromIndex}-${index}`}
                  d={`M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`}
                  stroke={executions[index]?.passed === false ? "rgba(244,63,94,0.3)" : "rgba(99,102,241,0.35)"}
                  strokeWidth="3"
                  strokeDasharray={executions[index]?.passed === false ? "none" : "6 4"}
                  fill="none"
                  className={cn("transition-all duration-700", executions[index]?.passed && "animate-pulse")}
                />
              );
            });
          })}
          {linkSourceIndex !== null && nodePositions[linkSourceIndex] && (
            <circle cx={nodePositions[linkSourceIndex].x + nodeWidth} cy={nodePositions[linkSourceIndex].y + nodeHeight / 2} r="8" fill="rgba(129,140,248,0.8)" className="animate-ping" />
          )}
        </svg>

        {executions.map((exec, index) => {
          const pos = nodePositions[index] || { x: 40, y: 40 + index * 160 };
          const active = selectedIndex === index;
          return (
            <motion.div
              layout
              key={`node-${index}`}
              onClick={() => onSelect(index)}
              className={cn(
                "absolute cursor-pointer rounded-[2.5rem] border-2 p-6 transition-all duration-300 group shadow-2xl",
                active 
                  ? "border-indigo-500 bg-indigo-500/10 shadow-[0_30px_90px_rgba(79,70,229,0.3)] z-10 scale-105" 
                  : (theme === "dark" ? "border-white/10 bg-slate-900/60 hover:border-white/30 hover:bg-slate-900/80" : "border-slate-200 bg-white hover:border-indigo-500/30 shadow-sm"),
                exec.passed === false 
                  ? (theme === "dark" ? "border-rose-500 bg-rose-500/15" : "border-rose-500 bg-rose-50") 
                  : (exec.passed ? (theme === "dark" ? "border-emerald-500/50 bg-emerald-500/5" : "border-emerald-500 bg-emerald-50") : "")
              )}
              style={{ width: nodeWidth, height: nodeHeight, left: pos.x, top: pos.y }}
            >
              <div onMouseDown={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget.parentElement as HTMLDivElement).getBoundingClientRect();
                dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setDraggingIndex(index);
              }} className="absolute top-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                <GripVertical className="h-5 w-5 text-slate-500" />
              </div>

              <div className="flex items-center gap-3 mb-4">
                <span className={cn("rounded-xl border px-3 py-1 text-[11px] font-black uppercase tracking-widest", methodTone(exec.method))}>
                  {exec.method}
                </span>
                <div className={cn("h-2 w-2 rounded-full ml-auto animate-pulse", exec.passed === null ? "bg-slate-700" : exec.passed ? "bg-emerald-500" : "bg-rose-500")} />
              </div>

              <h4 className={cn("text-lg font-black truncate pr-8 leading-tight", theme === "dark" ? "text-white" : "text-slate-900")}>
                {exec.name}
              </h4>
              
              <div className={cn("mt-4 flex items-center justify-between border-t pt-4", theme === "dark" ? "border-white/5" : "border-slate-100")}>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  <span className={cn("text-xs font-black", exec.passed === null ? "text-slate-600" : (exec.passed ? (theme === "dark" ? "text-emerald-400" : "text-emerald-600") : (theme === "dark" ? "text-rose-400" : "text-rose-600")))}>
                    {exec.passed === null ? "PENDING..." : exec.passed ? "PASSED" : `ERROR ${exec.status}`}
                  </span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onStartLink(index); }} 
                  className={cn(
                    "p-2 rounded-xl border transition-all",
                    theme === "dark" ? "bg-white/5 border-white/10 hover:bg-indigo-500" : "bg-slate-50 border-slate-200 hover:bg-indigo-500 hover:text-white"
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <button onClick={(e) => { e.stopPropagation(); onCompleteLink(index); }} className={cn("absolute -left-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border-4 flex items-center justify-center transition-all", linkSourceIndex !== null ? "border-indigo-400 bg-indigo-500 scale-110" : "border-[#020617] bg-slate-800 opacity-0 group-hover:opacity-100 shadow-xl")}>
                <div className="h-2 w-2 rounded-full bg-white/40" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

function StepList({ 
  executions, 
  selectedIndex, 
  onSelect, 
  theme 
}: { 
  executions: any[]; 
  selectedIndex: number | null; 
  onSelect: (index: number) => void;
  theme: "dark" | "light"; 
}) {
  return (
    <div className="h-full overflow-y-auto p-8 space-y-4 custom-scrollbar">
      {executions.map((exec, index) => (
        <div 
          key={index} 
          onClick={() => onSelect(index)}
          className={cn(
            "flex items-center gap-6 p-6 rounded-[2rem] border cursor-pointer transition-all duration-300",
            selectedIndex === index 
              ? "border-indigo-500 bg-indigo-500/5 shadow-2xl scale-[1.02] z-10" 
              : (theme === "dark" ? "border-white/5 bg-white/[0.02] hover:bg-white/[0.05]" : "border-slate-200 bg-white hover:border-indigo-200 shadow-sm")
          )}
        >
          <div className={cn("h-3 w-3 rounded-full ring-4 shadow-sm", exec.passed === null ? "bg-slate-700 ring-slate-700/20" : (exec.passed ? "bg-emerald-500 ring-emerald-500/20" : "bg-rose-500 ring-rose-500/20 shadow-rose-500/40"))} />
          <div className="flex-1 min-w-0">
             <div className="flex items-center gap-3 mb-1.5">
                <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border", methodTone(exec.method))}>
                  {exec.method}
                </span>
                <h4 className={cn("text-base font-black truncate", theme === "dark" ? "text-white" : "text-slate-900")}>{exec.name}</h4>
             </div>
             <p className="text-[11px] text-slate-500 font-mono truncate opacity-60 leading-tight">{exec.url}</p>
          </div>
          <div className="text-right">
             <span className={cn("text-[11px] font-black tracking-widest uppercase", exec.passed === null ? "text-slate-600" : (exec.passed ? "text-emerald-500" : "text-rose-500"))}>
               {exec.passed === null ? "PENDING" : (exec.passed ? "PASSED" : `FAILED ${exec.status}`)}
             </span>
             <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mt-1.5 opacity-60">
               {exec.responseTime ? `${exec.responseTime}ms` : "---"}
             </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  theme,
}: MetricCardProps & { theme: "dark" | "light" }) {
  return (
    <div className={cn(
      "rounded-3xl border p-4 sm:p-5 backdrop-blur-xl transition-all duration-300",
      theme === "dark" 
        ? "border-white/8 bg-white/5 shadow-[0_16px_60px_rgba(2,6,23,0.35)]" 
        : "border-slate-200 bg-white shadow-[0_16px_60px_rgba(0,0,0,0.05)]"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn("rounded-2xl p-3 ring-1 ring-inset", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-[10px] font-bold uppercase tracking-[0.22em]", theme === "dark" ? "text-slate-400" : "text-slate-500")}>
            {label}
          </p>
          <p className={cn("mt-1 text-2xl font-black", theme === "dark" ? "text-white" : "text-slate-900")}>{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {


  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { isLoaded, user } = useUser();
  const oauthCallbackPath = "/sso-callback";
  const [collections, setCollections] = useState<Item[]>([]);
  const [environments, setEnvironments] = useState<Item[]>([]);
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>("");
  const [selectedCollection, setSelectedCollection] = useState<Item | null>(
    null,
  );
  const [selectedEnv, setSelectedEnv] = useState<Item | null>(null);
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [showActiveConfigPassword, setShowActiveConfigPassword] =
    useState(false);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  const [activePage, setActivePage] = useState<"projects" | "workspace">("projects");
  const [workspaceView, setWorkspaceView] = useState<"graph" | "list">("graph");

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
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

  const getAssetKey = (item: Item | null) => {
    if (!item) return null;
    // For DB assets, use the UUID
    if (item.filename.startsWith("db-collections/")) {
      return item.filename.replace("db-collections/", "");
    }
    // For non-DB assets, use the filename as a stable key for isolation
    return item.filename;
  };

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
        const collRes = await axios.get(`${API_BASE}/collections`, { headers: authHeaders });
        setCollections(collRes.data);
      } catch (error) {
        console.error("Failed to fetch collections", error);
      }
    };

    fetchData();
  }, [isLoaded, user]);

  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0]);
    }
  }, [collections, selectedCollection]);

  // Handle workspace isolation: Refresh envs/schemas when collection changes
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    // Only fetch scoped assets if we have a selected collection
    // Otherwise, and specifically for environments, we might want a global list 
    // BUT the user asked for isolation, so we filter.
    const collectionKey = getAssetKey(selectedCollection);
    
    const fetchScopedAssets = async () => {
      // If no collection is selected, we should clear the scoped assets
      // to maintain absolute isolation and prevent "leaks"
      if (!collectionKey) {
        setEnvironments([]);
        setSelectedEnv(null);
        setSchemas([]);
        setSelectedSchemaId("");
        setCredentialProfiles([]);
        return;
      }

      try {
        const [envRes, schemaRes, profileRes] = await Promise.all([
          axios.get(`${API_BASE}/environments`, { 
            headers: authHeaders,
            params: { parentCollectionKey: collectionKey }
          }),
          axios.get(`${API_BASE}/schemas`, { 
            headers: authHeaders,
            params: { parentCollectionKey: collectionKey }
          }),
          axios.get(`${API_BASE}/credential-profiles`, {
            headers: authHeaders,
            params: { parentCollectionKey: collectionKey }
          }),
        ]);
        
        const nextEnvs = Array.isArray(envRes.data) ? envRes.data : [];
        setEnvironments(nextEnvs);
        if (nextEnvs.length > 0 && (!selectedEnv || !nextEnvs.find(e => e.filename === selectedEnv.filename))) {
          setSelectedEnv(nextEnvs[0]);
        } else if (nextEnvs.length === 0) {
          setSelectedEnv(null);
        }

        const nextSchemas = Array.isArray(schemaRes.data) ? schemaRes.data : [];
        setSchemas(nextSchemas);
        if (nextSchemas.length > 0 && (!selectedSchemaId || !nextSchemas.find(s => s.id === selectedSchemaId))) {
          setSelectedSchemaId(nextSchemas[0].id);
        } else if (nextSchemas.length === 0) {
          setSelectedSchemaId("");
        }

        const nextProfiles = Array.isArray(profileRes.data) ? profileRes.data : [];
        setCredentialProfiles(nextProfiles);
        if (nextProfiles.length > 0 && (!selectedCredentialProfileId || !nextProfiles.find(p => p.id === selectedCredentialProfileId))) {
          setSelectedCredentialProfileId(nextProfiles[0].id);
        } else if (nextProfiles.length === 0) {
          // Keep a default dummy profile if none exist? 
          // Actually, better to just let it be empty if that's what the user wants for isolation.
        }
      } catch (error) {
        console.error("Failed to fetch scoped assets", error);
      }
    };

    fetchScopedAssets();
  }, [selectedCollection, user, isLoaded]);

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
          const environmentDoc = environmentSource ? JSON.parse(environmentSource) : null;
          const meta = collectionDoc.nexus_metadata || {};
          if (meta.flowConnections) setFlowConnections(meta.flowConnections);
          if (meta.flowNodePositions) setFlowNodePositions(meta.flowNodePositions);

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
          if (response.data?.nexusMetadata) {
            const meta = response.data.nexusMetadata;
            if (meta.flowConnections) setFlowConnections(meta.flowConnections);
            if (meta.flowNodePositions) setFlowNodePositions(meta.flowNodePositions);
          }
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
    const total = results?.executions?.length || analysis?.summary.totalRequests || 0;
    if (total === 0) return;

    setFlowConnections((current) => {
      const next: Record<number, number[]> = { ...current };
      for (let i = 0; i < total; i++) {
        if (next[i] === undefined) {
          next[i] = i === 0 ? [] : [i - 1];
        }
      }
      return next;
    });

    setFlowNodePositions((current) => {
      const stepX = 320;
      const laneY = [24, 188];
      const next: Record<number, { x: number; y: number }> = { ...current };
      for (let i = 0; i < total; i++) {
        const lane = i % 2;
        const col = Math.floor(i / 2);
        if (next[i] === undefined) {
          next[i] = { x: 30 + col * stepX, y: laneY[lane] };
        }
      }
      return next;
    });
  }, [results, analysis]);

  const saveWorkspaceState = useCallback(
    async (
      connections: Record<number, number[]>,
      positions: Record<number, { x: number; y: number }>,
    ) => {
      if (!selectedCollection || !isLoaded || !user) return;

      try {
        const rawContent = collectionContentByFilename[selectedCollection.filename];
        if (!rawContent) return;

        const doc = JSON.parse(rawContent);
        doc.nexus_metadata = {
          flowConnections: connections,
          flowNodePositions: positions,
        };

        const updatedContent = JSON.stringify(doc, null, 2);
        await axios.post(
          `${API_BASE}/import`,
          {
            kind: "collection",
            filename: selectedCollection.filename,
            content: updatedContent,
            source: "nexus_workspace",
          },
          { headers: authHeaders },
        );

        setCollectionContentByFilename((curr) => ({
          ...curr,
          [selectedCollection.filename]: updatedContent,
        }));
      } catch (e) {
        console.error("Failed to save workspace state", e);
      }
    },
    [selectedCollection, isLoaded, user, collectionContentByFilename],
  );

  useEffect(() => {
    if (!selectedCollection) return;
    const timer = setTimeout(() => {
      if (Object.keys(flowConnections).length > 0 || Object.keys(flowNodePositions).length > 0) {
         void saveWorkspaceState(flowConnections, flowNodePositions);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [flowConnections, flowNodePositions, selectedCollection, saveWorkspaceState]);

  const syncCredentialProfile = async (profile: CredentialProfile) => {
    try {
      const response = await axios.post(
        `${API_BASE}/credential-profiles`,
        { 
          profile,
          parentCollectionKey: getAssetKey(selectedCollection)
        },
        { headers: authHeaders },
      );
      if (
        Array.isArray(response.data?.items)
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
        { 
          headers: authHeaders,
          params: { parentCollectionKey: getAssetKey(selectedCollection) }
        },
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
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotifications((current) =>
      [
        { id, ...item },
        ...current,
      ].slice(0, 4),
    );
    
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotifications(current => current.filter(n => n.id !== id));
    }, 6000);
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

      const response = await axios.post(
        `${API_BASE}/analyze`,
        {
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
        { headers: authHeaders },
      );
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
        setActivePage("projects");
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

  const importJsonFile = async (
    kind: "collection" | "environment",
    file: File,
  ) => {
    const content = await file.text();
    try {
      const response = await axios.post(
        `${API_BASE}/import`,
        {
          kind,
          filename: file.name,
          content,
          parentCollectionKey: kind === "environment" ? getAssetKey(selectedCollection) : null,
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
      const importedItem: Item = {
        name: file.name.replace(/\.json$/i, ""),
        filename: `${kind === "collection" ? "collections" : "environments"}/${localFilename.endsWith(".json") ? localFilename : `${localFilename}.json`}`,
        source: "local",
        updatedAt: new Date().toISOString(),
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
    setActivePage("workspace");

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
    setActivePage("workspace");
    if (isMobile) setMobileMenuOpen(false);
  };





  const resetHome = () => {
    setSelectedCollection(null);
    setResults(null);
    setExpandedId(null);
    setActivePage("projects");
    if (isMobile) setMobileMenuOpen(false);
  };

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

  if (window.location.pathname === oauthCallbackPath) {
    return (
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
        signInForceRedirectUrl="/"
        signUpForceRedirectUrl="/"
      />
    );
  }

  if (!user) {
    return <AuthLanding />;
  }


  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 selection:bg-indigo-500/30 relative",
      theme === "dark" ? "bg-[#020617] text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      <AnimatePresence>
        {!desktopSidebarOpen && !isMobile && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setDesktopSidebarOpen(true)}
            className={cn(
              "fixed left-6 top-6 z-50 p-3 rounded-2xl border backdrop-blur-xl transition-all hover:scale-110 active:scale-95 shadow-2xl",
              theme === "dark" ? "bg-slate-900/80 border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
            )}
            title="Expand Sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <div className="mx-auto flex min-h-screen w-full max-w-[2000px] flex-col lg:flex-row overflow-hidden">
        <Sidebar
          isMobile={isMobile}
          isSidebarOpen={isSidebarOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          setDesktopSidebarOpen={setDesktopSidebarOpen}
          activePage={activePage}
          setActivePage={setActivePage}
          resetHome={resetHome}
          collections={collections}
          selectedCollection={selectedCollection}
          selectCollection={selectCollection}
          removeCollection={removeCollection}
          isCollectionRemovable={isCollectionRemovable}
          environments={environments}
          selectedEnv={selectedEnv}
          setSelectedEnv={setSelectedEnv}
          baseUrl={baseUrl}
          setBaseUrl={setBaseUrl}
          credentialProfiles={credentialProfiles}
          selectedCredentialProfileId={selectedCredentialProfileId}
          setSelectedCredentialProfileId={setSelectedCredentialProfileId}
          addCredentialProfile={addCredentialProfile}
          removeCredentialProfile={removeCredentialProfile}
          selectedCredentialProfile={selectedCredentialProfile}
          updateSelectedCredentialProfile={updateSelectedCredentialProfile}
          showActiveConfigPassword={showActiveConfigPassword}
          setShowActiveConfigPassword={setShowActiveConfigPassword}
          theme={theme}
          toggleTheme={toggleTheme}
        />

        <main className={cn(
          "flex-1 transition-all duration-300",
          activePage === "projects" ? "overflow-y-auto" : "flex flex-col overflow-hidden"
        )}>
          {activePage === "projects" ? (
            <ProjectGrid
              collections={collections}
              theme={theme}
              toggleTheme={toggleTheme}
              onSelect={(item) => {
                setSelectedCollection(item);
                setResults(null);
                setExpandedId(null);
                setActivePage("workspace");
                void refreshAnalysis(item, selectedEnv);
              }}
              onDelete={(fn) => {
                const item = collections.find((c) => c.filename === fn);
                if (item) removeCollection(item);
              }}
              onImport={() => {
                 const input = document.createElement('input');
                 input.type = 'file';
                 input.accept = '.json';
                 input.onchange = (e: any) => {
                   const file = e.target.files?.[0];
                   if (file) void importJsonFile('collection', file);
                 };
                 input.click();
              }}
            />
          ) : (
            <div className={cn("flex flex-col h-full", theme === "dark" ? "bg-slate-950/20" : "bg-slate-50/50")}>
              <header className={cn(
                "px-6 py-5 flex items-center justify-between border-b backdrop-blur-3xl shadow-xl",
                theme === "dark" ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-white"
              )}>
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "p-3.5 rounded-2xl border shadow-inner group transition-all",
                    theme === "dark" 
                      ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20" 
                      : "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                  )}>
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className={cn("text-2xl font-black leading-tight", theme === "dark" ? "text-white" : "text-slate-900")}>
                      {selectedCollection?.name || "Active Workspace"}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      <p className={cn("text-[10px] font-bold uppercase tracking-[0.3em] font-mono", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Live Session</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* View Toggle */}
                  <div className={cn("flex items-center p-1.5 rounded-2xl border", theme === "dark" ? "bg-black/20 border-white/5" : "bg-slate-100 border-slate-200")}>
                    <button 
                      onClick={() => setWorkspaceView("graph")}
                      className={cn("p-2 rounded-xl transition-all", workspaceView === "graph" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-400")}
                      title="Flow Graph View"
                    >
                      <Activity className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => setWorkspaceView("list")}
                      className={cn("p-2 rounded-xl transition-all", workspaceView === "list" ? "bg-indigo-500 text-white shadow-lg" : "text-slate-500 hover:text-slate-400")}
                      title="List View"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="h-8 w-px bg-white/10 mx-1" />

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) void importJsonFile('collection', file);
                        };
                        input.click();
                      }}
                      className={cn("p-3 rounded-2xl border transition-all", theme === "dark" ? "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900")}
                      title="Update Collection Schema"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (e: any) => {
                          const file = e.target.files?.[0];
                          if (file) void importJsonFile('environment', file);
                        };
                        input.click();
                      }}
                      className={cn("p-3 rounded-2xl border transition-all", theme === "dark" ? "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900")}
                      title="Add Environment"
                    >
                      <Globe className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => selectedCollection && removeCollection(selectedCollection)}
                      className={cn("p-3 rounded-2xl border transition-all", theme === "dark" ? "bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20" : "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100")}
                      title="Delete Collection"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="h-8 w-px bg-white/10 mx-1" />

                  {/* Validation Schema Selector */}
                  <div className={cn(
                    "flex flex-col items-start gap-1 px-4 py-1.5 rounded-2xl border bg-white shadow-sm transition-all duration-300 group",
                    theme === "dark" ? "bg-slate-900 border-white/5" : "bg-white border-slate-200"
                  )}>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest px-0.5", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Validation Schema</p>
                    <div className="flex items-center gap-3">
                      <select 
                        value={selectedSchemaId} 
                        onChange={(e) => setSelectedSchemaId(e.target.value)}
                        className={cn(
                          "bg-transparent text-xs font-black outline-none appearance-none cursor-pointer pr-4",
                          theme === "dark" ? "text-amber-400" : "text-amber-600"
                        )}
                      >
                        <option value="">No Validation</option>
                        {schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.json';
                          input.onchange = async (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                               const content = await file.text();
                               try {
                                  const response = await axios.post(`${API_BASE}/schemas`, { 
                                    name: file.name.replace('.json',''), 
                                    schemaContent: content,
                                    parentCollectionKey: getAssetKey(selectedCollection)
                                  }, { headers: authHeaders });
                                  setSchemas(response.data.items || []);
                                  setSelectedSchemaId(response.data.saved?.id || "");
                                  pushNotification({ 
                                    kind: 'success', 
                                    title: 'Schema added', 
                                    detail: 'Validation schema uploaded and selected.',
                                    resolution: 'You can now run tests with this validation schema.'
                                  });
                               } catch (err) {
                                  pushNotification({ 
                                    kind: 'error', 
                                    title: 'Upload failed', 
                                    detail: 'Invalid JSON schema format.',
                                    resolution: 'Ensure the file is a valid JSON schema object.'
                                  });
                               }
                            }
                          };
                          input.click();
                        }}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-500 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-white/10 mx-1" />

                  <div className={cn(
                    "hidden lg:flex flex-col items-end gap-0.5 px-5 py-2 rounded-2xl border shadow-inner",
                    theme === "dark" ? "bg-white/[0.03] border-white/5" : "bg-slate-50 border-slate-200"
                  )}>
                    <p className={cn("text-[9px] font-bold uppercase tracking-widest", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Target Environment</p>
                    <span className={cn("text-sm font-black", theme === "dark" ? "text-indigo-300" : "text-indigo-600")}>{selectedEnv?.name || 'Local/Default'}</span>
                  </div>
                  <button
                    onClick={runTest}
                    disabled={loading || !selectedCollection}
                    className="flex-shrink-0 group relative inline-flex items-center gap-3 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all hover:bg-indigo-500 hover:shadow-[0_25px_60px_rgba(79,70,229,0.4)] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                    {loading ? "Discovering Trail..." : "Run Test Trail"}
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-hidden p-6 lg:p-10 flex gap-8 relative">
                {/* Floating Action Button (FAB) for Running Tests */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="fixed right-10 bottom-10 z-[100] hidden lg:block"
                >
                  <button
                    onClick={runTest}
                    disabled={loading || !selectedCollection}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl bg-indigo-600 pl-6 pr-8 py-4 text-sm font-black text-white shadow-[0_20px_50px_rgba(79,70,229,0.4)] transition-all hover:bg-indigo-500 hover:shadow-[0_25px_60px_rgba(79,70,229,0.5)] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed",
                      loading && "pr-6"
                    )}
                  >
                    <div className="relative flex items-center justify-center h-5 w-5">
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4 fill-current group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <span className="tracking-tight">
                      {loading ? "Discovering Trail..." : "Run Test Trail"}
                    </span>
                  </button>
                </motion.div>

                <div className="flex-1 flex flex-col gap-8 overflow-hidden">
                  {results && (
                     <motion.div 
                       initial={{ opacity: 0, y: -20 }}
                       animate={{ opacity: 1, y: 0 }}
                       className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
                     >
                        <MetricCard label="Total Steps" value={results.stats.requests.total} icon={Activity} accent="bg-indigo-500/10 text-indigo-400 ring-indigo-500/20" theme={theme} />
                        <MetricCard label="Success Ratio" value={`${Math.round(((results.accuracy?.passedExecutions || 0) / (results.accuracy?.totalExecutions || 1)) * 100) || 0}%`} icon={CheckCircle2} accent="bg-emerald-500/10 text-emerald-400 ring-emerald-500/20" theme={theme} />
                        <MetricCard label="Failures" value={results.stats.requests.failed} icon={XCircle} accent="bg-rose-500/10 text-rose-400 ring-rose-500/20" theme={theme} />
                        <MetricCard label="Latency Avg" value={`${Math.round(results.executions.reduce((a, b) => a + (b.responseTime || 0), 0) / results.executions.length) || 0}ms`} icon={Clock} accent="bg-amber-500/10 text-amber-400 ring-amber-500/20" theme={theme} />
                     </motion.div>
                  )}

                  <div className={cn(
                    "flex-1 relative rounded-[3rem] border hide-scrollbar overflow-hidden transition-all duration-500",
                    theme === "dark" 
                      ? "border-white/5 bg-slate-950/40 shadow-2xl" 
                      : "border-slate-200 bg-white shadow-[0_20px_80px_rgba(0,0,0,0.03)]"
                  )}>
                     {workspaceView === "graph" ? (
                       <FlowGraph
                          executions={results?.executions || analysis?.issues.map((_, i) => ({ name: `Preflight Requirement ${i+1}`, method: 'GET', passed: null, expectedStatuses: [200], status: '---' } as any)) || []}
                          flowConnections={flowConnections}
                          nodePositions={flowNodePositions}
                          selectedIndex={selectedFlowNodeIndex}
                          onSelect={(index) => setExpandedId(index)}
                          onNodePositionChange={(index, pos) => setFlowNodePositions((c) => ({ ...c, [index]: pos }))}
                          linkSourceIndex={linkSourceIndex}
                          onStartLink={setLinkSourceIndex}
                          onCompleteLink={(targetIndex) => {
                            if (linkSourceIndex === null || linkSourceIndex === targetIndex) return;
                            setFlowConnections(c => ({
                              ...c,
                              [targetIndex]: [...(c[targetIndex] || []), linkSourceIndex]
                            }));
                            setLinkSourceIndex(null);
                          }}
                          theme={theme}
                       />
                     ) : (
                       <StepList 
                          executions={results?.executions || analysis?.issues.map((_, i) => ({ name: `Preflight Requirement ${i+1}`, method: 'GET', passed: null, expectedStatuses: [200], status: '---' } as any)) || []}
                          selectedIndex={selectedFlowNodeIndex}
                          onSelect={(index) => setExpandedId(index)}
                          theme={theme}
                       />
                     )}
                  </div>
                </div>
                <AnimatePresence>
                  {selectedFlowNodeIndex !== null && (
                    <motion.aside
                      initial={{ opacity: 0, x: 40, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 40, scale: 0.95 }}
                      className={cn(
                        "w-[440px] rounded-[3rem] border backdrop-blur-3xl p-8 overflow-y-auto custom-scrollbar z-20 transition-colors duration-500",
                        theme === "dark" 
                          ? "border-white/10 bg-slate-900/60 shadow-[-20px_0_80px_rgba(0,0,0,0.6)] border-l border-indigo-500/10" 
                          : "border-slate-200 bg-white/95 shadow-[-20px_0_80px_rgba(0,0,0,0.1)] border-l border-indigo-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-10">
                        <div>
                          <h3 className={cn("text-2xl font-black leading-none", theme === "dark" ? "text-white" : "text-slate-900")}>Intelligence</h3>
                          <p className={cn("text-[10px] font-bold uppercase tracking-[0.4em] mt-3 font-mono", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Node Diagnostic</p>
                        </div>
                        <button 
                          onClick={() => setExpandedId(null)} 
                          className="p-3.5 rounded-2xl hover:bg-white/5 text-slate-500 transition-all hover:text-white active:scale-90"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>

                      {selectedFlowNode && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                          <div className={cn(
                            "p-6 rounded-[2rem] border shadow-inner relative overflow-hidden group",
                            theme === "dark" ? "bg-white/[0.03] border-white/10" : "bg-slate-50 border-slate-200"
                          )}>
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Zap className="h-20 w-20 text-indigo-500" />
                            </div>
                            <p className={cn("text-[10px] font-bold uppercase tracking-widest font-mono", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Endpoint Identity</p>
                            <h4 className={cn("mt-3 text-xl font-black break-words leading-snug", theme === "dark" ? "text-white" : "text-slate-900")}>{selectedFlowNode.name}</h4>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 transition-colors hover:bg-indigo-500/10">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/60 font-mono">Method</p>
                              <p className="mt-2 text-lg font-black text-indigo-300">{selectedFlowNode.method}</p>
                            </div>
                            <div className={cn("p-5 rounded-[2rem] border transition-all", selectedFlowNode.passed ? "bg-emerald-500/5 border-emerald-500/10 shadow-[inner_0_0_20px_rgba(16,185,129,0.05)]" : "bg-rose-500/5 border-rose-500/10 shadow-[inner_0_0_20px_rgba(244,63,94,0.05)]")}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">Verdict</p>
                              <p className={cn("mt-2 text-lg font-black", selectedFlowNode.passed ? "text-emerald-400" : "text-rose-400")}>
                                {selectedFlowNode.passed ? "PASSED" : "FAILED"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                             <p className={cn("text-[10px] font-bold uppercase tracking-widest px-1 font-mono", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Resolved Path</p>
                             <div className={cn(
                               "p-5 rounded-[1.5rem] border font-mono text-[11px] break-all leading-relaxed shadow-inner group relative",
                               theme === "dark" ? "bg-black/40 border-white/5 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
                             )}>
                                <button className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-white/5 hover:bg-white/10">
                                   <Copy className="h-3 w-3 text-slate-400" />
                                </button>
                                {selectedFlowNode.url}
                             </div>
                          </div>

                          {selectedFlowNode.responseBody && (
                            <div className="space-y-4">
                               <p className={cn("text-[10px] font-bold uppercase tracking-widest px-1 font-mono", theme === "dark" ? "text-slate-500" : "text-slate-400")}>Deep Inspection (Payload)</p>
                               <div className={cn(
                                 "p-6 rounded-[2.5rem] border font-mono text-[11px] overflow-auto max-h-[360px] custom-scrollbar shadow-2xl leading-6",
                                 theme === "dark" ? "bg-black/60 border-white/5 text-indigo-200/90 ring-1 ring-inset ring-white/5" : "bg-white border-slate-200 text-indigo-900 ring-1 ring-inset ring-slate-100"
                               )}>
                                  <pre>{selectedFlowNode.responseBody.includes('{') ? JSON.stringify(JSON.parse(selectedFlowNode.responseBody), null, 2) : selectedFlowNode.responseBody}</pre>
                               </div>
                            </div>
                          )}

                          {selectedFlowNode.assertions.length > 0 && (
                            <div className="space-y-5">
                               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-1 font-mono">Trail Validation</p>
                               <div className="space-y-3">
                                  {selectedFlowNode.assertions.map((a, i) => (
                                    <div key={i} className={cn(
                                      "flex items-start gap-5 p-5 rounded-[1.5rem] border shadow-sm transition-all hover:translate-x-1",
                                      theme === "dark" ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]" : "bg-white border-slate-100 hover:bg-slate-50"
                                    )}>
                                       <div className={cn("mt-1.5 h-2.5 w-2.5 rounded-full ring-4", a.passed ? "bg-emerald-500 ring-emerald-500/20" : "bg-rose-500 ring-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.4)]")} />
                                       <div className="min-w-0 flex-1">
                                          <p className={cn("text-sm font-black leading-tight", theme === "dark" ? "text-slate-100" : "text-slate-900")}>{a.assertion}</p>
                                          {!a.passed && <p className="mt-2.5 text-[11px] text-rose-500/70 leading-relaxed font-semibold italic">{a.error}</p>}
                                       </div>
                                    </div>
                                  ))}
                               </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.aside>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Graceful Notification System */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "pointer-events-auto flex items-start gap-4 p-5 rounded-3xl border backdrop-blur-3xl shadow-2xl min-w-[320px] max-w-md",
                n.kind === "success" 
                  ? (theme === "dark" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100" : "bg-emerald-50 border-emerald-200 text-emerald-900")
                  : n.kind === "warning"
                    ? (theme === "dark" ? "bg-amber-500/10 border-amber-500/20 text-amber-100" : "bg-amber-50 border-amber-200 text-amber-900")
                    : (theme === "dark" ? "bg-rose-500/10 border-rose-500/20 text-rose-100" : "bg-rose-50 border-rose-200 text-rose-900")
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-bold">{n.title}</p>
                {n.detail && <p className="mt-1 text-xs opacity-70 leading-relaxed">{n.detail}</p>}
              </div>
              <button 
                onClick={() => setNotifications(curr => curr.filter(item => item.id !== n.id))}
                className="p-1 rounded-lg hover:bg-white/10 opacity-50 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
