"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  Truck,
  Package,
  FileText,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import {
  Client,
  ClientConstraints,
  Weekday,
  WEEKDAYS,
} from "@/types";
import { updateClientConstraints, defaultConstraints } from "@/services/clients";
import {
  getVehicleTypes,
  getSpecialties,
  VehicleType,
  Specialty,
} from "@/services/fleet";

interface ClientConfigProps {
  client: Client;
  editable: boolean;
  onUpdate: (updated: Client) => void;
  onBack: () => void;
}

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

export default function ClientConfig({
  client,
  editable,
  onUpdate,
  onBack,
}: ClientConfigProps) {
  const [constraints, setConstraints] = useState<ClientConstraints>(
    () => client.constraints ?? defaultConstraints(),
  );
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Toute modification des contraintes réinitialise l'état "Enregistré"
  // pour repasser le bouton en "Enregistrer les modifications".
  const updateConstraints = (
    updater: (prev: ClientConstraints) => ClientConstraints,
  ) => {
    setConstraints(updater);
    setJustSaved(false);
  };

  useEffect(() => {
    let active = true;
    Promise.all([getVehicleTypes(), getSpecialties()]).then(
      ([types, specs]) => {
        if (!active) return;
        setVehicleTypes(types);
        setSpecialties(specs);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  // ---- Fenêtres horaires ----
  const toggleDayOpen = (day: Weekday) => {
    updateConstraints((prev) => {
      const window = prev.deliveryWindows[day];
      const open = !window.open;
      return {
        ...prev,
        deliveryWindows: {
          ...prev.deliveryWindows,
          [day]: {
            open,
            // À l'ouverture, on propose un créneau vide à renseigner soi-même.
            slots:
              open && window.slots.length === 0
                ? [{ start: "", end: "" }]
                : window.slots,
          },
        },
      };
    });
  };

  const updateSlot = (
    day: Weekday,
    index: number,
    field: "start" | "end",
    value: string,
  ) => {
    updateConstraints((prev) => {
      const slots = prev.deliveryWindows[day].slots.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      );
      return {
        ...prev,
        deliveryWindows: {
          ...prev.deliveryWindows,
          [day]: { ...prev.deliveryWindows[day], slots },
        },
      };
    });
  };

  const addSlot = (day: Weekday) => {
    updateConstraints((prev) => ({
      ...prev,
      deliveryWindows: {
        ...prev.deliveryWindows,
        [day]: {
          ...prev.deliveryWindows[day],
          slots: [
            ...prev.deliveryWindows[day].slots,
            { start: "", end: "" },
          ],
        },
      },
    }));
  };

  const removeSlot = (day: Weekday, index: number) => {
    updateConstraints((prev) => ({
      ...prev,
      deliveryWindows: {
        ...prev.deliveryWindows,
        [day]: {
          ...prev.deliveryWindows[day],
          slots: prev.deliveryWindows[day].slots.filter((_, i) => i !== index),
        },
      },
    }));
  };

  // ---- Gabarits ----
  const toggleVehicleType = (id: string) => {
    updateConstraints((prev) => {
      const set = new Set(prev.allowedVehicleTypes);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...prev, allowedVehicleTypes: Array.from(set) };
    });
  };

  // ---- Équipements ----
  const toggleEquipment = (value: string) => {
    updateConstraints((prev) => {
      const set = new Set(prev.requiredEquipment);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, requiredEquipment: Array.from(set) };
    });
  };

  const handleSave = async () => {
    if (!editable) return;
    setSaving(true);
    const success = await updateClientConstraints(client.id, constraints);
    setSaving(false);
    if (success) {
      const updated = {
        ...constraints,
        updatedAt: new Date().toISOString(),
      };
      setConstraints(updated);
      setJustSaved(true);
      onUpdate({ ...client, constraints: updated });
    }
  };

  const handleCancel = () => {
    setConstraints(client.constraints ?? defaultConstraints());
    onBack();
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-opti-blue transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste
      </button>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-opti-blue font-display">
            Configuration détaillée :{" "}
            <span className="text-opti-red">
              {client.company || client.name}
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gérez les contraintes logistiques et fenêtres d&apos;accès
            spécifiques à ce client.
          </p>
        </div>
        {editable && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-opti-blue hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || justSaved}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors cursor-pointer disabled:cursor-default ${
                justSaved
                  ? "bg-emerald-600"
                  : "bg-opti-red hover:bg-opti-red-dark disabled:opacity-50"
              }`}
            >
              {saving ? (
                "Enregistrement..."
              ) : justSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Enregistré
                </>
              ) : (
                "Enregistrer les modifications"
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fenêtres horaires */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-5">
              <Clock className="w-5 h-5 text-opti-red" />
              <h2 className="text-lg font-bold text-opti-blue font-display">
                Fenêtres horaires de livraison
              </h2>
            </div>

            <div className="space-y-3">
              {WEEKDAYS.map((day) => {
                const window = constraints.deliveryWindows[day];
                return (
                  <div
                    key={day}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100"
                  >
                    <div className="flex items-center justify-between sm:w-40 shrink-0">
                      <span className="text-sm font-bold text-opti-blue uppercase tracking-wide">
                        {DAY_LABELS[day]}
                      </span>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={window.open}
                          disabled={!editable}
                          onChange={() => toggleDayOpen(day)}
                        />
                        <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-opti-red transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>

                    <div className="flex-1">
                      {window.open ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {window.slots.map((slot, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 px-2 py-1"
                            >
                              <input
                                type="time"
                                value={slot.start}
                                disabled={!editable}
                                onChange={(e) =>
                                  updateSlot(day, index, "start", e.target.value)
                                }
                                className="text-sm text-opti-blue bg-transparent focus:outline-none"
                              />
                              <span className="text-gray-400">–</span>
                              <input
                                type="time"
                                value={slot.end}
                                disabled={!editable}
                                onChange={(e) =>
                                  updateSlot(day, index, "end", e.target.value)
                                }
                                className="text-sm text-opti-blue bg-transparent focus:outline-none"
                              />
                              {editable && (
                                <button
                                  onClick={() => removeSlot(day, index)}
                                  className="text-gray-400 hover:text-opti-red transition-colors"
                                  aria-label="Supprimer le créneau"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {editable && (
                            <button
                              onClick={() => addSlot(day)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-opti-blue hover:text-opti-red transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Créneau
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Fermé</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Instructions supplémentaires */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5 text-opti-red" />
              <h2 className="text-lg font-bold text-opti-blue font-display">
                Instructions supplémentaires
              </h2>
            </div>
            <textarea
              value={constraints.instructions}
              disabled={!editable}
              onChange={(e) =>
                updateConstraints((prev) => ({
                  ...prev,
                  instructions: e.target.value,
                }))
              }
              rows={4}
              placeholder="Notes pour le conducteur (accès, quai de déchargement, consignes particulières…)"
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors resize-none disabled:bg-gray-50"
            />
            {constraints.updatedAt && (
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Dernière mise à jour le{" "}
                {new Date(constraints.updatedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Restrictions de gabarit */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-5 h-5 text-opti-red" />
              <h2 className="text-lg font-bold text-opti-blue font-display">
                Restrictions de gabarit
              </h2>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Sélectionnez les types de véhicules autorisés pour ce site.
            </p>

            {vehicleTypes.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Aucun type de véhicule configuré.
              </p>
            ) : (
              <div className="space-y-3">
                {vehicleTypes.map((type) => {
                  const checked = constraints.allowedVehicleTypes.includes(
                    type.id,
                  );
                  return (
                    <div
                      key={type.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-opti-blue">
                          {type.name}
                        </p>
                        {type.description && (
                          <p className="text-xs text-gray-400">
                            {type.description}
                          </p>
                        )}
                      </div>
                      <label className="inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={checked}
                          disabled={!editable}
                          onChange={() => toggleVehicleType(type.id)}
                        />
                        <div className="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-opti-red transition-colors relative after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Équipements requis */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-opti-red" />
              <h2 className="text-lg font-bold text-opti-blue font-display">
                Équipements requis
              </h2>
            </div>

            {specialties.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Aucun équipement configuré.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {specialties.map((spec) => {
                  const checked = constraints.requiredEquipment.includes(
                    spec.name,
                  );
                  return (
                    <label
                      key={spec.id}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!editable}
                        onChange={() => toggleEquipment(spec.name)}
                        className="w-4 h-4 text-opti-red border-gray-300 rounded focus:ring-opti-red"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        {spec.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
