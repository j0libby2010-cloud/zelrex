/**
 * USER DATA API
 * 
 * GET  /api/user-data → Load all user data (chats, goal, notifications)
 * POST /api/user-data → Save/update user data
 * 
 * Authenticated via Clerk. Uses the clerk user ID to scope all data.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  loadUserData,
  getUserByClerkId,
  createUser,
  getChats,
  createChat,
  updateChat,
  deleteChat as deleteChatDb,
  upsertWebsite,
  upsertDeploy,
  upsertGoal,
  deleteGoal,
  getGoal,
  getNotifications,
  createNotification,
  markNotificationsRead,
} from "@/lib/db/queries";

// ─── GET: Load all user data ────────────────────────────────────────

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure user exists in Supabase (fallback if webhook hasn't fired yet)
  let userData = await loadUserData(clerkId);
  if (!userData) {
    await createUser(clerkId);
    userData = await loadUserData(clerkId);
  }
  if (!userData) return NextResponse.json({ error: "Failed to load user" }, { status: 500 });

  return NextResponse.json(userData);
}

// ─── POST: Save/update user data ────────────────────────────────────

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  switch (action) {
    // ─── Chat operations ──────────────────────────────────────────
    case "create_chat": {
      const chat = await createChat(user.id, body.title);
      return NextResponse.json({ chat });
    }

    case "update_chat": {
      const chat = await updateChat(body.chatId, {
        title: body.title,
        messages: body.messages,
        pending_survey: body.pendingSurvey,
      });
      return NextResponse.json({ chat });
    }

    case "delete_chat": {
      const ok = await deleteChatDb(body.chatId);
      return NextResponse.json({ ok });
    }

    // ─── Website operations ───────────────────────────────────────
    case "save_website": {
      const website = await upsertWebsite(user.id, body.chatId, {
        survey_data: body.surveyData,
        branding: body.branding,
        copy_data: body.copyData,
        template: body.template,
        generated_html: body.generatedHtml,
      });
      return NextResponse.json({ website });
    }

    // ─── Deploy operations ────────────────────────────────────────
    case "save_deploy": {
      const deploy = await upsertDeploy(user.id, body.websiteId, {
        vercel_project_id: body.vercelProjectId,
        vercel_project_name: body.vercelProjectName,
        url: body.url,
        custom_domain: body.customDomain,
        domain_verified: body.domainVerified,
      });
      return NextResponse.json({ deploy });
    }

    // ─── Goal operations ──────────────────────────────────────────
    case "save_goal": {
      const goal = await upsertGoal(user.id, {
        text: body.text,
        target: body.target,
        deadline: body.deadline,
      });
      // Create notification
      await createNotification(user.id, `Goal set: "${body.text}" — Zelrex will track your progress.`);
      return NextResponse.json({ goal });
    }

    case "delete_goal": {
      const ok = await deleteGoal(user.id);
      return NextResponse.json({ ok });
    }

    // ─── Notification operations ──────────────────────────────────
    case "mark_notifications_read": {
      const ok = await markNotificationsRead(user.id);
      return NextResponse.json({ ok });
    }

    case "create_notification": {
      const notif = await createNotification(user.id, body.text);
      return NextResponse.json({ notif });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
