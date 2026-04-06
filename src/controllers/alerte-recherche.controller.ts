/**
 * ALERTES RECHERCHE — CRUD acheteur
 * POST   /api/alertes          — Créer une alerte
 * GET    /api/alertes          — Mes alertes
 * PATCH  /api/alertes/:id      — Activer / désactiver
 * DELETE /api/alertes/:id      — Supprimer
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {AlerteRechercheRepository} from '../repositories';

export class AlerteRechercheController {
  constructor(
    @repository(AlerteRechercheRepository)
    public alerteRepository: AlerteRechercheRepository,
  ) {}

  // ─── POST /api/alertes ────────────────────────────────────────────────────

  @authenticate('jwt')
  @post('/api/alertes', {
    summary: '[Diwane] Créer une alerte recherche',
    responses: {
      '201': {description: 'Alerte créée', content: {'application/json': {schema: {type: 'object'}}}},
    },
  })
  async creerAlerte(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['onesignal_subscription_id'],
            properties: {
              onesignal_subscription_id: {type: 'string'},
              label:                     {type: 'string', maxLength: 60},
              criteres: {
                type: 'object',
                properties: {
                  type_transaction: {type: 'string', enum: ['vente', 'location', 'les_deux']},
                  type_bien:        {type: 'array', items: {type: 'string'}},
                  villes:           {type: 'array', items: {type: 'string'}},
                  quartier:         {type: 'string'},
                  loyer_max_fcfa:   {type: 'number'},
                  prix_max_fcfa:    {type: 'number'},
                  nb_chambres_min:  {type: 'number'},
                },
              },
            },
          },
        },
      },
    })
    body: {
      onesignal_subscription_id: string;
      label?: string;
      criteres?: object;
    },
  ): Promise<object> {
    const userId = currentUser[securityId];

    // Éviter les doublons (même subscription_id + même acheteur)
    const existing = await this.alerteRepository.findOne({
      where: {
        acheteur_id: userId,
        onesignal_subscription_id: body.onesignal_subscription_id,
      } as any,
    });
    if (existing) {
      // Mise à jour des critères si l'alerte existe déjà
      await this.alerteRepository.updateById(existing.id, {
        criteres:  body.criteres ?? existing.criteres,
        label:     body.label    ?? existing.label,
        active:    true,
        updatedAt: new Date(),
      });
      return {id: existing.id, updated: true};
    }

    const alerte = await this.alerteRepository.create({
      acheteur_id:               userId,
      onesignal_subscription_id: body.onesignal_subscription_id,
      label:                     body.label,
      criteres:                  body.criteres ?? {},
      active:                    true,
      nb_notifications_envoyees: 0,
      createdAt:                 new Date(),
      updatedAt:                 new Date(),
    });

    return {id: alerte.id, created: true};
  }

  // ─── GET /api/alertes ─────────────────────────────────────────────────────

  @authenticate('jwt')
  @get('/api/alertes', {
    summary: '[Diwane] Mes alertes recherche',
    responses: {
      '200': {description: 'Liste alertes', content: {'application/json': {schema: {type: 'array'}}}},
    },
  })
  async mesAlertes(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    return this.alerteRepository.find({
      where: {acheteur_id: userId} as any,
      order: ['createdAt DESC'],
    });
  }

  // ─── PATCH /api/alertes/:id — activer/désactiver ──────────────────────────

  @authenticate('jwt')
  @patch('/api/alertes/{id}', {
    summary: '[Diwane] Activer ou désactiver une alerte',
    responses: {'204': {description: 'Mise à jour'}},
  })
  async mettreAJourAlerte(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              active:   {type: 'boolean'},
              label:    {type: 'string', maxLength: 60},
              criteres: {type: 'object'},
            },
          },
        },
      },
    })
    body: {active?: boolean; label?: string; criteres?: object},
  ): Promise<void> {
    const alerte = await this.alerteRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Alerte introuvable.');
    });
    if (alerte.acheteur_id !== currentUser[securityId]) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }
    const update: any = {updatedAt: new Date()};
    if (body.active   !== undefined) update.active   = body.active;
    if (body.label    !== undefined) update.label    = body.label;
    if (body.criteres !== undefined) update.criteres = body.criteres;
    await this.alerteRepository.updateById(id, update);
  }

  // ─── DELETE /api/alertes/:id ──────────────────────────────────────────────

  @authenticate('jwt')
  @del('/api/alertes/{id}', {
    summary: '[Diwane] Supprimer une alerte',
    responses: {'204': {description: 'Supprimée'}},
  })
  async supprimerAlerte(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const alerte = await this.alerteRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Alerte introuvable.');
    });
    if (alerte.acheteur_id !== currentUser[securityId]) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }
    await this.alerteRepository.deleteById(id);
  }
}
