import { collection, doc, setDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface TrafficIncident {
  id: string;
  address: string;
  lat: number;
  lng: number;
  radiusInMeters: number;
  type: 'BLOCKAGE' | 'SLOWDOWN';
  date: string; // Format YYYY-MM-DD
  time: string; // Heure de début (HH:MM)
  endTime: string; // NOUVEAU : Heure de fin (HH:MM)
  createdAt: string;
}

export async function addGlobalIncident(incident: Omit<TrafficIncident, 'id' | 'createdAt'>): Promise<TrafficIncident> {
  const id = crypto.randomUUID();
  const newIncident: TrafficIncident = {
    ...incident,
    id,
    createdAt: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'traffic_incidents', id), newIncident);
  return newIncident;
}

export async function getIncidentsForDate(dateStr: string): Promise<TrafficIncident[]> {
  const q = query(
    collection(db, 'traffic_incidents'), 
    where('date', '==', dateStr)
  );
  
  const snap = await getDocs(q);
  const incidents = snap.docs.map(d => d.data() as TrafficIncident);
  
  return incidents.sort((a, b) => a.time.localeCompare(b.time));
}

export async function removeGlobalIncident(id: string): Promise<void> {
  await deleteDoc(doc(db, 'traffic_incidents', id));
}