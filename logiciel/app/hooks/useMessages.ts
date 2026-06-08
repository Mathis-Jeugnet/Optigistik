"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  increment,
  getDoc,
  getDocs,
  limitToLast,
  limit,
  endBefore,
  Timestamp,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { Message } from "@/lib/messaging";

const PAGE_SIZE = 30;

function expiresAt(): Timestamp {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return Timestamp.fromDate(d);
}

export function useMessages(conversationId: string | null) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const oldestDocRef = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setHasMore(true);
    oldestDocRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !user?.uid) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: Message[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as Message));

        setMessages(msgs);
        setLoading(false);

        if (snapshot.docs.length > 0) {
          oldestDocRef.current = snapshot.docs[0];
        }
        if (snapshot.docs.length < PAGE_SIZE) {
          setHasMore(false);
        }

        const unread = snapshot.docs.filter(
          (d) => !d.data().readBy?.includes(user.uid)
        );
        if (unread.length > 0) {
          unread.forEach((msgDoc) =>
            updateDoc(msgDoc.ref, { readBy: arrayUnion(user.uid) })
          );
          updateDoc(doc(db, "conversations", conversationId), {
            [`unreadCounts.${user.uid}`]: 0,
          });
        }
      },
      (error) => {
        console.error("[useMessages] Firestore error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [conversationId, user?.uid]);

  const loadMore = useCallback(async () => {
    if (!conversationId || !oldestDocRef.current || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "conversations", conversationId, "messages"),
        orderBy("createdAt", "asc"),
        endBefore(oldestDocRef.current),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMore(false);
        return;
      }

      const older: Message[] = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      } as Message));

      oldestDocRef.current = snap.docs[0];
      setMessages((prev) => [...older, ...prev]);

      if (snap.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, hasMore]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !user?.uid || !profile || !content.trim()) return;

      const convRef = doc(db, "conversations", conversationId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) return;

      const otherParticipants: string[] = convSnap
        .data()
        .participantIds.filter((id: string) => id !== user.uid);

      const senderName = profile.name || profile.email;

      await addDoc(
        collection(db, "conversations", conversationId, "messages"),
        {
          senderId: user.uid,
          senderName,
          content: content.trim(),
          createdAt: serverTimestamp(),
          expiresAt: expiresAt(),
          readBy: [user.uid],
        }
      );

      const update: Record<string, unknown> = {
        lastMessage: {
          content: content.trim(),
          senderId: user.uid,
          senderName,
          createdAt: serverTimestamp(),
        },
        lastMessageAt: serverTimestamp(),
      };
      otherParticipants.forEach((uid) => {
        update[`unreadCounts.${uid}`] = increment(1);
      });

      await updateDoc(convRef, update);
    },
    [conversationId, user?.uid, profile]
  );

  return { messages, loading, loadingMore, hasMore, loadMore, sendMessage };
}
