"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth"; // Ajout de signOut
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type UserRole = 'Admin' | 'Gestionnaire' | 'Lecteur' | 'Chauffeur';

// Source de vérité unique des rôles assignables (cf. /admin/roles et /api/users/create).
export const ROLES: UserRole[] = ['Admin', 'Gestionnaire', 'Lecteur', 'Chauffeur'];

// Édition (créer / modifier / supprimer) réservée à Admin et Gestionnaire.
// Comparaison insensible à la casse pour gérer d'éventuels anciens comptes en minuscules.
export const canEdit = (role?: string | null): boolean => {
  const r = role?.toLowerCase();
  return r === 'admin' || r === 'gestionnaire';
};

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>; // Ajout de la définition du type
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {}, // Valeur par défaut
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fonction de déconnexion centralisée
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Les documents users sont créés avec l'UID comme ID (cf. /api/users/create),
          // donc une lecture directe par ID suffit toujours.
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setProfile({ uid: currentUser.uid, ...docSnap.data() } as UserProfile);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error("Erreur profil:", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);