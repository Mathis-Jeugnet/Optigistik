import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DeliverySession } from '@/types/logistics';

// Utilitaire pour convertir "HH:MM" en secondes
function timeToSeconds(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

export async function getAffectedSessions(
  incidentDate: string, 
  incidentStart: string, 
  incidentEnd: string
): Promise<DeliverySession[]> {
  
  // 1. Récupérer toutes les sessions validées ou prévues à cette date
  const q = query(
    collection(db, 'delivery_sessions'),
    where('meta.date', '==', incidentDate)
  );

  const snapshot = await getDocs(q);
  const affectedSessions: DeliverySession[] = [];

  const incStartSec = timeToSeconds(incidentStart);
  const incEndSec = timeToSeconds(incidentEnd);

  snapshot.forEach((docSnap) => {
    const session = docSnap.data() as DeliverySession;
    
    // On ne recalcule que les tournées qui ont déjà des points et une heure de départ
    if (!session.meta?.start_time) return;

    const sessionStartSec = timeToSeconds(session.meta.start_time);
    const sessionEndSec = sessionStartSec + (11 * 3600); // Règle des 11 heures

    // 2. Vérifier le chevauchement mathématique : DébutA <= FinB ET FinA >= DébutB
    const isOverlapping = (sessionStartSec <= incEndSec) && (sessionEndSec >= incStartSec);

    if (isOverlapping) {
      affectedSessions.push({ ...session, id: docSnap.id });
    }
  });

  return affectedSessions;
}