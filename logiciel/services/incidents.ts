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

function parseDateLocal(dateStr: string): Date {
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

  const q1 = query(collection(db, 'traffic_incidents'), where('date', '==', targetDateStr));
  const q2 = query(collection(db, 'traffic_incidents'), where('recurrenceType', 'in', ['DAILY', 'WEEKLY']));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  
  const incidentMap = new Map<string, TrafficIncident>();
  const allDocs = [...snap1.docs, ...snap2.docs];

  allDocs.forEach(d => {
    const inc = d.data() as TrafficIncident;
    if (incidentMap.has(inc.id)) return; // Évite les doublons

    const incStart = parseDateLocal(inc.date).getTime();
    const incEnd = inc.endDate ? parseDateLocal(inc.endDate).getTime() : Infinity;

    // L'incident ne s'applique que si la date ciblée est dans sa période de validité
    if (targetTime >= incStart && targetTime <= incEnd) {
      if (inc.recurrenceType === 'DAILY' || inc.recurrenceType === 'NONE') {
        // NONE s'applique uniquement si targetTime === incStart (géré implicitement car snap1)
        if (inc.recurrenceType === 'NONE' && targetTime !== incStart) return;
        incidentMap.set(inc.id, inc);
      } else if (inc.recurrenceType === 'WEEKLY') {
        // WEEKLY s'applique uniquement si le jour ciblé est coché
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