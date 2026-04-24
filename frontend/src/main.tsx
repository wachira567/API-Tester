import {  } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import App from "./App.tsx";

const clerkPublishableKey = `${import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || ""}`.trim();

if (!clerkPublishableKey) {
  createRoot(document.getElementById("root")!).render(
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#020617", color: "#e2e8f0", padding: "24px" }}>
      <div style={{ maxWidth: "760px", border: "1px solid rgba(148,163,184,0.25)", borderRadius: "16px", padding: "20px", background: "rgba(15,23,42,0.75)" }}>
        <h2 style={{ marginTop: 0, marginBottom: "8px" }}>Missing Clerk publishable key</h2>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>api-tester-dashboard/frontend/.env</code>, then restart Vite or recreate Docker containers.
        </p>
      </div>
    </div>,
  );
} else {
  createRoot(document.getElementById("root")!).render(
    <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
      <App />
    </ClerkProvider>,
  );
}
