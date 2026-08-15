/**
 * SMS Service — Générique et provider-agnostic
 * Pour maintenant : stub (logs seulement)
 * Quand activé : peut utiliser Twilio, Brevo SMS, Orange Money, etc.
 */

class SmsService {
  async envoyerSMS(phone: string, message: string, type: string = 'generic'): Promise<void> {
    const smsProviderActivated = process.env.SMS_PROVIDER_ACTIVATED === 'true';

    if (!smsProviderActivated) {
      console.log(`[SMS DEV] À: ${phone} | Type: ${type}\nMessage: ${message}`);
      return;
    }

    // Quand SMS_PROVIDER_ACTIVATED=true, on switch selon le provider configuré
    const provider = process.env.SMS_PROVIDER ?? 'twilio';

    switch (provider) {
      case 'twilio':
        return await this._envoyerViatwilio(phone, message);
      case 'brevo':
        return await this._envoyerViaBrEVO(phone, message);
      case 'orange':
        return await this._envoyerViaOrangeApiMoney(phone, message);
      default:
        console.warn(`[SMS] Provider inconnu: ${provider}`);
    }
  }

  // Twilio — À implémenter quand activé
  private async _envoyerViatwilio(phone: string, message: string): Promise<void> {
    // TODO: Implémenter avec twilio package
    // const twilio = require('twilio');
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE_NUMBER,
    //   to: phone
    // });
    console.log(`[SMS Twilio] À: ${phone}\n${message}`);
  }

  // Brevo SMS — À implémenter quand activé
  private async _envoyerViaBrEVO(phone: string, message: string): Promise<void> {
    // TODO: Utiliser Brevo TransactionalSmsApi
    // const brevo = require('@getbrevo/brevo');
    // const smsApi = new brevo.TransactionalSmsApi();
    // await smsApi.sendTransacSms({...});
    console.log(`[SMS Brevo] À: ${phone}\n${message}`);
  }

  // Orange Money API — À implémenter quand activé
  private async _envoyerViaOrangeApiMoney(phone: string, message: string): Promise<void> {
    // TODO: Utiliser Orange Money API pour SMS
    console.log(`[SMS Orange] À: ${phone}\n${message}`);
  }
}

export const smsService = new SmsService();
