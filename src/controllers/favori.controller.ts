/**
 * CONTROLLER FAVORI — Liste de souhaits acheteur
 * Remplace : panier.controller.ts (logique B2B)
 * Plateforme Immobilière Sénégal
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  post,
  requestBody,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {Favori} from '../models';
import {BienRepository, FavoriRepository} from '../repositories';

export class FavoriController {
  constructor(
    @repository(FavoriRepository)
    public favoriRepo: FavoriRepository,
    @repository(BienRepository)
    public bienRepo: BienRepository,
  ) {}

  // ─── Ajouter un favori ─────────────────────────────────────────────────────
  @authenticate('jwt')
  @post('/favoris', {
    summary: 'Ajouter un bien en favori',
    responses: {'201': {description: 'Ajouté aux favoris'}},
  })
  async add(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bien_id'],
            properties: {
              bien_id: {type: 'string'},
              note_personnelle: {type: 'string', maxLength: 200},
            },
          },
        },
      },
    })
    body: {bien_id: string; note_personnelle?: string},
  ): Promise<Favori> {
    // Vérifier que le bien existe
    const bien = await this.bienRepo.findById(body.bien_id);
    if (!bien || bien.statut === 'archive') {
      throw new HttpErrors.NotFound('Bien introuvable.');
    }

    // Vérifier qu'il n'est pas déjà en favori
    const existing = await this.favoriRepo.findOne({
      where: {
        acheteur_id: currentUser[securityId],
        bien_id: body.bien_id,
      } as any,
    });
    if (existing) {
      throw new HttpErrors.Conflict('Ce bien est déjà dans vos favoris.');
    }

    const favori = await this.favoriRepo.create({
      acheteur_id: currentUser[securityId],
      bien_id: body.bien_id,
      note_personnelle: body.note_personnelle,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mettre à jour nb_favoris du bien (best-effort)
    this.favoriRepo.countForBien(body.bien_id).then(count => {
      this.bienRepo.updateById(body.bien_id, {
        stats: {...bien.stats, nb_favoris: count} as any,
      });
    }).catch(() => {});

    return favori;
  }

  // ─── Mes favoris ────────────────────────────────────────────────────────────
  @authenticate('jwt')
  @get('/mes-favoris', {
    summary: 'Ma liste de biens favoris',
    responses: {'200': {description: 'Favoris'}},
  })
  async myFavoris(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.number('limit') limit = 50,
    @param.query.number('skip') skip = 0,
  ): Promise<Favori[]> {
    return this.favoriRepo.find({
      where: {acheteur_id: currentUser[securityId]} as any,
      limit,
      skip,
      order: ['createdAt DESC'],
    });
  }

  // ─── Supprimer un favori ───────────────────────────────────────────────────
  @authenticate('jwt')
  @del('/favoris/{id}', {
    summary: 'Retirer un bien des favoris',
    responses: {'204': {description: 'Retiré des favoris'}},
  })
  async remove(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const favori = await this.favoriRepo.findById(id);
    if (String(favori.acheteur_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }
    await this.favoriRepo.deleteById(id);
  }

  // ─── Supprimer par bien_id ─────────────────────────────────────────────────
  @authenticate('jwt')
  @del('/favoris/bien/{bienId}', {
    summary: 'Retirer un bien spécifique des favoris',
    responses: {'204': {description: 'Retiré des favoris'}},
  })
  async removeByBien(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('bienId') bienId: string,
  ): Promise<void> {
    await this.favoriRepo.removeByAcheteurAndBien(currentUser[securityId], bienId);
  }

  // ─── Vérifier si un bien est en favori ────────────────────────────────────
  @authenticate('jwt')
  @get('/favoris/check/{bienId}', {
    summary: 'Vérifier si un bien est dans mes favoris',
    responses: {'200': {description: 'Résultat'}},
  })
  async checkFavori(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('bienId') bienId: string,
  ): Promise<{estFavori: boolean; favoriId?: string}> {
    const favori = await this.favoriRepo.findOne({
      where: {
        acheteur_id: currentUser[securityId],
        bien_id: bienId,
      } as any,
    });
    return {estFavori: !!favori, favoriId: favori?.id};
  }
}
