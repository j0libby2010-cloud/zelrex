"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string; createdAt: number };

type Chat = {
  id: string;
  title: string;
  messages: Msg[];
  updatedAt: number;
};

type DraftAttachment = {
  id: string;
  file: File;
  kind: "image" | "file";
  previewUrl?: string; // only for images
};

const STORAGE_KEY = "zelrex_chats_v1";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(
    16
  )}`;
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function makePremiumTitleFromFirstMessage(text: string) {
  // Not “copy/paste”. Make it feel like a chat title.
  // 1) trim
  // 2) remove extra punctuation
  // 3) take first ~7 words
  const cleaned = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s'-]/g, "")
    .slice(0, 120);

  const words = cleaned.split(" ").filter(Boolean);
  const slice = words.slice(0, 7).join(" ");
  if (!slice) return "New chat";

  // Title-case-ish (simple)
  const titled = slice
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

  return titled.length > 42 ? titled.slice(0, 42).trim() + "…" : titled;
}

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

/** Premium inline icons (no deps). */
function Icon({
  name,
  className,
}: {
  name:
    | "menu"
    | "close"
    | "plus"
    | "compose"
    | "copy"
    | "retry"
    | "microphone"
    | "search"
    | "dots"
    | "flag"
    | "trash"
    | "pencil"
    | "send"
    | "stop"
    | "user";
  className?: string;
}) {
  const common = "inline-block";
  const cls = classNames(common, className);
  switch (name) {
    case "menu":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "close":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M7 7l10 10M17 7L7 17"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "plus":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "compose":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <path
            d="M7.5 17.8 6 20l2.2-1.5 8.9-8.9-2.2-2.2L7.5 17.8z"
            fill="currentColor"
          />
          <path
            d="M14.8 6.5c.4-.4 1-.4 1.4 0l1.3 1.3c.4.4.4 1 0 1.4l-1.1 1.1-2.7-2.7 1.1-1.1z"
            fill="currentColor"
          />
        </svg>
      );
    case "search":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M16.5 16.5 21 21"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
      case "copy":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none">
            <rect x="9" y="3" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <rect x="4" y="8" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        );
      case "retry":
        return (
          <svg className={cls} viewBox="0 0 24 24" fill="none">
            <path d="M21 12a9 9 0 1 0-2.6 6.1L21 12z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
    case "dots":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="5" cy="12" r="2.2" fill="currentColor" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <circle cx="19" cy="12" r="2.2" fill="currentColor" />
        </svg>
      );
    case "flag":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 3v18"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M6 5c2-1 4-1 6 0s4 1 6 0v8c-2 1-4 1-6 0s-4-1-6 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "trash":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M9 3h6m-9 4h12m-10 0 1 14h6l1-14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "pencil":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 20h9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "send":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M20 12 4 20l4-8-4-8 16 8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "stop":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2.5" />
        </svg>
      );
    case "user":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M20 21a8 8 0 1 0-16 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "microphone":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor" />
          <path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 19v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 21h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
}

function ZelrexThinking() {
  return (
    <>
      <div className="zelrex-thinking" role="status" aria-label="Thinking">
        <span />
        <span />
        <span />
      </div>

      <style>{`
        .zelrex-thinking {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 0;
        }

        .zelrex-thinking span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: currentColor;
          opacity: 0.4;
          animation: zelrexDotBounce 1.2s infinite ease-in-out;
        }

        .zelrex-thinking span:nth-child(1) { animation-delay: 0s; }
        .zelrex-thinking span:nth-child(2) { animation-delay: 0.15s; }
        .zelrex-thinking span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes zelrexDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  );
}






function Typewriter({
  text,
  speed = 10,
  onFinish,
}: {
  text: string;
  speed?: number;
  onFinish?: () => void;
}) {
  const [shown, setShown] = useState("");
  const onFinishRef = useRef<(() => void) | undefined>(onFinish);

  // Keep latest onFinish in a ref so the main interval effect doesn't restart
  // when a new callback identity is passed.
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    setShown("");
    let i = 0;
    let t: number | undefined;
    t = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        if (t) window.clearInterval(t);
        // call the latest onFinish if present
        onFinishRef.current?.();
      }
    }, speed);

    return () => {
      if (t) window.clearInterval(t);
    };
  }, [text, speed]);

  return <>{shown}</>;
}

function formatMessage(content: string) {
  const lines = content.split("\n").map(l => l.trim());

  return lines.map((line, idx) => {
    // Divider
    if (line === "---") {
      return (
        <div
          key={idx}
          className="my-5 h-px w-full bg-white/10"
        />
      );
    }

    // Section header (ALL CAPS or ends with :)
    const isHeader =
      /^[A-Z\s]{4,}$/.test(line) ||
      line.endsWith(":");

    if (isHeader) {
      return (
        <div key={idx} className="mt-6 mb-2">
          <div className="text-[15px] font-semibold tracking-tight text-white">
            {line.replace(/:$/, "")}
          </div>
        </div>
      );
    }

    // Bold markdown **text**
    const parts: Array<{ text: string; bold: boolean }> = [];
    let remaining = line;

    while (remaining.includes("**")) {
      const start = remaining.indexOf("**");
      const end = remaining.indexOf("**", start + 2);
      if (end === -1) break;

      if (start > 0) {
        parts.push({ text: remaining.slice(0, start), bold: false });
      }

      parts.push({
        text: remaining.slice(start + 2, end),
        bold: true,
      });

      remaining = remaining.slice(end + 2);
    }

    if (remaining.length) {
      parts.push({ text: remaining, bold: false });
    }

    return (
      <p
        key={idx}
        className="my-3 text-[16.5px] leading-[1.7] text-white/90"
      >
        {parts.map((p, i) =>
          p.bold ? (
            <strong key={i} className="font-semibold text-white">
              {p.text}
            </strong>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </p>
    );
  });
}


function shouldAnimateMessage(
  message: Msg,
  chat: Chat | undefined
) {
  if (!chat) return false;
  const last = chat.messages[chat.messages.length - 1];
  return message.id === last?.id && message.role === "assistant";
}

export default function ChatPage() {
  // Sidebar collapse
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Track which messages have finished their typewriter animation for this session.
  // This is intentionally NOT persisted to localStorage or shown in the UI.
  const [animatedIds, setAnimatedIds] = useState<string[]>([]);

  // Chats state
  const [chats, setChats] = useState<Chat[]>(() => {
    const stored = safeJsonParse<Chat[]>(
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
      []
    );
    if (stored.length) return stored;

    const first: Chat = {
      id: uid("chat"),
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    return [first];
  });

  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? "");
  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? chats[0],
    [chats, activeChatId]
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => {
      if (c.title?.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => m.content.toLowerCase().includes(q));
    });
  }, [chats, searchQuery]);

  // UI states
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Message actions
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Persist chats
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  // Ensure active chat id exists
  useEffect(() => {
    if (!activeChatId && chats[0]?.id) setActiveChatId(chats[0].id);
    if (activeChatId && !chats.some((c) => c.id === activeChatId) && chats[0]?.id) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  // Auto scroll
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, isSending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(180, el.scrollHeight);
    el.style.height = `${next}px`;
  }, [input]);

  // Click-outside closes menus
  useEffect(() => {
    const onDown = () => {
      setOpenChatMenuId(null);
      setOpenMsgMenuId(null);
      setAttachMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  function createNewChat() {
    const c: Chat = {
      id: uid("chat"),
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setChats((prev) => [c, ...prev]);
    setActiveChatId(c.id);
    setOpenChatMenuId(null);
    setRenamingChatId(null);
    setInput("");

    // Clear draft attachments after optimistic update and revoke object URLs
    setDraftAttachments((prev) => {
      for (const a of prev) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      return [];
    });
  }

  function deleteChat(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    setOpenChatMenuId(null);

    // if deleting active, move to next
    if (id === activeChatId) {
      const remaining = chats.filter((c) => c.id !== id);
      const next = remaining[0]?.id ?? "";
      setActiveChatId(next);
    }
  }

  function startRename(id: string) {
    const c = chats.find((x) => x.id === id);
    setRenamingChatId(id);
    setRenameValue(c?.title ?? "");
    setOpenChatMenuId(null);
  }

  function commitRename() {
    if (!renamingChatId) return;
    const v = renameValue.trim() || "New chat";
    setChats((prev) =>
      prev.map((c) => (c.id === renamingChatId ? { ...c, title: v } : c))
    );
    setRenamingChatId(null);
    setRenameValue("");
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && draftAttachments.length === 0) || !activeChat || isSending) return;

    setIsSending(true);
    setOpenMsgMenuId(null);

    const userMsg: Msg = {
      id: uid("m"),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    // If first message, auto-title the chat (premium summarized)
    const shouldAutoTitle = activeChat.messages.length === 0;

    // optimistic update
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChat.id
          ? {
              ...c,
              title: shouldAutoTitle ? makePremiumTitleFromFirstMessage(text) : c.title,
              messages: [...c.messages, userMsg],
              updatedAt: Date.now(),
            }
          : c
      )
    );

    setInput("");

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ messages: [...activeChat.messages, userMsg] }),
      });

      // If backend returns non-JSON, handle cleanly
      const raw = await res.text();
      let data: { reply?: string } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        // keep empty; handled below
      }

      const replyText =
        data.reply && typeof data.reply === "string" && data.reply.trim()
          ? data.reply.trim()
          : "Something went wrong. Please try again.";

      const assistantMsg: Msg = {
        id: uid("m"),
        role: "assistant",
        content: replyText,
        createdAt: Date.now(),
      };

      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
            : c
        )
      );
    } catch (e) {
      const assistantMsg: Msg = {
        id: uid("m"),
        role: "assistant",
        content: "Something went wrong. Please try again.",
        createdAt: Date.now(),
      };
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
            : c
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  function stopResponse() {
    // abort any in-flight request and visually stop typing/thinking
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSending(false);
  }

  function startSpeech() {
    const Speech =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;

    if (!Speech) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    const recog = new Speech();
    recog.lang = "en-US";
    recog.start();
    setListening(true);

    recog.onresult = (e: any) => {
      setInput(prev => prev + " " + e.results[0][0].transcript);
      setListening(false);
    };

    recog.onerror = () => setListening(false);
  }

    function retryLastMessage() {
      if (!activeChat) return;

      const msgs = activeChat.messages;
      if (msgs.length < 2) return;

      const lastUser = [...msgs].reverse().find(m => m.role === "user");
      if (!lastUser) return;

      // remove last assistant message
      setChats(prev =>
        prev.map(c =>
          c.id === activeChat.id
            ? { ...c, messages: c.messages.slice(0, -1) }
            : c
        )
      );

      setInput(lastUser.content);
      sendMessage();
    }

    function addFilesToDraft(files: FileList | File[]) {
      const arr = Array.from(files);
      if (!arr.length) return;

      setDraftAttachments((prev) => {
        const next: DraftAttachment[] = [];

        for (const f of arr) {
          const isImage = f.type?.startsWith("image/");
          next.push({
            id: uid("att"),
            file: f,
            kind: isImage ? "image" : "file",
            previewUrl: isImage ? URL.createObjectURL(f) : undefined,
          });
        }

        return [...prev, ...next];
      });
    }

    function removeDraftAttachment(id: string) {
      setDraftAttachments((prev) => {
        const target = prev.find((a) => a.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return prev.filter((a) => a.id !== id);
      });
    }

    // Paste handler: supports multiple clipboard items
    function onInputPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }

      if (files.length) {
        e.preventDefault(); // stops the raw image from “pasting as text”
        addFilesToDraft(files);
      }
    }

    // Cleanup object URLs if user navigates away
    useEffect(() => {
      return () => {
        for (const a of draftAttachments) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  const hasMessages = (activeChat?.messages?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#05070C]">
      {/* Top bar (logo stays even when sidebar closed) */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#05070C]/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
              type="button"
            >
              <Icon name={sidebarOpen ? "close" : "menu"} className="h-5 w-5" />
            </button>

            <div className="select-none text-[15px] font-semibold tracking-tight text-white/90">
              Zelrex
            </div>
          </div>

            <div className="flex items-center gap-2">
            <button
              onClick={createNewChat}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/85 hover:bg-white/10 hover:text-white"
              type="button"
            >
              <Icon name="compose" className="h-4 w-4 opacity-90" />
              New chat
            </button>
          </div>
        </div>
      </div>

      {/* Main layout: sidebar overlays, chat stays centered */}
      <div className="relative">
        {/* Sidebar (overlay style so center column NEVER shifts) */}
        <aside
          className={classNames(
            "fixed left-0 top-14 z-50 h-[calc(100vh-56px)] w-[300px] border-r border-white/10 bg-[#060A12]/80 backdrop-blur transition-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar actions */}
              <div className="p-4">
              <button
                onClick={createNewChat}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                type="button"
              >
                <Icon name="compose" className="h-4 w-4" />
                New chat
              </button>

              <div className="mt-3">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-white/60">
                  <Icon name="search" className="h-4 w-4" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats"
                    className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/40"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
                      aria-label="Clear search"
                    >
                      <Icon name="close" className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="px-2">
              <div className="my-2 h-px bg-white/10" />
            </div>

            {/* Chat list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-white/40">
                Chats
              </div>

              <div className="space-y-1">
                {filteredChats.map((c) => {
                  const isActive = c.id === activeChatId;
                  const isRenaming = renamingChatId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={classNames(
                        "group relative flex items-center rounded-xl px-2 py-2",
                        isActive ? "bg-white/10" : "hover:bg-white/5"
                      )}
                    >
                        <button
                          onClick={() => setActiveChatId(c.id)}
                          className="flex-1 text-left"
                          type="button"
                        >
                        {isRenaming ? (
                          <input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") {
                                setRenamingChatId(null);
                                setRenameValue("");
                              }
                            }}
                            onBlur={commitRename}
                            autoFocus
                            className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-white/25"
                          />
                        ) : (
                          <div className="truncate text-sm text-white/85">
                            {c.title || "New chat"}
                          </div>
                        )}
                      </button>

                      {/* hover dots */}
                      {!isRenaming && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenChatMenuId((v) => (v === c.id ? null : c.id));
                          }}
                          className={classNames(
                            "ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100",
                            openChatMenuId === c.id && "opacity-100"
                          )}
                          aria-label="Chat options"
                        >
                          <Icon name="dots" className="h-5 w-5" />
                        </button>
                      )}

                      {/* popover */}
                      {openChatMenuId === c.id && (
                        <div
                          onMouseDown={(e) => e.stopPropagation()}
                          className="absolute right-2 top-11 z-60 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A1020] shadow-2xl"
                        >
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white rounded-b-xl"
                            onClick={() => startRename(c.id)}
                            type="button"
                          >
                            <Icon name="pencil" className="h-4 w-4" />
                            Rename
                          </button>
                          <button
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white rounded-b-xl"
                            onClick={() => deleteChat(c.id)}
                            type="button"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Account */}
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Icon name="user" className="h-4 w-4" />
                Account
              </button>
            </div>
          </div>
        </aside>

        {/* Centered Chat Column (never moves) */}
        <main className="mx-auto max-w-[1200px] px-4">
          <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-[820px] flex-col">
            {/* Welcome headline */}
            {!hasMessages && (
              <div className="flex flex-1 flex-col items-center justify-center pb-10 pt-16 text-center">
                <div className="text-5xl font-semibold tracking-tight text-white/90">
                      What are you trying to launch?
                    </div>
                    <div className="mt-3 max-w-[640px] text-lg leading-relaxed text-white/60">
                  A specialized intelligence layer for the modern entrepreneur, engineered to build, launch, and scale comprehensive online businesses with clinical precision.
                </div>
              </div>
            )}

            {/* Messages */}
            <div
              className={classNames(
                "flex-1 relative z-0",
                hasMessages ? "pt-6" : "hidden"
              )}
            >
              <div className="space-y-5 pb-28">
                {activeChat?.messages.map((m) => {
                  const isUser = m.role === "user";
                  const bubbleBase =
                    "rounded-lg px-3 py-1 text-[14.5px] leading-relaxed";
                  const userBubble =
                    "bg-white/10 text-white/90 border border-white/10";
                  const assistantBubble =
                    "bg-transparent text-white/90";

                  return (
                    <div key={m.id} className={classNames("flex", isUser ? "justify-end" : "justify-start")}>
                      <div className={classNames("max-w-[720px] w-full", isUser ? "flex justify-end" : "flex justify-start")}>
                        <div className={classNames(bubbleBase, isUser ? userBubble : assistantBubble)}>
                          {m.role === "assistant" ? (
                            <>
                              {(() => {
                                const processed = m.content.replace(/\. (?=[A-Z])/g, ".\n\n");
                                if (shouldAnimateMessage(m, activeChat) && !animatedIds.includes(m.id)) {
                                  return (
                                    <div className="text-white/90 whitespace-pre-wrap">
                                      <Typewriter
                                        text={processed}
                                        speed={6}
                                        onFinish={() => {
                                          // mark this message as animated for the current session only
                                          setAnimatedIds((prev) => (prev.includes(m.id) ? prev : [...prev, m.id]));
                                        }}
                                      />
                                    </div>
                                  );
                                }

                                return <div>{formatMessage(processed)}</div>;
                              })()}

                              {/* Assistant message actions (3 dots only) */}
                              <div className="mt-2 flex items-center justify-start">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMsgMenuId((v) => (v === m.id ? null : m.id));
                                  }}
                                  className={classNames(
                                    "inline-flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                                  )}
                                  aria-label="Message options"
                                >
                                  <Icon name="dots" className="h-4 w-4" />
                                </button>


                                {openMsgMenuId === m.id && (
                                  <div
                                    onMouseDown={(e) => e.stopPropagation()}
                                    className="relative"
                                  >
                                    <div className="absolute left-0 top-2 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A1020] shadow-2xl">
                                      <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(m.content);
                                          setCopiedMsgId(m.id);
                                          setOpenMsgMenuId(null);
                                          setTimeout(() => setCopiedMsgId(null), 1200);
                                        }}
                                      >
                                        ⧉ Copy
                                      </button>

                                <button
  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
  type="button"
  onClick={() => {
    setOpenMsgMenuId(null);
    retryLastMessage();
  }}
>
  <span className="text-white/60">↻</span>
  Retry
</button>



                                      <button
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                                        type="button"
                                        onClick={() => {
                                          setOpenMsgMenuId(null);
                                          alert("Report saved (stub). Hook this up later.");
                                        }}
                                      >
                                        <span className="text-white/60">⚑</span>
                                        Report
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-white/90 max-w-none">
                              {formatMessage(
                                m.content
                                  // force paragraph breaks after sentences
                                  .replace(/\. (?=[A-Z])/g, ".\n\n")
                              )}
                            </div>
                          )}
                        </div>
                        {copiedMsgId === m.id && (
                          <div className={classNames(isUser ? "mt-1 text-right" : "mt-1 text-left")}>
                            <div className="text-xs text-[#0EA5FF]">Copied</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

               {isSending && (
  <div className="flex justify-start">
    <div className="px-2.5 py-1.5 rounded-lg w-fit max-w-[75%]">
      <ZelrexThinking />
    </div>
  </div>
)}


                <div ref={listEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div
              className={classNames(
                "sticky bottom-0 pb-6 pt-5 relative transition-z",
                sidebarOpen ? "z-30" : "z-[9999]"
              )}
            >
              <div
                className={classNames(
                  draftAttachments.length ? "rounded-2xl" : "rounded-full",
                  "border border-white/10 bg-[#071018] px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
                )}
              >
                  {draftAttachments.length > 0 && (
                    <div className="mb-2 rounded-xl bg-white/5 p-2">
                      <div className="flex flex-wrap gap-2">
                        {draftAttachments.map((a) => {
                          const isImg = a.kind === "image";
                          return (
                            <div
                              key={a.id}
                              className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/20"
                              style={{ width: 96, height: 96 }}
                            >
                              {isImg ? (
                                /* image preview */
                                <img
                                  src={a.previewUrl}
                                  alt={a.file.name}
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              ) : (
                                /* file chip */
                                <div className="flex h-full w-full flex-col justify-between p-2">
                                  <div className="text-xs text-white/80 line-clamp-3">
                                    {a.file.name}
                                  </div>
                                  <div className="text-[11px] text-white/40">
                                    {(a.file.size / 1024).toFixed(0)} KB
                                  </div>
                                </div>
                              )}

                              {/* Hover remove (×) */}
                              <button
                                type="button"
                                onClick={() => removeDraftAttachment(a.id)}
                                className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove attachment"
                              >
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white/80 hover:bg-black/80">
                                  ×
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center">
                    {/* LEFT */}
                    <div className="flex items-center">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFilesToDraft(e.target.files);
                      e.currentTarget.value = ""; // allows selecting same file twice
                    }}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFilesToDraft(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachMenuOpen((v) => !v)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label="Add"
                    >
                      <Icon name="plus" className="h-5 w-5" />
                    </button>

                    {attachMenuOpen && (
                      <div
                        onMouseDown={(e) => e.stopPropagation()}
                        className="absolute left-0 bottom-14 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0A1020] shadow-2xl"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            imageInputRef.current?.click();
                          }}
                        >
                          <span className="text-white/60">▣</span>
                          Add images
                        </button>

                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <span className="text-white/60">≡</span>
                          Add files
                        </button>
                      </div>
                    )}
                  </div>

                    </div>

                  <div className="flex-1 flex items-center">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      onPaste={onInputPaste}
                      placeholder="Message Zelrex…"
                      className="max-h-[180px] min-h-[40px] w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-white/90 outline-none placeholder:text-white/35"
                    />
                  </div>

                  <div className="flex items-center gap-1 pr-1">
                    <button
                      type="button"
                      onClick={startSpeech}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label="Speech to text"
                    >
                      <Icon name="microphone" className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={isSending ? stopResponse : sendMessage}
                      className={classNames(
                        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                        isSending
                          ? "bg-[#0EA5FF] text-white"
                          : input.trim() || draftAttachments.length > 0
                          ? "bg-[#0EA5FF] text-white"
                          : "bg-white/10 text-white/40"
                      )}
                      aria-label={isSending ? "Stop" : "Send"}
                    >
                      {isSending ? (
                        <Icon name="stop" className="h-4 w-4" />
                      ) : (
                        <Icon name="send" className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtle disclaimer (ChatGPT/Gemini style) */}
              <div className="mt-2 text-center text-xs text-white/35">
                Zelrex can make mistakes. Check important info before making business decisions.
              </div>
            </div>

            {/* Bottom background overlay: sits above messages but below the input box */}
            <div className="fixed left-0 right-0 bottom-0 z-20 pointer-events-none">
              <div className="mx-auto max-w-[820px] px-4 h-28 bg-[#05070C]" />
            </div>
          </div>
        </main>

        {/* Dim backdrop when sidebar open (premium feel) */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar backdrop"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 top-14 z-40 bg-black/40"
          />
        )}
      </div>
    </div>
  );
}
