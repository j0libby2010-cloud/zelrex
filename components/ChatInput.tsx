import { useRef } from "react";

export default function ChatInput() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  return (
    <div className="border-t border-zinc-800 p-4">
      <textarea
        ref={textareaRef}
        onInput={handleInput}
        rows={1}
        placeholder="Message Zelrex..."
        className="w-full resize-none rounded-md bg-zinc-900 text-white text-sm px-3 py-2 outline-none border border-zinc-800 focus:border-zinc-700"
      />
    </div>
  );
}
