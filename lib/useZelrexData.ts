/**
 * USE ZELREX DATA
 * 
 * Client-side hook that loads user data from Supabase on mount
 * and provides save functions that persist to the database.
 * 
 * Used in page.tsx to replace localStorage.
 * 
 * Usage:
 *   const { dbUser, isLoading, saveChat, saveGoal, ... } = useZelrexData();
 */

"use client";

import { useCallback, useRef } from "react";

// ─── Types (matching the page.tsx types) ────────────────────────────

interface ApiChat {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  pending_survey: boolean;
  created_at: string;
  updated_at: string;
}

// ─── API Helper ─────────────────────────────────────────────────────

async function api(action: string, data?: Record<string, any>) {
  const res = await fetch("/api/user-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  if (!res.ok) {
    console.error(`API error (${action}):`, res.status);
    return null;
  }
  return res.json();
}

async function apiGet() {
  const res = await fetch("/api/user-data");
  if (!res.ok) return null;
  return res.json();
}

// ─── Debounced Save ─────────────────────────────────────────────────
// Prevents spamming the API on every keystroke

export function useDebouncedSave(delay = 1000) {
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  return useCallback((key: string, fn: () => Promise<any>) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try { await fn(); } catch (e) { console.error(`Save error (${key}):`, e); }
    }, delay);
  }, [delay]);
}

// ─── Data Operations ────────────────────────────────────────────────

export const db = {
  // Load all data on initial page load
  async loadAll() {
    return apiGet();
  },

  // Chat operations
  async createChat(title?: string) {
    const res = await api("create_chat", { title });
    return res?.chat ?? null;
  },

  async updateChat(chatId: string, data: { title?: string; messages?: any[]; pendingSurvey?: boolean; websiteData?: any; deployData?: any; surveyData?: any }) {
    const res = await api("update_chat", { chatId, ...data });
    return res?.chat ?? null;
  },

  async deleteChat(chatId: string) {
    const res = await api("delete_chat", { chatId });
    return res?.ok ?? false;
  },

  // Website operations
  async saveWebsite(chatId: string, data: { surveyData?: any; branding?: any; copyData?: any; template?: string; generatedHtml?: string }) {
    const res = await api("save_website", { chatId, ...data });
    return res?.website ?? null;
  },

  // Deploy operations
  async saveDeploy(websiteId: string, data: { vercelProjectId?: string; vercelProjectName?: string; url?: string; customDomain?: string; domainVerified?: boolean }) {
    const res = await api("save_deploy", { websiteId, ...data });
    return res?.deploy ?? null;
  },

  // Goal operations
  async saveGoal(data: { text: string; target?: string; deadline?: string }) {
    const res = await api("save_goal", data);
    return res?.goal ?? null;
  },

  async deleteGoal() {
    const res = await api("delete_goal");
    return res?.ok ?? false;
  },

  // Notification operations
  async markNotificationsRead() {
    const res = await api("mark_notifications_read");
    return res?.ok ?? false;
  },

  async createNotification(text: string) {
    const res = await api("create_notification", { text });
    return res?.notif ?? null;
  },
};
