"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/components/DashboardLayout";
import ConversationList from "@/app/components/messaging/ConversationList";
import ChatWindow from "@/app/components/messaging/ChatWindow";
import NewConversationModal from "@/app/components/messaging/NewConversationModal";
import { useConversations } from "@/app/hooks/useConversations";

function MessagerieContent() {
  const { conversations, loading } = useConversations();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const convParam = searchParams.get("conv");
    if (convParam) setSelectedId(convParam);
  }, [searchParams]);
  const [showNewModal, setShowNewModal] = useState(false);

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  const handleCreated = (id: string) => {
    setSelectedId(id);
    setShowNewModal(false);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-2rem)] flex gap-4">
        {/* Panneau gauche : liste des conversations */}
        <div className="w-80 shrink-0 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-opti-blue rounded-full animate-spin" />
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onNew={() => setShowNewModal(true)}
            />
          )}
        </div>

        {/* Panneau droit : fenêtre de chat */}
        <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <ChatWindow conversation={selectedConversation} />
        </div>
      </div>

      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleCreated}
        />
      )}
    </DashboardLayout>
  );
}

export default function MessageriePage() {
  return (
    <Suspense>
      <MessagerieContent />
    </Suspense>
  );
}
