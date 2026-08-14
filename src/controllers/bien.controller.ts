/**
 * CONTROLLER BIEN — Plateforme Immobilière Sénégal
 * Annonces immobilières : création, recherche, boost, modération
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
import {Bien} from '../models';
import {BienRepository, UserRepository} from '../repositories';

export class BienController {
  constructor(
    @repository(BienRepository)
    public bienRepository: BienRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
  ) {}

  // ─── Créer une annonce ──────────────────────────────────────────────────────
  @authenticate('jwt')
  @post('/biens', {
    summary: 'Créer une annonce immobilière',
    responses: {'201': {description: 'Annonce créée'}},
  })
  async create(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {'application/json': {schema: {type: 'object'}}},
    })
    bienData: Partial<Bien>,
  ): Promise<Bien> {
    const courtier = await this.userRepository.findById(currentUser[securityId]);
    if (courtier.role !== 'courtier') {
      throw new HttpErrors.Forbidden('Seuls les courtiers peuvent publier des annonces.');
    }
    if (!courtier.actif) {
      throw new HttpErrors.Forbidden('Compte désactivé.');
    }

    bienData.courtier_id = currentUser[securityId];
    bienData.statut = bienData.statut ?? 'brouillon';

    // Génération de la référence
    if (bienData.localisation?.ville && bienData.type_bien) {
      bienData.reference = await this.bienRepository.generateReference(
        bienData.localisation.ville,
        bienData.type_bien,
      );
    }

    // Calcul total entrée si location
    if (bienData.type_transaction === 'location' && bienData.finances?.loyer_mensuel_fcfa) {
      const loyer = bienData.finances.loyer_mensuel_fcfa;
      const caution = bienData.finances.caution_mois ?? 2;
      const avance = bienData.finances.avance_mois ?? 1;
      const charges = bienData.finances.charges_incluses ? 0 : (bienData.finances.charges_montant_fcfa ?? 0);
      bienData.finances.total_entree_fcfa = loyer * (caution + avance) + charges;
    }

    bienData.createdAt = new Date();
    bienData.updatedAt = new Date();

    return this.bienRepository.create(bienData);
  }

  // ─── Recherche d'annonces (public) ─────────────────────────────────────────
  @get('/biens', {
    summary: 'Rechercher des annonces immobilières',
    responses: {'200': {description: 'Liste d\'annonces', content: {'application/json': {schema: {type: 'array'}}}}},
  })
  async search(
    @param.query.string('ville') ville?: string,
    @param.query.string('quartier') quartier?: string,
    @param.query.string('type_bien') typeBien?: string,
    @param.query.string('type_transaction') typeTransaction?: string,
    @param.query.number('loyer_min') loyerMin?: number,
    @param.query.number('loyer_max') loyerMax?: number,
    @param.query.number('prix_min') prixMin?: number,
    @param.query.number('prix_max') prixMax?: number,
    @param.query.number('nb_chambres') nbChambres?: number,
    @param.query.number('limit') limit = 20,
    @param.query.number('skip') skip = 0,
  ): Promise<Bien[]> {
    const where: any = {statut: 'publie'};

    if (ville) where['localisation.ville'] = ville;
    if (quartier) where['localisation.quartier'] = {like: quartier};
    if (typeBien) where.type_bien = typeBien;
    if (typeTransaction) where.type_transaction = typeTransaction;
    if (loyerMin || loyerMax) {
      where['finances.loyer_mensuel_fcfa'] = {};
      if (loyerMin) where['finances.loyer_mensuel_fcfa'].gte = loyerMin;
      if (loyerMax) where['finances.loyer_mensuel_fcfa'].lte = loyerMax;
    }
    if (prixMin || prixMax) {
      where['finances.prix_vente_fcfa'] = {};
      if (prixMin) where['finances.prix_vente_fcfa'].gte = prixMin;
      if (prixMax) where['finances.prix_vente_fcfa'].lte = prixMax;
    }
    if (nbChambres) where['caracteristiques.nb_chambres'] = {gte: nbChambres};

    return this.bienRepository.find({
      where,
      limit,
      skip,
      order: ['en_vedette DESC', 'boost.actif DESC', 'createdAt DESC'],
    });
  }

  // ─── Obtenir une annonce par ID (public) ───────────────────────────────────
  @get('/biens/{id}', {
    summary: 'Détail d\'une annonce',
    responses: {'200': {description: 'Annonce'}},
  })
  async findById(@param.path.string('id') id: string): Promise<Bien> {
    const bien = await this.bienRepository.findById(id);
    if (!bien || bien.statut === 'archive') {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    }

    // Incrémenter les vues (best-effort)
    const nbVues = (bien.stats?.nb_vues ?? 0) + 1;
    this.bienRepository.updateById(id, {
      stats: {...bien.stats, nb_vues: nbVues, derniere_vue: new Date()} as any,
    }).catch(() => {});

    return bien;
  }

  // ─── Annonces en vedette (page d'accueil) ──────────────────────────────────
  @get('/biens/featured', {
    summary: 'Annonces en vedette et boostées',
    responses: {'200': {description: 'Annonces featured'}},
  })
  async featured(@param.query.number('limit') limit = 20): Promise<Bien[]> {
    return this.bienRepository.findFeatured(limit);
  }

  // ─── Mes annonces (courtier connecté) ──────────────────────────────────────
  @authenticate('jwt')
  @get('/mes-biens', {
    summary: 'Mes annonces (courtier connecté)',
    responses: {'200': {description: 'Mes annonces'}},
  })
  async myBiens(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('statut') statut?: string,
  ): Promise<Bien[]> {
    const where: any = {courtier_id: currentUser[securityId]};
    if (statut) where.statut = statut;
    return this.bienRepository.find({where, order: ['createdAt DESC']});
  }

  // ─── Mettre à jour une annonce ──────────────────────────────────────────────
  @authenticate('jwt')
  @patch('/biens/{id}', {
    summary: 'Modifier une annonce',
    responses: {'204': {description: 'Annonce mise à jour'}},
  })
  async update(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({content: {'application/json': {schema: {type: 'object'}}}})
    update: Partial<Bien>,
  ): Promise<void> {
    const bien = await this.bienRepository.findById(id);
    const roles: string[] = (currentUser.roles as string[]) || [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');

    if (!isAdmin && String(bien.courtier_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden('Vous ne pouvez modifier que vos propres annonces.');
    }

    // Recalcul total entrée si les données financières changent
    const finances = update.finances ?? bien.finances;
    if (finances?.loyer_mensuel_fcfa) {
      const loyer = finances.loyer_mensuel_fcfa;
      const caution = finances.caution_mois ?? 2;
      const avance = finances.avance_mois ?? 1;
      const charges = finances.charges_incluses ? 0 : (finances.charges_montant_fcfa ?? 0);
      if (update.finances) {
        update.finances.total_entree_fcfa = loyer * (caution + avance) + charges;
      }
    }

    update.updatedAt = new Date();
    await this.bienRepository.updateById(id, update);
  }

  // ─── Publier / mettre en brouillon ─────────────────────────────────────────
  @authenticate('jwt')
  @patch('/biens/{id}/statut', {
    summary: 'Changer le statut d\'une annonce',
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
                enum: ['brouillon', 'en_attente', 'publie', 'loue', 'vendu', 'archive'],
              },
            },
          },
        },
      },
    })
    body: {statut: string},
  ): Promise<void> {
    const bien = await this.bienRepository.findById(id);
    if (String(bien.courtier_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }

    const update: Partial<Bien> = {statut: body.statut};
    if (body.statut === 'publie' && !bien.date_publication) {
      update.date_publication = new Date();
    }
    await this.bienRepository.updateById(id, update);
  }

  // ─── Admin : modération d'une annonce ──────────────────────────────────────
  @authenticate('jwt')
  @patch('/biens/{id}/moderation', {
    summary: 'Admin : modérer une annonce',
    responses: {'204': {description: 'Modération appliquée'}},
  })
  async moderer(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              statut_moderation: {type: 'string', enum: ['verifie', 'signale', 'non_verifie']},
              en_vedette: {type: 'boolean'},
              admin_note: {type: 'string'},
              statut_annonce: {type: 'string', enum: ['publie', 'rejete', 'archive']},
            },
          },
        },
      },
    })
    body: {statut_moderation?: string; en_vedette?: boolean; admin_note?: string; statut_annonce?: string},
  ): Promise<void> {
    const roles: string[] = (currentUser.roles as string[]) || [];
    if (!roles.some(r => String(r).toLowerCase() === 'admin')) {
      throw new HttpErrors.Forbidden('Accès admin requis.');
    }

    const update: any = {};
    if (body.statut_moderation) {
      update.moderation = {
        statut: body.statut_moderation,
        admin_note: body.admin_note,
        date_verification: new Date(),
      };
    }
    if (body.en_vedette !== undefined) update.en_vedette = body.en_vedette;
    if (body.statut_annonce) update.statut = body.statut_annonce;

    await this.bienRepository.updateById(id, update);
  }

  // ─── Supprimer une annonce ─────────────────────────────────────────────────
  @authenticate('jwt')
  @del('/biens/{id}', {
    summary: 'Supprimer une annonce (archive)',
    responses: {'204': {description: 'Annonce archivée'}},
  })
  async delete(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const bien = await this.bienRepository.findById(id);
    const roles: string[] = (currentUser.roles as string[]) || [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');

    if (!isAdmin && String(bien.courtier_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }

    // Soft delete : archive
    await this.bienRepository.updateById(id, {statut: 'archive', updatedAt: new Date()});
  }
}
