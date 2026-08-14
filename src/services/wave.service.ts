/**
 * DIWANE — Service Wave Checkout
 * Intégration Wave API pour les paiements abonnements et boosts
 */
import {injectable} from '@loopback/core';
import * as crypto from 'crypto';
import * as https from 'https';

@injectable()
export class WaveService {
  private apiUrl = process.env.WAVE_API_URL ?? 'https://api.wave.com/v1';
  private apiKey = process.env.WAVE_API_KEY ?? '';
  private signingSecret = process.env.WAVE_SIGNING_SECRET ?? '';
  private webhookSecret = process.env.WAVE_WEBHOOK_SECRET ?? '';

  // ── Signature des requêtes sortantes (request signing Wave, optionnel) ──────
  // Format : "t={timestamp},v1={hmac_hex}" où hmac = HMAC-SHA256(signingSecret, timestamp + body)
  // https://docs.wave.com/business#request-signing
  private _signatureHeader(rawBody: string): string | undefined {
    if (!this.signingSecret) return undefined;
    const timestamp = Math.floor(Date.now() / 1000);
    const hmac = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${timestamp}${rawBody}`)
      .digest('hex');
    return `t=${timestamp},v1=${hmac}`;
  }

  // ── Requête HTTP interne (pas de dépendance axios) ──────────────────────────
  private async _post(path: string, body: object): Promise<any> {
    const data = JSON.stringify(body);
    const url = new URL(path, this.apiUrl + '/');
    const signature = this._signatureHeader(data);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            ...(signature ? {'Wave-Signature': signature} : {}),
          },
        },
        res => {
          let raw = '';
          res.on('data', chunk => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`Wave API ${res.statusCode}: ${parsed.message ?? raw}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`Wave API parse error: ${raw}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private async _get(path: string): Promise<any> {
    const url = new URL(path, this.apiUrl + '/');
    // Pour un GET, la signature porte sur le timestamp seul (body vide).
    const signature = this._signatureHeader('');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(signature ? {'Wave-Signature': signature} : {}),
          },
        },
        res => {
          let raw = '';
          res.on('data', chunk => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`Wave API ${res.statusCode}: ${parsed.message ?? raw}`));
              } else {
                resolve(parsed);
              }
            } catch {
              reject(new Error(`Wave API parse error: ${raw}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  // ── Créer une session Checkout Wave ─────────────────────────────────────────
  async creerCheckoutSession(params: {
    montant_fcfa: number;
    description: string;
    reference: string;
    transaction_id: string;
    telephone_client?: string;
  }): Promise<{checkout_url: string; wave_session_id: string}> {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const tx = encodeURIComponent(params.transaction_id);

    const body: any = {
      amount: params.montant_fcfa.toString(),
      currency: 'XOF',
      error_url: `${appUrl}/api/payments/wave/cancel?ref=${params.reference}&tx=${tx}`,
      success_url: `${appUrl}/api/payments/wave/success?ref=${params.reference}&tx=${tx}`,
      client_reference: params.reference,
    };

    // Restreint le paiement au numéro Wave du courtier (son propre abonnement/boost).
    if (params.telephone_client) {
      body.restrict_payer_mobile = params.telephone_client;
    }

    const response = await this._post('checkout/sessions', body);

    return {
      checkout_url: response.wave_launch_url,
      wave_session_id: response.id,
    };
  }

  // ── Valider la signature d'un webhook Wave ───────────────────────────────────
  // Header "Wave-Signature: t={timestamp},v1={hmac_hex}" — hmac = HMAC-SHA256(webhookSecret, timestamp + rawBody)
  // https://docs.wave.com/webhook#webhooks
  validerSignatureWebhook(rawPayload: string, signatureHeader: string): boolean {
    if (!this.webhookSecret) {
      console.warn('[Wave Webhook] WAVE_WEBHOOK_SECRET non configuré côté serveur.');
      return false;
    }
    if (!signatureHeader) {
      console.warn('[Wave Webhook] aucun en-tête Wave-Signature reçu.');
      return false;
    }
    try {
      const parts: Record<string, string> = {};
      for (const kv of signatureHeader.split(',')) {
        const [key, value] = kv.split('=').map(s => s.trim());
        if (key) parts[key] = value ?? '';
      }
      const timestamp = parts['t'];
      const v1 = parts['v1'];
      if (!timestamp || !v1) {
        console.warn('[Wave Webhook] en-tête de signature mal formé:', JSON.stringify(signatureHeader));
        return false;
      }

      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(`${timestamp}${rawPayload}`)
        .digest('hex');

      const valid = v1.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));

      // TODO(test-wave): retirer ce log une fois la vérification confirmée fonctionnelle.
      if (!valid) {
        console.warn(
          '[Wave Webhook] signature invalide — reçu:', v1,
          '| attendu:', expected,
          '| timestamp:', timestamp,
          '| body_len:', rawPayload.length,
          '| body_preview:', rawPayload.slice(0, 200),
        );
      }
      return valid;
    } catch (e) {
      console.warn('[Wave Webhook] erreur vérification signature:', e);
      return false;
    }
  }

  // ── Vérifier le statut d'une session Wave ────────────────────────────────────
  async verifierSession(sessionId: string): Promise<{
    statut: 'processing' | 'cancelled' | 'succeeded';
    montant: number;
  }> {
    const response = await this._get(`checkout/sessions/${sessionId}`);
    return {
      statut: response.payment_status,
      montant: parseInt(response.amount ?? '0', 10),
    };
  }
}
