import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const { name, email, subject, category, message } = await req.json();

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    // Rate limit: max 3 submissions per email per hour (in-memory)
    const now = Date.now();
    const key = `contact:${email.toLowerCase()}`;
    const bucket = contactRateLimits.get(key);
    if (bucket && now < bucket.resetAt && bucket.count >= 3) {
      return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 });
    }
    if (!bucket || now > bucket.resetAt) {
      contactRateLimits.set(key, { count: 1, resetAt: now + 3600_000 });
    } else {
      bucket.count++;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey);

    const { error } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject?.trim() || '',
      category: category || 'general',
      message: message.trim(),
      status: 'new',
    });

    if (error) {
      console.error('[Contact] Insert error:', error.message);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[Contact] Error:', e?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

const contactRateLimits = new Map<string, { count: number; resetAt: number }>();