/**
 * ZELREX PROGRESS TRACKER
 * 
 * Tracks user milestones from evaluation → first client → revenue goals.
 * Generates shareable progress cards for word-of-mouth growth.
 * 
 * Storage: Vercel KV (will migrate to Postgres in v2)
 * Key pattern: progress:{userId}
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface Milestone {
  key: string;
  label: string;
  date: string | null;      // ISO date when achieved, null if not yet
  userReported: boolean;     // true = user told us, false = system detected
}

export interface BusinessProgress {
  userId: string;
  businessCategory: "video-editing" | "design" | "writing" | "social-media" | "virtual-assistance" | "coaching" | "consulting" | "agency" | "other";
  businessName?: string;
  startedAt: string;         // ISO date of first evaluation
  
  // Milestones
  milestones: Milestone[];
  
  // Revenue tracking (user-reported)
  revenueReports: Array<{
    date: string;
    amount: number;
    clients: number;
    note?: string;
  }>;
  
  // Commitments
  commitments: Array<{
    action: string;
    givenAt: string;
    dueBy: string;
    status: "pending" | "done" | "missed" | "skipped";
    reportedAt?: string;
  }>;
  
  // Check-in history
  checkIns: Array<{
    date: string;
    weekNumber: number;
    focusGiven: string;
    commitmentsGiven: string[];
  }>;
  
  // Warning flags triggered
  warningsTriggered: string[];
  
  // Sharing
  shareEnabled: boolean;
  shareSlug?: string;        // e.g., "sarah-design-47d"
}

// ═══════════════════════════════════════════════════════════════════════
// DEFAULT MILESTONES
// ═══════════════════════════════════════════════════════════════════════

export function createDefaultMilestones(): Milestone[] {
  return [
    { key: "evaluation",       label: "Market evaluation completed",  date: null, userReported: false },
    { key: "website",          label: "Website built",                date: null, userReported: false },
    { key: "first-outreach",   label: "First outreach sent",         date: null, userReported: true },
    { key: "first-response",   label: "First response received",     date: null, userReported: true },
    { key: "first-call",       label: "First client conversation",   date: null, userReported: true },
    { key: "first-client",     label: "First paying client",         date: null, userReported: true },
    { key: "revenue-1k",       label: "First $1,000 month",          date: null, userReported: true },
    { key: "revenue-5k",       label: "First $5,000 month",          date: null, userReported: true },
    { key: "revenue-10k",      label: "First $10,000 month",         date: null, userReported: true },
    { key: "platform-free",    label: "Fully off platforms",         date: null, userReported: true },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS CREATION
// ═══════════════════════════════════════════════════════════════════════

export function createBusinessProgress(
  userId: string,
  category: BusinessProgress["businessCategory"],
  businessName?: string
): BusinessProgress {
  return {
    userId,
    businessCategory: category,
    businessName,
    startedAt: new Date().toISOString(),
    milestones: createDefaultMilestones(),
    revenueReports: [],
    commitments: [],
    checkIns: [],
    warningsTriggered: [],
    shareEnabled: false,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MILESTONE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

export function markMilestone(
  progress: BusinessProgress,
  key: string,
  date?: string
): BusinessProgress {
  const updated = { ...progress };
  updated.milestones = updated.milestones.map((m) =>
    m.key === key && !m.date
      ? { ...m, date: date || new Date().toISOString() }
      : m
  );
  return updated;
}

export function getNextMilestone(progress: BusinessProgress): Milestone | null {
  return progress.milestones.find((m) => !m.date) || null;
}

export function getCompletedMilestones(progress: BusinessProgress): Milestone[] {
  return progress.milestones.filter((m) => m.date !== null);
}

export function getDaysSinceStart(progress: BusinessProgress): number {
  return Math.floor(
    (Date.now() - new Date(progress.startedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMMITMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

export function addCommitments(
  progress: BusinessProgress,
  actions: string[],
  dueInDays: number = 7
): BusinessProgress {
  const dueBy = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString();
  const newCommitments = actions.map((action) => ({
    action,
    givenAt: new Date().toISOString(),
    dueBy,
    status: "pending" as const,
  }));
  
  return {
    ...progress,
    commitments: [...progress.commitments, ...newCommitments],
  };
}

export function getPendingCommitments(progress: BusinessProgress): BusinessProgress["commitments"] {
  return progress.commitments.filter((c) => c.status === "pending");
}

export function markCommitmentDone(
  progress: BusinessProgress,
  index: number
): BusinessProgress {
  const updated = { ...progress };
  const pending = updated.commitments.filter((c) => c.status === "pending");
  if (pending[index]) {
    pending[index].status = "done";
    pending[index].reportedAt = new Date().toISOString();
  }
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════
// REVENUE TRACKING
// ═══════════════════════════════════════════════════════════════════════

export function addRevenueReport(
  progress: BusinessProgress,
  amount: number,
  clients: number,
  note?: string
): BusinessProgress {
  const updated = { ...progress };
  updated.revenueReports.push({
    date: new Date().toISOString(),
    amount,
    clients,
    note,
  });
  
  // Auto-mark revenue milestones
  const totalThisMonth = amount; // Simplified — in production, aggregate by month
  if (totalThisMonth >= 1000 && !updated.milestones.find((m) => m.key === "revenue-1k")?.date) {
    updated.milestones = updated.milestones.map((m) =>
      m.key === "revenue-1k" ? { ...m, date: new Date().toISOString() } : m
    );
  }
  if (totalThisMonth >= 5000 && !updated.milestones.find((m) => m.key === "revenue-5k")?.date) {
    updated.milestones = updated.milestones.map((m) =>
      m.key === "revenue-5k" ? { ...m, date: new Date().toISOString() } : m
    );
  }
  if (totalThisMonth >= 10000 && !updated.milestones.find((m) => m.key === "revenue-10k")?.date) {
    updated.milestones = updated.milestones.map((m) =>
      m.key === "revenue-10k" ? { ...m, date: new Date().toISOString() } : m
    );
  }
  
  // Auto-mark first client if revenue > 0 and milestone not yet hit
  if (clients > 0 && !updated.milestones.find((m) => m.key === "first-client")?.date) {
    updated.milestones = updated.milestones.map((m) =>
      m.key === "first-client" ? { ...m, date: new Date().toISOString() } : m
    );
  }
  
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════
// CHECK-IN RECORDING
// ═══════════════════════════════════════════════════════════════════════

export function recordCheckIn(
  progress: BusinessProgress,
  focus: string,
  commitments: string[]
): BusinessProgress {
  const weekNumber = Math.ceil(getDaysSinceStart(progress) / 7);
  return {
    ...progress,
    checkIns: [
      ...progress.checkIns,
      {
        date: new Date().toISOString(),
        weekNumber,
        focusGiven: focus,
        commitmentsGiven: commitments,
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SHARE CARD GENERATION
// ═══════════════════════════════════════════════════════════════════════

export function generateShareData(progress: BusinessProgress): {
  canShare: boolean;
  shareCard: {
    businessCategory: string;
    daysSinceStart: number;
    milestonesCompleted: number;
    totalMilestones: number;
    latestMilestone: string | null;
    totalRevenue: number;
    totalClients: number;
    checkInsCompleted: number;
  } | null;
} {
  const completed = getCompletedMilestones(progress);
  
  // Need at least 1 milestone to share
  if (completed.length === 0) {
    return { canShare: false, shareCard: null };
  }
  
  const totalRevenue = progress.revenueReports.reduce((sum, r) => sum + r.amount, 0);
  const totalClients = progress.revenueReports.reduce((max, r) => Math.max(max, r.clients), 0);
  
  return {
    canShare: true,
    shareCard: {
      businessCategory: formatCategory(progress.businessCategory),
      daysSinceStart: getDaysSinceStart(progress),
      milestonesCompleted: completed.length,
      totalMilestones: progress.milestones.length,
      latestMilestone: completed[completed.length - 1]?.label || null,
      totalRevenue,
      totalClients,
      checkInsCompleted: progress.checkIns.length,
    },
  };
}

function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    "video-editing": "Video Editing",
    "design": "Design",
    "writing": "Writing & Copywriting",
    "social-media": "Social Media Management",
    "virtual-assistance": "Virtual Assistance",
    "coaching": "Coaching",
    "consulting": "Consulting",
    "agency": "Agency",
    "other": "Service Business",
  };
  return map[cat] || "Service Business";
}

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS SUMMARY (for Zelrex to reference in conversations)
// ═══════════════════════════════════════════════════════════════════════

export function generateProgressSummary(progress: BusinessProgress): string {
  const days = getDaysSinceStart(progress);
  const completed = getCompletedMilestones(progress);
  const next = getNextMilestone(progress);
  const pending = getPendingCommitments(progress);
  const latestRevenue = progress.revenueReports[progress.revenueReports.length - 1];
  const totalRevenue = progress.revenueReports.reduce((s, r) => s + r.amount, 0);
  const weekNum = Math.ceil(days / 7);
  
  const lines: string[] = [];
  
  lines.push(`**Week ${weekNum}** · Day ${days} since evaluation`);
  lines.push("");
  
  // Milestones
  lines.push(`**Milestones:** ${completed.length}/${progress.milestones.length}`);
  for (const m of completed) {
    const daysAgo = Math.floor((Date.now() - new Date(m.date!).getTime()) / (1000 * 60 * 60 * 24));
    lines.push(`  ✓ ${m.label} (${daysAgo === 0 ? "today" : daysAgo + "d ago"})`);
  }
  if (next) {
    lines.push(`  → Next: ${next.label}`);
  }
  lines.push("");
  
  // Revenue
  if (totalRevenue > 0) {
    lines.push(`**Revenue:** $${totalRevenue.toLocaleString()} total`);
    if (latestRevenue) {
      lines.push(`  Latest report: $${latestRevenue.amount} (${latestRevenue.clients} client${latestRevenue.clients !== 1 ? "s" : ""})`);
    }
  } else {
    lines.push("**Revenue:** No revenue reported yet");
  }
  lines.push("");
  
  // Pending commitments
  if (pending.length > 0) {
    lines.push(`**Open commitments:** ${pending.length}`);
    for (const c of pending) {
      const overdue = new Date(c.dueBy) < new Date();
      lines.push(`  ${overdue ? "⚠️" : "○"} ${c.action}${overdue ? " (OVERDUE)" : ""}`);
    }
  }
  
  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// MESSAGE PARSING — detect milestones and revenue from user messages
// ═══════════════════════════════════════════════════════════════════════

export function detectMilestonesInMessage(
  message: string,
  progress: BusinessProgress
): { milestonesReached: string[]; revenueDetected: number | null; clientsDetected: number | null } {
  const lower = message.toLowerCase();
  const reached: string[] = [];
  
  // First outreach
  if (lower.match(/sent.*(message|email|dm|outreach|pitch)|reached out|contacted.*client/)) {
    if (!progress.milestones.find((m) => m.key === "first-outreach")?.date) {
      reached.push("first-outreach");
    }
  }
  
  // First response
  if (lower.match(/got a (reply|response)|someone (replied|responded|got back)|heard back/)) {
    if (!progress.milestones.find((m) => m.key === "first-response")?.date) {
      reached.push("first-response");
    }
  }
  
  // First call
  if (lower.match(/had a call|booked a call|discovery call|talked to.*client|met with.*client/)) {
    if (!progress.milestones.find((m) => m.key === "first-call")?.date) {
      reached.push("first-call");
    }
  }
  
  // First client
  if (lower.match(/first (paying )?client|got (my |a )?(first )?client|someone (paid|hired)|landed.*(client|project|gig)/)) {
    if (!progress.milestones.find((m) => m.key === "first-client")?.date) {
      reached.push("first-client");
    }
  }
  
  // Platform free
  if (lower.match(/deleted.*(upwork|fiverr)|left.*(upwork|fiverr)|off.*(platforms?|upwork|fiverr)|quit.*(upwork|fiverr)/)) {
    if (!progress.milestones.find((m) => m.key === "platform-free")?.date) {
      reached.push("platform-free");
    }
  }
  
  // Revenue detection
  let revenueDetected: number | null = null;
  const revMatch = lower.match(/(?:made|earned|got|received|invoiced|billed)\s*\$?([\d,]+)/);
  if (revMatch) {
    revenueDetected = parseInt(revMatch[1].replace(/,/g, ""));
  }
  
  // Client count detection
  let clientsDetected: number | null = null;
  const clientMatch = lower.match(/(\d+)\s*(clients?|customers?|projects?)/);
  if (clientMatch) {
    clientsDetected = parseInt(clientMatch[1]);
  }
  
  return { milestonesReached: reached, revenueDetected, clientsDetected };
}
