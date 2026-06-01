import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé. Token de connexion requis.' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();

    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur' }, { status: 500 });
    }

    // 1. Vérification du jeton d'authentification pour identifier l'utilisateur
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 });
    }

    // 2. Mise à jour sécurisée du mot de passe dans Firebase Auth (bypasse requires-recent-login)
    await adminAuth.updateUser(uid, {
      password: newPassword
    });

    // 3. Mise à jour du flag dans Firestore (users) avec privilèges admin
    await adminDb.collection('users').doc(uid).update({
      mustChangePassword: false,
      passwordChangedAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Mot de passe sécurisé et compte activé avec succès.' 
    });

  } catch (error: any) {
    console.error('Erreur serveur lors du changement de mot de passe:', error);
    return NextResponse.json({ 
      error: error.message || 'Une erreur interne est survenue lors de la mise à jour.' 
    }, { status: 500 });
  }
}
