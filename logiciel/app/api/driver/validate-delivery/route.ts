import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, nodeId } = body;

    if (!sessionId || !nodeId) {
      return NextResponse.json({ success: false, error: 'Paramètres manquants (sessionId, nodeId).' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ success: false, error: 'Erreur de configuration serveur (Firebase Admin)' }, { status: 500 });
    }

    const sessionRef = adminDb.collection('delivery_sessions').doc(sessionId);
    const docSnap = await sessionRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Session introuvable' }, { status: 404 });
    }

    const sessionData = docSnap.data();
    let isUpdated = false;

    // Parcours des clusters pour mettre à jour le statut du point
    const updatedClusters = (sessionData?.clusters || []).map((cluster: any) => {
      return {
        ...cluster,
        nodes: cluster.nodes.map((node: any) => {
          if (node.id === nodeId) {
            isUpdated = true;
            return { ...node, status: 'DELIVERED' }; // On applique le statut
          }
          return node;
        })
      };
    });

    if (!isUpdated) {
       return NextResponse.json({ success: false, error: 'Point de livraison introuvable dans cette tournée' }, { status: 404 });
    }

    // Mise à jour sécurisée via Admin SDK
    await sessionRef.update({ clusters: updatedClusters });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erreur lors de la validation de la livraison:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}