export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-zinc-900 text-white flex flex-col border-r border-zinc-800">
      
      {/* Logo */}
      <div className="p-4 text-xl font-semibold tracking-tight">
        Zelrex
      </div>

      {/* New Chat Button */}
      <div className="px-4">
        <button className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition text-sm">
          New chat
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 mt-4 overflow-y-auto">
        <div className="px-4 py-2 text-sm text-zinc-400">
          Chats
        </div>

        {/* Fake chats for now */}
        <div className="px-4 py-2 text-sm rounded-md hover:bg-zinc-800 cursor-pointer">
          First business idea
        </div>
        <div className="px-4 py-2 text-sm rounded-md hover:bg-zinc-800 cursor-pointer">
          Website launch
        </div>
      </div>

      {/* Account Section */}
      <div className="p-4 border-t border-zinc-800 text-sm text-zinc-400">
        Account
      </div>

    </aside>
  );
}
