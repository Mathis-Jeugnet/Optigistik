"use client";

import { useState } from "react";
import { X, Search, Users, User, Loader2 } from "lucide-react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import { useMessagingUsers } from "@/app/hooks/useMessagingUsers";
import { MessagingUser } from "@/lib/messaging";

interface NewConversationModalProps {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export default function NewConversationModal({
  onClose,
  onCreated,
}: NewConversationModalProps) {
  const { user, profile } = useAuth();
  const { users, loading } = useMessagingUsers();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<MessagingUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);

  const canCreateGroup =
    profile?.role === "Admin" || profile?.role === "Gestionnaire";

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (u: MessagingUser) => {
    if (mode === "direct") {
      setSelected([u]);
    } else {
      setSelected((prev) =>
        prev.some((p) => p.uid === u.uid)
          ? prev.filter((p) => p.uid !== u.uid)
          : [...prev, u]
      );
    }
  };

  const handleCreate = async () => {
    if (!user?.uid || !profile || selected.length === 0) return;
    if (mode === "group" && !groupName.trim()) return;
    setCreating(true);

    try {
      if (mode === "direct") {
        const target = selected[0];

        // Chercher une conversation directe existante
        const q = query(
          collection(db, "conversations"),
          where("type", "==", "direct"),
          where("participantIds", "array-contains", user.uid)
        );
        const snap = await getDocs(q);
        const existing = snap.docs.find((d) =>
          d.data().participantIds.includes(target.uid)
        );
        if (existing) {
          onCreated(existing.id);
          return;
        }

        const participantIds = [user.uid, target.uid];
        const ref = await addDoc(collection(db, "conversations"), {
          type: "direct",
          participantIds,
          participantRoles: {
            [user.uid]: profile.role,
            [target.uid]: target.role,
          },
          participantNames: {
            [user.uid]: profile.name || profile.email,
            [target.uid]: target.name || target.email,
          },
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          unreadCounts: Object.fromEntries(participantIds.map((id) => [id, 0])),
        });
        onCreated(ref.id);
      } else {
        const allParticipants = [
          { uid: user.uid, name: profile.name || profile.email, role: profile.role },
          ...selected,
        ];
        const participantIds = allParticipants.map((p) => p.uid);
        const ref = await addDoc(collection(db, "conversations"), {
          type: "group",
          name: groupName.trim(),
          participantIds,
          participantRoles: Object.fromEntries(allParticipants.map((p) => [p.uid, p.role])),
          participantNames: Object.fromEntries(
            allParticipants.map((p) => [p.uid, p.name])
          ),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          lastMessageAt: serverTimestamp(),
          unreadCounts: Object.fromEntries(participantIds.map((id) => [id, 0])),
        });
        onCreated(ref.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const roleLabel: Record<string, string> = {
    Admin: "Admin",
    Gestionnaire: "Gestionnaire",
    Lecteur: "Lecteur",
    Chauffeur: "Chauffeur",
  };

  const roleColor: Record<string, string> = {
    Admin: "bg-red-50 text-opti-red",
    Gestionnaire: "bg-blue-50 text-opti-blue",
    Lecteur: "bg-slate-100 text-slate-500",
    Chauffeur: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-opti-blue font-display">
            Nouvelle conversation
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type toggle */}
        {canCreateGroup && (
          <div className="flex gap-2 p-4 pb-0">
            <button
              onClick={() => { setMode("direct"); setSelected([]); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                mode === "direct"
                  ? "bg-opti-blue text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <User className="w-4 h-4" />
              Direct
            </button>
            <button
              onClick={() => { setMode("group"); setSelected([]); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                mode === "group"
                  ? "bg-opti-blue text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Groupe
            </button>
          </div>
        )}

        {/* Group name */}
        {mode === "group" && (
          <div className="px-4 pt-3">
            <input
              type="text"
              placeholder="Nom du groupe"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-opti-blue/20 focus:border-opti-blue"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-opti-blue/20 focus:border-opti-blue"
            />
          </div>
        </div>

        {/* Selected chips (group mode) */}
        {mode === "group" && selected.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-2">
            {selected.map((u) => (
              <span
                key={u.uid}
                className="flex items-center gap-1 px-2 py-1 bg-opti-blue/10 text-opti-blue rounded-lg text-xs font-medium"
              >
                {u.name || u.email}
                <button onClick={() => toggleUser(u)} className="cursor-pointer hover:text-opti-red">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-opti-blue rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Aucun utilisateur disponible
            </p>
          ) : (
            filtered.map((u) => {
              const isSelected = selected.some((s) => s.uid === u.uid);
              return (
                <button
                  key={u.uid}
                  onClick={() => toggleUser(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left cursor-pointer ${
                    isSelected
                      ? "bg-opti-blue/10 border border-opti-blue/30"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-opti-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {u.name || u.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${roleColor[u.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleCreate}
            disabled={
              creating ||
              selected.length === 0 ||
              (mode === "group" && !groupName.trim())
            }
            className="w-full py-2.5 rounded-xl bg-opti-blue text-white font-semibold text-sm hover:bg-opti-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "direct" ? "Démarrer la conversation" : "Créer le groupe"}
          </button>
        </div>
      </div>
    </div>
  );
}
