"use client";

import { useState, useEffect } from "react";
import { Users, Building2, Mail, MapPin, Pencil, Trash2, X } from "lucide-react";
import { Client } from "@/types";
import { subscribeToClients, deleteClient } from "@/services/clients";
import ClientFormModal from "./ClientFormModal";

interface ClientsListProps {
  onConfigure: (client: Client) => void;
  editable: boolean;
}

export default function ClientsList({ onConfigure, editable }: ClientsListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToClients((data) => {
      setClients(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getInitialsColor = (name: string) => {
    const colors = [
      "bg-rose-500",
      "bg-blue-600",
      "bg-emerald-600",
      "bg-violet-600",
      "bg-amber-600",
      "bg-cyan-600",
    ];
    const code = name.charCodeAt(0) || 0;
    return colors[code % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient) return;
    setDeleting(true);
    await deleteClient(deletingClient.id);
    setDeleting(false);
    setDeletingClient(null);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-blue"></div>
      </div>
    );

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
          <Users className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 font-semibold text-sm">
          Aucun client enregistré. Ajoutez-en un pour commencer.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {clients.map((client) => (
          <div
            key={client.id}
            onClick={() => onConfigure(client)}
            className="group relative bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:border-opti-red/30 hover:shadow-md transition-all cursor-pointer"
          >
            {/* Actions */}
            {editable && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingClient(client);
                  }}
                  className="p-1.5 text-gray-400 hover:text-opti-blue bg-white rounded-lg shadow-sm border border-gray-100 transition-colors cursor-pointer"
                  aria-label="Modifier le client"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingClient(client);
                  }}
                  className="p-1.5 text-gray-400 hover:text-opti-red bg-white rounded-lg shadow-sm border border-gray-100 transition-colors cursor-pointer"
                  aria-label="Supprimer le client"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Header : avatar + nom + rôle/entreprise */}
            <div className="flex flex-col items-center text-center mb-4">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold mb-3 ${getInitialsColor(
                  client.name,
                )}`}
              >
                {getInitials(client.name)}
              </div>
              <h3 className="text-lg font-bold text-opti-blue font-display">
                {client.name || "Sans nom"}
              </h3>
              <p className="text-xs font-semibold text-opti-red mt-0.5">
                {[client.role, client.company].filter(Boolean).join(" – ")}
              </p>
            </div>

            {/* Détails */}
            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{client.company || "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{client.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate">{client.address || "—"}</span>
              </div>
            </div>

            {/* Abonnement */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
              <span className="text-sm text-gray-500">Abonnement</span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  client.subscriptionActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {client.subscriptionActive ? "Actif" : "Inactif"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal d'édition des infos de base */}
      {editingClient && (
        <ClientFormModal
          isOpen={!!editingClient}
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSaved={() => setEditingClient(null)}
        />
      )}

      {/* Modal de confirmation de suppression */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeletingClient(null)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 animate-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-opti-blue font-display">
                Supprimer le client
              </h2>
              <button
                onClick={() => setDeletingClient(null)}
                className="p-2 text-gray-400 hover:text-opti-blue hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Voulez-vous vraiment supprimer{" "}
              <span className="font-semibold text-opti-blue">
                {deletingClient.name || deletingClient.company}
              </span>{" "}
              ? Cette action est irréversible.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingClient(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-opti-blue hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
