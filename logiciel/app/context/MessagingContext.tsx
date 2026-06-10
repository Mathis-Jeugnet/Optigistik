"use client";

import React, { createContext, useContext } from "react";
import { useConversations } from "@/app/hooks/useConversations";
import { Conversation } from "@/lib/messaging";

interface MessagingContextType {
  conversations: Conversation[];
  totalUnread: number;
  loading: boolean;
}

const MessagingContext = createContext<MessagingContextType>({
  conversations: [],
  totalUnread: 0,
  loading: true,
});

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { conversations, totalUnread, loading } = useConversations();

  return (
    <MessagingContext.Provider value={{ conversations, totalUnread, loading }}>
      {children}
    </MessagingContext.Provider>
  );
}

export const useMessaging = () => useContext(MessagingContext);
