"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Client } from "@/types";
import { addClient, updateClient, defaultConstraints } from "@/services/clients";

interface ClientFormModalProps {
  isOpen: boolean;
  client?: Client; // présent => mode édition
  onClose: () => void;
  onSaved: (client: Client) => void;
}

export default function ClientFormModal({
  isOpen,
  client,
  onClose,
  onSaved,
}: ClientFormModalProps) {
  const isEdit = !!client;
  const [form, setForm] = useState(() => ({
    name: client?.name ?? "",
    role: client?.role ?? "",
    company: client?.company ?? "",
    email: client?.email ?? "",
    address: client?.address ?? "",
    subscriptionActive: client?.subscriptionActive ?? true,
  }));
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isEdit && client) {
      const success = await updateClient(client.id, {
        name: form.name,
        role: form.role,
        company: form.company,
        email: form.email,
        address: form.address,
        subscriptionActive: form.subscriptionActive,
      });
      setSaving(false);
      if (success) {
        onSaved({ ...client, ...form });
      }
    } else {
      const created = await addClient({
        ...form,
        constraints: defaultConstraints(),
      });
      setSaving(false);
      if (created) {
        onSaved(created);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 animate-in">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-3xl border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-opti-blue font-display">
            {isEdit ? "Modifier le client" : "Ajouter un client"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-opti-blue hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <fieldset>
            <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Contact
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Nom du contact
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Prénom Nom"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Fonction
                </label>
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="Fonction du contact"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="prenom.nom@entreprise.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1.5">
                  Abonnement
                </label>
                <select
                  value={form.subscriptionActive ? "active" : "inactive"}
                  onChange={(e) =>
                    handleChange("subscriptionActive", e.target.value === "active")
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Entreprise & Adresse
            </legend>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Entreprise
                </label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => handleChange("company", e.target.value)}
                  placeholder="Nom de l'entreprise"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="N° rue, code postal, ville"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-opti-blue hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
