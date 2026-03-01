/**
 * CLERK WEBHOOK HANDLER
 * 
 * Syncs Clerk user events to Supabase.
 * Endpoint: POST /api/webhooks/clerk
 * 
 * Setup: In Clerk Dashboard → Webhooks → Add endpoint
 * URL: https://zelrex.ai/api/webhooks/clerk
 * Events: user.created, user.updated, user.deleted
 */

import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createUser, updateUser, deleteUser } from "@/lib/db/queries";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  // Verify the webhook signature
  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = evt.type;
  const data = evt.data;

  switch (eventType) {
    case "user.created": {
      const email = data.email_addresses?.[0]?.email_address;
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      const avatar = data.image_url || null;
      await createUser(data.id, email, name, avatar);
      console.log(`[Clerk Webhook] User created: ${data.id} (${email})`);
      break;
    }

    case "user.updated": {
      const email = data.email_addresses?.[0]?.email_address;
      const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || null;
      const avatar = data.image_url || null;
      await updateUser(data.id, { email, name, avatar_url: avatar });
      console.log(`[Clerk Webhook] User updated: ${data.id}`);
      break;
    }

    case "user.deleted": {
      await deleteUser(data.id);
      console.log(`[Clerk Webhook] User deleted: ${data.id}`);
      break;
    }

    default:
      console.log(`[Clerk Webhook] Unhandled event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
