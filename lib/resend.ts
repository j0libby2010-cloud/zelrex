/**
 * ZELREX EMAIL SERVICE (Resend)
 * 
 * Handles all transactional email from Zelrex:
 * - Weekly business reports
 * - Goal milestone notifications
 * - Market alerts
 * - Product updates
 * 
 * SETUP:
 * 1. Sign up at resend.com (free tier = 3000 emails/month, 100/day)
 * 2. Add your domain (zelrex.ai) in Resend dashboard
 * 3. Verify DNS records (SPF, DKIM, return-path)
 * 4. Run: npm install resend
 * 5. Add env vars in Vercel:
 *    - RESEND_API_KEY (from Resend dashboard)
 *    - FROM_EMAIL=Zelrex <hello@zelrex.ai>
 *    - REPLY_TO_EMAIL=support@zelrex.ai (optional)
 * 
 * USAGE:
 * import { sendEmail } from '@/lib/resend';
 * await sendEmail({ to, subject, html, text });
 */

import { captureError } from './sentry';

// Lazy-load Resend
let Resend: any = null;
try {
  const resendModule = require('resend');
  Resend = resendModule.Resend;
} catch {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Resend] resend package not installed — email service disabled');
  }
}

const resend = Resend && process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'Zelrex <hello@zelrex.ai>';
const REPLY_TO = process.env.REPLY_TO_EMAIL;

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      reply_to: options.replyTo || REPLY_TO,
      tags: options.tags,
    });

    if (result.error) {
      captureError(new Error(result.error.message || 'Email send failed'), {
        action: 'send-email',
        metadata: { to: options.to, subject: options.subject },
      });
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (err) {
    captureError(err, {
      action: 'send-email',
      metadata: { to: options.to, subject: options.subject },
    });
    return { success: false, error: (err as Error).message };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Email Templates ─────────────────────────────────────────────

const BASE_STYLES = `
  body { margin: 0; padding: 0; background: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e5e5e5; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; }
  .logo { font-size: 28px; font-weight: 700; letter-spacing: 0.1em; color: #fff; margin-bottom: 8px; font-style: italic; }
  .tagline { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 32px; letter-spacing: 0.05em; text-transform: uppercase; }
  h1 { font-size: 22px; color: #fff; margin: 0 0 16px; font-weight: 500; }
  h2 { font-size: 17px; color: #fff; margin: 24px 0 12px; font-weight: 500; }
  p { line-height: 1.6; margin: 0 0 16px; font-size: 15px; }
  .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(90deg, #6366f1, #8b5cf6); color: #fff !important; text-decoration: none; border-radius: 10px; font-weight: 500; margin: 16px 0; }
  .stat { display: inline-block; padding: 12px 16px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; margin: 4px 8px 4px 0; }
  .stat-num { font-size: 20px; font-weight: 600; color: #fff; display: block; }
  .stat-label { font-size: 11px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 0.05em; }
  .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; }
  .footer a { color: rgba(255,255,255,0.6); text-decoration: none; }
  ul { padding-left: 20px; line-height: 1.7; }
  .divider { height: 1px; background: rgba(255,255,255,0.08); margin: 24px 0; }
`;

function wrapEmail(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${BASE_STYLES}</style>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">ZELREX</div>
      <div class="tagline">AI Business Engine</div>
      ${content}
    </div>
    <div class="footer">
      You received this because you enabled this notification in Zelrex.<br>
      <a href="https://zelrex.ai/chat?tab=settings">Manage email preferences</a> · <a href="https://zelrex.ai">Open Zelrex</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── Weekly Report Email ─────────────────────────────────────────

export interface WeeklyReportData {
  userName: string;
  weekStart: string;
  weekEnd: string;
  revenue: number;
  revenueChange: number;
  newClients: number;
  invoicesPaid: number;
  outreachSent: number;
  replyRate: number;
  topInsight: string;
  nextAction: string;
}

export async function sendWeeklyReport(to: string, data: WeeklyReportData) {
  const revChange = data.revenueChange > 0 ? `+${data.revenueChange}%` : `${data.revenueChange}%`;
  const content = `
    <h1>Your week in review</h1>
    <p>Hey ${data.userName}, here's how your business performed from ${data.weekStart} to ${data.weekEnd}.</p>
    
    <div style="margin: 24px 0;">
      <div class="stat">
        <span class="stat-num">$${data.revenue.toLocaleString()}</span>
        <span class="stat-label">Revenue (${revChange})</span>
      </div>
      <div class="stat">
        <span class="stat-num">${data.newClients}</span>
        <span class="stat-label">New clients</span>
      </div>
      <div class="stat">
        <span class="stat-num">${data.invoicesPaid}</span>
        <span class="stat-label">Invoices paid</span>
      </div>
      <div class="stat">
        <span class="stat-num">${data.outreachSent}</span>
        <span class="stat-label">Outreach sent</span>
      </div>
      <div class="stat">
        <span class="stat-num">${data.replyRate}%</span>
        <span class="stat-label">Reply rate</span>
      </div>
    </div>

    <h2>What I'm seeing</h2>
    <p>${data.topInsight}</p>

    <h2>What to focus on this week</h2>
    <p>${data.nextAction}</p>

    <a href="https://zelrex.ai/chat" class="btn">Open Zelrex</a>
  `;

  return sendEmail({
    to,
    subject: `Your Zelrex week: ${revChange} revenue · ${data.newClients} new clients`,
    html: wrapEmail(content, `Revenue ${revChange} this week, ${data.newClients} new clients, ${data.replyRate}% reply rate on outreach.`),
    tags: [{ name: 'type', value: 'weekly_report' }],
  });
}

// ─── Goal Milestone Email ────────────────────────────────────────

export async function sendMilestoneEmail(to: string, userName: string, milestone: string, nextMilestone: string) {
  const content = `
    <h1>Milestone reached: ${milestone}</h1>
    <p>${userName}, you hit a big one. This is one of the 10 stages that takes a freelancer from stuck on platforms to running a real independent business.</p>
    
    <div class="divider"></div>
    
    <h2>What's next</h2>
    <p>${nextMilestone}</p>

    <a href="https://zelrex.ai/chat" class="btn">Keep building</a>
  `;

  return sendEmail({
    to,
    subject: `🎯 Milestone reached: ${milestone}`,
    html: wrapEmail(content),
    tags: [{ name: 'type', value: 'milestone' }],
  });
}

// ─── Market Alert Email ──────────────────────────────────────────

export async function sendMarketAlertEmail(to: string, userName: string, niche: string, alert: string, opportunity: string) {
  const content = `
    <h1>Market alert: ${niche}</h1>
    <p>${userName}, something shifted in your market. Here's what I'm seeing.</p>
    
    <h2>What changed</h2>
    <p>${alert}</p>

    <h2>What this means for you</h2>
    <p>${opportunity}</p>

    <a href="https://zelrex.ai/chat" class="btn">Discuss in Zelrex</a>
  `;

  return sendEmail({
    to,
    subject: `Market shift in ${niche} — what to do`,
    html: wrapEmail(content, alert.slice(0, 100)),
    tags: [{ name: 'type', value: 'market_alert' }],
  });
}

// ─── Product Update Email ────────────────────────────────────────

export async function sendProductUpdateEmail(to: string, userName: string, features: { title: string; description: string }[]) {
  const featureHtml = features.map(f => `
    <div style="margin-bottom: 16px;">
      <strong style="color: #fff;">${f.title}</strong>
      <p style="margin-top: 4px;">${f.description}</p>
    </div>
  `).join('');

  const content = `
    <h1>What's new in Zelrex</h1>
    <p>Hey ${userName}, we shipped some new stuff this week.</p>
    
    ${featureHtml}

    <a href="https://zelrex.ai/chat" class="btn">Try the new features</a>
  `;

  return sendEmail({
    to,
    subject: `New in Zelrex: ${features[0]?.title || 'Updates'}`,
    html: wrapEmail(content),
    tags: [{ name: 'type', value: 'product_update' }],
  });
}