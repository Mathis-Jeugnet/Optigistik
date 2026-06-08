"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import RoleGuard from "../components/RoleGuard";
import ClientsList from "../components/ClientsList";
import ClientConfig from "../components/ClientConfig";
import ClientFormModal from "../components/ClientFormModal";
import { Client } from "@/types";
import { useAuth, canEdit } from "../context/AuthContext";

type ViewState = "list" | "config";

export default function ClientsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [view, setView] = useState<ViewState>("list");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [listKey, setListKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const editable = canEdit(profile?.role);

  const handleConfigure = (client: Client) => {
    setSelectedClient(client);
    setView("config");
  };

  const handleBackToList = () => {
    setSelectedClient(null);
    setView("list");
    setListKey((k) => k + 1);
  };

  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur"]}>
        <div className="w-full space-y-6">
          {authLoading ? (
            <div className="flex h-[400px] items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-opti-blue"></div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500 space-y-6">
              {view === "list" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-opti-blue font-display">
                        Gestion des clients
                      </h1>
                      <p className="text-sm text-gray-500 mt-1">
                        Gérez vos clients, leurs adresses et leurs contraintes
                        logistiques.
                      </p>
                    </div>
                    {editable && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter un client
                      </button>
                    )}
                  </div>

                  <ClientsList
                    key={listKey}
                    onConfigure={handleConfigure}
                    editable={editable}
                  />
                </>
              )}

              {view === "config" && selectedClient && (
                <ClientConfig
                  client={selectedClient}
                  editable={editable}
                  onUpdate={(updated) => setSelectedClient(updated)}
                  onBack={handleBackToList}
                />
              )}
            </div>
          )}

          {showCreateModal && (
            <ClientFormModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSaved={() => {
                setShowCreateModal(false);
                setListKey((k) => k + 1);
              }}
            />
          )}
        </div>
      </RoleGuard>
    </DashboardLayout>
  );
}
