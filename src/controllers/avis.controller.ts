/**
 * CONTROLLER AVIS — Post-visite avec QR code
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
import {Avis} from '../models';
import {AvisRepository, DemandeContactRepository, UserRepository} from '../repositories';

export class AvisController {
  constructor(
    @repository(AvisRepository)
    public avisRepo: AvisRepository,
    @repository(DemandeContactRepository)
    public demandeRepo: DemandeContactRepository,
    @repository(UserRepository)
    public userRepo: UserRepository,
  ) {}

  // ─── Soumettre un avis post-visite ─────────────────────────────────────────
  @authenticate('jwt')
  @post('/avis', {
    summary: 'Soumettre un avis après une visite (QR code validé)',
    responses: {'201': {description: 'Avis créé'}},
  })
  async create(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['demande_id', 'note_globale'],
            properties: {
              demande_id: {type: 'string'},
              note_globale: {type: 'number', minimum: 1, maximum: 5},
              note_ponctualite: {type: 'number', minimum: 1, maximum: 5},
              note_information: {type: 'number', minimum: 1, maximum: 5},
              note_professionnalisme: {type: 'number', minimum: 1, maximum: 5},
              commentaire: {type: 'string', maxLength: 800},
            },
          },
        },
      },
    })
    data: Partial<Avis>,
  ): Promise<Avis> {
    // Vérifier que la visite a bien été effectuée
    const demande = await this.demandeRepo.findById(data.demande_id!);
    if (!demande.visite_effectuee) {
      throw new HttpErrors.Forbidden('Impossible de noter : visite non confirmée.');
    }
    if (String(demande.acheteur_id) !== currentUser[securityId]) {
      throw new HttpErrors.Forbidden('Vous ne pouvez noter que les visites que vous avez effectuées.');
    }

    // Vérifier qu'aucun avis n'existe déjà pour cette demande
    const existingAvis = await this.avisRepo.findOne({
      where: {demande_id: data.demande_id} as any,
    });
    if (existingAvis) {
      throw new HttpErrors.Conflict('Un avis a déjà été soumis pour cette visite.');
    }

    const avis = await this.avisRepo.create({
      ...data,
      courtier_id: String(demande.courtier_id),
      bien_id: String(demande.bien_id),
      auteur_id: currentUser[securityId],
      statut: 'en_attente',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mettre à jour la note moyenne du courtier (best-effort)
    this.avisRepo.getNotesMoyenneCourtier(String(demande.courtier_id)).then(async noteMoyenne => {
      const nbAvisResult = await this.avisRepo.count({
        courtier_id: demande.courtier_id,
        statut: 'publie',
      } as any);
      await this.userRepo.updateById(String(demande.courtier_id), {
        stats: {note_moyenne: noteMoyenne, nb_avis: nbAvisResult.count} as any,
      });
    }).catch(() => {});

    return avis;
  }

  // ─── Avis d'un courtier (public) ───────────────────────────────────────────
  @get('/courtiers/{courtierId}/avis', {
    summary: 'Avis publiés pour un courtier',
    responses: {'200': {description: 'Liste des avis'}},
  })
  async getCourtierAvis(
    @param.path.string('courtierId') courtierId: string,
    @param.query.number('limit') limit = 10,
    @param.query.number('skip') skip = 0,
  ): Promise<Avis[]> {
    return this.avisRepo.find({
      where: {courtier_id: courtierId, statut: 'publie'} as any,
      limit,
      skip,
      order: ['createdAt DESC'],
    });
  }

  // ─── Admin : modérer un avis ────────────────────────────────────────────────
  @authenticate('jwt')
  @patch('/avis/{id}/moderation', {
    summary: 'Admin : publier, signaler ou supprimer un avis',
    responses: {'204': {description: 'Statut mis à jour'}},
  })
  async moderer(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statut'],
            properties: {
              statut: {type: 'string', enum: ['publie', 'signale', 'supprime']},
            },
          },
        },
      },
    })
    body: {statut: string},
  ): Promise<void> {
    const roles: string[] = (currentUser.roles as string[]) || [];
    if (!roles.some(r => String(r).toLowerCase() === 'admin')) {
      throw new HttpErrors.Forbidden('Accès admin requis.');
    }
    await this.avisRepo.updateById(id, {
      statut: body.statut,
      date_moderation: new Date(),
      updatedAt: new Date(),
    } as any);
  }
}
