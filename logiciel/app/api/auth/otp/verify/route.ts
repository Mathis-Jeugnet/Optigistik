import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email, otpCode } = await request.json();

    if (!email || !otpCode) {
      return NextResponse.json({ error: 'Email et code OTP requis.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: 'Erreur de configuration serveur' }, { status: 500 });
    }

    // 1. Recherche du chauffeur dans Firestore
    const querySnapshot = await adminDb.collection('drivers').where('email', '==', email.trim().toLowerCase()).get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Chauffeur introuvable.' }, { status: 404 });
    }

    const driverDoc = querySnapshot.docs[0];
    const driverData = driverDoc.data();

    // 2. Vérification des étapes
    if (!driverData.tempPasswordVerified) {
      return NextResponse.json({ error: 'Veuillez d\'abord valider votre mot de passe temporaire.' }, { status: 400 });
    }

    if (!driverData.otpCode || driverData.otpCode !== otpCode) {
      return NextResponse.json({ error: 'Code OTP incorrect.' }, { status: 400 });
    }

    // 3. Vérification de l'expiration
    const expiry = new Date(driverData.otpExpiresAt);
    if (expiry.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code OTP expiré.' }, { status: 400 });
    }

    // 4. Marquage de la vérification OTP réussie
    await driverDoc.ref.update({
      otpVerified: true,
      otpCode: null,
      otpExpiresAt: null
    });

    return NextResponse.json({
      success: true,
      message: 'Code OTP vérifié avec succès.'
    });

  } catch (error: any) {
    console.error('Erreur lors de la vérification de l\'OTP:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur interne' }, { status: 500 });
  }
}
