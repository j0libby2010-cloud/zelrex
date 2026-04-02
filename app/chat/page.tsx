"use client";

import dynamic from "next/dynamic";

const ChatPage = dynamic(() => import("./ChatPageClient"), { ssr: false });

export default function Page() {
  return <ChatPage />;
}
