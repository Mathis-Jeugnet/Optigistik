"use client";

import { useRouter } from "next/navigation";
import MessagesList from "./MessagesList";
import { useConversations } from "../hooks/useConversations";
import { useAuth } from "../context/AuthContext";
import { Conversation, getConversationDisplayName, formatMessageTime } from "@/lib/messaging";

export default function RecentMessagesWidget() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, totalUnread } = useConversations();

  const recentMessages = conversations.slice(0, 4).map((conv: Conversation) => ({
    id: conv.id,
    name: getConversationDisplayName(conv, user?.uid ?? ""),
    time: formatMessageTime(conv.lastMessageAt),
    content: conv.lastMessage?.content ?? "",
    unread: (conv.unreadCounts?.[user?.uid ?? ""] ?? 0) > 0,
  }));

  const handleItemClick = (id: string) => {
    router.push(`/messagerie?conv=${id}`);
  };

  return (
    <div className="h-full">
      <MessagesList messages={recentMessages} unreadCount={totalUnread} onItemClick={handleItemClick} />
    </div>
  );
}
