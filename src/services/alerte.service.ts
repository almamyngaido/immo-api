/**
 * ALERTE SERVICE — Matching des alertes acheteur avec un bien publié
 * + envoi de notifications push via OneSignal REST API
 *
 * Variables d'environnement requises :
 *   ONESIGNAL_APP_ID      — App ID (depuis OneSignal → Settings → Keys & IDs)
 *   ONESIGNAL_REST_API_KEY — REST API Key (depuis OneSignal → Settings → Keys & IDs)
 */
import {injectable} from '@loopback/core';
import https from 'https';
import {Bien} from '../models';
import {AlerteRecherche} from '../models/alerte-recherche.model';

const ONESIGNAL_APP_ID       = process.env.ONESIGNAL_APP_ID       ?? '';
const ONESIGNAL_REST_API_KEY  = process.env.ONESIGNAL_REST_API_KEY  ?? '';

@injectable()
export class AlerteService {

  /**
   * Appelé quand un bien passe en statut 'publie'.
   * Cherche toutes les alertes actives et notifie les acheteurs qui matchent.
   */
  async notifierAlertes(bien: Bien, alertes: AlerteRecherche[]): Promise<void> {
    const actives = alertes.filter(a => a.active);
    const correspondances = actives.filter(a => this._correspond(bien, a));

    for (const alerte of correspondances) {
      try {
        await this._envoyerNotification(alerte, bien);
      } catch (err) {
        console.error('[AlerteService] Erreur notification', alerte.id, err);
      }
    }
  }

  // ── Logique de matching ────────────────────────────────────────────────────

  private _correspond(bien: Bien, alerte: AlerteRecherche): boolean {
    const c = alerte.criteres ?? {};

    // Type de transaction
    if (c.type_transaction && c.type_transaction !== 'les_deux') {
      if (bien.type_transaction !== c.type_transaction) return false;
    }

    // Type de bien
    if (c.type_bien && c.type_bien.length > 0) {
      if (!c.type_bien.includes(bien.type_bien)) return false;
    }

    // Ville
    if (c.villes && c.villes.length > 0) {
      const ville = (bien.localisation as any)?.ville ?? '';
      if (!c.villes.some(v => v.toLowerCase() === ville.toLowerCase())) return false;
    }

    // Quartier (optionnel, si spécifié)
    if (c.quartier) {
      const quartier = (bien.localisation as any)?.quartier ?? '';
      if (quartier.toLowerCase() !== c.quartier.toLowerCase()) return false;
    }

    // Prix max (vente)
    if (c.prix_max_fcfa !== undefined && bien.type_transaction === 'vente') {
      const prix = (bien.finances as any)?.prix_vente_fcfa ?? 0;
      if (prix > c.prix_max_fcfa) return false;
    }

    // Loyer max (location)
    if (c.loyer_max_fcfa !== undefined && bien.type_transaction === 'location') {
      const loyer = (bien.finances as any)?.loyer_mensuel_fcfa ?? 0;
      if (loyer > c.loyer_max_fcfa) return false;
    }

    // Nombre de chambres min
    if (c.nb_chambres_min !== undefined) {
      const chambres = (bien.caracteristiques as any)?.nb_chambres ?? 0;
      if (chambres < c.nb_chambres_min) return false;
    }

    return true;
  }

  // ── Envoi OneSignal ────────────────────────────────────────────────────────

  private _envoyerNotification(
    alerte: AlerteRecherche,
    bien: Bien,
  ): Promise<void> {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('[AlerteService] OneSignal non configuré (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY manquants)');
      return Promise.resolve();
    }

    const ville     = (bien.localisation as any)?.ville    ?? '';
    const quartier  = (bien.localisation as any)?.quartier ?? '';
    const localite  = quartier ? `${quartier}, ${ville}` : ville;

    const titre  = `Nouveau bien : ${bien.titre}`;
    const corps  = `${localite} · ${this._formatPrix(bien)}`;

    const payload = JSON.stringify({
      app_id:            ONESIGNAL_APP_ID,
      include_subscription_ids: [alerte.onesignal_subscription_id],
      headings:          {fr: titre, en: titre},
      contents:          {fr: corps, en: corps},
      data: {
        type:    'nouveau_bien',
        bien_id: bien.id,
        alerte_id: alerte.id,
      },
      ios_badgeType:     'Increase',
      ios_badgeCount:    1,
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'onesignal.com',
          path:     '/api/v1/notifications',
          method:   'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', d => (data += d));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              console.error('[AlerteService] OneSignal error', res.statusCode, data);
            }
            resolve();
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  private _formatPrix(bien: Bien): string {
    const f = bien.finances as any;
    if (bien.type_transaction === 'location' && f?.loyer_mensuel_fcfa) {
      return `${(f.loyer_mensuel_fcfa as number).toLocaleString('fr-FR')} FCFA/mois`;
    }
    if (bien.type_transaction === 'vente' && f?.prix_vente_fcfa) {
      return `${(f.prix_vente_fcfa as number).toLocaleString('fr-FR')} FCFA`;
    }
    return '';
  }
}
