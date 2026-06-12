"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import RoleGuard from "@/app/components/RoleGuard";
import AccessDenied from "@/app/components/AccessDenied";
import AppShell from "@/app/components/AppShell";
import { ROLES } from "@/app/context/AuthContext";
import Link from "next/link";
import { 
  ArrowLeft, Plus, X, UserPlus, ShieldCheck, Info,
  Users, Truck, Trash2, Pencil, Check, AlertCircle, CheckCircle, ShieldAlert
} from "lucide-react";

type UserData = {
  uid: string;
  email: string;
  name: string;
  role: string;
  createdAt: any;
  mustChangePassword?: boolean;
};

const COMMON_LANGUAGES = [
  "Abkhaze", "Afar", "Afrikaans", "Akan", "Albanais", "Allemand", "Amharique", "Arabe", "Aragonais", "Arménien", "Assamais", "Avar", "Avestique", "Aymara", "Azéri", "Bambara", "Bachkir", "Basque", "Bengali", "Bihari", "Bislama", "Bosniaque", "Breton", "Bulgare", "Birman", "Catalan", "Chamorro", "Tchétchène", "Chichewa", "Chinois", "Tchouvache", "Cornique", "Corse", "Crie", "Croate", "Tchèque", "Danois", "Dhivehi", "Néerlandais", "Dzongkha", "Anglais", "Espéranto", "Estonien", "Ewe", "Féroïen", "Fidjien", "Finnois", "Français", "Frison occidental", "Fula", "Galicien", "Géorgien", "Grec", "Guarani", "Gujarati", "Haïtien", "Haoussa", "Hébreu", "Herero", "Hindi", "Hiri Motu", "Hongrois", "Interlingua", "Indonésien", "Interlingue", "Inuktitut", "Inupiaq", "Irlandais", "Islandais", "Italien", "Japonais", "Javanais", "Kalaallisut", "Kannada", "Kanouri", "Cachemiri", "Kazakh", "Khmer", "Kikuyu", "Kinyarwanda", "Kirghize", "Komi", "Kongo", "Coréen", "Kurde", "Kwanyama", "Lao", "Latin", "Letton", "Limbourgeois", "Lingala", "Lituanien", "Luba-Katanga", "Luxembourgeois", "Macédonien", "Malgache", "Malais", "Malayalam", "Maltais", "Manx", "Maori", "Marathi", "Marshallais", "Mongol", "Nauru", "Navajo", "Ndébélé du Nord", "Ndébélé du Sud", "Ndonga", "Népalais", "Norvégien", "Norvégien Bokmål", "Norvégien Nynorsk", "Occitan", "Ojibwé", "Oriya", "Oromo", "Ossète", "Pali", "Panjabi", "Pashto", "Persan", "Polonais", "Portugais", "Quechua", "Romanche", "Kirundi", "Roumain", "Russe", "Sami du Nord", "Samoan", "Sango", "Sanskrit", "Sarde", "Écossais", "Serbe", "Shona", "Sindhi", "Cinghalais", "Slovaque", "Slovène", "Somali", "Sotho du Sud", "Espagnol", "Soudanais", "Swahili", "Swati", "Suédois", "Tagalog", "Tahitien", "Tadjik", "Tamoul", "Tatar", "Telugu", "Thaï", "Tibétain", "Tigrinya", "Tonga", "Tsonga", "Tswana", "Turc", "Turkmène", "Twi", "Ouïghour", "Ukrainien", "Ourdou", "Ouzbek", "Venda", "Vietnamien", "Volapük", "Wallon", "Gallois", "Wolof", "Xhosa", "Yiddish", "Yoruba", "Zhuang", "Zoulou"
];

export default function RolesAdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // États pour la création d'utilisateur
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("Lecteur");
  const [driverContractType, setDriverContractType] = useState("GRAND_ROUTIER");
  const [driverNightWork, setDriverNightWork] = useState(false);
  const [driverDepot, setDriverDepot] = useState("DEPOT_LYON_01");
  const [driverLicenseTypes, setDriverLicenseTypes] = useState("");
  const [driverSeniority, setDriverSeniority] = useState("");
  const [driverLanguages, setDriverLanguages] = useState("");
  const [driverEmployeeId, setDriverEmployeeId] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [driverRole, setDriverRole] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // État pour la suppression
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // États pour la modification
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserData | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // États pour le système de notifications Toast (Pop-up moderne)
  const [notifications, setNotifications] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersList: UserData[] = [];
      querySnapshot.forEach((doc) => {
        usersList.push({ uid: doc.id, ...doc.data() } as UserData);
      });
      setUsers(usersList);
    } catch (error) {
      console.error("Erreur lors de la récupération des utilisateurs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsCreating(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Session expirée");

      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          role: newRole,
          driverConfig: newRole === "Chauffeur" ? {
            contract_type: driverContractType,
            night_work_authorized: driverNightWork,
            default_depot_id: driverDepot,
            license_types: driverLicenseTypes,
            seniority: driverSeniority,
            languages: driverLanguages,
            employee_id: driverEmployeeId,
            phone: driverPhone,
            role: driverRole
          } : undefined
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors de la création");

      setShowCreateModal(false);
      setNewName("");
      setNewEmail("");
      setNewRole("Lecteur");
      setDriverContractType("GRAND_ROUTIER");
      setDriverNightWork(false);
      setDriverDepot("DEPOT_LYON_01");
      setDriverLicenseTypes("");
      setDriverSeniority("");
      setDriverLanguages("");
      setDriverEmployeeId("");
      setDriverPhone("");
      setDriverRole("");
      await fetchUsers();
      showNotification("Utilisateur créé avec succès !", "success");
    } catch (error: any) {
      setCreateError(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Session expirée");

      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUid: userToDelete.uid }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur lors de la suppression");
      }

      setShowDeleteModal(false);
      setUserToDelete(null);
      await fetchUsers();
      showNotification("Utilisateur supprimé avec succès !", "success");
    } catch (error: any) {
      showNotification(error.message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditModal = async (user: UserData) => {
    setUserToEdit(user);
    setEditName(user.name || "");
    setEditEmail(user.email || "");
    setEditRole(user.role || "Lecteur");
    setEditError(null);
    
    if (user.role === "Chauffeur") {
      const driverDoc = await getDoc(doc(db, "drivers", user.uid));
      if (driverDoc.exists()) {
        const data = driverDoc.data();
        setDriverContractType(data.regime || "GRAND_ROUTIER");
        setDriverNightWork(data.nightWorkAuthorized || false);
        setDriverDepot(data.defaultDepotId || "DEPOT_LYON_01");
        setDriverLicenseTypes(data.licenseTypes?.join(", ") || "");
        setDriverSeniority(data.seniority || "");
        setDriverLanguages(data.languages?.join(", ") || "");
        setDriverEmployeeId(data.employeeId || "");
        setDriverPhone(data.phone || "");
        setDriverRole(data.role || "");
      } else {
        setDriverContractType("GRAND_ROUTIER");
        setDriverNightWork(false);
        setDriverDepot("DEPOT_LYON_01");
        setDriverLicenseTypes("");
        setDriverSeniority("");
        setDriverLanguages("");
        setDriverEmployeeId("");
        setDriverPhone("");
        setDriverRole("");
      }
    }

    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setIsUpdating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Session expirée");

      const response = await fetch("/api/users/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUid: userToEdit.uid,
          name: editName,
          email: editEmail,
          role: editRole,
          driverConfig: editRole === "Chauffeur" ? {
            contract_type: driverContractType,
            night_work_authorized: driverNightWork,
            default_depot_id: driverDepot,
            license_types: driverLicenseTypes,
            seniority: driverSeniority,
            languages: driverLanguages,
            employee_id: driverEmployeeId,
            phone: driverPhone,
            role: driverRole
          } : undefined
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur lors de la mise à jour");
      }

      setShowEditModal(false);
      await fetchUsers();
      showNotification("Utilisateur mis à jour avec succès !", "success");
    } catch (error: any) {
      setEditError(error.message);
      showNotification(error.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <RoleGuard
      allowedRoles={["Admin"]}
      fallback={
        <AccessDenied message="Désolé, cette zone est réservée aux administrateurs du système Optigistik." />
      }
    >
      <AppShell>
        <div className="flex-1">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-opti-blue border border-transparent hover:border-slate-100">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Administration</span>
              </div>
              <h1 className="text-4xl font-bold text-opti-blue tracking-tight mb-2">Gestion du Personnel</h1>
              <p className="text-slate-500 font-medium">Gérez les accès et les responsabilités de vos collaborateurs.</p>
            </div>
            
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-3 px-8 py-4 bg-opti-red text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-100 active:scale-95 group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
              Ajouter un collaborateur
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-8 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:shadow-md">
              <div className="bg-blue-50 p-4 rounded-2xl text-blue-600"><Users className="w-8 h-8" /></div>
              <div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Total</p>
                <h3 className="text-3xl font-bold text-opti-blue">{users.length}</h3>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:shadow-md">
              <div className="bg-purple-50 p-4 rounded-2xl text-purple-600"><ShieldCheck className="w-8 h-8" /></div>
              <div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Admins</p>
                <h3 className="text-3xl font-bold text-opti-blue">{users.filter(u => u.role?.toLowerCase() === 'admin').length}</h3>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:shadow-md">
              <div className="bg-orange-50 p-4 rounded-2xl text-orange-600"><ShieldCheck className="w-8 h-8" /></div>
              <div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Gestionnaires</p>
                <h3 className="text-3xl font-bold text-opti-blue">{users.filter(u => u.role?.toLowerCase() === 'gestionnaire').length}</h3>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[28px] shadow-sm border border-slate-100 flex items-center gap-6 transition-all hover:shadow-md">
              <div className="bg-green-50 p-4 rounded-2xl text-green-600"><Truck className="w-8 h-8" /></div>
              <div>
                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Chauffeurs</p>
                <h3 className="text-3xl font-bold text-opti-blue">{users.filter(u => u.role?.toLowerCase() === 'chauffeur').length}</h3>
              </div>
            </div>
          </div>
          
          {/* Main Table Card */}
          <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-white">
              <h3 className="text-xl font-bold text-opti-blue">Liste des accès</h3>
              <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                Affichage de {users.length} utilisateurs
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">Collaborateur</th>
                    <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">Date d'arrivée</th>
                    <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">Rôle actuel</th>
                    <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">Statut</th>
                    <th className="p-6 text-xs font-bold text-slate-400 uppercase tracking-[0.1em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.uid} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm
                            ${user.role?.toLowerCase() === 'admin' ? 'bg-purple-100 text-purple-600' : 
                              user.role?.toLowerCase() === 'gestionnaire' ? 'bg-blue-100 text-blue-600' : 
                              user.role?.toLowerCase() === 'chauffeur' ? 'bg-green-100 text-green-600' : 
                              'bg-slate-100 text-slate-500'}`}>
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-opti-blue text-lg mb-0.5">{user.name || "N/A"}</p>
                            <p className="text-slate-400 text-sm font-medium">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 font-semibold text-sm text-slate-500">
                        {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : "N/A"}
                      </td>
                      <td className="p-6">
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider
                          ${user.role?.toLowerCase() === 'admin' ? 'bg-purple-50 text-purple-600' : 
                            user.role?.toLowerCase() === 'gestionnaire' ? 'bg-blue-50 text-blue-600' : 
                            user.role?.toLowerCase() === 'chauffeur' ? 'bg-green-50 text-green-600' : 
                            'bg-slate-50 text-slate-500'}`}>
                          {user.role || "Aucun"}
                        </span>
                      </td>
                      <td className="p-6">
                        {user.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Attente activation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Actif
                          </span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEditModal(user)} className="p-3 text-slate-400 hover:text-opti-blue hover:bg-blue-50 rounded-xl transition-all"><Pencil className="w-5 h-5" /></button>
                          <button onClick={() => { setUserToDelete(user); setShowDeleteModal(true); }} className="p-3 text-slate-400 hover:text-opti-red hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {notification && (
          <div className={`fixed bottom-8 right-8 z-[9999] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl animate-in slide-in-from-bottom-5 duration-300 border
            ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
            {notification.type === 'success' ? <Check className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span className="font-semibold text-sm">{notification.message}</span>
          </div>
        )}
      </AppShell>

      {/* MODALE CRÉATION */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-red-50 p-3 rounded-2xl"><UserPlus className="w-6 h-6 text-opti-red" /></div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <h2 className="text-2xl font-bold text-opti-blue mb-2">Ajouter un collaborateur</h2>
            <p className="text-slate-500 text-sm mb-8">Remplissez les informations pour créer un nouveau compte accès.</p>
            <form onSubmit={handleCreateUser} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nom Complet</label>
                <input type="text" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="ex: Jean Dupont" className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email</label>
                <input type="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="jean.dupont@optigistik.fr" className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Rôle</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer">
                  {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>

              {/* Champs spécifiques au Chauffeur */}
              {newRole === "Chauffeur" && (
                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                  <h3 className="text-sm font-bold text-opti-blue flex items-center gap-2">
                    <Truck className="w-4 h-4 text-opti-red" />
                    Informations Techniques
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Régime Contractuel</label>
                      <select 
                        value={driverContractType} 
                        onChange={e => setDriverContractType(e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer"
                      >
                        <option value="GRAND_ROUTIER">Grand Routier</option>
                        <option value="AUTRE_PERSONNEL">Autre Personnel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dépôt</label>
                      <input 
                        type="text" 
                        required
                        value={driverDepot} 
                        onChange={e => setDriverDepot(e.target.value)} 
                        placeholder="DEPOT_LYON_01"
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Métier / Description</label>
                      <input type="text" value={driverRole} onChange={e => setDriverRole(e.target.value)} placeholder="ex: Conducteur Poids Lourd" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Téléphone</label>
                      <input type="text" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="0600112233" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">ID Employé</label>
                      <input type="text" value={driverEmployeeId} onChange={e => setDriverEmployeeId(e.target.value)} placeholder="BHD-HDD-123" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Type de permis</label>
                      <input type="text" value={driverLicenseTypes} onChange={e => setDriverLicenseTypes(e.target.value)} placeholder="C, CE" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Langues</label>
                      <select 
                        value={driverLanguages} 
                        onChange={e => setDriverLanguages(e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer"
                      >
                        <option value="">Sélectionner une langue</option>
                        <option value="Français">Français</option>
                        <option disabled>────────────────────</option>
                        {COMMON_LANGUAGES.filter(l => l !== "Français").map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date d'embauche (Ancienneté)</label>
                    <input type="date" value={driverSeniority} onChange={e => setDriverSeniority(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <input 
                      type="checkbox" 
                      id="nightWork"
                      checked={driverNightWork}
                      onChange={e => setDriverNightWork(e.target.checked)}
                      className="w-4 h-4 text-opti-red border-gray-300 rounded focus:ring-opti-red"
                    />
                    <label htmlFor="nightWork" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Autorisation du travail de nuit
                    </label>
                  </div>
                </div>
              )}
              {createError && <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-opti-red text-xs font-medium">{createError}</div>}
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Annuler</button>
                <button type="submit" disabled={isCreating} className="flex-1 px-4 py-3 bg-opti-red text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50">{isCreating ? "Création..." : "Confirmer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE SUPPRESSION */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 className="w-10 h-10 text-opti-red" /></div>
            <h2 className="text-2xl font-bold text-opti-blue mb-3">Supprimer l'accès ?</h2>
            <p className="text-slate-500 mb-8 leading-relaxed">Êtes-vous sûr de vouloir supprimer le compte de <span className="font-bold text-opti-blue">{userToDelete.name || userToDelete.email}</span> ? Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }} className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Annuler</button>
              <button onClick={handleDeleteUser} disabled={isDeleting} className="flex-1 px-4 py-3 bg-opti-red text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50">{isDeleting ? "Suppression..." : "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ÉDITION */}
      {showEditModal && userToEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-blue-50 p-3 rounded-2xl"><Pencil className="w-6 h-6 text-opti-blue" /></div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <h2 className="text-2xl font-bold text-opti-blue mb-2">Modifier le profil</h2>
            <p className="text-slate-500 text-sm mb-8">Mise à jour des informations de <span className="font-bold text-opti-blue">{userToEdit.name || userToEdit.email}</span>.</p>
            <form onSubmit={handleUpdateUser} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nom Complet</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Email Professionnel</label>
                <input type="email" required value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Rôle</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full border border-gray-200 rounded-xl p-3 text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer">
                  {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>

              {/* Champs spécifiques au Chauffeur (Edition) */}
              {editRole === "Chauffeur" && (
                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                  <h3 className="text-sm font-bold text-opti-blue flex items-center gap-2">
                    <Truck className="w-4 h-4 text-opti-red" />
                    Informations Techniques
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Régime Contractuel</label>
                      <select 
                        value={driverContractType} 
                        onChange={e => setDriverContractType(e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer"
                      >
                        <option value="GRAND_ROUTIER">Grand Routier</option>
                        <option value="AUTRE_PERSONNEL">Autre Personnel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dépôt</label>
                      <input 
                        type="text" 
                        required
                        value={driverDepot} 
                        onChange={e => setDriverDepot(e.target.value)} 
                        placeholder="DEPOT_LYON_01"
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Métier / Description</label>
                      <input type="text" value={driverRole} onChange={e => setDriverRole(e.target.value)} placeholder="ex: Conducteur Poids Lourd" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Téléphone</label>
                      <input type="text" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="0600112233" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">ID Employé</label>
                      <input type="text" value={driverEmployeeId} onChange={e => setDriverEmployeeId(e.target.value)} placeholder="BHD-HDD-123" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Type de permis</label>
                      <input type="text" value={driverLicenseTypes} onChange={e => setDriverLicenseTypes(e.target.value)} placeholder="C, CE" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Langues</label>
                      <select 
                        value={driverLanguages} 
                        onChange={e => setDriverLanguages(e.target.value)} 
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none bg-white transition-all cursor-pointer"
                      >
                        <option value="">Sélectionner une langue</option>
                        <option value="Français">Français</option>
                        <option disabled>────────────────────</option>
                        {COMMON_LANGUAGES.filter(l => l !== "Français").map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date d'embauche (Ancienneté)</label>
                    <input type="date" value={driverSeniority} onChange={e => setDriverSeniority(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-opti-blue font-medium focus:ring-2 focus:ring-opti-red outline-none transition-all" />
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <input 
                      type="checkbox" 
                      id="editNightWork"
                      checked={driverNightWork}
                      onChange={e => setDriverNightWork(e.target.checked)}
                      className="w-4 h-4 text-opti-red border-gray-300 rounded focus:ring-opti-red"
                    />
                    <label htmlFor="editNightWork" className="text-sm font-medium text-slate-700 cursor-pointer">
                      Autorisation du travail de nuit
                    </label>
                  </div>
                </div>
              )}
              {editError && <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-opti-red text-xs font-medium">{editError}</div>}
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-3 text-slate-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Annuler</button>
                <button type="submit" disabled={isUpdating} className="flex-1 px-4 py-3 bg-opti-red text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50">{isUpdating ? "Mise à jour..." : "Sauvegarder"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications Overlay (Premium Pop-ups) */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {notifications.map((notif) => (
          <div 
            key={notif.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 animate-in slide-in-from-bottom-10 duration-300 w-full ${
              notif.type === 'success' 
                ? 'bg-white/95 border-green-100 text-slate-800' 
                : notif.type === 'error'
                ? 'bg-white/95 border-red-100 text-slate-800'
                : 'bg-white/95 border-blue-100 text-slate-800'
            }`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${
              notif.type === 'success' 
                ? 'bg-green-50 text-green-500' 
                : notif.type === 'error'
                ? 'bg-red-50 text-opti-red'
                : 'bg-blue-50 text-blue-500'
            }`}>
              {notif.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {notif.type === 'error' && <ShieldAlert className="w-5 h-5" />}
              {notif.type === 'info' && <Info className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 pt-0.5">
              <p className="text-sm font-bold text-slate-900 mb-0.5">
                {notif.type === 'success' ? 'Succès' : notif.type === 'error' ? 'Erreur' : 'Information'}
              </p>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                {notif.message}
              </p>
            </div>

            <button 
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </RoleGuard>
  );
}