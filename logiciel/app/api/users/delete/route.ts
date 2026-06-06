import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { targetUid } = await request.json();

    if (!targetUid) {
      return NextResponse.json({ error: 'UID cible requis' }, { status: 400 });
    }

    // 1. Vérification de l'autorisation (Seul un Admin peut supprimer)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken.role !== 'Admin') {
      return NextResponse.json({ error: 'Accès refusé. Réservé aux administrateurs.' }, { status: 403 });
    }

    // 3. Vérifier si l'utilisateur cible est un Admin
    // On autorise la suppression si c'est l'utilisateur lui-même qui le demande
    const targetUser = await adminAuth.getUser(targetUid);
    const targetRole = targetUser.customClaims?.role;

    if (targetRole === 'Admin' && decodedToken.uid !== targetUid) {
      return NextResponse.json({ error: 'Sécurité : Vous ne pouvez pas supprimer un autre administrateur.' }, { status: 403 });
    }

    // 4. Suppression dans Firebase Auth
    await adminAuth.deleteUser(targetUid);

    // 5. Suppression dans Firestore (users et potentiellement drivers)
    await adminDb.collection('users').doc(targetUid).delete();
    await adminDb.collection('drivers').doc(targetUid).delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Utilisateur supprimé avec succès' 
    });

  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
