import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { name, email, password, role, driverConfig } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Tous les champs sont requis (nom, email, password, role)' }, { status: 400 });
    }

    if (role === 'Chauffeur') {
      if (!driverConfig || !driverConfig.contract_type || typeof driverConfig.night_work_authorized !== 'boolean' || !driverConfig.default_depot_id) {
        return NextResponse.json({ error: 'Paramètres de conformité RSE manquants pour la création d\'un conducteur.' }, { status: 400 });
      }
    }

    // 1. Vérification de l'autorisation (Seul un Admin peut créer)
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

    // 2. Création de l'utilisateur dans Firebase Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name,
    });

    // 3. Attribution du rôle (Custom Claims)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 4. Création du profil dans Firestore (users)
    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email,
      role,
      createdAt: new Date(),
      uid: userRecord.uid
    });

    // 5. Si Chauffeur, création de l'entité Driver
    if (role === 'Chauffeur') {
      const nameParts = name.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts.pop() : name;
      const firstName = nameParts.join(' ');

      await adminDb.collection('drivers').doc(userRecord.uid).set({
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        phone: driverConfig.phone || "",
        regime: driverConfig.contract_type,
        nightWorkAuthorized: driverConfig.night_work_authorized,
        defaultDepotId: driverConfig.default_depot_id,
        status: "DISPONIBLE",
        role: driverConfig.role || "Conducteur",
        licenseTypes: driverConfig.license_types ? driverConfig.license_types.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        employeeId: driverConfig.employee_id || userRecord.uid,
        seniority: driverConfig.seniority || new Date().toISOString(),
        languages: driverConfig.languages ? driverConfig.languages.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        unavailabilities: [],
        assignedVehicles: []
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Utilisateur créé avec succès',
      uid: userRecord.uid 
    });

  } catch (error: any) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    
    // Gestion des erreurs spécifiques Firebase
    const errorMessage = error.message || '';
    
    if (errorMessage.includes('PASSWORD_DOES_NOT_MEET_REQUIREMENTS')) {
      const requirementsStr = errorMessage.split('Missing password requirements: ')[1] || '';
      
      // Traduction des termes techniques en français
      const translations: { [key: string]: string } = {
        'an upper case character': 'une majuscule',
        'a lower case character': 'une minuscule',
        'a numeric character': 'un chiffre',
        'a non-alphanumeric character': 'un caractère spécial',
      };

      const missing = Object.keys(translations)
        .filter(key => requirementsStr.includes(key))
        .map(key => translations[key]);

      if (missing.length > 0) {
        return NextResponse.json({ error: `Le mot de passe doit contenir : ${missing.join(', ')}.` }, { status: 400 });
      }
      return NextResponse.json({ error: 'Le mot de passe ne respecte pas les critères de sécurité.' }, { status: 400 });
    }

    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Cet email est déjà utilisé.' }, { status: 400 });
    }
    if (error.code === 'auth/invalid-password') {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
    }

    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
