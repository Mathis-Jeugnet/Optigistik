import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendOtpEmail } from '@/utils/mailer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, tempPassword } = await request.json();

    if (!email || !tempPassword) {
      return NextResponse.json({ error: 'Email et mot de passe temporaire requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur' }, { status: 500 });
    }

    // 1. Recherche du chauffeur dans Firestore
    const querySnapshot = await adminDb.collection('drivers').where('email', '==', email.trim().toLowerCase()).get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    const driverDoc = querySnapshot.docs[0];
    const driverData = driverDoc.data();

    // 2. Vérification du mot de passe temporaire ou permanent
    if (driverData.tempAppPassword) {
      // Cas 1 : Premier login, on exige le mot de passe temporaire
      if (driverData.tempAppPassword !== tempPassword) {
        return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
      }

      // 3. Génération de l'OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes d'expiration

      // 4. Enregistrement de l'OTP dans Firestore
      await driverDoc.ref.update({
        otpCode,
        otpExpiresAt: otpExpiresAt.toISOString(),
        tempPasswordVerified: true
      });

      // 5. Envoi de l'e-mail avec l'OTP en arrière-plan sans bloquer la réponse API
      const driverName = `${driverData.firstName} ${driverData.lastName}`.trim() || 'Chauffeur';
      sendOtpEmail(email.trim().toLowerCase(), driverName, otpCode).catch(err => {
        console.error("[MAILER ERROR] Échec de l'envoi de l'OTP en arrière-plan:", err);
      });

      return NextResponse.json({
        success: true,
        requiresOtp: true,
        message: 'Code OTP envoyé avec succès.'
      });
    } else {
      // Cas 2 : Déjà activé, on valide le mot de passe final contre Firebase Auth
      try {
        const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
        if (!apiKey) {
          throw new Error('Clé API Firebase manquante sur le serveur.');
        }

        const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password: tempPassword,
            returnSecureToken: true
          })
        });

        const authData = await authResponse.json();

        if (!authResponse.ok || authData.error) {
          return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
        }

        return NextResponse.json({
          success: true,
          requiresOtp: false,
          driverId: driverDoc.id,
          email: email.trim().toLowerCase(),
          message: 'Connexion réussie.'
        });

      } catch (authErr: any) {
        console.error('Firebase Auth sign-in error:', authErr);
        return NextResponse.json({ error: 'Erreur d\'authentification serveur.' }, { status: 500 });
      }
    }

  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de l\'OTP:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}
