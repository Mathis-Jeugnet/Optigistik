import { collection, doc, setDoc, getDocs, deleteDoc, query, where, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface TrafficIncident {
  id: string;
  address: string;
  lat: number;
  lng: number;
  radiusInMeters: number;
  type: 'BLOCKAGE' | 'SLOWDOWN';
  date: string; 
  time: string; 
  endTime: string; 
  recurrenceType: 'NONE' | 'DAILY' | 'WEEKLY';
  endDate?: string; 
  daysOfWeek?: number[]; // NOUVEAU : 0=Dim, 1=Lun, 2=Mar, 3=Mer, 4=Jeu, 5=Ven, 6=Sam
  createdAt: string;
}

// Fonction utilitaire sécurisée pour la gestion des fuseaux horaires (Minuit exact)
function parseDateLocal(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

export async function addGlobalIncident(incident: Omit<TrafficIncident, 'id' | 'createdAt'>): Promise<TrafficIncident> {
  const id = crypto.randomUUID();
  const newIncident: TrafficIncident = { ...incident, id, createdAt: new Date().toISOString() };
  await setDoc(doc(db, 'traffic_incidents', id), newIncident);
  return newIncident;
}

export async function updateGlobalIncident(id: string, updates: Partial<TrafficIncident>): Promise<void> {
  await updateDoc(doc(db, 'traffic_incidents', id), updates);
}

export async function getIncidentsForDate(targetDateStr: string): Promise<TrafficIncident[]> {
  const targetDate = parseDateLocal(targetDateStr);
  const targetTime = targetDate.getTime();
  const targetDayOfWeek = targetDate.getDay(); 

  // 1. Les incidents isolés de ce jour précis
  const q1 = query(collection(db, 'traffic_incidents'), where('date', '==', targetDateStr));
  // 2. Les incidents récurrents (à filtrer ensuite)
  const q2 = query(collection(db, 'traffic_incidents'), where('recurrenceType', 'in', ['DAILY', 'WEEKLY']));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  const incidentMap = new Map<string, TrafficIncident>();
  const allDocs = [...snap1.docs, ...snap2.docs];

  allDocs.forEach(d => {
    const inc = d.data() as TrafficIncident;
    
    // SÉCURITÉ : Si l'incident est vieux et n'a pas de type, on force "NONE"
    const recType = inc.recurrenceType || 'NONE'; 

    if (incidentMap.has(inc.id)) return; // On évite les doublons

    const incStart = parseDateLocal(inc.date).getTime();
    // Si pas de date de fin définie, la date de fin est égale à la date de début
    const incEnd = inc.endDate ? parseDateLocal(inc.endDate).getTime() : incStart;

    // L'incident ne s'applique que si la date ciblée est dans sa période d'existence globale
    if (targetTime >= incStart && targetTime <= incEnd) {
      
      if (recType === 'NONE') {
        // Une seule fois : doit correspondre exactement
        if (targetTime === incStart) {
          incidentMap.set(inc.id, inc);
        }
      } 
      else if (recType === 'DAILY') {
        // Tous les jours : s'applique obligatoirement puisque c'est dans la plage
        incidentMap.set(inc.id, inc);
      } 
      else if (recType === 'WEEKLY') {
        // Hebdomadaire : s'applique uniquement si le jour ciblé a été coché
        if (inc.daysOfWeek && inc.daysOfWeek.includes(targetDayOfWeek)) {
          incidentMap.set(inc.id, inc);
        }
      }
      
    }
  });

  return Array.from(incidentMap.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export async function removeGlobalIncident(id: string): Promise<void> {
  await deleteDoc(doc(db, 'traffic_incidents', id));
}