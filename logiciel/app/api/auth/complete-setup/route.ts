import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Email et nouveau mot de passe (min. 8 caractères) requis.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur' }, { status: 500 });
    }

    // 1. Recherche du chauffeur dans Firestore
    const querySnapshot = await adminDb.collection('drivers').where('email', '==', email.trim().toLowerCase()).get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const driverDoc = querySnapshot.docs[0];
    const driverData = driverDoc.data();

    // 2. Vérification que l'OTP a bien été validé
    if (!driverData.otpVerified) {
      return NextResponse.json({ error: 'Veuillez valider le code OTP avant de configurer le mot de passe.' }, { status: 400 });
    }

    // 3. Récupération de l'utilisateur Firebase Auth par e-mail
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email.trim().toLowerCase());
    } catch (authError) {
      return NextResponse.json({ error: 'Utilisateur d\'authentification introuvable.' }, { status: 404 });
    }

    const uid = userRecord.uid;

    // 4. Mise à jour du mot de passe dans Firebase Auth
    await adminAuth.updateUser(uid, {
      password: newPassword
    });

    // 5. Mise à jour de l'utilisateur dans la collection `users`
    await adminDb.collection('users').doc(uid).update({
      mustChangePassword: false,
      passwordChangedAt: new Date()
    });

    // 6. Nettoyage du profil chauffeur dans `drivers`
    await driverDoc.ref.update({
      tempAppPassword: null,
      tempPasswordVerified: null,
      otpVerified: null
    });

    return NextResponse.json({
      success: true,
      message: 'Mot de passe configuré et compte activé avec succès.'
    });

  } catch (error: any) {
    console.error('Erreur lors de la configuration finale du mot de passe:', error);
    
    if (error.message && error.message.includes('PASSWORD_DOES_NOT_MEET_REQUIREMENTS')) {
      return NextResponse.json({ error: 'Le mot de passe ne respecte pas les critères de sécurité de Firebase.' }, { status: 400 });
    }
    
    return NextResponse.json({ error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}
