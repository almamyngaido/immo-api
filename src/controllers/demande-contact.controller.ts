/**
 * CONTROLLER DEMANDE DE CONTACT
 * Acheteur → Courtier : demande d'info, visite, offre
 * Plateforme Immobilière Sénégal
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {DemandeContact} from '../models';
import {BienRepository, DemandeContactRepository} from '../repositories';
import * as crypto from 'crypto';

export class DemandeContactController {
  constructor(
    @repository(DemandeContactRepository)
    public demandeRepo: DemandeContactRepository,
    @repository(BienRepository)
    public bienRepo: BienRepository,
  ) {}

  // ─── Créer une demande de contact (public ou connecté) ─────────────────────
  @post('/demandes-contact', {
    summary: 'Contacter un courtier pour un bien',
    responses: {'201': {description: 'Demande créée'}},
  })
  async create(
    @requestBody({content: {'application/json': {schema: {type: 'object'}}}})
    data: Partial<DemandeContact>,
    @inject(SecurityBindings.USER, {optional: true})
    currentUser?: UserProfile,
  ): Promise<DemandeContact> {
    if (!data.bien_id || !data.courtier_id) {
      throw new HttpErrors.BadRequest('bien_id et courtier_id sont requis.');
    }

    // Vérifier que le bien existe et est publié
    const bien = await this.bienRepo.findById(data.bien_id);
    if (!bien || bien.statut !== 'publie') {
      throw new HttpErrors.NotFound('Annonce introuvable ou non publiée.');
    }

    if (currentUser) {
      data.acheteur_id = currentUser[securityId];
    }

    data.statut = 'nouvelle';
    data.createdAt = new Date();
    data.updatedAt = new Date();

    const demande = await this.demandeRepo.create(data);

    // Incrémenter nb_contacts du bien (best-effort)
    const nbContacts = (bien.stats?.nb_contacts ?? 0) + 1;
    this.bienRepo.updateById(data.bien_id, {
      stats: {...bien.stats, nb_contacts: nbContacts} as any,
    }).catch(() => {});

    return demande;
  }

  // ─── Mes demandes reçues (courtier connecté) ────────────────────────────────
  @authenticate('jwt')
  @get('/mes-demandes', {
    summary: 'Courtier : mes demandes de contact reçues',
    responses: {'200': {description: 'Liste des demandes'}},
  })
  async myDemandes(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('statut') statut?: string,
    @param.query.number('limit') limit = 20,
    @param.query.number('skip') skip = 0,
  ): Promise<DemandeContact[]> {
    const where: any = {courtier_id: currentUser[securityId]};
    if (statut) where.statut = statut;
    return this.demandeRepo.find({where, limit, skip, order: ['createdAt DESC']});
  }

  // ─── Mes demandes envoyées (acheteur connecté) ──────────────────────────────
  @authenticate('jwt')
  @get('/mes-demandes-envoyees', {
    summary: 'Acheteur : mes demandes de contact envoyées',
    responses: {'200': {description: 'Liste des demandes'}},
  })
  async mySentDemandes(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<DemandeContact[]> {
    return this.demandeRepo.find({
      where: {acheteur_id: currentUser[securityId]} as any,
      order: ['createdAt DESC'],
    });
  }

  // ─── Mettre à jour le statut d'une demande (courtier) ──────────────────────
  @authenticate('jwt')
  @patch('/demandes-contact/{id}/statut', {
    summary: 'Courtier : mettre à jour le statut d\'une demande',
    responses: {'204': {description: 'Statut mis à jour'}},
  })
  async updateStatut(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statut'],
            properties: {
              statut: {
                type: 'string',
                enum: ['vue', 'en_cours', 'visite_planifiee', 'cloturee', 'annulee'],
              },
              reponse_canal: {type: 'string', enum: ['chat', 'telephone', 'whatsapp']},
              date_visite_souhaitee: {type: 'string', format: 'date-time'},
            },
          },
        },
      },
    })
    body: {statut: string; reponse_canal?: string; date_visite_souhaitee?: string},
  ): Promise<void> {
    const demande = await this.demandeRepo.findById(id);
    if (demande.courtier_id !== currentUser[securityId]) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }

    const update: Partial<DemandeContact> = {
      statut: body.statut,
      updatedAt: new Date(),
    };

    if (body.reponse_canal) update.reponse_canal = body.reponse_canal;

    // Calculer le délai de réponse pour le badge ultra_reactif
    if (demande.statut === 'nouvelle' && !demande.date_reponse) {
      update.date_reponse = new Date();
      const diffMs = new Date().getTime() - new Date(demande.createdAt!).getTime();
      update.heure_reponse_minutes = Math.round(diffMs / 60000);
    }

    // Générer un code QR si visite planifiée
    if (body.statut === 'visite_planifiee' && !demande.code_visite) {
      update.code_visite = crypto.randomUUID();
      if (body.date_visite_souhaitee) {
        update.date_visite_souhaitee = new Date(body.date_visite_souhaitee);
      }
    }

    await this.demandeRepo.updateById(id, update);
  }

  // ─── Confirmer une visite via QR code ──────────────────────────────────────
  @post('/demandes-contact/confirmer-visite', {
    summary: 'Confirmer une visite physique via QR code',
    responses: {'200': {description: 'Visite confirmée'}},
  })
  async confirmerVisite(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['code_visite'],
            properties: {code_visite: {type: 'string'}},
          },
        },
      },
    })
    body: {code_visite: string},
  ): Promise<{message: string; demande_id: string}> {
    const demande = await this.demandeRepo.findOne({
      where: {code_visite: body.code_visite, visite_effectuee: false} as any,
    });
    if (!demande) {
      throw new HttpErrors.NotFound('Code de visite invalide ou déjà utilisé.');
    }

    await this.demandeRepo.updateById(demande.id!, {
      visite_effectuee: true,
      date_visite_reelle: new Date(),
      statut: 'cloturee',
    });

    return {message: 'Visite confirmée. Un avis vous sera demandé sous 24h.', demande_id: demande.id!};
  }
}
