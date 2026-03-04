import { createClient } from '@supabase/supabase-js';
import { MemoryService } from '@/lib/memory';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const memoryService = new MemoryService(supabase);

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const progress = await memoryService.getProgressData(userId);
  return NextResponse.json(progress);
}