/**
 * ZELREX OUTREACH INTELLIGENCE
 * 
 * The difference between "AI that writes emails" and "AI marketer that gets replies":
 * 
 * 1. DEEP PERSONALIZATION — not "I saw your company", but reasoning about what they 
 *    actually care about right now based on their website, recent posts, industry signals
 * 2. SEND-TIME INTELLIGENCE — timezone-aware, day-of-week optimized, avoids Mondays and Fridays
 * 3. SUBJECT LINE SCIENCE — tested patterns that beat curiosity gaps and fake urgency
 * 4. OPENING LINE CRAFT — the first 11 words determine reply rate; this gets them right
 * 5. CTA CALIBRATION — matches ask size to trust level; doesn't ask for a call in email 1
 * 6. REPLY-PREDICTION — scores each draft before send; refuses to send low-scoring drafts
 */

import Anthropic from "@anthropic-ai/sdk";

// ─── SUBJECT LINE INTELLIGENCE ───────────────────────────────────

/**
 * Research-backed subject line patterns, ranked by typical reply rate.
 * Source: analysis of hundreds of thousands of B2B cold emails.
 */
export const SUBJECT_PATTERNS = {
  // HIGH REPLY RATE (8-15%)
  mutualConnection: "quick question about {theirCompany}",
  specificObservation: "noticed something about {theirSpecificThing}",
  relevantRef: "{theirCompetitor} and {theirCompany}",
  lowercaseQuestion: "quick q",
  
  // MEDIUM REPLY RATE (4-8%)
  benefitDriven: "{outcome} for {theirCompany}",
  nameReference: "{theirFirstName}?",
  
  // AVOID — these tank reply rates
  avoid: [
    /quick favor/i,
    /would love to (chat|connect)/i,
    /circling back/i,
    /following up/i,
    /just checking in/i,
    /touching base/i,
    /hope this finds you well/i,
    /🚀|🔥|⭐|✨/, // emojis in subject = high spam flag
    /^RE:/i, // fake re: as first message is dishonest + filter-flagged
    /free|discount|offer|sale/i, // spam trigger words
  ],
};

/**
 * Score a subject line 0-100 based on reply-rate research.
 */
export function scoreSubjectLine(subject: string): { score: number; issues: string[]; strengths: string[] } {
  const issues: string[] = [];
  const strengths: string[] = [];
  let score = 50;

  // Length — sweet spot is 3-7 words, 30-50 chars
  const wordCount = subject.trim().split(/\s+/).length;
  const charCount = subject.length;
  
  if (wordCount >= 3 && wordCount <= 7) { score += 10; strengths.push('good length'); }
  else if (wordCount <= 2) { score -= 5; issues.push('too short — may look empty'); }
  else if (wordCount >= 10) { score -= 15; issues.push('too long — gets truncated on mobile'); }
  
  if (charCount > 60) { score -= 10; issues.push('truncated on mobile previews'); }

  // Lowercase scores higher than Title Case (feels more personal)
  const isAllLower = subject === subject.toLowerCase();
  const isTitleCase = /^([A-Z][a-z]*\s*){2,}$/.test(subject);
  if (isAllLower) { score += 10; strengths.push('lowercase feels personal'); }
  else if (isTitleCase) { score -= 5; issues.push('title case feels like marketing'); }

  // Avoid patterns
  for (const pattern of SUBJECT_PATTERNS.avoid) {
    if (pattern.test(subject)) {
      score -= 20;
      issues.push(`contains blocked pattern: ${pattern.source}`);
    }
  }

  // Spam triggers
  if (/!{2,}/.test(subject)) { score -= 15; issues.push('multiple exclamation marks'); }
  if (subject === subject.toUpperCase() && subject.length > 5) { score -= 20; issues.push('all caps'); }
  if (/\$[\d,]+/.test(subject)) { score -= 10; issues.push('dollar amount in subject'); }
  
  // Question marks score well for cold email
  if (subject.endsWith('?')) { score += 5; strengths.push('question invites response'); }
  
  // Specificity — contains a company/name-like proper noun
  if (/[A-Z][a-z]{2,}/.test(subject) && !isTitleCase) {
    score += 10; strengths.push('contains specific reference');
  }

  return { score: Math.max(0, Math.min(100, score)), issues, strengths };
}

// ─── SEND-TIME INTELLIGENCE ──────────────────────────────────────

/**
 * Returns whether this is a good time to send an outreach email.
 * Based on B2B email reply-rate research.
 */
export function isOptimalSendTime(timezone = 'America/New_York'): { optimal: boolean; reason: string; nextGoodTime?: Date } {
  const now = new Date();
  // Get local time in the target timezone
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric', weekday: 'short', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const weekday = parts.find(p => p.type === 'weekday')?.value || '';

  // Weekend — bad. Cold emails on Saturday/Sunday get buried by Monday.
  if (['Sat', 'Sun'].includes(weekday)) {
    return { optimal: false, reason: 'weekend — send Tuesday-Thursday instead', nextGoodTime: nextWeekday(now, 'Tue', 9, timezone) };
  }
  
  // Monday morning — inbox overflow, emails get marked read without reply
  if (weekday === 'Mon' && hour < 10) {
    return { optimal: false, reason: 'Monday morning inbox overflow — wait until 10am or Tuesday' };
  }

  // Friday afternoon — people mentally checked out
  if (weekday === 'Fri' && hour >= 14) {
    return { optimal: false, reason: 'Friday afternoon — send Tuesday instead', nextGoodTime: nextWeekday(now, 'Tue', 9, timezone) };
  }

  // Best window: Tuesday/Wednesday/Thursday, 9am-11am or 1pm-3pm local
  const isPrimeDay = ['Tue', 'Wed', 'Thu'].includes(weekday);
  const isPrimeHour = (hour >= 9 && hour <= 11) || (hour >= 13 && hour <= 15);
  
  if (isPrimeDay && isPrimeHour) {
    return { optimal: true, reason: 'prime sending window' };
  }

  // Outside prime window but still workable
  if (hour >= 8 && hour <= 17 && !['Sat', 'Sun'].includes(weekday)) {
    return { optimal: true, reason: 'acceptable business hours' };
  }

  // Late night / very early
  if (hour < 8 || hour > 18) {
    const nextMorn = new Date(now);
    nextMorn.setHours(9, 0, 0, 0);
    if (nextMorn < now) nextMorn.setDate(nextMorn.getDate() + 1);
    return { optimal: false, reason: 'outside business hours — schedule for 9am', nextGoodTime: nextMorn };
  }

  return { optimal: true, reason: 'acceptable' };
}

function nextWeekday(from: Date, targetDay: string, hour: number, timezone: string): Date {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const targetIdx = days.indexOf(targetDay);
  const result = new Date(from);
  const currentIdx = result.getDay();
  let daysUntil = targetIdx - currentIdx;
  if (daysUntil <= 0) daysUntil += 7;
  result.setDate(result.getDate() + daysUntil);
  result.setHours(hour, 0, 0, 0);
  return result;
}

// ─── OPENING LINE SCIENCE ────────────────────────────────────────

/**
 * The first 11 words of a cold email determine whether they keep reading.
 * Score the opening line.
 */
export function scoreOpeningLine(opening: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 50;

  const firstSentence = opening.split(/[.!?]/)[0].trim();
  const first11Words = firstSentence.split(/\s+/).slice(0, 11).join(' ');

  // Bad openings — instant unread
  const deadOnArrival = [
    { pattern: /^(hi|hello|hey|dear)\s+[a-z]+,?\s*(i|my name)/i, issue: 'generic greeting into self-introduction' },
    { pattern: /^I hope (this|you|your)/i, issue: '"I hope this finds you well" = instant delete' },
    { pattern: /^I('m| am) reaching out/i, issue: 'reaching out = formal cold email tell' },
    { pattern: /^My name is/i, issue: 'leading with your name — nobody cares yet' },
    { pattern: /^I wanted to/i, issue: '"wanted to" = passive throat-clear' },
    { pattern: /^I('m| am) writing to/i, issue: '"writing to" = formal and distant' },
    { pattern: /^(Just |Quick |Briefly )/i, issue: 'apology framing weakens the email' },
    { pattern: /saw your (company|business|website)\s*(and|\.|,)/i, issue: 'generic "saw your X" — no specificity' },
  ];

  for (const d of deadOnArrival) {
    if (d.pattern.test(first11Words)) {
      score -= 30;
      issues.push(d.issue);
    }
  }

  // Good signals
  if (/\b(noticed|spotted|read|watched|listened)\b/i.test(first11Words)) {
    score += 15; // Suggests specific observation
  }
  if (firstSentence.length > 20 && firstSentence.length < 120) {
    score += 10; // Good length
  }
  if (firstSentence.length > 200) {
    score -= 15;
    issues.push('opening sentence too long');
  }

  // Specificity — mentions a specific thing about them
  const hasSpecificity = /\b(your \w+ (post|article|blog|video|podcast|episode|launch|update|announcement))\b/i.test(firstSentence);
  if (hasSpecificity) score += 20;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ─── CTA CALIBRATION ─────────────────────────────────────────────

/**
 * Match CTA difficulty to trust level.
 * Cold email 1 should NEVER ask for a call. Cold email 1 asks for "interest" only.
 */
export const CTA_LADDER = {
  coldEmailFirst: {
    tier: 'lowest commitment',
    examples: [
      'Worth a reply if this is relevant?',
      'Interested in learning more, or not a fit right now?',
      'Want me to send more details?',
      'Quick yes/no?',
    ],
    avoid: ['call', 'demo', 'meeting', 'chat', 'jump on', '15 minutes'],
  },
  coldEmailFollowUp: {
    tier: 'medium commitment',
    examples: [
      'Sending over a 2-min loom if you want to see how this works?',
      'I can share 3 case studies from similar work — interested?',
      'Want a quick written proposal?',
    ],
  },
  warmLead: {
    tier: 'meeting-appropriate',
    examples: [
      'Grab 15 min this week?',
      'When works to chat?',
      'Quick call Tuesday or Thursday?',
    ],
  },
};

/**
 * Check if the CTA matches the email stage.
 */
export function validateCta(emailBody: string, stage: 'cold-first' | 'follow-up' | 'warm'): { valid: boolean; issue?: string } {
  const aggressiveCta = /(jump on a call|15 minutes?|30 minutes?|schedule (a |an )?(demo|call|meeting)|book a (call|demo|meeting)|chat this week)/i;
  
  if (stage === 'cold-first' && aggressiveCta.test(emailBody)) {
    return {
      valid: false,
      issue: 'First cold email asks for a call — reply rate drops 3-5x. Start with "worth a reply if this is relevant?" instead.',
    };
  }
  
  return { valid: true };
}

// ─── REPLY-PROBABILITY SCORING ───────────────────────────────────

/**
 * Score an outreach email's probability of getting a reply, 0-100.
 * Combines subject quality, opening quality, specificity, length, and CTA fit.
 */
export function scoreReplyProbability(email: {
  subject: string;
  body: string;
  prospectCompany?: string;
  prospectName?: string;
  stage?: 'cold-first' | 'follow-up' | 'warm';
}): {
  score: number;
  tier: 'excellent' | 'good' | 'mediocre' | 'poor';
  breakdown: { category: string; score: number; notes: string[] }[];
  recommendation: string;
} {
  const stage = email.stage || 'cold-first';
  const breakdown: any[] = [];
  
  // 1. Subject (25% weight)
  const subjectResult = scoreSubjectLine(email.subject);
  breakdown.push({
    category: 'Subject line',
    score: subjectResult.score,
    notes: [...subjectResult.strengths, ...subjectResult.issues].slice(0, 3),
  });

  // 2. Opening line (25% weight)
  const openingResult = scoreOpeningLine(email.body);
  breakdown.push({
    category: 'Opening line',
    score: openingResult.score,
    notes: openingResult.issues.slice(0, 2),
  });

  // 3. Personalization depth (20% weight)
  let personalizationScore = 30;
  const personalNotes: string[] = [];
  
  if (email.prospectName && email.body.includes(email.prospectName.split(' ')[0])) {
    personalizationScore += 10;
    personalNotes.push('uses first name');
  }
  if (email.prospectCompany && email.body.includes(email.prospectCompany)) {
    personalizationScore += 10;
    personalNotes.push('references company');
  }
  
  // Specific references (posts, articles, recent events) — biggest signal
  const specificityMarkers = [
    /\byour (recent|latest|new) \w+/i,
    /\b(read|saw|watched|noticed) your \w+/i,
    /\byour post about \w+/i,
  ];
  for (const m of specificityMarkers) {
    if (m.test(email.body)) {
      personalizationScore += 20;
      personalNotes.push('specific observation');
      break;
    }
  }
  
  // Generic tells that REDUCE personalization
  const genericTells = [
    /\bbusinesses? like yours?\b/i,
    /\bcompanies in your (space|industry)\b/i,
    /\bI work with many\b/i,
  ];
  for (const t of genericTells) {
    if (t.test(email.body)) {
      personalizationScore -= 15;
      personalNotes.push('generic "companies like yours"');
    }
  }
  
  breakdown.push({
    category: 'Personalization',
    score: Math.max(0, Math.min(100, personalizationScore)),
    notes: personalNotes,
  });

  // 4. Length (15% weight) — sweet spot is 50-125 words for cold, under 60 for follow-up
  const wordCount = email.body.trim().split(/\s+/).length;
  let lengthScore = 50;
  const lengthNotes: string[] = [];
  
  if (stage === 'cold-first') {
    if (wordCount >= 50 && wordCount <= 125) { lengthScore = 90; lengthNotes.push(`${wordCount} words — ideal`); }
    else if (wordCount < 30) { lengthScore = 40; lengthNotes.push('too short — may seem low-effort'); }
    else if (wordCount > 200) { lengthScore = 20; lengthNotes.push('too long — won\'t get read'); }
    else { lengthScore = 65; lengthNotes.push(`${wordCount} words — acceptable`); }
  } else {
    if (wordCount <= 60) { lengthScore = 90; lengthNotes.push(`${wordCount} words — good brevity`); }
    else if (wordCount > 100) { lengthScore = 40; lengthNotes.push('follow-ups should be shorter'); }
    else { lengthScore = 70; }
  }
  
  breakdown.push({ category: 'Length', score: lengthScore, notes: lengthNotes });

  // 5. CTA fit (15% weight)
  const ctaResult = validateCta(email.body, stage);
  const ctaScore = ctaResult.valid ? 85 : 30;
  breakdown.push({
    category: 'Call to action',
    score: ctaScore,
    notes: ctaResult.issue ? [ctaResult.issue] : ['appropriate for stage'],
  });

  // Calculate weighted score
  const weights = { 'Subject line': 0.25, 'Opening line': 0.25, 'Personalization': 0.20, 'Length': 0.15, 'Call to action': 0.15 };
  let totalScore = 0;
  for (const item of breakdown) {
    totalScore += item.score * (weights[item.category as keyof typeof weights] || 0);
  }
  const finalScore = Math.round(totalScore);

  const tier: 'excellent' | 'good' | 'mediocre' | 'poor' = 
    finalScore >= 80 ? 'excellent' :
    finalScore >= 65 ? 'good' :
    finalScore >= 45 ? 'mediocre' :
    'poor';

  const recommendation = 
    tier === 'poor' ? 'Do not send — reply probability too low. Revise based on issues above.' :
    tier === 'mediocre' ? 'Consider revising. This may send but reply rate will be below average.' :
    tier === 'good' ? 'Ready to send. Expect reply rate around 3-6%.' :
    'Ship it. Expect reply rate above 8%.';

  return { score: finalScore, tier, breakdown, recommendation };
}

// ─── DEEP PERSONALIZATION PROMPT ─────────────────────────────────

/**
 * Build a prompt that produces truly personalized cold emails.
 * The key insight: force Claude to reason about WHAT THEY CARE ABOUT RIGHT NOW,
 * not "what their business does."
 */
export function buildDeepPersonalizationPrompt(params: {
  freelancerVoice: string;
  freelancerService: string;
  prospectName: string;
  prospectCompany: string;
  prospectUrl: string;
  prospectContext?: string;
}): string {
  return `You are writing a cold email that actually gets replied to. The bar is high.

═══ THE FREELANCER ═══
Service: ${params.freelancerService}

How they write (match their voice exactly — vocabulary, cadence, formality):
${params.freelancerVoice}

═══ THE PROSPECT ═══
Name: ${params.prospectName}
Company: ${params.prospectCompany}
Website: ${params.prospectUrl}
What you observed: ${params.prospectContext || 'Limited info available'}

═══ CRITICAL MINDSET ═══

You are NOT writing "an outreach email." You are writing a note from one human 
to another human, where the receiver has 2 seconds to decide if you're worth a reply.

Before writing ANYTHING, answer these questions internally:

1. WHAT DO THEY CARE ABOUT RIGHT NOW? Not "what does their business do" — what is 
   occupying their attention this week? New product launch? Hiring push? Redesign? 
   PR moment? If you don't know, admit it and keep the email simple.

2. WHAT SPECIFIC THING DID YOU SEE? A real cold email references something concrete: 
   "your homepage redesign shipped" or "your founder posted about scaling support on 
   LinkedIn" — not "your company's great work." If you only have generic info, be 
   brief and direct instead of faking specificity.

3. WHY NOW? Why are you emailing THIS week, not last week, not next week? If there's 
   no answer, the email will feel random. Find one if possible.

4. WHAT'S IN IT FOR THEM IN THE NEXT 60 SECONDS? Not "I can help you scale" — 
   something they could literally act on in the next minute. Often: "reply if 
   relevant, ignore if not."

═══ RULES (violating any of these tanks reply rate) ═══

FORBIDDEN OPENINGS (instant delete):
- "I hope this finds you well"
- "I'm reaching out to..."
- "My name is... and I wanted to..."  
- "I saw your company and..."
- "Just checking in"
- "Quick question" as the opening sentence (tolerable in subject, dead in body)

FORBIDDEN MIDDLE:
- "I work with companies like yours"  
- "We help businesses scale"
- "Here's why I think we'd be a fit"
- Any sentence starting with "I think" or "I believe"

FORBIDDEN CTA:
- "Jump on a quick 15-minute call"
- "Grab some time on my calendar"  
- "Open to a demo?"
- Any calendar link

ACCEPTABLE CTA (first cold email only):
- "Worth a reply if relevant?"
- "Interested, or not a fit right now?"
- "Want me to send more details?"

═══ FORMAT ═══

Return JSON only:
{
  "subject": "3-7 words, lowercase preferred, no emojis, no exclamation",
  "body": "50-125 words. Plain text with line breaks. No signatures — the freelancer's email client adds that.",
  "reasoning": "1 sentence explaining what you personalized on and why you think it'll land"
}

If you cannot personalize meaningfully because prospect context is thin, write a 
BRIEF, HONEST email that acknowledges you don't know much about them but explains 
why you reached out. A short honest email beats a long fake-personalized one.`;
}