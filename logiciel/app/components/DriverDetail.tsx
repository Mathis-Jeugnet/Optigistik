"use client";

import { useState } from "react";
import {
  ArrowLeft, Mail, Phone, Pencil, Truck,
  CalendarPlus, Save, Trash2, ChevronRight, Shield, Clock,
} from "lucide-react";
import { Driver, DriverUnavailability } from "@/types";
import { updateDriver } from "@/services/drivers";
import { useAuth } from "../context/AuthContext";

interface DriverDetailProps {
  driver: Driver;
  onUpdate: (updated: Driver) => void;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  EN_MISSION: { label: "EN MISSION", bg: "bg-emerald-800", text: "text-white" },
  DISPONIBLE: { label: "ACTIF", bg: "bg-emerald-100", text: "text-emerald-800" },
  INDISPONIBLE: { label: "INDISPONIBLE", bg: "bg-amber-500", text: "text-white" },
};

const unavailabilityTypeConfig: Record<string, { label: string; color: string; bg: string }> = {
  CONGES_ANNUELS: { label: "CONGÉS ANNUELS", color: "text-opti-red", bg: "bg-red-50" },
  FORMATION: { label: "FORMATION TECHNIQUE", color: "text-blue-700", bg: "bg-blue-50" },
  MALADIE: { label: "ARRÊT MALADIE", color: "text-amber-700", bg: "bg-amber-50" },
  AUTRE: { label: "AUTRE", color: "text-gray-700", bg: "bg-gray-50" },
};

export default function DriverDetail({ driver, onUpdate, onBack }: DriverDetailProps) {
  const [saving, setSaving] = useState(false);
  const [showUnavailForm, setShowUnavailForm] = useState(false);
  const [unavailForm, setUnavailForm] = useState({
    type: "CONGES_ANNUELS" as DriverUnavailability["type"],
    startDate: "",
    endDate: "",
    note: "",
  });
  const [savingUnavail, setSavingUnavail] = useState(false);
  const [editingUnavailId, setEditingUnavailId] = useState<string | null>(null);
  const { profile } = useAuth();
  const isAdmin = (profile?.role as string) === "admin" || (profile?.role as string) === "Admin";

  const status = statusConfig[driver.status] || statusConfig.DISPONIBLE;

  const handleAddUnavailability = async () => {
    if (!isAdmin) {
      alert("Seuls les administrateurs peuvent modifier les indisponibilités.");
      return;
    }
    if (!unavailForm.startDate || !unavailForm.endDate) {
      alert("Veuillez renseigner une date de début et une date de fin.");
      return;
    }

    try {
      setSavingUnavail(true);
      const currentUnavailabilities = Array.isArray(driver.unavailabilities) ? driver.unavailabilities : [];
      let updated;

      if (editingUnavailId) {
        // Mode Edition
        updated = currentUnavailabilities.map(u => {
          if (u.id === editingUnavailId) {
            const updatedItem: DriverUnavailability = {
              ...u,
              type: unavailForm.type,
              label: unavailabilityTypeConfig[unavailForm.type]?.label || unavailForm.type,
              startDate: unavailForm.startDate,
              endDate: unavailForm.endDate,
            };
            if (unavailForm.note.trim()) {
              updatedItem.note = unavailForm.note.trim();
            } else {
              delete updatedItem.note;
            }
            return updatedItem;
          }
          return u;
        });
      } else {
        // Mode Création
        const newUnavail: DriverUnavailability = {
          id: `u-${Date.now()}`,
          type: unavailForm.type,
          label: unavailabilityTypeConfig[unavailForm.type]?.label || unavailForm.type,
          startDate: unavailForm.startDate,
          endDate: unavailForm.endDate,
        };
        if (unavailForm.note.trim()) {
          newUnavail.note = unavailForm.note.trim();
        }
        
        updated = [...currentUnavailabilities, newUnavail];
      }
      
      const success = await updateDriver(driver.id, { unavailabilities: updated });
      
      if (success) {
        onUpdate({ ...driver, unavailabilities: updated });
        setShowUnavailForm(false);
        setEditingUnavailId(null);
        setUnavailForm({ type: "CONGES_ANNUELS", startDate: "", endDate: "", note: "" });
        alert(editingUnavailId ? "Indisponibilité modifiée avec succès." : "Indisponibilité ajoutée avec succès.");
      } else {
        alert("Erreur lors de la mise à jour sur le serveur.");
      }
    } catch (err) {
      console.error("Erreur handleAddUnavailability:", err);
      alert("Une erreur est survenue.");
    } finally {
      setSavingUnavail(false);
    }
  };

  const handleDeleteUnavailability = async (unavailId: string) => {
    if (!isAdmin) return;
    if (!confirm("Supprimer cette période d'indisponibilité ?")) return;
    
    try {
      const updated = (driver.unavailabilities || []).filter(u => u.id !== unavailId);
      const success = await updateDriver(driver.id, { unavailabilities: updated });
      if (success) {
        onUpdate({ ...driver, unavailabilities: updated });
      } else {
        alert("Erreur lors de la suppression.");
      }
    } catch (err) {
      alert("Une erreur est survenue lors de la suppression.");
    }
  };

  const startEditingUnavail = (u: DriverUnavailability) => {
    setEditingUnavailId(u.id);
    setUnavailForm({
      type: u.type,
      startDate: u.startDate,
      endDate: u.endDate,
      note: u.note || "",
    });
    setShowUnavailForm(true);
  };

  const getInitials = () => {
    return `${(driver.firstName || "").charAt(0)}${(driver.lastName || "").charAt(0)}`.toUpperCase();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Back link - Changé de Link à Button pour la navigation par vue */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-opti-blue transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>

        {/* Profile Header */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-opti-blue text-2xl font-bold font-display">
                  {getInitials()}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-opti-blue font-display">
                    {driver.firstName} {driver.lastName}
                  </h1>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  🚛 {driver.role || "Conducteur"}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    {driver.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    {driver.phone}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Informations Techniques */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-5 h-5 text-opti-blue" />
                <h2 className="text-lg font-bold text-opti-blue font-display">
                  Informations Techniques
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Type de permis</p>
                  <p className="text-sm font-semibold text-opti-blue">
                    {(driver.licenseTypes || []).join(", ") || "Non renseigné"}
                    {driver.licenseExpiry && (
                      <span className="text-gray-400 font-normal"> (Valide jusqu&apos;en {new Date(driver.licenseExpiry).getFullYear()})</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">ID Employé</p>
                  <p className="text-sm font-semibold text-opti-blue">{driver.employeeId}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ancienneté</p>
                  <p className="text-sm font-semibold text-opti-blue">
                    {(() => {
                      if (!driver.seniority || !driver.seniority.includes('-')) return driver.seniority;
                      const hireDate = new Date(driver.seniority);
                      if (isNaN(hireDate.getTime())) return driver.seniority;
                      const diffTime = Math.abs(new Date().getTime() - hireDate.getTime());
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      return `${hireDate.toLocaleDateString('fr-FR')} (${diffDays} jours)`;
                    })()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Langues</p>
                  <p className="text-sm font-semibold text-opti-blue">{(driver.languages || []).join(", ") || "Non renseigné"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Régime contractuel</p>
                  <p className="text-sm font-semibold text-opti-blue">{driver.regime === "GRAND_ROUTIER" ? "Grand Routier" : "Autre personnel"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Travail de nuit</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <p className="text-sm font-semibold text-opti-blue">{driver.nightWorkAuthorized ? "Autorisé" : "Non autorisé"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Véhicules Assignés */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-5">
                <Truck className="w-5 h-5 text-opti-blue" />
                <h2 className="text-lg font-bold text-opti-blue font-display">Véhicules Assignés</h2>
              </div>
              {(driver.assignedVehicles || []).length > 0 ? (
                <div className="space-y-3">
                  {(driver.assignedVehicles || []).map((vehicle) => (
                    <div key={vehicle.vehicleId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-gray-200">
                          <Truck className="w-5 h-5 text-opti-blue" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-opti-blue">{vehicle.label}</p>
                          <p className="text-xs text-gray-500">
                            {vehicle.role === "PRINCIPAL" ? "Véhicule principal" : "Remplacement temporaire"}
                            {vehicle.isActive ? " · Actif" : ""}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">Aucun véhicule assigné</p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-opti-blue font-display">Indisponibilité</h2>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setShowUnavailForm(!showUnavailForm);
                      if (showUnavailForm) {
                        setEditingUnavailId(null);
                        setUnavailForm({ type: "CONGES_ANNUELS", startDate: "", endDate: "", note: "" });
                      }
                    }} 
                    className="flex items-center gap-1.5 text-sm text-opti-blue hover:text-opti-red font-semibold cursor-pointer"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    {showUnavailForm ? "Annuler" : "Ajouter"}
                  </button>
                )}
              </div>

              {isAdmin && showUnavailForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                  <select
                    value={unavailForm.type}
                    onChange={(e) => setUnavailForm({ ...unavailForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue bg-white"
                  >
                    <option value="CONGES_ANNUELS">Congés annuels</option>
                    <option value="FORMATION">Formation</option>
                    <option value="MALADIE">Arrêt maladie</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={unavailForm.startDate} onChange={(e) => setUnavailForm({ ...unavailForm, startDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue" />
                    <input type="date" value={unavailForm.endDate} onChange={(e) => setUnavailForm({ ...unavailForm, endDate: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue" />
                  </div>
                  <input type="text" value={unavailForm.note} onChange={(e) => setUnavailForm({ ...unavailForm, note: e.target.value })} placeholder="Note (optionnel)" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-opti-blue" />
                  <button onClick={handleAddUnavailability} disabled={savingUnavail} className="w-full py-2 bg-opti-red text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                    {savingUnavail ? "Enregistrement..." : (editingUnavailId ? "Modifier la période" : "Ajouter la période")}
                  </button>
                </div>
              )}

              <div className="space-y-3">
                 {(driver.unavailabilities || []).map((u) => {
                  const config = unavailabilityTypeConfig[u.type] || unavailabilityTypeConfig.AUTRE;
                  return (
                    <div key={u.id} className={`p-4 rounded-2xl border border-gray-100 ${config.bg} flex justify-between items-start group`}>
                      <div>
                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${config.color}`}>{config.label}</p>
                        <p className="text-sm font-bold text-opti-blue">
                          {new Date(u.startDate).toLocaleDateString("fr-FR")} – {new Date(u.endDate).toLocaleDateString("fr-FR")}
                        </p>
                        {u.note && <p className="text-xs text-gray-500 mt-1 italic">{u.note}</p>}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditingUnavail(u)} className="p-1.5 text-gray-400 hover:text-opti-blue bg-white rounded-lg shadow-sm border border-gray-100 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteUnavailability(u.id)} className="p-1.5 text-gray-400 hover:text-opti-red bg-white rounded-lg shadow-sm border border-gray-100 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}