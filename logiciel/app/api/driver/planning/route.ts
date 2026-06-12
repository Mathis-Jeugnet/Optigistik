import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return NextResponse.json({ error: 'Identifiant du chauffeur (driverId) requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur (Firebase Admin)' }, { status: 500 });
    }

    // 1. Récupérer tous les trajets planifiés pour ce chauffeur
    const snapshot = await adminDb.collection('vehicle_trips')
      .where('driver_id', '==', driverId)
      .get();

    const trips: any[] = [];
    const sessionIds = new Set<string>();
    const vehicleIds = new Set<string>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      trips.push({
        id: doc.id,
        vehicleId: data.vehicle_id,
        sessionId: data.session_id,
        status: data.status || 'PLANNED',
        startTime: data.start_time ? data.start_time.toDate() : null,
        endTime: data.end_time ? data.end_time.toDate() : null,
      });

      if (data.session_id) sessionIds.add(data.session_id);
      if (data.vehicle_id) vehicleIds.add(data.vehicle_id);
    });

    // 2. Récupérer les détails des sessions et véhicules en parallèle (batching léger)
    const sessionsMap: Record<string, any> = {};
    const vehiclesMap: Record<string, any> = {};

    const sessionPromises = Array.from(sessionIds).map(async (sid) => {
      const docSnap = await adminDb.collection('delivery_sessions').doc(sid).get();
      if (docSnap.exists) {
        const sdata = docSnap.data();
        sessionsMap[sid] = {
          name: sdata?.meta?.name || `Tournée #${sid.slice(0, 4)}`,
          date: sdata?.meta?.date || '',
        };
      }
    });

    const vehiclePromises = Array.from(vehicleIds).map(async (vid) => {
      const docSnap = await adminDb.collection('vehicles').doc(vid).get();
      if (docSnap.exists) {
        const vdata = docSnap.data();
        vehiclesMap[vid] = {
          name: vdata?.name || 'Camion',
          plate: vdata?.plate || vid,
        };
      }
    });

    await Promise.all([...sessionPromises, ...vehiclePromises]);

    // 3. Compléter les trajets avec les noms réels
    const resolvedTrips = trips.map(t => {
      const session = sessionsMap[t.sessionId];
      const vehicle = vehiclesMap[t.vehicleId];

      return {
        ...t,
        sessionName: session?.name || `Tournée #${t.sessionId.slice(0, 4)}`,
        date: session?.date || '',
        vehicleName: vehicle ? `${vehicle.name} (${vehicle.plate})` : t.vehicleId,
      };
    });

    // 4. Trier les trajets par date/heure de début croissante
    resolvedTrips.sort((a, b) => {
      const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return timeA - timeB; // Chronologique (futur en premier ou passé récent)
    });

    return NextResponse.json({
      success: true,
      planning: resolvedTrips
    });

  } catch (error: any) {
    console.error('Erreur lors de la récupération du planning du chauffeur:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}
