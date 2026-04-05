/**
 * DIWANE — Service Email (Brevo HTTP API)
 * Utilise @getbrevo/brevo (HTTPS — compatible Railway)
 *
 * Env vars Railway :
 *   BREVO_API_KEY=xkeysib-...
 *   BREVO_SENDER_EMAIL=intelligtech@gmail.com   (doit être vérifié sur Brevo)
 *   BREVO_SENDER_NAME=Diwane                    (optionnel)
 */
import * as brevo from '@getbrevo/brevo';

const APP_URL  = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const APP_NAME = 'Diwane';
const NAVY     = '#1B2A4A';
const ORANGE   = '#E8621A';

function baseTemplate(body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif}
    .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
    .header{background:${NAVY};padding:28px 32px;text-align:center}
    .header h1{margin:0;color:#fff;font-size:22px;letter-spacing:.5px}
    .content{padding:32px;color:#333;font-size:15px;line-height:1.6}
    .btn{display:inline-block;background:${ORANGE};color:#fff!important;text-decoration:none;padding:13px 28px;border-radius:8px;font-weight:700;font-size:15px;margin:20px 0}
    .footer{background:#f4f6f9;padding:20px 32px;text-align:center;font-size:12px;color:#999}
    .divider{border:none;border-top:1px solid #eee;margin:24px 0}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>${APP_NAME}</h1></div>
  <div class="content">${body}</div>
  <div class="footer">Cet email a été envoyé automatiquement — merci de ne pas y répondre.<br>${APP_NAME} — Plateforme immobilière Sénégal</div>
</div>
</body></html>`;
}

class DiwaneEmailService {
  private api: brevo.TransactionalEmailsApi | null = null;
  private senderEmail: string;
  private senderName: string;

  constructor() {
    const apiKey       = process.env.BREVO_API_KEY;
    this.senderEmail   = process.env.BREVO_SENDER_EMAIL ?? 'intelligtech@gmail.com';
    this.senderName    = process.env.BREVO_SENDER_NAME  ?? APP_NAME;

    if (apiKey) {
      this.api = new brevo.TransactionalEmailsApi();
      this.api.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);
      console.log(`✅ [DiwaneEmail] Brevo configuré — expéditeur: ${this.senderEmail}`);
    } else {
      console.warn('⚠️ [DiwaneEmail] BREVO_API_KEY manquant — emails simulés dans les logs');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.api) {
      console.log(`[DiwaneEmail DEV] À: ${to} | Sujet: ${subject}`);
      return;
    }
    const mail = new brevo.SendSmtpEmail();
    mail.sender  = {name: this.senderName, email: this.senderEmail};
    mail.to      = [{email: to}];
    mail.subject = subject;
    mail.htmlContent = html;

    await this.api.sendTransacEmail(mail);
    console.log(`[DiwaneEmail] ✅ Envoyé à ${to}`);
  }

  // ── Vérification email ────────────────────────────────────────────────────

  async envoyerVerification(email: string, prenom: string, token: string): Promise<void> {
    const url = `${APP_URL}/api/auth/verifier-email?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenom} 👋</h2>
      <p>Merci de vous être inscrit sur <strong>${APP_NAME}</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour vérifier votre adresse email :</p>
      <div style="text-align:center"><a href="${url}" class="btn">Vérifier mon email</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Lien valable 24h. Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.</p>
    `);
    await this.send(email, `Vérifiez votre email — ${APP_NAME}`, html);
  }

  // ── Invitation agence (utilisateur existant) ──────────────────────────────

  async envoyerInvitationExistant(
    email: string, prenomInvite: string, nomAgence: string,
    proprietaireNom: string, token: string,
  ): Promise<void> {
    const urlRejoindre = `${APP_URL}/agence/rejoindre?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenomInvite} 👋</h2>
      <p><strong>${proprietaireNom}</strong> vous invite à rejoindre l'agence <strong>${nomAgence}</strong> sur ${APP_NAME}.</p>
      <p>En acceptant, votre compte passera automatiquement au <strong>plan Pro</strong>.</p>
      <div style="text-align:center"><a href="${urlRejoindre}" class="btn">Rejoindre l'agence</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">
        Vous pouvez aussi accepter directement depuis votre profil dans l'application Diwane.<br>
        Invitation valable 7 jours.
      </p>
    `);
    await this.send(email, `Invitation à rejoindre ${nomAgence} — ${APP_NAME}`, html);
  }

  // ── Invitation agence (nouveau compte) ───────────────────────────────────

  async envoyerInvitationNouveauCompte(
    email: string, prenomInvite: string, nomAgence: string,
    proprietaireNom: string, token: string,
  ): Promise<void> {
    const urlCreer = `${APP_URL}/agence/rejoindre?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenomInvite} 👋</h2>
      <p><strong>${proprietaireNom}</strong> vous invite à rejoindre l'agence <strong>${nomAgence}</strong> sur ${APP_NAME}.</p>
      <p>Cliquez ci-dessous pour créer votre compte et rejoindre l'agence avec le <strong>plan Pro</strong> :</p>
      <div style="text-align:center"><a href="${urlCreer}" class="btn">Créer mon compte et rejoindre</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Invitation valable 7 jours.</p>
    `);
    await this.send(email, `Invitation à rejoindre ${nomAgence} — ${APP_NAME}`, html);
  }

  // ── Confirmation rejoindre ────────────────────────────────────────────────

  async envoyerConfirmationRejoindre(email: string, prenom: string, nomAgence: string): Promise<void> {
    const html = baseTemplate(`
      <h2>Bienvenue dans l'agence ${nomAgence} ! 🎉</h2>
      <p>Bonjour ${prenom}, vous faites maintenant partie de l'agence <strong>${nomAgence}</strong>.</p>
      <p>Votre compte est passé au <strong>plan Pro</strong>. Connectez-vous à l'application Diwane pour commencer.</p>
    `);
    await this.send(email, `Vous avez rejoint ${nomAgence} — ${APP_NAME}`, html);
  }
}

export const diwaneEmail = new DiwaneEmailService();
