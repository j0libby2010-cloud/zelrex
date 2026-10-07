"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/* A real product tour: it highlights the actual buttons in the app, one at a time, and explains each in a sentence.
   Targets are found by a `data-tour="name"` attribute on the real element, so the tour can't drift from the UI:
   if a target isn't on screen (collapsed sidebar, small screen, feature hidden) the step still shows, centred, without a spotlight.

   Keys: Right arrow = next, Left arrow = back, Esc = skip, Enter = next (or presses the focused button). Clicks outside the card are ignored so nobody ends the tour by accident. */

const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* ── Icons: drawn for this tour, 1.5px stroke, same family as the rest of the app ─────────────── */
export type TourIcon = "welcome" | "chat" | "business" | "outreach" | "clients" | "analytics" | "summaries" | "goal" | "settings";

const ICONS: Record<TourIcon, React.ReactNode> = {
  /* the Zelrex Z */
  welcome: <path d="M6 6.5h12L6 17.5h12" />,
  /* speech bubble with a text line */
  chat: <><path d="M5 6.5A1.5 1.5 0 016.5 5h11A1.5 1.5 0 0119 6.5v8a1.5 1.5 0 01-1.5 1.5H11l-3.6 3v-3H6.5A1.5 1.5 0 015 14.5z" /><path d="M8.5 9.5h7M8.5 12.2h4" /></>,
  /* a folder-like card with a plus */
  business: <><rect x="4.5" y="5" width="15" height="14" rx="2.5" /><path d="M12 9v6M9 12h6" /></>,
  /* paper plane */
  outreach: <><path d="M20 4L10.2 13.8" /><path d="M20 4l-6.2 16-3.6-6.2L4 10.2z" /></>,
  /* person */
  clients: <><circle cx="12" cy="8.5" r="3.2" /><path d="M5.5 19.5c.6-3.3 3.2-5.2 6.5-5.2s5.9 1.9 6.5 5.2" /></>,
  /* rising line over a baseline */
  analytics: <><path d="M4.5 19.5h15" /><path d="M5.5 15.5l4-4.5 3 2.8 5.5-6.3" /><path d="M14.5 7.5h4v4" /></>,
  /* a page with lines and a corner */
  summaries: <><path d="M7 4.5h7.2L18 8.3V18a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 18V6A1.5 1.5 0 017 4.5z" /><path d="M14 4.8V9h4M9 12.5h6M9 15.5h4" /></>,
  /* target rings */
  goal: <><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="3.5" /><path d="M12 4.5V2.8M12 21.2v-1.7M4.5 12H2.8M21.2 12h-1.7" /></>,
  /* two sliders: settings without the stock gear */
  settings: <><path d="M4.5 8h8M16.5 8h3M4.5 16h3M11.5 16h8" /><circle cx="14.5" cy="8" r="2" /><circle cx="9.5" cy="16" r="2" /></>,
};

function Icon({ name, size = 20 }: { name: TourIcon; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/* ── Steps ─────────────────────────────────────────────────────────────────────────────────── */
export type TourStep = {
  id: string;
  /** Value of the `data-tour` attribute on the element to highlight. Omit for a centred step. */
  target?: string;
  title: string;
  body: string;
  icon: TourIcon;
  /** The target lives in the sidebar, so the app should show the sidebar for this step. */
  needsSidebar?: boolean;
};

export const DEFAULT_STEPS: TourStep[] = [
  { id: "welcome", icon: "welcome", title: "Welcome to Zelrex", body: "This takes about a minute. We'll point at the parts of the app you'll use most, so you know where everything is." },
  { id: "composer", target: "composer", icon: "chat", title: "Start by talking", body: "Tell Zelrex what you do and who you want to work with. Ask it to size up your market, plan your first offer, or build your website." },
  { id: "business", target: "new-business", icon: "business", title: "One chat per business", body: "Each business gets its own chat and its own history. Start a new one here, and switch between them in the list below.", needsSidebar: true },
  { id: "outreach", target: "outreach", icon: "outreach", title: "Find your first clients", body: "Outreach finds prospects in your niche and drafts the messages. You read them and send them yourself.", needsSidebar: true },
  { id: "clients", target: "clients", icon: "clients", title: "Keep your clients in one place", body: "Track clients, projects, invoices and contracts, so nothing depends on a spreadsheet or your memory.", needsSidebar: true },
  { id: "analytics", target: "analytics", icon: "analytics", title: "See who visits your site", body: "Once your website is live, this shows visits, your top pages, and where visitors come from.", needsSidebar: true },
  { id: "summaries", target: "summaries", icon: "summaries", title: "A review of your week", body: "Weekly Summaries looks back at what happened in your business and suggests what to focus on next.", needsSidebar: true },
  { id: "goal", target: "goal", icon: "goal", title: "Say what you're working toward", body: "Set a goal and Zelrex checks its advice against it. You can change it whenever your plans change.", needsSidebar: true },
  { id: "settings", target: "settings", icon: "settings", title: "Make it yours", body: "Settings has your reply style, notifications and account. You can replay this tour from Help & legal.", needsSidebar: true },
];

/* ── Geometry ───────────────────────────────────────────────────────────────────────────────── */
type Rect = { top: number; left: number; width: number; height: number; radius: number };
const PAD = 6;      /* breathing room around the highlighted element */
const CARD_W = 344;
const GAP = 14;     /* distance between the spotlight and the card */
const EDGE = 16;    /* minimum distance from the viewport edge */

/** The first element with this data-tour name that is actually visible. (A name can exist twice, e.g. desktop and mobile.) */
function findTarget(name: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none") return el;
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const br = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8;
  const radius = Math.min(br, Math.min(r.width, r.height) / 2) + PAD;
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2, radius };
}

/** Where the card goes. Beside the target when there is room, otherwise above or below it. Pure, so it can be tested. */
export function placeCard(rect: Rect | null, vw: number, vh: number, cardH: number): { top: number; left: number; mode: "center" | "side" | "above" | "below" | "dock-top" | "dock-bottom" } {
  const mobile = vw < 640;
  const w = mobile ? vw - EDGE * 2 : CARD_W;
  if (!rect) return { top: Math.max(EDGE, (vh - cardH) / 2), left: (vw - w) / 2, mode: "center" };
  const clampTop = (t: number) => Math.min(Math.max(EDGE, t), vh - cardH - EDGE);
  if (mobile) {
    /* A phone has no room beside anything: dock the card to whichever edge the target isn't near. */
    const targetMid = rect.top + rect.height / 2;
    return targetMid > vh / 2 ? { top: EDGE, left: EDGE, mode: "dock-top" } : { top: vh - cardH - EDGE, left: EDGE, mode: "dock-bottom" };
  }
  const right = rect.left + rect.width + GAP;
  if (right + w + EDGE <= vw) return { top: clampTop(rect.top + rect.height / 2 - cardH / 2), left: right, mode: "side" };
  const leftOf = rect.left - GAP - w;
  const centreLeft = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - w / 2), vw - w - EDGE);
  if (rect.top - GAP - cardH >= EDGE) return { top: rect.top - GAP - cardH, left: centreLeft, mode: "above" };
  if (rect.top + rect.height + GAP + cardH + EDGE <= vh) return { top: rect.top + rect.height + GAP, left: centreLeft, mode: "below" };
  if (leftOf >= EDGE) return { top: clampTop(rect.top + rect.height / 2 - cardH / 2), left: leftOf, mode: "side" };
  return { top: Math.max(EDGE, (vh - cardH) / 2), left: (vw - w) / 2, mode: "center" };
}

/* ── Component ──────────────────────────────────────────────────────────────────────────────── */
export function ProductTour({ steps = DEFAULT_STEPS, onClose, onStepChange, startAt = 0 }: {
  steps?: TourStep[];
  /** `completed` is true when the person reached the last step and pressed Done, false when they skipped. */
  onClose: (completed: boolean) => void;
  /** Fires whenever a step becomes current, before it is measured, so the app can open the sidebar. */
  onStepChange?: (step: TourStep, index: number) => void;
  startAt?: number;
}) {
  const [i, setI] = useState(Math.min(Math.max(0, startAt), steps.length - 1));
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: typeof window === "undefined" ? 1280 : window.innerWidth, h: typeof window === "undefined" ? 800 : window.innerHeight });
  const [cardH, setCardH] = useState(220);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;
  const first = i === 0;

  const onStepChangeRef = useRef(onStepChange);
  useEffect(() => { onStepChangeRef.current = onStepChange; });

  const next = useCallback(() => { if (last) onClose(true); else setI((n) => Math.min(n + 1, steps.length - 1)); }, [last, onClose, steps.length]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);
  const skip = useCallback(() => onClose(false), [onClose]);

  /* Tell the app which step is current (it may need to open the sidebar). */
  useEffect(() => { onStepChangeRef.current?.(step, i); }, [step, i]);

  /* Find and track the target. It can take a moment to appear (sidebar sliding open), so poll for a second, then follow resizes and scrolls. */
  useLayoutEffect(() => {
    let raf = 0, stopped = false, el: HTMLElement | null = null;
    const started = performance.now();
    const update = () => {
      if (stopped) return;
      if (!step.target) { setRect(null); return; }
      el = findTarget(step.target);
      if (el) {
        const r = measure(el);
        setRect((p) => (p && Math.abs(p.top - r.top) < 0.5 && Math.abs(p.left - r.left) < 0.5 && Math.abs(p.width - r.width) < 0.5 && Math.abs(p.height - r.height) < 0.5 ? p : r));
      } else setRect(null);
    };
    const poll = () => { update(); if (!stopped && performance.now() - started < 1000) raf = requestAnimationFrame(poll); };
    /* Make sure the target is on screen before measuring (e.g. a sidebar button below the fold). */
    const initial = step.target ? findTarget(step.target) : null;
    initial?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    poll();
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); update(); };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", update, true);
    return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("scroll", update, true); };
  }, [step]);

  /* Measure the card so it can be placed without overflowing. */
  useLayoutEffect(() => {
    const h = cardRef.current?.offsetHeight;
    if (h && Math.abs(h - cardH) > 1) setCardH(h);
  }, [i, vp.w, rect, cardH]);

  /* Keyboard. Registered on window so it works wherever focus is; the dialog is modal, so nothing underneath should react. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); skip(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      else if (e.key === "Enter") {
        /* Focus rests on the card itself (no ring around a button), so Enter means "next". On a focused button, Enter presses that button. */
        if (!(document.activeElement instanceof HTMLButtonElement)) { e.preventDefault(); next(); }
      }
      else if (e.key === "Tab") {
        const f = cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f || f.length === 0) return;
        const a = f[0], z = f[f.length - 1], cur = document.activeElement;
        if (cur === cardRef.current || !cardRef.current?.contains(cur)) { e.preventDefault(); (e.shiftKey ? z : a).focus(); }
        else if (e.shiftKey && cur === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && cur === z) { e.preventDefault(); a.focus(); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, back, skip]);

  /* Keep focus inside the dialog: on the card itself at each step, so screen readers announce the new title and Enter advances. */
  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, [i]);

  const place = useMemo(() => placeCard(rect, vp.w, vp.h, cardH), [rect, vp.w, vp.h, cardH]);
  const mobile = vp.w < 640;
  const cardW = mobile ? vp.w - EDGE * 2 : CARD_W;
  const centered = place.mode === "center";

  return (
    <div className="pt-root" role="dialog" aria-modal="true" aria-labelledby="pt-title" aria-describedby="pt-body" style={{ position: "fixed", inset: 0, zIndex: 9600, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        .pt-root,.pt-root *{box-sizing:border-box}
        @keyframes pt-in{from{opacity:0}to{opacity:1}}
        @keyframes pt-card{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .pt-spot{position:absolute;pointer-events:none;border:1px solid rgba(74,144,255,0.55);transition:top 320ms ${EASE},left 320ms ${EASE},width 320ms ${EASE},height 320ms ${EASE},border-radius 320ms ${EASE}}
        .pt-card{position:absolute;background:${C.bgElevated};border:1px solid ${C.borderHover};border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.55);transition:top 320ms ${EASE},left 320ms ${EASE}}
        .pt-card:focus{outline:none}
        .pt-card-inner{animation:pt-card 220ms ${EASE} both}
        .pt-btn{height:36px;padding:0 16px;border-radius:999px;border:1px solid ${C.borderHover};background:none;color:${C.text};font-size:13.5px;font-weight:500;font-family:inherit;cursor:pointer;transition:background 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE};white-space:nowrap}
        .pt-btn:hover{background:rgba(255,255,255,0.05)}
        .pt-primary{border-color:${C.accent};background:${C.accent};color:#fff;font-weight:600}
        .pt-primary:hover{background:#5B9BFF;border-color:#5B9BFF}
        .pt-link{height:36px;padding:0 4px;border:none;background:none;color:${C.textSec};font-size:13px;font-weight:500;font-family:inherit;cursor:pointer;transition:color 150ms ${EASE}}
        .pt-link:hover{color:${C.text}}
        .pt-btn:focus-visible,.pt-link:focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
        @media (prefers-reduced-motion:reduce){.pt-spot,.pt-card{transition:none}.pt-card-inner{animation:none}}
      `}</style>

      {/* Catches every click so the app underneath can't be used mid-tour; deliberately does NOT end the tour. */}
      <div style={{ position: "absolute", inset: 0, background: rect ? "transparent" : "rgba(3,6,12,0.78)", animation: `pt-in 240ms ${EASE} both` }} />

      {/* The spotlight is a box whose shadow covers the rest of the screen. */}
      {rect && (
        <div className="pt-spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: rect.radius, boxShadow: "0 0 0 9999px rgba(3,6,12,0.78)" }} />
      )}

      <div ref={cardRef} className="pt-card" tabIndex={-1} style={{ top: place.top, left: place.left, width: cardW }}>
        <div className="pt-card-inner" key={step.id} style={{ padding: centered && !rect ? "26px 24px 20px" : "20px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name={step.icon} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, fontVariantNumeric: "tabular-nums" }} aria-label={`Step ${i + 1} of ${steps.length}`}>{i + 1} / {steps.length}</span>
          </div>
          <h2 id="pt-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25, color: C.text }}>{step.title}</h2>
          <p id="pt-body" style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.6, color: C.textSec }}>{step.body}</p>

          {/* Progress: one segment per step, filled up to the current one. */}
          <div style={{ display: "flex", gap: 3, margin: "20px 0 16px" }} aria-hidden>
            {steps.map((s, k) => (
              <div key={s.id} style={{ flex: 1, height: 2, borderRadius: 2, background: k <= i ? C.accent : "rgba(255,255,255,0.10)", transition: `background 240ms ${EASE}` }} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {last ? <span /> : <button type="button" className="pt-link" onClick={skip}>Skip tour</button>}
            <div style={{ display: "flex", gap: 8 }}>
              {!first && <button type="button" className="pt-btn" onClick={back}>Back</button>}
              <button type="button" className="pt-btn pt-primary" onClick={next}>{first ? "Start" : last ? "Done" : "Next"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
