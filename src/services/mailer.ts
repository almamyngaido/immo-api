import {injectable} from '@loopback/core';
import * as nodemailer from 'nodemailer';
import {v4 as uuidv4} from 'uuid';

// Load environment variables
require('dotenv').config();

@injectable()
export class EmailService {
  private transporter?: nodemailer.Transporter;

  constructor() {
    // Debug environment variables
    console.log('🔍 Debug environment variables:');
    console.log('GMAIL_USER:', process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD defined:', !!process.env.GMAIL_APP_PASSWORD);
    console.log('GMAIL_APP_PASSWORD length:', process.env.GMAIL_APP_PASSWORD?.length);
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      console.error('❌ Missing environment variables:');
      console.error('GMAIL_USER:', gmailUser ? '✅ Defined' : '❌ Missing');
      console.error('GMAIL_APP_PASSWORD:', gmailPassword ? '✅ Defined' : '❌ Missing');
      console.log('⚠️ Development mode: EmailService disabled');
      return;
    }

    // Configure Gmail transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: gmailUser.trim(),
        pass: gmailPassword.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
      debug: true,
      logger: true,
    });

    console.log('📧 Attempting Gmail connection...');
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) {
      console.log('⚠️ Transporter not initialized (development mode)');
      return;
    }

    try {
      console.log('🔄 Testing Gmail connection...');
      const result = await this.transporter.verify();
      console.log('✅ Gmail configured and ready!', result);
      console.log('📧 Connected user:', process.env.GMAIL_USER);
    } catch (error: any) {
      console.error('❌ Gmail connection error:', error.message);
      console.error('Error code:', error.code);
      if (error.code === 'EAUTH') {
        console.log('\n💡 EAUTH error solutions:');
        console.log('1. Ensure 2FA is ENABLED on your Gmail account');
        console.log('2. Generate a NEW App Password');
        console.log('3. Use the App Password (NOT your Gmail password)');
        console.log('4. Restart the server after updating .env');
      }
      if (error.code === 'ECONNECTION') {
        console.log('\n🌐 Connection issues:');
        console.log('1. Check your internet connection');
        console.log('2. Ensure port 587 is not blocked by firewall');
      }
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
    if (!this.transporter) {
      console.log('📧 Development mode: Verification email simulated for', email);
      console.log('🔗 Token:', token);
      console.log('👤 For:', firstName);
      return;
    }

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
      const info = await this.transporter.sendMail({
        from: `"MAxiim" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Confirmez votre email 📧',
        text: textContent,
        html: htmlContent,
      });
      console.log('✅ Verification email sent:', info.messageId);
      console.log('🔗 Verification link:', verificationUrl);
    } catch (error: any) {
      console.error('❌ Error sending verification email:', error.message);
      console.error('Error code:', error.code);
      console.log('⚠️ Development mode: Email not sent but signup continues');
      console.log('🔗 Verification link:', verificationUrl);
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Development mode: Welcome email simulated for', firstName);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Maxiim" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: `Bienvenue ${firstName} ! 🎉`,
        html: `
          <h1>Bienvenue ${firstName} ! 🎉</h1>
          <p>Votre compte a été activé avec succès.</p>
          <p>Vous pouvez maintenant profiter de toutes nos fonctionnalités !</p>
        `,
      });
      console.log('✅ Welcome email sent:', info.messageId);
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
    }
  }

  async sendPasswordResetEmail(email: string, firstName: string, resetToken: string): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Development mode: Password reset email simulated for', email);
      console.log('🔑 Reset token:', resetToken);
      console.log('👤 For:', firstName);
      return;
    }

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
      const info = await this.transporter.sendMail({
        from: `"" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '🔒 Réinitialisation de votre mot de passe',
        text: textContent,
        html: htmlContent,
      });
      console.log('✅ Password reset email sent:', info.messageId);
      console.log('🔗 Reset link:', resetUrl);
    } catch (error: any) {
      console.error('❌ Error sending password reset email:', error.message);
      console.error('Error code:', error.code);
      console.log('⚠️ Development mode: Email not sent but reset continues');
      console.log('🔗 Reset link:', resetUrl);
    }
  }

  async sendPasswordChangedEmail(email: string, firstName: string): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Development mode: Password changed email simulated for', firstName);
      return;
    }

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
      const info = await this.transporter.sendMail({
        from: `"Maxiim" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '✅ Votre mot de passe a été modifié',
        html: htmlContent,
      });
      console.log('✅ Password changed email sent:', info.messageId);
    } catch (error) {
      console.error('❌ Error sending password changed email:', error);
    }
  }
  generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  }

  async sendOtpEmail(email: string, firstName: string, otp: string): Promise<void> {
    if (!this.transporter) {
      console.log('📧 Development mode: OTP email simulated for', email);
      console.log('🔢 OTP:', otp);
      console.log('👤 For:', firstName);
      return;
    }

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

      Votre code OTP pour vérifier votre compte Maxiim est : ${otp}

      Entrez ce code dans l'application pour compléter votre inscription.
      Ce code expirera dans 1 heure.
      Si vous n'avez pas fait cette demande, ignorez cet email.

      Cordialement,
      L'équipe Maxiim
    `;

    try {
      console.log('📤 Sending OTP email to:', email);
      const info = await this.transporter.sendMail({
        from: `"Maxiim" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: '🔐 Votre code OTP pour Maxiim',
        text: textContent,
        html: htmlContent,
      });
      console.log('✅ OTP email sent:', info.messageId);
    } catch (error: any) {
      console.error('❌ Error sending OTP email:', error.message);
      console.error('Error code:', error.code);
      console.log('⚠️ Development mode: Email not sent but process continues');
    }
  }
}
