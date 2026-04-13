// @ts-nocheck
"use client";
import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

const C = {
  bg: "#06090F", text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.30)", accent: "#4A90FF", border: "rgba(255,255,255,0.07)", red: "#EF4444",
};

export class ZelrexErrorBoundary extends React.Component<
  { children: React.ReactNode; userId?: string },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const info = errorInfo.componentStack || "";
    this.setState({ errorInfo: info });

    // Log error to API
    try {
      fetch("/api/z/error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: this.props.userId || "unknown",
          error: error.message,
          stack: error.stack?.slice(0, 2000) || "",
          componentStack: info.slice(0, 1000),
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {}

    console.error("[Zelrex Error Boundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", background: C.bg, display: "flex",
          alignItems: "center", justifyContent: "center", padding: 24,
          fontFamily: "-apple-system, 'Inter', sans-serif",
        }}>
          <div style={{
            maxWidth: 480, width: "100%", textAlign: "center",
            background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
            borderRadius: 20, padding: "48px 32px",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px",
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>⚠</div>

            <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>
              Something went wrong
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
              Zelrex encountered an unexpected error. This has been logged automatically.
            </p>

            {/* Error details (collapsed) */}
            <details style={{ textAlign: "left", marginBottom: 24 }}>
              <summary style={{ fontSize: 12, color: C.textMuted, cursor: "pointer", marginBottom: 8 }}>
                Error details
              </summary>
              <div style={{
                padding: "12px 14px", borderRadius: 10, background: "rgba(239,68,68,0.04)",
                border: `1px solid rgba(239,68,68,0.1)`, fontSize: 11, fontFamily: "monospace",
                color: C.red, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all",
                maxHeight: 200, overflow: "auto",
              }}>
                {this.state.error?.message || "Unknown error"}
                {this.state.errorInfo && `\n\nComponent stack:${this.state.errorInfo.slice(0, 500)}`}
              </div>
            </details>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "12px 28px", borderRadius: 12, border: "none",
                  background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", letterSpacing: "-0.01em",
                }}
              >
                Reload Zelrex
              </button>
              <button
                onClick={() => { this.setState({ hasError: false, error: null, errorInfo: "" }); }}
                style={{
                  padding: "12px 28px", borderRadius: 12,
                  border: `1px solid ${C.border}`, background: "transparent",
                  color: C.textSec, fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}