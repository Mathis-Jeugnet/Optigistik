import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { targetUid, name, email, role, driverConfig } = await request.json();

    if (!targetUid || !name || !email || !role) {
      return NextResponse.json({ error: 'Tous les champs sont requis (uid, name, email, role)' }, { status: 400 });
    }

    // 1. Vérification de l'autorisation
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

    // 2. Sécurité : Ne pas modifier un autre Admin (sauf soi-même)
    const targetUser = await adminAuth.getUser(targetUid);
    const currentTargetRole = targetUser.customClaims?.role;

    if (currentTargetRole === 'Admin' && decodedToken.uid !== targetUid) {
      return NextResponse.json({ error: 'Sécurité : Vous ne pouvez pas modifier les informations d\'un autre administrateur.' }, { status: 403 });
    }

    // 3. Mise à jour dans Firebase Auth (Email et Nom d'affichage)
    await adminAuth.updateUser(targetUid, {
      email,
      displayName: name,
    });

    // 4. Mise à jour du rôle (Custom Claims)
    await adminAuth.setCustomUserClaims(targetUid, { role });

    // 5. Mise à jour dans Firestore
    await adminDb.collection('users').doc(targetUid).update({
      name,
      email,
      role,
    });

    // 6. Si Chauffeur, mise à jour de l'entité Driver
    if (role === 'Chauffeur' && driverConfig) {
      const nameParts = name.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts.pop() : name;
      const firstName = nameParts.join(' ');

      const driverData: any = {
        firstName: firstName || "",
        lastName: lastName || "",
        email,
        role: driverConfig.role || "Conducteur",
      };

      if (driverConfig.contract_type) driverData.regime = driverConfig.contract_type;
      if (typeof driverConfig.night_work_authorized === 'boolean') driverData.nightWorkAuthorized = driverConfig.night_work_authorized;
      if (driverConfig.default_depot_id) driverData.defaultDepotId = driverConfig.default_depot_id;
      if (driverConfig.phone !== undefined) driverData.phone = driverConfig.phone;
      if (driverConfig.license_types !== undefined) driverData.licenseTypes = driverConfig.license_types.split(",").map((s: string) => s.trim()).filter(Boolean);
      if (driverConfig.employee_id !== undefined) driverData.employeeId = driverConfig.employee_id;
      if (driverConfig.seniority !== undefined) driverData.seniority = driverConfig.seniority;
      if (driverConfig.languages !== undefined) driverData.languages = driverConfig.languages.split(",").map((s: string) => s.trim()).filter(Boolean);

      await adminDb.collection('drivers').doc(targetUid).set(driverData, { merge: true });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Utilisateur mis à jour avec succès' 
    });

  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Cet email est déjà utilisé par un autre compte.' }, { status: 400 });
    }
    
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
