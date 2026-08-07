/**
 * ALERTE SERVICE — Matching des alertes acheteur avec un bien publié
 * + envoi de notifications push via OneSignal REST API
 *
 * Variables d'environnement requises :
 *   ONESIGNAL_APP_ID      — App ID (depuis OneSignal → Settings → Keys & IDs)
 *   ONESIGNAL_REST_API_KEY — REST API Key (depuis OneSignal → Settings → Keys & IDs)
 */
import {injectable} from '@loopback/core';
import {repository} from '@loopback/repository';
import https from 'https';
import {Bien} from '../models';
import {AlerteRecherche} from '../models/alerte-recherche.model';
import {AlerteRechercheRepository} from '../repositories';

const ONESIGNAL_APP_ID       = process.env.ONESIGNAL_APP_ID       ?? '';
// Accepter les deux noms possibles de la variable Railway
const ONESIGNAL_REST_API_KEY  = process.env.ONESIGNAL_REST_API_KEY  ?? process.env.ONESIGNAL_API_KEY ?? '';

// Diagnostic au démarrage — présence uniquement, jamais la valeur (même partielle)
console.log('[AlerteService] ONESIGNAL_APP_ID:', ONESIGNAL_APP_ID ? 'OK' : 'MANQUANT');
console.log('[AlerteService] ONESIGNAL_REST_API_KEY:', ONESIGNAL_REST_API_KEY ? 'OK' : 'MANQUANT');

@injectable()
export class AlerteService {
  constructor(
    @repository(AlerteRechercheRepository)
    private alerteRepository: AlerteRechercheRepository,
  ) {}

  /**
   * Appelé quand un bien passe en statut 'publie'.
   * Cherche toutes les alertes actives et notifie les acheteurs qui matchent.
   */
  async notifierAlertes(bien: Bien, alertes: AlerteRecherche[]): Promise<void> {
    console.log(`[AlerteService] notifierAlertes — bien: "${bien.titre}" (id: ${bien.id})`);
    console.log(`[AlerteService] Total alertes reçues: ${alertes.length}`);

    const actives = alertes.filter(a => a.active);
    console.log(`[AlerteService] Alertes actives: ${actives.length}`);

    const correspondances = actives.filter(a => this._correspond(bien, a));
    console.log(`[AlerteService] Alertes correspondantes: ${correspondances.length}`);

    if (correspondances.length === 0) {
      console.log('[AlerteService] Aucune alerte ne correspond — pas de notification envoyée');
      // Log détail du bien pour debugger le matching
      console.log('[AlerteService] Bien localisation:', JSON.stringify(bien.localisation));
      console.log('[AlerteService] Bien type_bien:', bien.type_bien, '| type_transaction:', bien.type_transaction);
      if (actives.length > 0) {
        console.log('[AlerteService] Critères de la 1ère alerte active:', JSON.stringify(actives[0].criteres));
      }
    }

    for (const alerte of correspondances) {
      try {
        const envoyee = await this._envoyerNotification(alerte, bien);
        if (envoyee) {
          await this.alerteRepository.updateById(alerte.id, {
            nb_notifications_envoyees: (alerte.nb_notifications_envoyees ?? 0) + 1,
            derniere_notification: new Date(),
          });
        }
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
  ): Promise<boolean> {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.warn('[AlerteService] OneSignal non configuré (ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY manquants)');
      return Promise.resolve(false);
    }

    console.log(`[AlerteService] Envoi notification → subscription_id: ${alerte.onesignal_subscription_id} | alerte: ${alerte.id}`);

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
          hostname: 'api.onesignal.com',
          path:     '/notifications',
          method:   'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`,
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', d => (data += d));
          res.on('end', () => {
            const succes = !!res.statusCode && res.statusCode < 400;
            if (!succes) {
              console.error(`[AlerteService] OneSignal HTTP ${res.statusCode}:`, data);
            } else {
              console.log(`[AlerteService] OneSignal réponse ${res.statusCode}:`, data);
            }
            resolve(succes);
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
