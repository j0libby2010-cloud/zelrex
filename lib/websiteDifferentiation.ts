/**
 * ZELREX WEBSITE DIFFERENTIATION
 * 
 * The problem with AI-generated websites: they all look the same. Every freelancer's 
 * site has the same hero shape, the same "trust us" section, the same testimonial grid.
 * 
 * This module injects meaningful variation so no two Zelrex-generated sites look 
 * identical — even within the same theme.
 * 
 * What gets varied:
 * 1. HERO COMPOSITION — 12 distinct hero structures, not 1
 * 2. SECTION ORDER — proof-first vs story-first vs work-first depending on fit
 * 3. COPY VOICE — 6 copy archetypes (not just "professional" vs "friendly")
 * 4. VISUAL RHYTHM — text-to-whitespace ratios that match the brand
 * 5. SIGNATURE ELEMENTS — small bespoke touches unique to each business
 * 6. CTA PHRASING — 20+ distinct CTA templates, matched to audience
 * 7. TYPOGRAPHIC ACCENTS — mixed font sizes and weights for personality
 */

export interface DifferentiationSeed {
  businessName: string;
  businessType: string;
  audience: string;
  style: string;
  font: string;
  yearsInBusiness?: number;
  uniqueValueProp?: string;
}

// ─── HERO COMPOSITIONS ───────────────────────────────────────────

export type HeroComposition = 
  | 'manifesto'           // Single bold statement, minimal everything else
  | 'split-proof'         // Headline left, social proof right
  | 'question-answer'     // Headline is a question the visitor has
  | 'before-after'        // Shows transformation
  | 'credential-lead'     // Lead with credibility ("20 years...", "Worked with...")
  | 'work-lead'           // Show the work immediately, copy secondary
  | 'story-lead'          // Personal narrative opens the page
  | 'service-grid'        // 3-4 services as primary hero
  | 'numbers-lead'        // Stats/results as the primary hero element
  | 'manifesto-offer'     // Manifesto + single CTA, no secondary content above fold
  | 'specialist-declare'  // "I help [specific audience] do [specific thing]"
  | 'ambient-mood';       // Hero is mood/feel over message (for luxury/creative)

/**
 * Pick a hero composition that fits the business type.
 * Different archetypes suit different service categories.
 */
export function selectHeroComposition(seed: DifferentiationSeed): HeroComposition {
  const bt = seed.businessType.toLowerCase();
  const yrs = seed.yearsInBusiness || 0;

  // Coaches / consultants — lead with specificity
  if (/coach|consult|advis/.test(bt)) {
    if (yrs >= 10) return 'credential-lead';
    return 'specialist-declare';
  }

  // Designers / creatives — show the work
  if (/design|creative|illustrat|brand|visual/.test(bt)) {
    if (seed.style === 'minimal-elegant' || seed.style === 'luxury') return 'ambient-mood';
    return 'work-lead';
  }

  // Writers / content creators — story-first
  if (/writ|content|journalis|copy/.test(bt)) {
    return 'story-lead';
  }

  // Video / media — work-first, high visual impact
  if (/video|film|photo|edit|produc/.test(bt)) {
    return 'work-lead';
  }

  // Developers / technical — specificity or numbers
  if (/develop|engineer|technical|code|software/.test(bt)) {
    if (yrs >= 5) return 'numbers-lead';
    return 'specialist-declare';
  }

  // Agencies / teams — grid or proof-split
  if (/agency|team|studio/.test(bt)) {
    return 'split-proof';
  }

  // Marketing / growth — before-after
  if (/market|growth|seo|ad/.test(bt)) {
    return 'before-after';
  }

  // Virtual assistants / ops — manifesto-offer (simple, direct)
  if (/assist|virtual|admin|ops|support/.test(bt)) {
    return 'manifesto-offer';
  }

  // Default — match to style
  if (seed.style === 'minimal-elegant') return 'manifesto';
  if (seed.style === 'bold-colorful') return 'question-answer';
  return 'specialist-declare';
}

// ─── SECTION ORDERS ──────────────────────────────────────────────

export type SectionArchetype = 
  | 'hero'
  | 'proof'          // testimonials, logos, numbers
  | 'services'       // what they offer
  | 'process'        // how it works
  | 'work'           // case studies, portfolio
  | 'about'          // who they are
  | 'pricing'        // clear pricing
  | 'faq'
  | 'contact';

/**
 * Generate a section order based on the business archetype and audience.
 * Different businesses benefit from different narrative flows.
 */
export function selectSectionOrder(seed: DifferentiationSeed): SectionArchetype[] {
  const bt = seed.businessType.toLowerCase();
  const audience = seed.audience.toLowerCase();

  // B2B consultants — lead with credibility
  if (/consult|advis|strateg/.test(bt)) {
    return ['hero', 'proof', 'services', 'process', 'work', 'about', 'contact'];
  }

  // Designers / creatives — show work first, credentials later
  if (/design|creative|visual|brand/.test(bt)) {
    return ['hero', 'work', 'services', 'process', 'about', 'proof', 'contact'];
  }

  // Coaches — story matters more than proof for trust
  if (/coach/.test(bt)) {
    return ['hero', 'about', 'process', 'proof', 'services', 'faq', 'contact'];
  }

  // High-ticket services ($10k+) — more trust-building, more FAQ
  const isHighTicket = /enterprise|executive|C-suite|fortune|technical due diligence/.test(audience);
  if (isHighTicket) {
    return ['hero', 'proof', 'about', 'process', 'services', 'work', 'faq', 'contact'];
  }

  // Productized services — pricing upfront
  if (/virtual assistant|SEO|social media management/i.test(bt)) {
    return ['hero', 'services', 'pricing', 'process', 'proof', 'faq', 'contact'];
  }

  // Writers / content — work-driven
  if (/writ|content/.test(bt)) {
    return ['hero', 'work', 'about', 'services', 'proof', 'contact'];
  }

  // Default — balanced narrative
  return ['hero', 'services', 'proof', 'process', 'about', 'work', 'contact'];
}

// ─── COPY VOICE ARCHETYPES ───────────────────────────────────────

export type CopyVoice = 
  | 'confident-expert'    // "I've done this 47 times. Here's what actually works."
  | 'warm-guide'          // "Let me show you how I think about this..."
  | 'direct-operator'     // "Send the brief. Get the work. No meetings."
  | 'thoughtful-artisan'  // "Every project starts with understanding the why..."
  | 'rebellious-outsider' // "Most [industry] advice is wrong. Here's what I've learned instead."
  | 'quiet-authority';    // Minimal copy, maximum space. Lets work speak.

export function selectCopyVoice(seed: DifferentiationSeed): CopyVoice {
  const bt = seed.businessType.toLowerCase();
  const yrs = seed.yearsInBusiness || 0;

  if (seed.style === 'minimal-elegant' || seed.style === 'luxury') return 'quiet-authority';
  if (seed.style === 'bold-colorful') return 'rebellious-outsider';
  
  if (/coach|therap|counsel/.test(bt)) return 'warm-guide';
  if (/consult|advis|strateg/.test(bt) && yrs >= 10) return 'confident-expert';
  if (/virtual assistant|ops|admin/.test(bt)) return 'direct-operator';
  if (/design|creative|artist|craft/.test(bt)) return 'thoughtful-artisan';
  if (yrs >= 15) return 'confident-expert';
  
  return 'warm-guide';
}

// ─── CTA PHRASING LIBRARY ────────────────────────────────────────

export const CTA_LIBRARY: Record<CopyVoice, { primary: string[]; secondary: string[] }> = {
  'confident-expert': {
    primary: ['Start a project', 'Book a consultation', 'Get in touch', 'Discuss your project'],
    secondary: ['See the work', 'Read client stories', 'About the process'],
  },
  'warm-guide': {
    primary: ['Let\'s talk', 'Start the conversation', 'Send a message', 'Reach out'],
    secondary: ['How I work', 'About me', 'Recent projects'],
  },
  'direct-operator': {
    primary: ['Send a brief', 'Request a quote', 'Start now', 'Get started'],
    secondary: ['How it works', 'Pricing', 'Examples'],
  },
  'thoughtful-artisan': {
    primary: ['Begin a project', 'Inquire', 'Open a conversation', 'Explore working together'],
    secondary: ['See the craft', 'The philosophy', 'About'],
  },
  'rebellious-outsider': {
    primary: ['Let\'s build something', 'Work with me', 'Break the rules together', 'Start a project'],
    secondary: ['Why this works', 'See for yourself', 'The approach'],
  },
  'quiet-authority': {
    primary: ['Inquire', 'Enquire', 'Contact', 'Get in touch'],
    secondary: ['Selected work', 'Studio', 'Contact'],
  },
};

// ─── SIGNATURE ELEMENTS ──────────────────────────────────────────

export interface SignatureElement {
  type: 'hand-drawn-divider' | 'numbered-steps' | 'timeline' | 'quote-wall' | 'before-after-slider' | 'live-counter' | 'typewriter-intro' | 'scroll-story' | 'gallery-grid' | 'single-testimonial-hero';
  placement: 'hero' | 'between-sections' | 'about' | 'contact';
  description: string;
}

/**
 * Pick 1-2 signature elements that'll make the site feel distinct.
 * These are the "oh that's cool" moments that differentiate.
 */
export function selectSignatureElements(seed: DifferentiationSeed): SignatureElement[] {
  const voice = selectCopyVoice(seed);
  const elements: SignatureElement[] = [];

  // Creative/artisan voices — one bespoke element
  if (voice === 'thoughtful-artisan' || voice === 'quiet-authority') {
    elements.push({
      type: 'single-testimonial-hero',
      placement: 'between-sections',
      description: 'One large testimonial, no grid, lets a single strong quote breathe',
    });
  }

  // Operators / direct voices — transparent process
  if (voice === 'direct-operator' || voice === 'confident-expert') {
    elements.push({
      type: 'numbered-steps',
      placement: 'between-sections',
      description: 'Clear numbered process (1, 2, 3) instead of vague benefits',
    });
  }

  // Storytellers — timeline
  if (voice === 'warm-guide' || voice === 'rebellious-outsider') {
    elements.push({
      type: 'timeline',
      placement: 'about',
      description: 'Chronological timeline of career/evolution instead of static bio',
    });
  }

  // Add a second signature if there's a strong fit
  const bt = seed.businessType.toLowerCase();
  if (/growth|market|seo|optim/.test(bt)) {
    elements.push({
      type: 'before-after-slider',
      placement: 'between-sections',
      description: 'Interactive slider showing before/after results',
    });
  } else if (/writ|content|journalis/.test(bt)) {
    elements.push({
      type: 'typewriter-intro',
      placement: 'hero',
      description: 'Hero headline types out on page load',
    });
  } else if (/design|photo|video|art/.test(bt)) {
    elements.push({
      type: 'gallery-grid',
      placement: 'between-sections',
      description: 'Asymmetric gallery grid (not uniform cards)',
    });
  }

  return elements.slice(0, 2);
}

// ─── MICRO-COPY VARIATION ────────────────────────────────────────

export interface MicroCopySet {
  formLabels: {
    name: string;
    email: string;
    message: string;
    submit: string;
  };
  sectionLabels: {
    services: string;
    process: string;
    about: string;
    contact: string;
    work: string;
    proof: string;
  };
  navItems: string[];
}

/**
 * Even section labels ("Services" vs "What I Do" vs "Capabilities") change the feel.
 * This returns varied micro-copy matched to the voice.
 */
export function generateMicroCopy(voice: CopyVoice): MicroCopySet {
  const sets: Record<CopyVoice, MicroCopySet> = {
    'confident-expert': {
      formLabels: { name: 'Your name', email: 'Email address', message: 'What do you need help with?', submit: 'Send' },
      sectionLabels: { services: 'Services', process: 'Process', about: 'Background', contact: 'Start a project', work: 'Selected work', proof: 'Client outcomes' },
      navItems: ['Services', 'Work', 'About', 'Contact'],
    },
    'warm-guide': {
      formLabels: { name: 'What should I call you?', email: 'Your email', message: 'Tell me what\'s on your mind', submit: 'Send message' },
      sectionLabels: { services: 'How I can help', process: 'How we\'ll work together', about: 'About me', contact: 'Let\'s talk', work: 'Recent work', proof: 'What clients say' },
      navItems: ['Home', 'About', 'Services', 'Contact'],
    },
    'direct-operator': {
      formLabels: { name: 'Name', email: 'Email', message: 'Project brief', submit: 'Submit' },
      sectionLabels: { services: 'Services', process: 'How it works', about: 'About', contact: 'Start', work: 'Examples', proof: 'Reviews' },
      navItems: ['Services', 'Pricing', 'FAQ', 'Start'],
    },
    'thoughtful-artisan': {
      formLabels: { name: 'Your name', email: 'Email', message: 'Tell me about the project', submit: 'Inquire' },
      sectionLabels: { services: 'Practice', process: 'Approach', about: 'Studio', contact: 'Inquire', work: 'Archive', proof: 'Voices' },
      navItems: ['Archive', 'Practice', 'Studio', 'Inquire'],
    },
    'rebellious-outsider': {
      formLabels: { name: 'Name', email: 'Email', message: 'What are you trying to do?', submit: 'Send it' },
      sectionLabels: { services: 'What I do', process: 'How I work', about: 'Who I am', contact: 'Get in touch', work: 'Proof', proof: 'Results' },
      navItems: ['Work', 'Approach', 'About', 'Contact'],
    },
    'quiet-authority': {
      formLabels: { name: 'Name', email: 'Email', message: 'Project', submit: 'Send' },
      sectionLabels: { services: 'Services', process: 'Process', about: 'Studio', contact: 'Contact', work: 'Work', proof: 'Clients' },
      navItems: ['Work', 'Studio', 'Contact'],
    },
  };

  return sets[voice];
}

// ─── COMBINED DIFFERENTIATION PLAN ───────────────────────────────

export interface DifferentiationPlan {
  heroComposition: HeroComposition;
  sectionOrder: SectionArchetype[];
  copyVoice: CopyVoice;
  signatureElements: SignatureElement[];
  microCopy: MicroCopySet;
  ctaLibrary: { primary: string[]; secondary: string[] };
  uniquenessScore: number; // 0-100, how differentiated this plan is from "AI default"
}

/**
 * Generate a complete differentiation plan for a new website.
 * This is the single function to call that makes every site distinct.
 */
export function buildDifferentiationPlan(seed: DifferentiationSeed): DifferentiationPlan {
  const heroComposition = selectHeroComposition(seed);
  const sectionOrder = selectSectionOrder(seed);
  const copyVoice = selectCopyVoice(seed);
  const signatureElements = selectSignatureElements(seed);
  const microCopy = generateMicroCopy(copyVoice);
  const ctaLibrary = CTA_LIBRARY[copyVoice];

  // Uniqueness score — how far from generic defaults
  let uniquenessScore = 30;
  if (heroComposition !== 'specialist-declare') uniquenessScore += 15;
  if (signatureElements.length >= 2) uniquenessScore += 20;
  if (copyVoice === 'rebellious-outsider' || copyVoice === 'thoughtful-artisan') uniquenessScore += 15;
  if (sectionOrder[1] !== 'services') uniquenessScore += 10;
  if (seed.uniqueValueProp && seed.uniqueValueProp.length > 20) uniquenessScore += 10;

  return {
    heroComposition,
    sectionOrder,
    copyVoice,
    signatureElements,
    microCopy,
    ctaLibrary,
    uniquenessScore: Math.min(100, uniquenessScore),
  };
}