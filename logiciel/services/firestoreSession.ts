import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import type { DeliverySession } from '@/types/logistics'

const COLLECTION = 'delivery_sessions'

export async function getBusyVehicleIdsForDate(dateStr: string, currentSessionId: string): Promise<string[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("meta.date", "==", dateStr),
      where("status", "==", "VALIDATED") // Assumons que les tournées verrouillées ont ce statut
    );
    const snapshot = await getDocs(q);
    const busyIds = new Set<string>();
    
    snapshot.forEach(doc => {
      if (doc.id !== currentSessionId) {
        const data = doc.data();
        // On suppose que lorsqu'une tournée est validée, on stocke les IDs des camions utilisés
        if (Array.isArray(data.vehicles_used)) {
          data.vehicles_used.forEach((id: string) => busyIds.add(id));
        }
      }
    });
    return Array.from(busyIds);
  } catch (e) {
    console.error("Erreur getBusyVehicleIdsForDate:", e);
    return [];
  }
}

export async function saveSession(session: DeliverySession): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Utilisateur non connecté')

  const ref = doc(db, COLLECTION, session.id)
  await setDoc(ref, {
    ...session,
    uid,
    createdAt: Timestamp.fromDate(new Date(session.createdAt)),
    updatedAt: Timestamp.fromDate(new Date(session.updatedAt)),
  })
}

export async function loadSession(id: string): Promise<DeliverySession | null> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Utilisateur non connecté')

  const ref = doc(db, COLLECTION, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null

  const data = snap.data()
  if (data.uid !== uid) throw new Error('Accès non autorisé')

  return {
    ...data,
    createdAt: (data.createdAt as Timestamp).toDate(),
    updatedAt: (data.updatedAt as Timestamp).toDate(),
  } as DeliverySession
}

export async function listSessions(): Promise<DeliverySession[]> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Utilisateur non connecté')

  const q = query(collection(db, COLLECTION), where('uid', '==', uid), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      ...data,
      createdAt: (data.createdAt as Timestamp).toDate(),
      updatedAt: (data.updatedAt as Timestamp).toDate(),
    } as DeliverySession
  })
}

export async function deleteSession(id: string): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Utilisateur non connecté')
  await deleteDoc(doc(db, COLLECTION, id))
}
