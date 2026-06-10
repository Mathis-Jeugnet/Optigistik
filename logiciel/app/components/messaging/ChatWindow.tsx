"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { useMessages } from "@/app/hooks/useMessages";
import { useAuth } from "@/app/context/AuthContext";
import { Conversation, getConversationDisplayName, formatMessageTime } from "@/lib/messaging";

interface ChatWindowProps {
  conversation: Conversation | null;
}

export default function ChatWindow({ conversation }: ChatWindowProps) {
  const { user } = useAuth();
  const { messages, loading, loadingMore, hasMore, loadMore, sendMessage } =
    useMessages(conversation?.id ?? null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef(0);
  const isFirstLoad = useRef(true);

  // Scroll en bas au premier chargement
  useEffect(() => {
    if (!loading && isFirstLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      isFirstLoad.current = false;
    }
  }, [loading]);

  // Scroll en bas à chaque nouveau message si déjà en bas
  useEffect(() => {
    if (loading || isFirstLoad.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // Maintenir la position de scroll après chargement de messages anciens
  useEffect(() => {
    if (!loadingMore) {
      const el = scrollRef.current;
      if (el && prevScrollHeightRef.current) {
        el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
        prevScrollHeightRef.current = 0;
      }
    }
  }, [loadingMore]);

  // Reset au changement de conversation
  useEffect(() => {
    isFirstLoad.current = true;
    setInput("");
  }, [conversation?.id]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop < 80) {
      prevScrollHeightRef.current = el.scrollHeight;
      loadMore();
    }
  }, [loadMore, loadingMore, hasMore]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const text = input;
    setInput("");
    try {
      await sendMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <MessageSquare className="w-12 h-12 mb-3 text-gray-200" />
        <p className="text-sm font-medium">Sélectionnez une conversation</p>
        <p className="text-xs mt-1">ou démarrez-en une nouvelle via le bouton +</p>
      </div>
    );
  }

  const displayName = getConversationDisplayName(conversation, user?.uid ?? "");

  const groupedMessages = messages.reduce<{ date: string; msgs: typeof messages }[]>(
    (acc, msg) => {
      if (!msg.createdAt) return acc;
      const dateStr = msg.createdAt.toDate().toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      const last = acc[acc.length - 1];
      if (last?.date === dateStr) {
        last.msgs.push(msg);
      } else {
        acc.push({ date: dateStr, msgs: [msg] });
      }
      return acc;
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-opti-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-opti-blue text-sm">{displayName}</p>
          {conversation.type === "group" && (
            <p className="text-[11px] text-gray-400">
              {conversation.participantIds.length} participants
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-1"
      >
        {loadingMore && (
          <div className="flex justify-center py-3">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-opti-blue rounded-full animate-spin" />
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <p className="text-center text-[11px] text-gray-300 py-2">
            Début de la conversation
          </p>
        )}

        {loading ? (
          <div className="flex justify-center pt-8">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-opti-blue rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>Aucun message. Démarrez la conversation !</p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[11px] text-gray-400 capitalize shrink-0">{group.date}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {group.msgs.map((msg, idx) => {
                const isOwn = msg.senderId === user?.uid;
                const prevMsg = group.msgs[idx - 1];
                const isSameSender = prevMsg?.senderId === msg.senderId;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isSameSender ? "mt-0.5" : "mt-3"}`}
                  >
                    <div className={`max-w-[70%] min-w-0 flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                      {!isOwn && !isSameSender && (
                        <span className="text-[11px] text-gray-400 mb-1 ml-1">{msg.senderName}</span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-all ${
                          isOwn
                            ? "bg-opti-blue text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-800 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message… (Entrée pour envoyer)"
            rows={1}
            disabled={sending}
            className="flex-1 resize-none px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-opti-blue/20 focus:border-opti-blue max-h-28 overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-opti-blue text-white hover:bg-opti-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
