import { Timestamp } from "firebase/firestore";
import { UserRole } from "@/app/context/AuthContext";

export interface LastMessage {
  content: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  participantIds: string[];
  participantRoles: Record<string, UserRole>;
  participantNames: Record<string, string>;
  name?: string;
  createdBy: string;
  createdAt: Timestamp;
  lastMessage?: LastMessage;
  lastMessageAt?: Timestamp;
  unreadCounts: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  readBy: string[];
}

export interface MessagingUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

// Matrice de permissions : qui peut initier une conversation directe avec qui.
export const canMessageRole = (senderRole: UserRole, recipientRole: UserRole): boolean => {
  if (senderRole === "Chauffeur") {
    return recipientRole === "Admin" || recipientRole === "Gestionnaire";
  }
  if (senderRole === "Lecteur") {
    return recipientRole !== "Chauffeur";
  }
  // Admin et Gestionnaire peuvent contacter tout le monde
  return true;
};

export const getConversationDisplayName = (
  conversation: Conversation,
  currentUid: string
): string => {
  if (conversation.type === "group") {
    return conversation.name || "Groupe";
  }
  const otherUid = conversation.participantIds.find((id) => id !== currentUid);
  if (!otherUid) return "Conversation";
  return conversation.participantNames[otherUid] || "Utilisateur";
};

export const getConversationUnread = (
  conversation: Conversation,
  uid: string
): number => {
  return conversation.unreadCounts?.[uid] ?? 0;
};

export const formatMessageTime = (timestamp: Timestamp | undefined): string => {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
};
