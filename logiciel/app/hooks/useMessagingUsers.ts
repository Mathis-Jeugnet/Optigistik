"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { MessagingUser, canMessageRole } from "@/lib/messaging";

// Retourne la liste des utilisateurs que le user connecté peut contacter.
export function useMessagingUsers() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<MessagingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !profile?.role) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, "users"));
      const all: MessagingUser[] = snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() } as MessagingUser))
        .filter(
          (u) =>
            u.uid !== user.uid &&
            canMessageRole(profile.role, u.role)
        );
      setUsers(all);
      setLoading(false);
    };

    fetchUsers();
  }, [user?.uid, profile?.role]);

  return { users, loading };
}
