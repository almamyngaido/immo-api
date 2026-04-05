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

  private async send(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.api) {
      console.log(`[DiwaneEmail DEV] À: ${to} | Sujet: ${subject}\n${text}`);
      return;
    }
    const mail = new brevo.SendSmtpEmail();
    mail.sender      = {name: this.senderName, email: this.senderEmail};
    mail.replyTo     = {email: this.senderEmail, name: this.senderName};
    mail.to          = [{email: to}];
    mail.subject     = subject;
    mail.htmlContent = html;
    mail.textContent = text; // version texte brut — réduit le score spam

    await this.api.sendTransacEmail(mail);
    console.log(`[DiwaneEmail] ✅ Envoyé à ${to}`);
  }

  // ── Vérification email ────────────────────────────────────────────────────

  async envoyerVerification(email: string, prenom: string, token: string): Promise<void> {
    const url = `${APP_URL}/api/auth/verifier-email?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenom},</h2>
      <p>Merci de vous être inscrit sur <strong>${APP_NAME}</strong>, la plateforme immobilière au Sénégal.</p>
      <p>Pour activer votre compte, veuillez confirmer votre adresse email :</p>
      <div style="text-align:center"><a href="${url}" class="btn">Confirmer mon adresse email</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Ce lien est valable 24 heures. Si vous n'avez pas créé de compte sur ${APP_NAME}, vous pouvez ignorer cet email.</p>
    `);
    const text = `Bonjour ${prenom},\n\nMerci de vous être inscrit sur ${APP_NAME}.\n\nPour activer votre compte, copiez ce lien dans votre navigateur :\n${url}\n\nCe lien est valable 24 heures.\n\nSi vous n'avez pas créé de compte, ignorez cet email.\n\n— L'équipe ${APP_NAME}`;
    await this.send(email, `Confirmez votre adresse email ${APP_NAME}`, html, text);
  }

  // ── Invitation agence (utilisateur existant) ──────────────────────────────

  async envoyerInvitationExistant(
    email: string, prenomInvite: string, nomAgence: string,
    proprietaireNom: string, token: string,
  ): Promise<void> {
    const urlRejoindre = `${APP_URL}/agence/rejoindre?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenomInvite},</h2>
      <p><strong>${proprietaireNom}</strong> vous invite à rejoindre l'agence <strong>${nomAgence}</strong> sur ${APP_NAME}, la plateforme immobilière au Sénégal.</p>
      <p>En acceptant cette invitation, votre compte passera au <strong>plan Pro</strong> et vous bénéficierez de toutes ses fonctionnalités.</p>
      <div style="text-align:center"><a href="${urlRejoindre}" class="btn">Accepter l'invitation</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Vous pouvez également accepter depuis votre profil dans l'application ${APP_NAME}. Cette invitation expire dans 7 jours. Si vous ne souhaitez pas rejoindre cette agence, ignorez cet email.</p>
    `);
    const text = `Bonjour ${prenomInvite},\n\n${proprietaireNom} vous invite à rejoindre l'agence ${nomAgence} sur ${APP_NAME}.\n\nAcceptez depuis l'application Diwane (profil > Invitations) ou via ce lien :\n${urlRejoindre}\n\nCette invitation expire dans 7 jours.\n\n— L'équipe ${APP_NAME}`;
    await this.send(email, `Invitation à rejoindre l'agence ${nomAgence} sur ${APP_NAME}`, html, text);
  }

  // ── Invitation agence (nouveau compte) ───────────────────────────────────

  async envoyerInvitationNouveauCompte(
    email: string, prenomInvite: string, nomAgence: string,
    proprietaireNom: string, token: string,
  ): Promise<void> {
    const urlCreer = `${APP_URL}/agence/rejoindre?token=${token}`;
    const html = baseTemplate(`
      <h2>Bonjour ${prenomInvite},</h2>
      <p><strong>${proprietaireNom}</strong> vous invite à rejoindre l'agence <strong>${nomAgence}</strong> sur ${APP_NAME}, la plateforme immobilière au Sénégal.</p>
      <p>Cliquez sur le bouton ci-dessous pour créer votre compte gratuitement et rejoindre l'agence avec le <strong>plan Pro</strong> :</p>
      <div style="text-align:center"><a href="${urlCreer}" class="btn">Créer mon compte</a></div>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Cette invitation expire dans 7 jours. Si vous ne souhaitez pas créer de compte, ignorez cet email.</p>
    `);
    const text = `Bonjour ${prenomInvite},\n\n${proprietaireNom} vous invite à rejoindre l'agence ${nomAgence} sur ${APP_NAME}.\n\nCréez votre compte via ce lien :\n${urlCreer}\n\nCette invitation expire dans 7 jours.\n\n— L'équipe ${APP_NAME}`;
    await this.send(email, `Invitation à rejoindre l'agence ${nomAgence} sur ${APP_NAME}`, html, text);
  }

  // ── Confirmation rejoindre ────────────────────────────────────────────────

  async envoyerConfirmationRejoindre(email: string, prenom: string, nomAgence: string): Promise<void> {
    const html = baseTemplate(`
      <h2>Bienvenue dans l'agence ${nomAgence}</h2>
      <p>Bonjour ${prenom},</p>
      <p>Vous faites maintenant partie de l'agence <strong>${nomAgence}</strong> sur ${APP_NAME}. Votre compte a été mis à jour avec le <strong>plan Pro</strong>.</p>
      <p>Connectez-vous à l'application pour commencer à publier des annonces sous le nom de l'agence.</p>
      <hr class="divider">
      <p style="font-size:13px;color:#888">Si vous n'êtes pas à l'origine de cette action, contactez le support.</p>
    `);
    const text = `Bonjour ${prenom},\n\nVous avez rejoint l'agence ${nomAgence} sur ${APP_NAME}. Votre compte est maintenant en plan Pro.\n\nConnectez-vous à l'application Diwane pour commencer.\n\n— L'équipe ${APP_NAME}`;
    await this.send(email, `Vous avez rejoint l'agence ${nomAgence} sur ${APP_NAME}`, html, text);
  }
}

export const diwaneEmail = new DiwaneEmailService();
