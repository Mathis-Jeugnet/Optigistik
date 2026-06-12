import { ArrowLeft, Edit2, Trash2, Settings, AlertTriangle, CheckCircle2, X, Clock, Wrench, Plus } from "lucide-react";
import { Vehicle, VehicleType, saveVehicle, checkFutureTours, deleteVehicle, MaintenanceLog, getMaintenanceLogs, addMaintenanceLog, updateMaintenanceLog, deleteMaintenanceLog } from "@/services/fleet";
import { UserRole, canEdit } from "@/app/context/AuthContext";
import { useState, useEffect } from "react";
import MaintenanceTimeline from "./MaintenanceTimeline";
import dynamic from "next/dynamic";

const VehicleLocationMap = dynamic(() => import("./VehicleLocationMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full min-h-[200px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-sm">Chargement de la carte...</div>
});

interface FleetDetailProps {
  vehicle: Vehicle;
  vehicleTypes: VehicleType[];
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => void;
  userRole: UserRole;
}

export default function FleetDetail({ vehicle, vehicleTypes, onBack, onEdit, onRefresh, userRole }: FleetDetailProps) {
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  // Nouveaux états pour le motif d'indisponibilité
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [unavailabilityReason, setUnavailabilityReason] = useState("Maintenance");
  const [customReason, setCustomReason] = useState("");

  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  
  // États pour l'ajout manuel d'événement
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [logToEdit, setLogToEdit] = useState<MaintenanceLog | null>(null);
  const [newLogType, setNewLogType] = useState<MaintenanceLog['type']>('Maintenance');
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [newLogDescription, setNewLogDescription] = useState("");

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const fetchedLogs = await getMaintenanceLogs(vehicle.id);
    setLogs(fetchedLogs);
    setLoadingLogs(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [vehicle.id]);

  const typeName = vehicleTypes.find(t => t.id === vehicle.typeId)?.name || "Inconnu";
  const typeDescription = vehicleTypes.find(t => t.id === vehicle.typeId)?.description || "";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isExpired = vehicle.inspection_date <= today;
  const daysUntilInspection = Math.ceil((vehicle.inspection_date.getTime() - today.getTime()) / (1000 * 3600 * 24));
  
  // Disponible: si actif manuellement ET date inspection > aujourd'hui
  const isAvailable = vehicle.is_active && !isExpired;

  const handleToggleActive = async () => {
    setError(null);
    if (vehicle.is_active) {
      // On veut le rendre inactif -> Vérification des tournées d'abord
      const hasFutureTours = await checkFutureTours(vehicle.id);
      if (hasFutureTours) {
        setError("Impossible de rendre ce véhicule indisponible : il est déjà affecté à une tournée validée dans le futur. Annulez ou réaffectez la tournée d'abord.");
        return;
      }
      
      // Si c'est bon, on ouvre la modale pour choisir le motif
      setCustomReason(""); // Réinitialiser le texte
      setShowReasonModal(true);
    } else {
      // On veut le réactiver
      await saveVehicle({ ...vehicle, is_active: true, unavailability_reason: "" });
      
      // Ajouter un log de réactivation
      await addMaintenanceLog({
        vehicleId: vehicle.id,
        date: new Date(),
        type: 'Réactivation',
        description: "Véhicule remis en service (Actif)."
      });
      
      onRefresh(); // Recharger les données
      fetchLogs(); // Recharger l'historique
    }
  };

  const handleConfirmUnavailability = async () => {
    const finalReason = unavailabilityReason === "Autre" ? customReason : unavailabilityReason;
    await saveVehicle({ ...vehicle, is_active: false, unavailability_reason: finalReason });
    
    // Ajouter un log d'indisponibilité
    await addMaintenanceLog({
      vehicleId: vehicle.id,
      date: new Date(),
      type: unavailabilityReason as MaintenanceLog['type'],
      description: `Mise hors service : ${finalReason}`
    });

    onRefresh();
    fetchLogs();
  };

  const handleAddManualLog = async () => {
    if (!newLogDescription.trim()) return;
    
    if (logToEdit && logToEdit.id) {
      // Modification d'un log existant
      await updateMaintenanceLog(logToEdit.id, {
        date: new Date(newLogDate),
        type: newLogType,
        description: newLogDescription
      });
    } else {
      // Création d'un nouveau log
      await addMaintenanceLog({
        vehicleId: vehicle.id,
        date: new Date(newLogDate),
        type: newLogType,
        description: newLogDescription
      });
    }

    setShowAddLogModal(false);
    setLogToEdit(null);
    setNewLogDescription("");
    fetchLogs();
  };

  const handleDeleteLog = async (logId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) {
      const success = await deleteMaintenanceLog(logId);
      if (success) {
        fetchLogs();
      } else {
        setError("Erreur lors de la suppression de l'événement.");
      }
    }
  };

  const handleOpenEditLog = (log: MaintenanceLog) => {
    setLogToEdit(log);
    setNewLogType(log.type);
    setNewLogDate(new Date(log.date).toISOString().split('T')[0]);
    setNewLogDescription(log.description);
    setShowAddLogModal(true);
  };

  const handleOpenAddLog = () => {
    setLogToEdit(null);
    setNewLogType('Maintenance');
    setNewLogDate(new Date().toISOString().split('T')[0]);
    setNewLogDescription("");
    setShowAddLogModal(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmText.toLowerCase() === "confirmer") {
      const success = await deleteVehicle(vehicle.id);
      if (success) {
        onBack();
      } else {
        setError("Erreur lors de la suppression.");
        setShowDeleteConfirm(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <button 
        onClick={onBack}
        className="text-gray-500 hover:text-opti-blue flex items-center gap-2 text-sm font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Retour à la liste
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-opti-blue">{vehicle.name || vehicle.plate}</h1>
              {isAvailable ? (
                <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Actif</span>
              ) : isExpired ? (
                <span className="bg-red-100 text-opti-red text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">Contrôle technique expirée</span>
              ) : (
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">{vehicle.unavailability_reason || "Indisponible"}</span>
              )}
            </div>
            <p className="text-sm text-gray-500">{vehicle.plate} • {vehicle.motorization} • {typeDescription} ({typeName})</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userRole.toLowerCase() === 'admin' && (
            <>
              <button onClick={onEdit} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors">
                MODIFIER
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-50 text-opti-red font-bold text-sm rounded-lg hover:bg-red-100 transition-colors"
              >
                SUPPRIMER
              </button>
              <button 
                onClick={handleToggleActive}
                className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors text-white ${vehicle.is_active ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'}`}
              >
                {vehicle.is_active ? 'INDISPONIBLE' : 'RÉACTIVER'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-opti-red p-4 rounded-xl flex items-start gap-3 border border-red-100">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Colonne de gauche (Infos Techniques + Maintenance) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-opti-red uppercase tracking-wider mb-6 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Informations Techniques
            </h3>
            
            <div className="grid grid-cols-2 gap-y-6 gap-x-8">
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Nom / Modèle</p>
                <p className="font-bold text-opti-blue">{vehicle.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Plaque d'immatriculation</p>
                <p className="font-bold text-opti-blue">{vehicle.plate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Motorisation</p>
                <p className="font-bold text-opti-blue">{vehicle.motorization}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Dimensions (L x H)</p>
                <p className="font-bold text-opti-blue">{vehicle.dimensions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Type de remorque</p>
                <p className="font-bold text-opti-blue">{typeName} <span className="text-gray-400 font-normal">({typeDescription})</span></p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Spécialité</p>
                <p className="font-bold text-blue-600">{vehicle.specialty || "Aucune"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-bold uppercase mb-1">Capacité maximale</p>
                <p className="font-bold text-opti-blue">{vehicle.capacity_palettes} Palettes</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-sm font-bold text-opti-red uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Historique de Maintenance
              </h3>
              <div className="flex items-center gap-4">
                {canEdit(userRole) && (
                  <button
                    onClick={handleOpenAddLog}
                    className="bg-opti-red hover:bg-red-700 text-white p-1 rounded-full transition-colors"
                    title="Ajouter un événement manuel"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                <button onClick={fetchLogs} className="text-xs text-opti-red hover:underline font-bold flex items-center gap-1">
                  Actualiser
                </button>
              </div>
            </div>
            
            {loadingLogs ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-red"></div>
              </div>
            ) : (
              <MaintenanceTimeline logs={logs} onEdit={handleOpenEditLog} onDelete={handleDeleteLog} userRole={userRole} />
            )}
          </div>
        </div>

        {/* Colonne de droite (Alertes, Conducteur, Statut) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-opti-red uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alerte contrôle technique
            </h3>
            
            <p className="font-bold text-opti-blue mb-1">Contrôle Technique</p>
            <p className={`text-sm mb-4 ${isExpired ? 'text-opti-red font-bold' : daysUntilInspection <= 30 ? 'text-orange-500' : 'text-gray-500'}`}>
              {isExpired 
                ? "Expiré depuis le " + vehicle.inspection_date.toLocaleDateString('fr-FR')
                : `Prévu dans ${daysUntilInspection} jours (${vehicle.inspection_date.toLocaleDateString('fr-FR')})`}
            </p>
            
            <button className="w-full bg-red-50 text-opti-red py-2 rounded-lg font-bold text-xs hover:bg-red-100 transition-colors uppercase tracking-wider">
              Planifier maintenant
            </button>
          </div>

          <div className="bg-opti-blue text-white p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-red-300 uppercase tracking-wider mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Conducteur Assigné
            </h3>
            <div className="text-center py-4 text-gray-400 text-sm">
              <p>Gestion des conducteurs non activée.</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-opti-red uppercase tracking-wider mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              Dernière Position Connue
            </h3>
            <div className="h-[200px] w-full rounded-xl overflow-hidden border border-gray-100">
              <VehicleLocationMap plate={vehicle.plate} />
            </div>
          </div>

        </div>

      </div>

      {/* Modal de suppression */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-opti-blue font-display flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-opti-red" />
                Confirmation de suppression
              </h3>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer définitivement le véhicule <strong className="text-opti-blue">{vehicle.plate}</strong> ? Cette action est irréversible.
            </p>

            <div className="mb-6">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Tapez "Confirmer" pour valider :
              </label>
              <input 
                type="text" 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Confirmer"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-opti-blue transition-colors border border-gray-200"
              >
                Annuler
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteConfirmText.toLowerCase() !== "confirmer"}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de motif d'indisponibilité */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-opti-blue font-display flex items-center gap-2">
                <Settings className="w-6 h-6 text-gray-500" />
                Rendre indisponible
              </h3>
              <button onClick={() => setShowReasonModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6 text-sm">
              Veuillez sélectionner le motif pour lequel le véhicule <strong className="text-opti-blue">{vehicle.plate}</strong> sera immobilisé :
            </p>

            <div className="mb-8 space-y-3">
              {[
                { id: "Maintenance", label: "Maintenance programmée" },
                { id: "Panne", label: "Panne inattendue" },
                { id: "Avarie", label: "Avarie / Accident" },
                { id: "Autre", label: "Autre motif" }
              ].map((reason) => (
                <div key={reason.id} className={`p-3 border rounded-xl transition-colors ${unavailabilityReason === reason.id ? 'bg-orange-50 border-orange-200' : 'hover:bg-gray-50'}`}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="radio" 
                      name="reason" 
                      value={reason.id}
                      checked={unavailabilityReason === reason.id}
                      onChange={(e) => setUnavailabilityReason(e.target.value)}
                      className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                    />
                    <span className="font-medium text-gray-700">{reason.label}</span>
                  </label>
                  
                  {reason.id === "Autre" && unavailabilityReason === "Autre" && (
                    <div className="mt-3 pl-7">
                      <input 
                        type="text" 
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Précisez le motif..."
                        className="w-full border border-gray-300 rounded-lg p-2 text-sm text-opti-blue focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowReasonModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-opti-blue transition-colors border border-gray-200"
              >
                Annuler
              </button>
              <button 
                onClick={handleConfirmUnavailability}
                disabled={unavailabilityReason === "Autre" && customReason.trim() === ""}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer l'indisponibilité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'ajout manuel d'événement de maintenance */}
      {showAddLogModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-opti-blue font-display flex items-center gap-2">
                <Wrench className="w-6 h-6 text-opti-red" />
                {logToEdit ? "Modifier l'événement" : "Nouvel événement"}
              </h3>
              <button onClick={() => setShowAddLogModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Type d'événement</label>
                <select 
                  value={newLogType}
                  onChange={(e) => setNewLogType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white"
                >
                  <option value="Maintenance">Entretien / Maintenance</option>
                  <option value="Panne">Panne</option>
                  <option value="Avarie">Avarie / Accident</option>
                  <option value="Réactivation">Remise en service</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
                <input 
                  type="date"
                  value={newLogDate}
                  onChange={(e) => setNewLogDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Description détaillée</label>
                <textarea 
                  value={newLogDescription}
                  onChange={(e) => setNewLogDescription(e.target.value)}
                  placeholder="Ex: Vidange, changement pneus, réparation carrosserie..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-8">
              <button 
                onClick={() => setShowAddLogModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-opti-blue transition-colors border border-gray-200"
              >
                Annuler
              </button>
              <button 
                onClick={handleAddManualLog}
                disabled={!newLogDescription.trim()}
                className="px-6 py-2 bg-opti-red text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
