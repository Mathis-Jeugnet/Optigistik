"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { Conversation } from "@/lib/messaging";

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const convs: Conversation[] = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as Conversation))
          .sort((a, b) => {
            const ta = a.lastMessageAt?.toMillis() ?? 0;
            const tb = b.lastMessageAt?.toMillis() ?? 0;
            return tb - ta;
          });
        setConversations(convs);
        setLoading(false);
      },
      (error) => {
        console.error("[useConversations] Firestore error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const totalUnread = conversations.reduce((sum, conv) => {
    return sum + (conv.unreadCounts?.[user?.uid ?? ""] ?? 0);
  }, 0);

  return { conversations, loading, totalUnread };
}
