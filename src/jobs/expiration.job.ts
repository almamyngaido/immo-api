/**
 * Job d'expiration — tourne toutes les heures
 * Rétrograde les abonnements expirés → gratuit
 * Désactive les boosts expirés
 *
 * Utilise le connecteur MongoDB natif car LoopBack juggler
 * ne supporte pas la notation pointée dans updateAll.
 */
import {getLimitesParPlan} from '../models';

function getNativeCollection(repo: any, collectionName: string): any {
  return repo.dataSource.connector.collection(collectionName);
}

export function demarrerJobsExpiration(userRepo: any, bienRepo: any): void {
  const UNE_HEURE = 60 * 60 * 1000;

  async function verifierExpirations() {
    const maintenant = new Date();

    try {
      const usersCol = getNativeCollection(userRepo, 'users');
      const biensCol = getNativeCollection(bienRepo, 'biens');

      // Rétrograder abonnements expirés → gratuit
      const limitesGratuit = getLimitesParPlan('gratuit');
      await usersCol.updateMany(
        {
          'abonnement.actif': true,
          'abonnement.date_fin': {$lt: maintenant},
        },
        {
          $set: {
            'abonnement.actif': false,
            'abonnement.plan': 'gratuit',
            'badges.premium': false,
            limites: limitesGratuit,
            updatedAt: maintenant,
          },
        },
      );

      // Désactiver boosts expirés
      await biensCol.updateMany(
        {
          'boost.actif': true,
          'boost.date_fin': {$lt: maintenant},
        },
        {
          $set: {
            'boost.actif': false,
            en_vedette: false,
            updatedAt: maintenant,
          },
        },
      );

      console.log(`[Job] Expirations vérifiées — ${maintenant.toISOString()}`);
    } catch (e) {
      console.error('[Job] Erreur expirations:', e);
    }
  }

  // Lancer après 5s (laisse le temps à MongoDB de se connecter), puis toutes les heures
  setTimeout(() => {
    verifierExpirations();
    setInterval(verifierExpirations, UNE_HEURE);
  }, 5000);
}
