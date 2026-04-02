"use client";

import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

const ChatPage = dynamic(() => import("../ChatPageClient"), { ssr: false });

export default function ChatWithId() {
  const { chatId } = useParams<{ chatId: string }>();
  return <ChatPage initialChatId={chatId} />;
}