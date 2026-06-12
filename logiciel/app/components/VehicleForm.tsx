import { useState } from "react";
import { Vehicle, VehicleType, Specialty, Motorization, saveVehicle, checkFutureTours } from "@/services/fleet";
import { AlertTriangle, X } from "lucide-react";

interface VehicleFormProps {
  initialData: Vehicle | null;
  vehicleTypes: VehicleType[];
  specialties: Specialty[];
  motorizations: Motorization[];
  onCancel: () => void;
  onSuccess: () => void;
}

export default function VehicleForm({ initialData, vehicleTypes, specialties, motorizations, onCancel, onSuccess }: VehicleFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Valeurs du formulaire
  const [name, setName] = useState(initialData?.name || "");
  const [plate, setPlate] = useState(initialData?.plate || "");
  const [dimensions, setDimensions] = useState(initialData?.dimensions || "");
  const [motorization, setMotorization] = useState(initialData?.motorization || "");
  const [typeId, setTypeId] = useState(initialData?.typeId || "");
  const [specialty, setSpecialty] = useState(initialData?.specialty || "");
  const [capacity, setCapacity] = useState(initialData?.capacity_palettes?.toString() || "");
  
  // Formatage de la date pour le champ input type="date"
  const getInitialDateStr = () => {
    if (!initialData?.inspection_date) return "";
    const d = new Date(initialData.inspection_date);
    return d.toISOString().split("T")[0];
  };
  const [inspectionDate, setInspectionDate] = useState(getInitialDateStr());

  // Formatage de la plaque (SIV Français : AB-123-CD)
  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    
    // Autoriser seulement A-Z, 0-9 et -
    val = val.replace(/[^A-Z0-9-]/g, '');

    // Si on efface, on ne fait pas d'auto-formatage
    if (val.length < plate.length) {
      setPlate(val);
      return;
    }

    // Auto-insertion intelligente du tiret
    const clean = val.replace(/-/g, '');
    if (clean.length === 2 && val.length === 2) val += '-';
    if (clean.length === 5 && val.length === 6) val += '-';

    setPlate(val.substring(0, 9));
  };

  // Validation en temps réel du format SIV
  const isPlateValid = plate.length === 0 || /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/.test(plate);

  // Validation en temps réel des dimensions
  const getDimensionsError = () => {
    if (dimensions.length === 0) return null;
    const numbers = dimensions.replace(',', '.').match(/\d+(\.\d+)?/g);
    if (!numbers || numbers.length < 2) {
      return "Il faut au moins deux nombres (ex: 13.6 / 4)";
    }
    return null;
  };
  const dimensionsError = getDimensionsError();

  // Validation en temps réel de la capacité
  const isCapacityValid = capacity.length === 0 || (/^\d+$/.test(capacity) && parseInt(capacity, 10) > 0);

  // Formatage des dimensions à la perte du focus (onBlur)
  const handleDimensionsBlur = () => {
    if (!dimensions) return;
    // On cherche deux nombres décimaux dans la chaîne saisie (ex: "13.6x4" ou "13.6 / 4")
    const numbers = dimensions.replace(',', '.').match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length >= 2) {
      const length = parseFloat(numbers[0]);
      const height = parseFloat(numbers[1]);
      // On s'assure qu'il y a au moins une décimale pour le style propre
      setDimensions(`${length}m / ${height}m`);
    } else if (numbers && numbers.length === 1) {
      // Si un seul nombre, on l'applique à la longueur
      setDimensions(`${parseFloat(numbers[0])}m`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    const missingFields = [];
    if (!name) missingFields.push("Nom / Identifiant");
    if (!plate) missingFields.push("Plaque d'immatriculation");
    if (!dimensions) missingFields.push("Dimensions");
    if (!motorization) missingFields.push("Motorisation");
    if (!typeId) missingFields.push("Typologie (Remorque)");
    if (!capacity) missingFields.push("Capacité");
    if (!inspectionDate) missingFields.push("Prochain Contrôle Technique");

    if (missingFields.length > 0) {
      setError(`Veuillez remplir les champs obligatoires : ${missingFields.join(', ')}`);
      return;
    }

    // Validation du format de la plaque
    const plateRegex = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;
    if (!plateRegex.test(plate)) {
      setError("Le format de la plaque est incorrect. Format attendu : AB-123-CD");
      return;
    }

    // Validation du format des dimensions
    const dimensionsRegex = /^\d+(\.\d+)?m \/ \d+(\.\d+)?m$/;
    if (!dimensionsRegex.test(dimensions)) {
      setError("Le format des dimensions est incorrect. Exemple attendu : 13.6m / 4.0m (Utilisez le point pour les décimales)");
      return;
    }

    const capacityInt = parseInt(capacity, 10);
    if (isNaN(capacityInt) || capacityInt <= 0 || capacityInt.toString() !== capacity) {
      setError("La capacité doit être un nombre entier positif de palettes.");
      return;
    }

    setLoading(true);

    try {
      if (initialData) {
        const capacityChanged = initialData.capacity_palettes !== capacityInt;
        const typeChanged = initialData.typeId !== typeId;

        if (capacityChanged || typeChanged) {
          const hasFutureTours = await checkFutureTours(initialData.id);
          if (hasFutureTours) {
            setError("Impossible de modifier la capacité ou le type : ce véhicule est affecté à une tournée validée dans le futur.");
            setLoading(false);
            return;
          }
        }
      }

      const vehicleData: Partial<Vehicle> = {
        ...(initialData ? { id: initialData.id } : {}),
        name,
        plate,
        dimensions,
        motorization,
        typeId,
        specialty,
        capacity_palettes: capacityInt,
        inspection_date: new Date(inspectionDate),
        is_active: initialData ? initialData.is_active : true,
      };

      const success = await saveVehicle(vehicleData);
      if (success) {
        onSuccess();
      } else {
        setError("Erreur lors de l'enregistrement. Veuillez réessayer.");
      }
    } catch (err) {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-opti-blue font-display">
          {initialData ? "Modifier le véhicule" : "Ajouter un véhicule"}
        </h2>
        <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-opti-red p-4 rounded-xl flex items-start gap-3 border border-red-100">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nom ou Identifiant *</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex: Volvo FH16 ou V-001"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Plaque d'immatriculation *</label>
            <input 
              type="text" 
              value={plate}
              onChange={handlePlateChange}
              placeholder="ex: AB-123-CD"
              className={`w-full border rounded-lg p-3 text-opti-blue font-medium outline-none transition-all ${!isPlateValid ? 'border-opti-red ring-1 ring-opti-red' : 'border-gray-200 focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red'}`}
            />
            {!isPlateValid && (
              <p className="text-[10px] text-opti-red font-bold mt-1 uppercase animate-fade-in">
                Format attendu : 2 lettres - 3 chiffres - 2 lettres
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Capacité en Palettes *</label>
            <input 
              type="text" 
              value={capacity}
              onChange={e => {
                // On n'autorise que la saisie de chiffres
                const val = e.target.value.replace(/\D/g, '');
                setCapacity(val);
              }}
              placeholder="ex: 33"
              className={`w-full border rounded-lg p-3 text-opti-blue font-medium outline-none transition-all ${!isCapacityValid ? 'border-opti-red ring-1 ring-opti-red' : 'border-gray-200 focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red'}`}
            />
            {!isCapacityValid && (
              <p className="text-[10px] text-opti-red font-bold mt-1 uppercase animate-fade-in">
                Veuillez entrer un nombre entier positif
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Dimensions (L x H) *</label>
            <input 
              type="text" 
              value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              onBlur={handleDimensionsBlur}
              placeholder="ex: 13.6m / 4.0m"
              className={`w-full border rounded-lg p-3 text-opti-blue font-medium outline-none transition-all ${dimensionsError ? 'border-opti-red ring-1 ring-opti-red' : 'border-gray-200 focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red'}`}
            />
            {dimensionsError && (
              <p className="text-[10px] text-opti-red font-bold mt-1 uppercase animate-fade-in">
                {dimensionsError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Motorisation *</label>
            <select 
              value={motorization}
              onChange={e => setMotorization(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white cursor-pointer"
            >
              <option value="">Sélectionner...</option>
              {motorizations.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Typologie (Remorque) *</label>
            {vehicleTypes.length > 0 ? (
              <select 
                value={typeId}
                onChange={e => setTypeId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white cursor-pointer"
              >
                <option value="" disabled>Sélectionner un type...</option>
                {vehicleTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name} - {type.description}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-red-500 mt-2">Aucun type de véhicule n'a été créé dans la base de données. Créez-en d'abord un depuis Firebase.</p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Spécialité</label>
            <select 
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white cursor-pointer"
            >
              <option value="">Aucune</option>
              {specialties.map(spec => (
                <option key={spec.id} value={spec.name}>{spec.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Prochain Contrôle Technique *</label>
            <input 
              type="date" 
              value={inspectionDate}
              onChange={e => setInspectionDate(e.target.value)}
              className="w-full md:w-1/2 border border-gray-200 rounded-xl px-4 py-2.5 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red focus:border-opti-red outline-none"
            />
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 hover:text-opti-blue transition-colors border border-gray-200"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Enregistrement..." : (initialData ? "Enregistrer les modifications" : "Créer le véhicule")}
          </button>
        </div>
      </form>
    </div>
  );
}
