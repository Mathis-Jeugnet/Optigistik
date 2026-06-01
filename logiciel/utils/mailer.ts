import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Utilitaire d'envoi d'e-mail avec fallback local pour le développement
export async function sendTempPasswordEmail(email: string, name: string, tempPassword: string, role: string): Promise<{ success: boolean; path?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromEmail = process.env.SMTP_FROM || 'no-reply@optigistik.fr';

  const subject = 'Bienvenue chez Optigistik - Vos identifiants de connexion';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          color: #1e293b;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .header {
          background-color: #1e3a8a;
          color: #ffffff;
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .content {
          padding: 32px;
          line-height: 1.6;
        }
        .welcome {
          font-size: 18px;
          font-weight: 600;
          color: #1e3a8a;
          margin-bottom: 16px;
        }
        .credentials-box {
          background-color: #f1f5f9;
          border-radius: 12px;
          padding: 24px;
          margin: 24px 0;
          border: 1px solid #e2e8f0;
        }
        .credential-row {
          margin-bottom: 12px;
        }
        .credential-row:last-child {
          margin-bottom: 0;
        }
        .label {
          font-weight: 600;
          color: #64748b;
          font-size: 14px;
          text-transform: uppercase;
        }
        .value {
          font-family: monospace;
          font-size: 16px;
          color: #0f172a;
          font-weight: bold;
        }
        .button-container {
          text-align: center;
          margin: 32px 0 16px 0;
        }
        .button {
          background-color: #ef4444;
          color: #ffffff !important;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: bold;
          display: inline-block;
          transition: background-color 0.2s;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>OPTIGISTIK</h1>
        </div>
        <div class="content">
          <p class="welcome">Bonjour ${name},</p>
          <p>Un administrateur vient de vous créer un compte sur la plateforme de gestion logistique <strong>Optigistik</strong>.</p>
          <p>Voici vos identifiants temporaires pour vous connecter :</p>
          
          <div class="credentials-box">
            <div class="credential-row">
              <span class="label">Adresse e-mail :</span><br/>
              <span class="value">${email}</span>
            </div>
            <div class="credential-row" style="margin-top: 16px;">
              <span class="label">Rôle attribué :</span><br/>
              <span class="value" style="font-family: inherit; font-size: 15px; color: #1e3a8a;">${role}</span>
            </div>
            <div class="credential-row" style="margin-top: 16px;">
              <span class="label">Mot de passe temporaire :</span><br/>
              <span class="value">${tempPassword}</span>
            </div>
          </div>
          
          <p style="color: #ef4444; font-weight: 600;">⚠️ Lors de votre toute première connexion, il vous sera demandé de modifier obligatoirement ce mot de passe temporaire pour choisir un mot de passe définitif et sécurisé.</p>
          
          <div class="button-container">
            <a href="http://localhost:3000" class="button">Se connecter à Optigistik</a>
          </div>
        </div>
        <div class="footer">
          Cet e-mail est généré automatiquement, merci de ne pas y répondre.<br/>
          &copy; ${new Date().getFullYear()} Optigistik. Tous droits réservés.
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Validation de la configuration SMTP
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('[MAILER ERROR] SMTP n\'est pas configuré dans les variables d\'environnement.');
    throw new Error('Le serveur de messagerie SMTP n\'est pas configuré. Veuillez définir SMTP_HOST, SMTP_USER, et SMTP_PASS dans votre fichier .env.local.');
  }

  // 2. Envoi par SMTP
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `Optigistik <${fromEmail}>`,
      to: email,
      subject,
      html: htmlContent,
    });

    console.log(`[MAILER] E-mail envoyé avec succès à ${email}`);
    return { success: true };
  } catch (error: any) {
    console.error('[MAILER] Échec de l\'envoi de l\'e-mail par SMTP:', error);
    throw new Error(`Échec de l'envoi de l'e-mail de bienvenue : ${error.message || error}`);
  }
}
