"use client";

import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Conversation, getConversationDisplayName, getConversationUnread, formatMessageTime } from "@/lib/messaging";
import { useAuth } from "@/app/context/AuthContext";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNew,
}: ConversationListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const filtered = conversations.filter((conv) => {
    const name = getConversationDisplayName(conv, user?.uid ?? "").toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-opti-blue font-display">Messages</h2>
          <button
            onClick={onNew}
            className="p-2 rounded-xl bg-opti-blue text-white hover:bg-opti-blue/90 transition-colors cursor-pointer"
            title="Nouvelle conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-opti-blue/20 focus:border-opti-blue"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm p-6 text-center">
            <p>Aucune conversation.</p>
            <p className="mt-1">Cliquez sur + pour en démarrer une.</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const name = getConversationDisplayName(conv, user?.uid ?? "");
            const unread = getConversationUnread(conv, user?.uid ?? "");
            const isSelected = conv.id === selectedId;

            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left border-b border-gray-50 cursor-pointer ${
                  isSelected ? "bg-red-50" : "hover:bg-gray-50"
                }`}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm bg-opti-blue">
                  {name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm truncate ${unread > 0 ? "font-bold text-opti-blue" : "font-semibold text-gray-700"}`}>
                      {name}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                      {formatMessageTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className={`text-xs truncate ${conv.lastMessage ? "text-gray-500" : "text-gray-300 italic"}`}>
                      {conv.lastMessage?.content ?? "Aucun message"}
                    </p>
                    {unread > 0 && (
                      <span className="ml-2 shrink-0 w-5 h-5 rounded-full bg-opti-red text-white text-[10px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
