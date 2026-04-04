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
  private webhookSecret = process.env.WAVE_WEBHOOK_SECRET ?? '';

  // ── Requête HTTP interne (pas de dépendance axios) ──────────────────────────
  private async _post(path: string, body: object): Promise<any> {
    const data = JSON.stringify(body);
    const url = new URL(path, this.apiUrl + '/');

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

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          headers: {Authorization: `Bearer ${this.apiKey}`},
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
    telephone_client?: string;
  }): Promise<{checkout_url: string; wave_session_id: string}> {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

    const body: any = {
      amount: params.montant_fcfa.toString(),
      currency: 'XOF',
      error_url: `${appUrl}/api/payments/wave/cancel?ref=${params.reference}`,
      success_url: `${appUrl}/api/payments/wave/success?ref=${params.reference}`,
      client_reference: params.reference,
      business_name: 'Diwane',
      payment_description: params.description,
    };

    if (params.telephone_client) {
      body.client = {phone_number: params.telephone_client};
    }

    const response = await this._post('checkout/sessions', body);

    return {
      checkout_url: response.wave_launch_url,
      wave_session_id: response.id,
    };
  }

  // ── Valider la signature d'un webhook Wave ───────────────────────────────────
  validerSignatureWebhook(rawPayload: string, signature: string): boolean {
    if (!this.webhookSecret || !signature) return false;
    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawPayload)
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  // ── Vérifier le statut d'une session Wave ────────────────────────────────────
  async verifierSession(sessionId: string): Promise<{
    statut: 'pending' | 'succeeded' | 'failed';
    montant: number;
  }> {
    const response = await this._get(`checkout/sessions/${sessionId}`);
    return {
      statut: response.payment_status,
      montant: parseInt(response.amount ?? '0', 10),
    };
  }
}
