/**
 * ZELREX DATABASE QUERIES
 * 
 * All database operations go through here.
 * Server-side only — used in API routes and server components.
 */

import { supabase } from "./supabase";

// ─── Types ──────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  clerk_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbChat {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  pending_survey: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbWebsite {
  id: string;
  user_id: string;
  chat_id: string | null;
  survey_data: any;
  branding: any;
  copy_data: any;
  template: string | null;
  generated_html: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbDeploy {
  id: string;
  user_id: string;
  website_id: string | null;
  vercel_project_id: string | null;
  vercel_project_name: string | null;
  url: string | null;
  custom_domain: string | null;
  domain_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbGoal {
  id: string;
  user_id: string;
  text: string;
  target: string | null;
  deadline: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  text: string;
  read: boolean;
  created_at: string;
}

// ─── Users ──────────────────────────────────────────────────────────

export async function getUserByClerkId(clerkId: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();
  if (error) return null;
  return data;
}

export async function createUser(clerkId: string, email?: string, name?: string, avatarUrl?: string): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from("users")
    .insert({ clerk_id: clerkId, email, name, avatar_url: avatarUrl })
    .select()
    .single();
  if (error) { console.error("createUser error:", error); return null; }
  return data;
}

export async function updateUser(clerkId: string, updates: Partial<Pick<DbUser, "email" | "name" | "avatar_url" | "plan" | "stripe_customer_id" | "stripe_subscription_id">>): Promise<DbUser | null> {
  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("clerk_id", clerkId)
    .select()
    .single();
  if (error) { console.error("updateUser error:", error); return null; }
  return data;
}

export async function deleteUser(clerkId: string): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("clerk_id", clerkId);
  return !error;
}

// ─── Chats ──────────────────────────────────────────────────────────

export async function getChats(userId: string): Promise<DbChat[]> {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("getChats error:", error); return []; }
  return data || [];
}

export async function createChat(userId: string, title?: string): Promise<DbChat | null> {
  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: userId, title: title || "New chat", messages: [] })
    .select()
    .single();
  if (error) { console.error("createChat error:", error); return null; }
  return data;
}

export async function updateChat(chatId: string, updates: Partial<Pick<DbChat, "title" | "messages" | "pending_survey">>): Promise<DbChat | null> {
  const { data, error } = await supabase
    .from("chats")
    .update(updates)
    .eq("id", chatId)
    .select()
    .single();
  if (error) { console.error("updateChat error:", error); return null; }
  return data;
}

export async function deleteChat(chatId: string): Promise<boolean> {
  const { error } = await supabase
    .from("chats")
    .delete()
    .eq("id", chatId);
  return !error;
}

// ─── Websites ───────────────────────────────────────────────────────

export async function getWebsite(chatId: string): Promise<DbWebsite | null> {
  const { data, error } = await supabase
    .from("websites")
    .select("*")
    .eq("chat_id", chatId)
    .single();
  if (error) return null;
  return data;
}

export async function getWebsites(userId: string): Promise<DbWebsite[]> {
  const { data, error } = await supabase
    .from("websites")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("getWebsites error:", error); return []; }
  return data || [];
}

export async function upsertWebsite(userId: string, chatId: string, website: Partial<Pick<DbWebsite, "survey_data" | "branding" | "copy_data" | "template" | "generated_html">>): Promise<DbWebsite | null> {
  // Check if website exists for this chat
  const existing = await getWebsite(chatId);
  if (existing) {
    const { data, error } = await supabase
      .from("websites")
      .update(website)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) { console.error("updateWebsite error:", error); return null; }
    return data;
  } else {
    const { data, error } = await supabase
      .from("websites")
      .insert({ user_id: userId, chat_id: chatId, ...website })
      .select()
      .single();
    if (error) { console.error("createWebsite error:", error); return null; }
    return data;
  }
}

// ─── Deploys ────────────────────────────────────────────────────────

export async function getDeploy(websiteId: string): Promise<DbDeploy | null> {
  const { data, error } = await supabase
    .from("deploys")
    .select("*")
    .eq("website_id", websiteId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertDeploy(userId: string, websiteId: string, deploy: Partial<Pick<DbDeploy, "vercel_project_id" | "vercel_project_name" | "url" | "custom_domain" | "domain_verified">>): Promise<DbDeploy | null> {
  const existing = await getDeploy(websiteId);
  if (existing) {
    const { data, error } = await supabase
      .from("deploys")
      .update(deploy)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) { console.error("updateDeploy error:", error); return null; }
    return data;
  } else {
    const { data, error } = await supabase
      .from("deploys")
      .insert({ user_id: userId, website_id: websiteId, ...deploy })
      .select()
      .single();
    if (error) { console.error("createDeploy error:", error); return null; }
    return data;
  }
}

// ─── Goals ──────────────────────────────────────────────────────────

export async function getGoal(userId: string): Promise<DbGoal | null> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export async function upsertGoal(userId: string, goal: { text: string; target?: string; deadline?: string }): Promise<DbGoal | null> {
  // Archive existing active goals
  await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, text: goal.text, target: goal.target || null, deadline: goal.deadline || null })
    .select()
    .single();
  if (error) { console.error("upsertGoal error:", error); return null; }
  return data;
}

export async function deleteGoal(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");
  return !error;
}

// ─── Notifications ──────────────────────────────────────────────────

export async function getNotifications(userId: string, limit = 20): Promise<DbNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("getNotifications error:", error); return []; }
  return data || [];
}

export async function createNotification(userId: string, text: string): Promise<DbNotification | null> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ user_id: userId, text })
    .select()
    .single();
  if (error) { console.error("createNotification error:", error); return null; }
  return data;
}

export async function markNotificationsRead(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  return !error;
}

// ─── Bulk Load (for initial page load) ──────────────────────────────

export async function loadUserData(clerkId: string) {
  const user = await getUserByClerkId(clerkId);
  if (!user) return null;

  const [chats, goal, notifications] = await Promise.all([
    getChats(user.id),
    getGoal(user.id),
    getNotifications(user.id),
  ]);

  return { user, chats, goal, notifications };
}
