/**
 * DIWANE — Plans d'abonnement
 * Route publique : GET /api/plans
 */
import {get} from '@loopback/rest';
import {getLimitesParPlan} from '../models';

export class DiwanePlansController {
  @get('/api/plans', {
    summary: '[Diwane] Retourne les plans disponibles (public)',
    responses: {
      '200': {
        description: 'Liste des plans',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async getPlans(): Promise<object> {
    return {
      plans: [
        {
          id: 'gratuit',
          nom: 'Gratuit',
          prix_fcfa: 0,
          limites: getLimitesParPlan('gratuit'),
          fonctionnalites: [
            '5 annonces actives',
            '10 photos par annonce',
            'Contact WhatsApp',
          ],
          non_inclus: [
            'Vidéos',
            'Visite 360°',
            'Boost annonces',
            'Dashboard stats',
            'Support prioritaire',
          ],
        },
        {
          id: 'premium',
          nom: 'Premium',
          prix_fcfa: 20, // TODO(test-wave): remettre 10000 après les tests de paiement réel.
          badge: 'Premium',
          recommande: true,
          limites: getLimitesParPlan('premium'),
          fonctionnalites: [
            'Annonces illimitées',
            '15 photos par annonce',
            '5 visites 360° / mois',
            '2 vidéos / mois',
            '1 boost gratuit / mois',
            'Badge Premium',
            'Dashboard stats avancées',
            'CRM léger',
            'Support prioritaire',
          ],
        },
        {
          id: 'pro',
          nom: 'Pro',
          prix_fcfa: 50, // TODO(test-wave): remettre 35000 après les tests de paiement réel.
          badge: 'Pro',
          limites: getLimitesParPlan('pro'),
          fonctionnalites: [
            'Tout Premium inclus',
            'Photos & vidéos illimitées',
            '360° illimitées',
            '3 boosts gratuits / mois',
            '7 utilisateurs / agence',
            'Page agence dédiée',
            'Dashboard agence complet',
            'API access partenaires',
            'Account manager dédié',
          ],
        },
      ],
    };
  }
}
