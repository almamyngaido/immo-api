import {injectable} from '@loopback/core';
import * as brevo from '@getbrevo/brevo';
import {v4 as uuidv4} from 'uuid';

// Load environment variables
require('dotenv').config();

@injectable()
export class EmailService {
  private apiInstance: brevo.TransactionalEmailsApi;
  private senderEmail: string;
  private senderName: string;
  private isConfigured: boolean = false;

  constructor() {
    console.log('🔍 Initializing Brevo Email Service...');

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'Maxiim';

    if (!apiKey || !senderEmail) {
      console.error('❌ Missing Brevo configuration:');
      console.error('BREVO_API_KEY:', apiKey ? '✅ Defined' : '❌ Missing');
      console.error('BREVO_SENDER_EMAIL:', senderEmail ? '✅ Defined' : '❌ Missing');
      console.log('⚠️ Development mode: EmailService disabled');
      this.apiInstance = new brevo.TransactionalEmailsApi();
      this.senderEmail = '';
      this.senderName = '';
      return;
    }

    this.senderEmail = senderEmail;
    this.senderName = senderName;

    // Configure Brevo API
    this.apiInstance = new brevo.TransactionalEmailsApi();
    this.apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, apiKey);

    this.isConfigured = true;
    console.log('✅ Brevo Email Service configured successfully');
    console.log('📧 Sender:', `${senderName} <${senderEmail}>`);
  }

  private async sendBrevoEmail(
    to: string,
    subject: string,
    htmlContent: string,
    textContent?: string
  ): Promise<void> {
    if (!this.isConfigured) {
      console.log('📧 Development mode: Email simulated for', to);
      console.log('📬 Subject:', subject);
      console.log('📄 Content preview:', htmlContent.substring(0, 200) + '...');
      console.log('⚠️ Brevo is NOT configured - emails will NOT be sent!');
      console.log('⚠️ Set BREVO_API_KEY and BREVO_SENDER_EMAIL in .env to enable emails');
      return;
    }

    try {
      console.log('📧 Preparing to send email via Brevo...');
      console.log('  → To:', to);
      console.log('  → From:', `${this.senderName} <${this.senderEmail}>`);
      console.log('  → Subject:', subject);

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.senderEmail,
      };
      sendSmtpEmail.to = [{email: to}];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;
      if (textContent) {
        sendSmtpEmail.textContent = textContent;
      }

      console.log('📤 Calling Brevo API...');
      console.log('  → Email object ready:', {
        from: sendSmtpEmail.sender,
        to: sendSmtpEmail.to,
        subject: sendSmtpEmail.subject,
      });

      const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log('✅ Email sent via Brevo!');
      console.log('  → Message ID:', result.body.messageId);
    } catch (error: any) {
      console.error('❌ Brevo email error:', error.message);
      console.error('❌ Error details:', JSON.stringify(error.response?.body || error, null, 2));
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error code:', error.code);
      console.error('❌ Full error stack:', error.stack);
      throw error;
    }
  }

  generateVerificationToken(): string {
    return uuidv4();
  }

  generateResetToken(): string {
    return uuidv4();
  }

  getTokenExpiration(hoursFromNow: number = 1): string {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + hoursFromNow);
    return expiration.toISOString();
  }

  async sendVerificationEmail(email: string, firstName: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'
      }/verify-email?token=${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmez votre email</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName} ! 👋</h2>
            <p>Merci de vous être inscrit ! Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Confirmer mon email</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all; color: #4f46e5;">${verificationUrl}</p>
            <p><strong>⚠️ Ce lien expirera dans 1 heure.</strong></p>
            <p>Si vous n'avez pas créé ce compte, ignorez cet email.</p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Bonjour ${firstName},

      Merci de vous être inscrit ! Pour activer votre compte,
      veuillez cliquer sur le lien ci-dessous :

      ${verificationUrl}

      Ce lien expirera dans 1 heure.

      Si vous n'avez pas créé ce compte, ignorez cet email.

      Cordialement,
      L'équipe Maxiim
    `;

    try {
      console.log('📤 Sending verification email to:', email);
      await this.sendBrevoEmail(email, 'Confirmez votre email 📧', htmlContent, textContent);
      console.log('🔗 Verification link:', verificationUrl);
    } catch (error: any) {
      console.error('❌ Error sending verification email:', error.message);
      console.log('⚠️ Development mode: Email not sent but signup continues');
      console.log('🔗 Verification link:', verificationUrl);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    const htmlContent = `
      <h1>Bienvenue ${firstName} ! 🎉</h1>
      <p>Votre compte a été activé avec succès.</p>
      <p>Vous pouvez maintenant profiter de toutes nos fonctionnalités !</p>
    `;

    try {
      await this.sendBrevoEmail(email, `Bienvenue ${firstName} ! 🎉`, htmlContent);
      console.log('✅ Welcome email sent to:', email);
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
    }
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'
      }/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button {
            display: inline-block;
            background-color: #dc2626;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Réinitialisation de mot de passe</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
            </div>
            <p>Ou copiez ce lien dans votre navigateur :</p>
            <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
            <div class="warning">
              <p><strong>⚠️ Important :</strong></p>
              <ul>
                <li>Ce lien expirera dans <strong>1 heure</strong></li>
                <li>Si vous n'avez pas fait cette demande, ignorez cet email</li>
                <li>Votre mot de passe actuel reste valide tant que vous n'en créez pas un nouveau</li>
              </ul>
            </div>
            <p>Pour votre sécurité, ce lien ne peut être utilisé qu'une seule fois.</p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>Si vous continuez à avoir des problèmes, contactez notre support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Bonjour ${firstName},

      Vous avez demandé la réinitialisation de votre mot de passe.

      Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe :
      ${resetUrl}

      IMPORTANT:
      - Ce lien expirera dans 1 heure
      - Si vous n'avez pas fait cette demande, ignorez cet email
      - Votre mot de passe actuel reste valide tant que vous n'en créez pas un nouveau

      Pour votre sécurité, ce lien ne peut être utilisé qu'une seule fois.

      Cordialement,
      L'équipe Maxiim
    `;

    try {
      console.log('📤 Sending password reset email to:', email);
      await this.sendBrevoEmail(email, '🔒 Réinitialisation de votre mot de passe', htmlContent, textContent);
      console.log('🔗 Reset link:', resetUrl);
    } catch (error: any) {
      console.error('❌ Error sending password reset email:', error.message);
      console.log('⚠️ Development mode: Email not sent but reset continues');
      console.log('🔗 Reset link:', resetUrl);
    }
  }

  async sendPasswordChangedEmail(email: string, firstName: string): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .success {
            background-color: #dcfce7;
            border: 1px solid #16a34a;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Mot de passe modifié</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <div class="success">
              <p><strong>✅ Votre mot de passe a été modifié avec succès !</strong></p>
              <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
            </div>
            <p>Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement notre support.</p>
            <p>Pour votre sécurité, nous vous recommandons de :</p>
            <ul>
              <li>Utiliser un mot de passe unique et fort</li>
              <li>Ne jamais partager vos identifiants</li>
              <li>Vous déconnecter de tous vos appareils si nécessaire</li>
            </ul>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>En cas de problème, contactez notre support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendBrevoEmail(email, '✅ Votre mot de passe a été modifié', htmlContent);
      console.log('✅ Password changed email sent to:', email);
    } catch (error) {
      console.error('❌ Error sending password changed email:', error);
    }
  }
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  }

  async sendOtpEmail(email: string, firstName: string, otp: string, isApprovalEmail: boolean = false): Promise<void> {
    const approvalText = isApprovalEmail
      ? '<p><strong>✅ Votre compte a été approuvé par un administrateur.</strong></p>'
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .otp { font-size: 24px; font-weight: bold; color: #4f46e5; text-align: center; margin: 20px 0; }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Vérifiez votre email</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            ${approvalText}
            <p>Votre code OTP pour vérifier votre compte Maxiim est :</p>
            <p class="otp">${otp}</p>
            <p>Entrez ce code dans l'application pour compléter votre inscription.</p>
            <p><strong>Ce code expirera dans 1 heure.</strong></p>
            <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>En cas de problème, contactez notre support.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Bonjour ${firstName},
      ${isApprovalEmail ? 'Votre compte a été approuvé par un administrateur.\n' : ''}
      Votre code OTP pour vérifier votre compte Maxiim est : ${otp}

      Entrez ce code dans l'application pour compléter votre inscription.
      Ce code expirera dans 1 heure.
      Si vous n'avez pas fait cette demande, ignorez cet email.

      Cordialement,
      L'équipe Maxiim
    `;

    try {
      console.log('📤 Sending OTP email to:', email);
      console.log('🔐 OTP Code:', otp);
      console.log('✉️ Is Approval Email:', isApprovalEmail);
      console.log('📧 Email service configured:', this.isConfigured);
      console.log('📧 Sender email:', this.senderEmail);
      console.log('📧 Sender name:', this.senderName);

      await this.sendBrevoEmail(email, '🔐 Votre code OTP pour Maxiim', htmlContent, textContent);
      console.log('✅ OTP email sent successfully to:', email);
    } catch (error: any) {
      console.error('❌ Error sending OTP email:', error.message);
      console.error('❌ Full error:', JSON.stringify(error, null, 2));
      console.error('❌ Error stack:', error.stack);
      // In production, we want to know if email failed
      if (this.isConfigured) {
        throw new Error(`Failed to send OTP email to ${email}: ${error.message}`);
      } else {
        console.log('⚠️ Development mode: Email not sent but process continues');
      }
    }
  }

  async sendAdminRegistrationNotification(
    adminEmail: string,
    adminFirstName: string,
    userFullName: string,
    userEmail: string,
    userPhoneNumber: string,
    userRole: string,
    registrationTimestamp: string
  ): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .user-details {
            background-color: #f3f4f6;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .detail-row {
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-label { font-weight: bold; color: #374151; }
          .otp-section {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: center;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #f97316;
            letter-spacing: 2px;
            margin: 15px 0;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nouvelle inscription - Approbation requise</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${adminFirstName},</h2>
            <p>Un nouvel utilisateur s'est inscrit et nécessite votre approbation :</p>

            <div class="user-details">
              <div class="detail-row">
                <span class="detail-label">Nom complet :</span> ${userFullName}
              </div>
              <div class="detail-row">
                <span class="detail-label">Email :</span> ${userEmail}
              </div>
              <div class="detail-row">
                <span class="detail-label">Téléphone :</span> ${userPhoneNumber}
              </div>
              <div class="detail-row">
                <span class="detail-label">Rôle demandé :</span> ${userRole}
              </div>
              <div class="detail-row">
                <span class="detail-label">Date d'inscription :</span> ${registrationTimestamp}
              </div>
            </div>

            <div class="otp-section">
              <p><strong>Action requise :</strong></p>
              <p style="margin: 15px 0;">Veuillez examiner cette demande d'inscription et approuver l'utilisateur via le panneau d'administration.</p>
              <p style="font-size: 12px; color: #666;">
                Une fois approuvé, l'utilisateur recevra un code OTP pour vérifier son email.
              </p>
            </div>

            <p>Prochaines étapes :</p>
            <ol>
              <li>Examinez les informations de l'utilisateur ci-dessus</li>
              <li>Connectez-vous au panneau d'administration</li>
              <li>Approuvez l'utilisateur pour lui envoyer le code OTP de vérification</li>
            </ol>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>Système d'inscription Maxiim</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Bonjour ${adminFirstName},

      Un nouvel utilisateur s'est inscrit et nécessite votre approbation :

      Nom complet : ${userFullName}
      Email : ${userEmail}
      Téléphone : ${userPhoneNumber}
      Rôle demandé : ${userRole}
      Date d'inscription : ${registrationTimestamp}

      Action requise :
      Veuillez examiner cette demande d'inscription et approuver l'utilisateur via le panneau d'administration.
      Une fois approuvé, l'utilisateur recevra un code OTP pour vérifier son email.

      Prochaines étapes :
      1. Examinez les informations de l'utilisateur
      2. Connectez-vous au panneau d'administration
      3. Approuvez l'utilisateur pour lui envoyer le code OTP de vérification

      Cordialement,
      Système d'inscription Maxiim
    `;

    try {
      console.log('📤 Sending admin registration notification to:', adminEmail);
      await this.sendBrevoEmail(adminEmail, '🔔 Nouvelle inscription - Approbation requise', htmlContent, textContent);
    } catch (error: any) {
      console.error('❌ Error sending admin registration notification:', error.message);
      console.log('⚠️ Failed to notify admin but process continues');
    }
  }

  // Keep the old method for backwards compatibility (now used by /send-user-otp)
  async sendAdminOtpNotification(
    adminEmail: string,
    adminFirstName: string,
    userFullName: string,
    userEmail: string,
    userPhoneNumber: string,
    userRole: string,
    registrationTimestamp: string,
    otp: string
  ): Promise<void> {
    // This method is no longer used in signup flow
    // Only used if you want to notify admins when OTP is sent
    console.log('⚠️ sendAdminOtpNotification called - this is deprecated for signup flow');
  }

  async sendRegistrationPendingEmail(
    userEmail: string,
    userFirstName: string,
    userRequestedRole: string
  ): Promise<void> {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background-color: #0ea5e9; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .info-box {
            background-color: #e0f2fe;
            border: 1px solid #0ea5e9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Inscription soumise avec succès</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${userFirstName},</h2>
            <p>Merci de vous être inscrit à Maxiim ! Votre demande d'inscription a été reçue.</p>

            <div class="info-box">
              <p><strong>Statut de l'inscription : En attente d'approbation</strong></p>
              <p>Rôle demandé : <strong>${userRequestedRole}</strong></p>
              <p>Un administrateur examinera vos informations et approuvera votre compte sous peu.</p>
            </div>

            <p><strong>Que se passe-t-il ensuite :</strong></p>
            <ol>
              <li>Un administrateur examinera les détails de votre inscription</li>
              <li><strong>Consultez votre email régulièrement</strong> - Une fois approuvé, nous vous enverrons un code de vérification (OTP) par email</li>
              <li>Entrez le code de vérification dans l'application pour activer votre compte</li>
              <li>Une fois vérifié, vous pourrez vous connecter et utiliser toutes les fonctionnalités</li>
            </ol>

            <p><strong>Important :</strong> Ne fermez pas l'application. Vous recevrez un email avec votre code de vérification dès que votre compte sera approuvé.</p>
          </div>
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            <p>Système d'inscription Maxiim</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Bonjour ${userFirstName},

      Merci de vous être inscrit à Maxiim ! Votre demande d'inscription a été reçue.

      Statut de l'inscription : En attente d'approbation
      Rôle demandé : ${userRequestedRole}

      Un administrateur examinera vos informations et approuvera votre compte sous peu.

      Que se passe-t-il ensuite :
      1. Un administrateur examinera les détails de votre inscription
      2. Consultez votre email régulièrement - Une fois approuvé, nous vous enverrons un code de vérification (OTP) par email
      3. Entrez le code de vérification dans l'application pour activer votre compte
      4. Une fois vérifié, vous pourrez vous connecter et utiliser toutes les fonctionnalités

      IMPORTANT: Ne fermez pas l'application. Vous recevrez un email avec votre code de vérification dès que votre compte sera approuvé.

      Si vous avez des questions, n'hésitez pas à contacter notre équipe de support.

      Cordialement,
      L'équipe Maxiim
    `;

    try {
      console.log('📤 Sending registration pending email to:', userEmail);
      await this.sendBrevoEmail(userEmail, '✅ Inscription soumise avec succès', htmlContent, textContent);
    } catch (error: any) {
      console.error('❌ Error sending registration pending email:', error.message);
      console.log('⚠️ Failed to send pending email but process continues');
    }
  }
}
