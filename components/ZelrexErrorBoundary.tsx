// @ts-nocheck
"use client";
import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
  retryCount: number;
  logSent: boolean;
}

const C = {
  bg: "#06090F", text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.30)", accent: "#4A90FF", border: "rgba(255,255,255,0.07)", red: "#EF4444",
};

// Max retries before suggesting reload
const MAX_RETRIES = 3;

export class ZelrexErrorBoundary extends React.Component<
  { children: React.ReactNode; userId?: string },
  ErrorBoundaryState
> {
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(props: any) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: "",
      retryCount: 0,
      logSent: false,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const info = errorInfo.componentStack || "";
    this.setState({ errorInfo: info });

    // Log error to API with retry (don't let error logging itself fail silently)
    this.logError(error, info);

    console.error("[Zelrex Error Boundary]", error, info);
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
  }

  async logError(error: Error, componentStack: string, attempt = 0): Promise<void> {
    try {
      const response = await fetch("/api/z/error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: this.props.userId || "unknown",
          error: error.message,
          stack: error.stack?.slice(0, 2000) || "",
          componentStack: componentStack.slice(0, 1000),
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          timestamp: new Date().toISOString(),
          retryCount: this.state.retryCount,
          severity: this.state.retryCount >= MAX_RETRIES ? "fatal" : "error",
        }),
      });

      if (response.ok) {
        this.setState({ logSent: true });
      } else if (attempt < 2) {
        // Retry log submission
        setTimeout(() => this.logError(error, componentStack, attempt + 1), 2000);
      }
    } catch {
      if (attempt < 2) {
        setTimeout(() => this.logError(error, componentStack, attempt + 1), 2000);
      }
    }
  }

  handleRetry = () => {
    const newCount = this.state.retryCount + 1;
    
    if (newCount > MAX_RETRIES) {
      // Too many retries — force reload
      window.location.reload();
      return;
    }

    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: "", 
      retryCount: newCount,
      logSent: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleResetState = () => {
    // Nuclear option: clear all localStorage and reload
    if (confirm("This will clear your local settings and reload. Your data in the cloud is safe. Continue?")) {
      try {
        // Only clear Zelrex-related keys, not everything
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('zelrex_')) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
      } catch {}
      window.location.href = '/chat';
    }
  };

  render() {
    if (this.state.hasError) {
      const isReloadRecommended = this.state.retryCount >= MAX_RETRIES;
      
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
              {isReloadRecommended ? "Persistent error" : "Something went wrong"}
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>
              {isReloadRecommended 
                ? "This error keeps happening. Please reload the page — if it continues, try clearing your local settings."
                : "Zelrex encountered an unexpected error."}
            </p>
            {this.state.logSent && (
              <p style={{ margin: "0 0 24px", fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                ✓ This has been logged for investigation
              </p>
            )}
            {!this.state.logSent && (
              <p style={{ margin: "0 0 24px", fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                Attempting to log the error...
              </p>
            )}

            {this.state.retryCount > 0 && (
              <p style={{ margin: "0 0 16px", fontSize: 11, color: C.textMuted }}>
                Retry attempt {this.state.retryCount} of {MAX_RETRIES}
              </p>
            )}

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

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {!isReloadRecommended && (
                <button
                  onClick={this.handleRetry}
                  style={{
                    padding: "12px 28px", borderRadius: 12,
                    border: `1px solid ${C.border}`, background: "transparent",
                    color: C.textSec, fontSize: 14, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Try again
                </button>
              )}
              <button
                onClick={this.handleReload}
                style={{
                  padding: "12px 28px", borderRadius: 12, border: "none",
                  background: C.accent, color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", letterSpacing: "-0.01em",
                }}
              >
                Reload Zelrex
              </button>
              {isReloadRecommended && (
                <button
                  onClick={this.handleResetState}
                  style={{
                    padding: "12px 28px", borderRadius: 12,
                    border: `1px solid rgba(239,68,68,0.2)`, background: "rgba(239,68,68,0.04)",
                    color: C.red, fontSize: 14, fontWeight: 500, cursor: "pointer",
                  }}
                >
                  Clear & restart
                </button>
              )}
            </div>

            <p style={{ margin: "24px 0 0", fontSize: 11, color: C.textMuted, lineHeight: 1.6 }}>
              Still stuck? <a href="/contact" style={{ color: C.accent, textDecoration: "none" }}>Get in touch</a>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}