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

    // 1. Récupérer toutes les sessions validées
    const snapshot = await adminDb.collection('delivery_sessions')
      .where('status', '==', 'VALIDATED')
      .get();

    const driverTours: any[] = [];

    // 2. Parcourir les sessions pour extraire les routes attribuées à ce chauffeur
    snapshot.forEach((doc) => {
      const sessionData = doc.data();
      
      if (Array.isArray(sessionData.clusters)) {
        const driverCluster = sessionData.clusters.find((c: any) => c.driver_id === driverId);
        
        if (driverCluster) {
          driverTours.push({
            sessionId: doc.id,
            date: sessionData.meta?.date || '',
            sessionName: sessionData.meta?.name || `Tournée #${doc.id.slice(0, 4)}`,
            vehicleName: driverCluster.vehicle_name || 'Camion non défini',
            stopsCount: driverCluster.nodes?.filter((n: any) => n.step_type === 'DELIVERY' || !n.step_type).length || 0,
            palletsCount: driverCluster.nodes?.reduce((sum: number, n: any) => sum + (n.pallets || 0), 0) || 0,
            nodes: driverCluster.nodes || [],
            createdAt: sessionData.createdAt || null
          });
        }
      }
    });

    // 3. Trier les tournées par date décroissante (plus récentes en premier)
    driverTours.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json({
      success: true,
      tours: driverTours
    });

  } catch (error: any) {
    console.error('Erreur lors de la récupération des tournées du chauffeur:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}
