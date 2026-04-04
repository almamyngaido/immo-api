/**
 * DIWANE — Controller Favoris B2C
 * Routes : POST /api/favoris, DELETE /api/favoris/:bienId, GET /api/favoris
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {del, get, HttpErrors, param, post, requestBody} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {BienRepository, FavoriRepository, UserRepository} from '../repositories';
import {diwaneBien} from '../utils/diwane-bien.utils';

export class DiwaneFavorisController {
  constructor(
    @repository(FavoriRepository)
    public favoriRepository: FavoriRepository,
    @repository(BienRepository)
    public bienRepository: BienRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
  ) {}

  // ─── POST /api/favoris — Ajouter un favori ───────────────────────────────────

  @authenticate('jwt')
  @post('/api/favoris', {
    summary: '[Diwane] Ajouter un bien aux favoris',
    responses: {
      '201': {
        description: 'Favori ajouté',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async ajouterFavori(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bien_id'],
            properties: {
              bien_id:          {type: 'string'},
              note_personnelle: {type: 'string', maxLength: 200},
            },
          },
        },
      },
    })
    body: {bien_id: string; note_personnelle?: string},
  ): Promise<object> {
    const acheteurId = currentUser[securityId];

    // Vérifier si le bien existe
    const bien = await this.bienRepository.findById(body.bien_id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    // Vérifier doublon
    const existing = await this.favoriRepository.findOne({
      where: {acheteur_id: acheteurId, bien_id: body.bien_id} as any,
    });
    if (existing) {
      throw new HttpErrors.Conflict('Ce bien est déjà dans vos favoris.');
    }

    await this.favoriRepository.create({
      acheteur_id:      acheteurId,
      bien_id:          body.bien_id,
      note_personnelle: body.note_personnelle,
      createdAt:        new Date(),
      updatedAt:        new Date(),
    });

    // Incrémenter bien.stats.nb_favoris (best-effort)
    this.bienRepository.updateById(body.bien_id, {
      stats: {
        ...bien.stats,
        nb_favoris: (bien.stats?.nb_favoris ?? 0) + 1,
      } as any,
    }).catch(() => {});

    return {success: true};
  }

  // ─── DELETE /api/favoris/:bienId — Retirer un favori ─────────────────────────

  @authenticate('jwt')
  @del('/api/favoris/{bienId}', {
    summary: '[Diwane] Retirer un bien des favoris',
    responses: {
      '200': {
        description: 'Favori retiré',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async supprimerFavori(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('bienId') bienId: string,
  ): Promise<object> {
    const acheteurId = currentUser[securityId];

    await this.favoriRepository.removeByAcheteurAndBien(acheteurId, bienId);

    // Décrémenter bien.stats.nb_favoris (min 0, best-effort)
    this.bienRepository.findById(bienId).then(bien => {
      return this.bienRepository.updateById(bienId, {
        stats: {
          ...bien.stats,
          nb_favoris: Math.max(0, (bien.stats?.nb_favoris ?? 0) - 1),
        } as any,
      });
    }).catch(() => {});

    return {success: true};
  }

  // ─── GET /api/favoris — Mes favoris avec biens populés ───────────────────────

  @authenticate('jwt')
  @get('/api/favoris', {
    summary: '[Diwane] Mes biens favoris',
    responses: {
      '200': {
        description: 'Liste des favoris',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async mesFavoris(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const favoris = await this.favoriRepository.find({
      where:  {acheteur_id: currentUser[securityId]} as any,
      order:  ['createdAt DESC'],
    });

    if (favoris.length === 0) return [];

    const bienIds = favoris.map(f => f.bien_id);
    const biens   = await this.bienRepository.find({
      where: {id: {inq: bienIds}} as any,
    });
    const biensMap = new Map(biens.map(b => [b.id!, b]));

    // Batch courtier lookup
    const courtierIds = [...new Set(biens.map(b => b.courtier_id).filter(Boolean))];
    const courtiers   = await this.userRepository.find({
      where:  {id: {inq: courtierIds}} as any,
      fields: {id: true, prenom: true, nom: true, telephone: true, ville: true, badges: true, stats: true} as any,
    });
    const courtierMap = new Map(courtiers.map(c => [c.id!, c]));

    return favoris
      .map(f => {
        const bien = biensMap.get(f.bien_id);
        if (!bien) return null;
        return {
          favori_id:  f.id,
          ajoute_le:  f.createdAt,
          note:       f.note_personnelle,
          bien:       diwaneBien(bien, courtierMap.get(bien.courtier_id)),
        };
      })
      .filter(Boolean) as object[];
  }
}
