"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Driver, DriverRegime } from "@/types";
import { updateDriver, addDriver } from "@/services/drivers";

interface DriverEditModalProps {
  driver: Driver;
  isOpen: boolean;
  onClose: () => void;
  onSave: (saved: Driver) => void;
}

export default function DriverEditModal({ driver, isOpen, onClose, onSave }: DriverEditModalProps) {
  const [form, setForm] = useState(() => ({
    phone: driver.phone,
    licenseTypes: (driver.licenseTypes || []).join(", "),
    languages: (driver.languages || []).join(", "),
    seniority: driver.seniority,
    status: driver.status,
  }));
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const driverData = {
      phone: form.phone,
      licenseTypes: form.licenseTypes.split(",").map((s) => s.trim()).filter(Boolean),
      languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
      seniority: form.seniority,
      status: form.status,
    };

    const success = await updateDriver(driver.id, driverData);
    setSaving(false);
    if (success) {
      onSave({ ...driver, ...driverData });
      onClose();
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
          <h2 className="text-xl font-bold text-opti-blue font-display">
            Modifier le profil (Données de contact et Statut)
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
          {/* Contact & Statut */}
          <fieldset>
            <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Contact & Statut
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">Téléphone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1.5">
                  Statut actuel
                </label>
                <select
                  value={form.status}
                  onChange={(e) => handleChange("status", e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white"
                >
                  <option value="DISPONIBLE">Disponible</option>
                  <option value="EN_MISSION">En mission</option>
                  <option value="INDISPONIBLE">Indisponible</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Infos Techniques */}
          <fieldset>
            <legend className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Informations Techniques
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Types de permis
                </label>
                <input
                  type="text"
                  value={form.licenseTypes}
                  onChange={(e) => handleChange("licenseTypes", e.target.value)}
                  placeholder="Permis C, CE, FIMO"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-opti-blue mb-1">
                  Langues
                </label>
                <input
                  type="text"
                  value={form.languages}
                  onChange={(e) => handleChange("languages", e.target.value)}
                  placeholder="Français, Anglais"
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
