"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

// This single file replaces BOTH the old app/chat/page.tsx and
// app/chat/[chatId]/page.tsx. Using an optional catch-all segment
// ([[...chatId]]) means /chat and /chat/{id} are the SAME route in
// Next.js's eyes — navigating between them updates a param, it does
// NOT unmount and remount the page. That was the root cause of chats
// appearing to "disappear": the old two-file setup forced a full
// remount (wiping all in-memory state) every time the app redirected
// from bare /chat to /chat/{latest}, which happened almost every load.

const ChatPage = dynamic(() => import("../ChatPageClient"), { ssr: false });

export default function ChatRoute() {
  const params = useParams<{ chatId?: string | string[] }>();
  // Catch-all params always arrive as an array (or undefined for the
  // bare /chat route). Normalize to a single string or undefined.
  const chatId = Array.isArray(params.chatId) ? params.chatId[0] : params.chatId;
  return <ChatPage initialChatId={chatId} />;
}
