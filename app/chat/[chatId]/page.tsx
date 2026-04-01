"use client";

import { useParams } from "next/navigation";
import ChatPage from "../ChatPageClient";

export default function ChatWithId() {
  const { chatId } = useParams<{ chatId: string }>();
  return <ChatPage initialChatId={chatId} />;
}