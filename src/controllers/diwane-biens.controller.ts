/**
 * DIWANE — Controller Biens B2C
 * Routes : GET /api/biens, GET /api/biens/mes-annonces,
 *          GET /api/biens/:id, POST /api/biens, PATCH /api/biens/:id,
 *          PATCH /api/biens/:id/statut, POST /api/biens/:id/contact,
 *          DELETE /api/biens/:id
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
  response,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {Bien} from '../models';
import {getLimitesParPlan} from '../models/user.model';
import {AlerteRechercheRepository, BienRepository, DemandeContactRepository, UserRepository} from '../repositories';
import {AlerteService} from '../services/alerte.service';
import {buildOrder, diwaneBien, escapeRegex} from '../utils/diwane-bien.utils';

export class DiwaneBiensController {
  constructor(
    @repository(BienRepository)
    public bienRepository: BienRepository,
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(DemandeContactRepository)
    public demandeContactRepository: DemandeContactRepository,
    @repository(AlerteRechercheRepository)
    public alerteRepository: AlerteRechercheRepository,
    @inject('services.AlerteService')
    public alerteService: AlerteService,
  ) {}

  // ─── GET /api/biens — Recherche avec filtres ─────────────────────────────────

  @get('/api/biens', {
    summary: '[Diwane] Rechercher des annonces',
    responses: {
      '200': {
        description: 'Liste annonces',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async listerBiens(
    @param.query.string('ville')             ville?: string,
    @param.query.string('quartier')          quartier?: string,
    @param.query.string('type_transaction')  typeTransaction?: string,
    @param.query.string('type_bien')         typeBien?: string,
    @param.query.number('loyer_min')         loyerMin?: number,
    @param.query.number('loyer_max')         loyerMax?: number,
    @param.query.number('prix_min')          prixMin?: number,
    @param.query.number('prix_max')          prixMax?: number,
    @param.query.number('nb_chambres')       nbChambres?: number,
    @param.query.number('limit')             limit = 20,
    @param.query.number('skip')              skip = 0,
    @param.query.string('sort')              sort = 'recent',
    // Phase 2 — nouveaux paramètres
    @param.query.string('q')                 q?: string,
    @param.query.string('equipements')       equipements?: string,
    @param.query.boolean('courtier_verifie') courtierVerifie?: boolean,
  ): Promise<object[]> {

    const andClauses: any[] = [
      {statut: 'publie'},
      // Exclure les annonces expirées (garder celles sans date_expiration)
      {or: [
        {date_expiration: {gt: new Date()}},
        {date_expiration: null as any},
      ]},
      // Exclure les biens loués ou vendus
      // Inclure : disponible, visite_en_cours, champ absent (anciens docs), null
      {or: [
        {disponibilite: {inq: ['disponible', 'visite_en_cours']}},
        {disponibilite: null as any},
        {disponibilite: {exists: false} as any},
      ]},
    ];

    if (ville) {
      // Normaliser la casse : "dakar" → "Dakar" (ville est un enum en base)
      const villeNorm = ville.trim().charAt(0).toUpperCase() + ville.trim().slice(1).toLowerCase();
      andClauses.push({'localisation.ville': villeNorm});
    }
    if (quartier)        andClauses.push({'localisation.quartier': {like: escapeRegex(quartier.trim()), options: 'i'}});
    if (typeBien)        andClauses.push({type_bien: typeBien});
    if (typeTransaction) andClauses.push({type_transaction: typeTransaction});

    if (loyerMin !== undefined || loyerMax !== undefined) {
      const loyerClause: any = {};
      if (loyerMin !== undefined) loyerClause.gte = loyerMin;
      if (loyerMax !== undefined) loyerClause.lte = loyerMax;
      andClauses.push({'finances.loyer_mensuel_fcfa': loyerClause});
    }
    if (prixMin !== undefined || prixMax !== undefined) {
      const prixClause: any = {};
      if (prixMin !== undefined) prixClause.gte = prixMin;
      if (prixMax !== undefined) prixClause.lte = prixMax;
      andClauses.push({'finances.prix_vente_fcfa': prixClause});
    }
    if (nbChambres) andClauses.push({'caracteristiques.nb_chambres': {gte: nbChambres}});

    // Recherche texte libre — insensible à la casse
    if (q) {
      const qTrim = escapeRegex(q.trim());
      andClauses.push({
        or: [
          {titre:                   {like: qTrim, options: 'i'}},
          {'localisation.quartier': {like: qTrim, options: 'i'}},
          {'localisation.ville':    {like: qTrim, options: 'i'}},
          {reference:               {like: qTrim, options: 'i'}},
          {description:             {like: qTrim, options: 'i'}},
        ],
      });
    }

    // Filtre équipements (AND — chaque équipement doit être true)
    if (equipements) {
      const eqList = equipements.split(',').map(e => e.trim()).filter(Boolean);
      for (const eq of eqList) {
        andClauses.push({[`caracteristiques.${eq}`]: true});
      }
    }

    // Filtre courtiers vérifiés
    if (courtierVerifie) {
      const verifiedCourtiers = await this.userRepository.find({
        where: {'badges.verifie': true} as any,
        fields: {id: true} as any,
      });
      const verifiedIds = verifiedCourtiers.map(c => c.id!).filter(Boolean);
      andClauses.push({courtier_id: {inq: verifiedIds}});
    }

    const where = andClauses.length === 1 ? andClauses[0] : {and: andClauses};

    const biens = await this.bienRepository.find({
      where,
      limit: Math.min(limit, 100),
      skip,
      order: buildOrder(sort, typeTransaction),
    });

    if (biens.length === 0) return [];

    // Populate courtiers en batch
    const courtierIds = [...new Set(biens.map(b => b.courtier_id).filter(Boolean))];
    const courtiers = await this.userRepository.find({
      where: {id: {inq: courtierIds}} as any,
      fields: {id: true, prenom: true, nom: true, ville: true, telephone: true, badges: true, stats: true} as any,
    });
    const courtierMap = new Map(courtiers.map(c => [c.id!, c]));

    return biens.map(b => diwaneBien(b, courtierMap.get(b.courtier_id)));
  }

  // ─── GET /api/biens/admin — Modération admin ─────────────────────────────────
  // ⚠️ Doit être défini AVANT /api/biens/{id} pour éviter la capture

  @authenticate('jwt')
  @get('/api/biens/admin', {
    summary: '[Diwane] Liste biens (admin) — modération',
    responses: {
      '200': {description: 'Liste biens', content: {'application/json': {schema: {type: 'array'}}}},
    },
  })
  async listeBiensAdmin(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('statut') statut = 'en_attente',
    @param.query.number('limit')  limit = 50,
    @param.query.number('skip')   skip  = 0,
  ): Promise<object[]> {
    const roles: string[] = (currentUser.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');
    if (!isAdmin) throw new HttpErrors.Forbidden('Réservé aux administrateurs.');

    const biens = await this.bienRepository.find({
      where: statut === 'tous' ? {} : {statut} as any,
      limit: Math.min(limit, 200),
      skip,
      order: ['createdAt DESC'],
    });

    if (biens.length === 0) return [];
    const courtierIds = [...new Set(biens.map(b => b.courtier_id).filter(Boolean))];
    const courtiers = await this.userRepository.find({
      where: {id: {inq: courtierIds}} as any,
      fields: {id: true, prenom: true, nom: true, ville: true, telephone: true, badges: true, stats: true} as any,
    });
    const courtierMap = new Map(courtiers.map(c => [c.id!, c]));
    return biens.map(b => diwaneBien(b, courtierMap.get(b.courtier_id)));
  }

  // ─── PATCH /api/biens/:id/disponibilite — Mise à jour disponibilité ─────────

  @authenticate('jwt')
  @patch('/api/biens/{id}/disponibilite', {
    summary: '[Diwane] Mettre à jour la disponibilité d\'un bien (courtier)',
    responses: {
      '200': {description: 'Succès', content: {'application/json': {schema: {type: 'object'}}}},
    },
  })
  async mettreAJourDisponibilite(
    @param.path.string('id') id: string,
    @requestBody() body: {disponibilite: string},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{success: boolean}> {
    const userId = currentUser[securityId];
    const bien = await this.bienRepository.findById(id);

    if (bien.courtier_id?.toString() !== userId?.toString()) {
      throw new HttpErrors.Forbidden('Cette annonce ne vous appartient pas.');
    }

    const valeurs = ['disponible', 'visite_en_cours', 'loue', 'vendu'];
    if (!valeurs.includes(body.disponibilite)) {
      throw new HttpErrors.UnprocessableEntity('Valeur de disponibilité invalide.');
    }

    const updates: any = {
      disponibilite: body.disponibilite,
      date_maj_disponibilite: new Date(),
    };

    // Si loué ou vendu → archiver le bien
    if (body.disponibilite === 'loue' || body.disponibilite === 'vendu') {
      updates.statut = body.disponibilite;
    }
    // Si remis disponible après archivage → repasser en publie
    if (body.disponibilite === 'disponible' && bien.statut !== 'publie') {
      updates.statut = 'publie';
    }

    await this.bienRepository.updateById(id, updates);
    return {success: true};
  }

  // ─── GET /api/biens/mes-annonces — Mes annonces (courtier) ───────────────────
  // ⚠️ Doit être défini AVANT /api/biens/{id} pour éviter la capture

  @authenticate('jwt')
  @get('/api/biens/mes-annonces', {
    summary: '[Diwane] Mes annonces (courtier connecté)',
    responses: {
      '200': {
        description: 'Mes annonces',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async mesAnnonces(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('statut') statut?: string,
  ): Promise<object[]> {
    const where: any = {courtier_id: currentUser[securityId]};
    if (statut) where.statut = statut;

    const biens = await this.bienRepository.find({
      where,
      order: ['createdAt DESC'],
    });

    const courtier = await this.userRepository.findById(currentUser[securityId]).catch(() => undefined);
    return biens.map(b => diwaneBien(b, courtier));
  }

  // ─── GET /api/biens/agence — Toutes les annonces de l'agence ────────────────
  // ⚠️ Doit être défini AVANT /api/biens/{id} pour éviter la capture

  @authenticate('jwt')
  @get('/api/biens/agence', {
    summary: '[Diwane] Annonces de l\'agence (Pro — propriétaire ou membre)',
    responses: {
      '200': {
        description: 'Annonces de l\'agence',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async annoncesAgence(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    const user = await this.userRepository.findById(userId).catch(() => undefined);
    if (!user) throw new HttpErrors.Unauthorized('Utilisateur introuvable.');

    const planAbonnement = (user as any).abonnement?.plan ?? 'gratuit';
    if (planAbonnement !== 'pro') {
      throw new HttpErrors.Forbidden('Cette fonctionnalité est réservée au plan Pro.');
    }

    // Déterminer l'ID du propriétaire de l'agence
    const agenceOwnerId: string = (user as any).agence_id ?? userId;

    // Récupérer tous les membres de l'agence (propriétaire + agents)
    const membres = await this.userRepository.find({
      where: {
        or: [
          {id: agenceOwnerId},
          {agence_id: agenceOwnerId},
        ],
      } as any,
      fields: {id: true, prenom: true, nom: true, nom_agence: true, badges: true, abonnement: true},
    });

    const membreIds = membres.map((m: any) => m.id as string);
    if (membreIds.length === 0) return [];

    const biens = await this.bienRepository.find({
      where: {courtier_id: {inq: membreIds}} as any,
      order: ['createdAt DESC'],
    });

    // Associer chaque bien à son courtier
    const membreMap = new Map(membres.map((m: any) => [m.id as string, m]));
    return biens.map(b => diwaneBien(b, membreMap.get((b as any).courtier_id)));
  }

  // ─── POST /api/biens/migrate-statut — Migration en_attente→publie (admin) ────
  // ⚠️ Endpoint temporaire — à supprimer après la migration

  @authenticate('jwt')
  @post('/api/biens/migrate-statut', {
    summary: '[Diwane Admin] Passer les biens en_attente → publie (one-shot)',
    responses: {'200': {description: 'Résultat migration', content: {'application/json': {schema: {type: 'object'}}}}},
  })
  async migrerStatutBiens(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object> {
    const roles: string[] = (currentUser.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');
    if (!isAdmin) throw new HttpErrors.Forbidden('Réservé aux administrateurs.');

    const biens = await this.bienRepository.find({where: {statut: 'en_attente'} as any});
    const dateExpiration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let modifiedCount = 0;

    for (const bien of biens) {
      await this.bienRepository.updateById(bien.id!, {
        statut:           'publie',
        date_publication: new Date(),
        date_expiration:  dateExpiration,
        updatedAt:        new Date(),
      } as any);
      modifiedCount++;
    }

    // Recalculer nb_annonces_actives pour chaque courtier concerné
    const courtierIds = [...new Set(biens.map(b => b.courtier_id).filter(Boolean))];
    for (const courtier_id of courtierIds) {
      const nbResult = await this.bienRepository.count({
        courtier_id,
        statut: {inq: ['publie', 'en_attente']} as any,
      });
      const courtier = await this.userRepository.findById(courtier_id).catch(() => null);
      if (courtier) {
        await this.userRepository.updateById(courtier_id, {
          stats: {...courtier.stats, nb_annonces_actives: nbResult.count} as any,
        });
      }
    }

    const nbEnAttente = await this.bienRepository.count({statut: 'en_attente'} as any);
    const nbPublie    = await this.bienRepository.count({statut: 'publie'} as any);

    return {
      message:       `${modifiedCount} annonce(s) passée(s) en publie`,
      modifiedCount,
      nbPublie:      nbPublie.count,
      nbEnAttente:   nbEnAttente.count,
    };
  }

  // ─── GET /api/biens/{id} — Détail ────────────────────────────────────────────

  @get('/api/biens/{id}', {
    summary: '[Diwane] Détail d\'une annonce',
    responses: {
      '200': {
        description: 'Annonce',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async detailBien(@param.path.string('id') id: string): Promise<object> {
    const bien = await this.bienRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    if (!bien || bien.statut === 'archive' || bien.statut === 'rejete') {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    }

    // Vérifier et désactiver boost expiré (best-effort)
    if (bien.boost?.actif && bien.boost.date_fin && bien.boost.date_fin < new Date()) {
      this.bienRepository.updateById(id, {
        boost: {...bien.boost, actif: false} as any,
      }).catch(() => {});
      bien.boost.actif = false;
    }

    // Incrémenter vues (best-effort)
    const nbVues = (bien.stats?.nb_vues ?? 0) + 1;
    this.bienRepository.updateById(id, {
      stats: {...bien.stats, nb_vues: nbVues, derniere_vue: new Date()} as any,
    }).catch(() => {});

    const courtier = await this.userRepository.findById(bien.courtier_id).catch(() => undefined);
    return diwaneBien(bien, courtier);
  }

  // ─── POST /api/biens/{id}/contact — Contacter le courtier ────────────────────
  // ⚠️ Doit être défini AVANT /api/biens/{id} pour éviter la capture

  @post('/api/biens/{id}/contact', {
    summary: '[Diwane] Envoyer une demande de contact',
    responses: {
      '201': {
        description: 'Demande créée',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async contacterCourtier(
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['type_demande'],
            properties: {
              contact_nom:       {type: 'string'},
              contact_telephone: {type: 'string', description: '+221XXXXXXXXX'},
              contact_email:     {type: 'string', format: 'email'},
              message:           {type: 'string', maxLength: 500},
              type_demande:      {type: 'string', enum: ['information', 'visite', 'offre']},
            },
          },
        },
      },
    })
    body: {
      contact_nom?: string;
      contact_telephone?: string;
      contact_email?: string;
      message?: string;
      type_demande: string;
    },
  ): Promise<object> {
    const bien = await this.bienRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    if (bien.statut !== 'publie') {
      throw new HttpErrors.UnprocessableEntity('Cette annonce n\'est plus disponible.');
    }

    const demande = await this.demandeContactRepository.create({
      bien_id:           id,
      courtier_id:       bien.courtier_id,
      contact_nom:       body.contact_nom,
      contact_telephone: body.contact_telephone,
      contact_email:     body.contact_email,
      message:           body.message,
      type_demande:      body.type_demande ?? 'information',
      statut:            'nouvelle',
      createdAt:         new Date(),
      updatedAt:         new Date(),
    });

    // Incrémenter stats bien (best-effort)
    this.bienRepository.updateById(id, {
      stats: {
        ...bien.stats,
        nb_contacts: (bien.stats?.nb_contacts ?? 0) + 1,
      } as any,
    }).catch(() => {});

    // Incrémenter stats courtier (best-effort)
    this.userRepository.findById(bien.courtier_id).then(courtier => {
      return this.userRepository.updateById(bien.courtier_id, {
        stats: {
          ...courtier.stats,
          nb_contacts_recus: (courtier.stats?.nb_contacts_recus ?? 0) + 1,
        } as any,
      });
    }).catch(() => {});

    return {success: true, id: demande.id};
  }

  // ─── PATCH /api/biens/{id}/statut — Changer le statut ────────────────────────
  // ⚠️ Doit être défini AVANT /api/biens/{id} pour éviter la capture

  @authenticate('jwt')
  @patch('/api/biens/{id}/statut', {
    summary: '[Diwane] Changer le statut d\'une annonce',
    responses: {'204': {description: 'Statut mis à jour'}},
  })
  async changerStatut(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statut'],
            properties: {
              statut:     {type: 'string', enum: ['brouillon', 'en_attente', 'publie', 'archive', 'rejete']},
              admin_note: {type: 'string'},
            },
          },
        },
      },
    })
    body: {statut: string; admin_note?: string},
  ): Promise<void> {
    console.log(`[changerStatut] ← reçu: bien=${id} statut=${body.statut}`);
    const bien = await this.bienRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    const roles: string[] = (currentUser.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');
    const userId  = currentUser[securityId];

    if (!isAdmin && bien.courtier_id?.toString() !== userId?.toString()) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }

    // Validation selon le rôle
    const statuts_admin    = ['publie', 'rejete', 'archive'];
    const statuts_courtier = ['archive', 'brouillon'];

    if (isAdmin && !statuts_admin.includes(body.statut)) {
      throw new HttpErrors.UnprocessableEntity(
        `Statut invalide pour un admin. Statuts autorisés : ${statuts_admin.join(', ')}`,
      );
    }
    if (!isAdmin && !statuts_courtier.includes(body.statut)) {
      throw new HttpErrors.Forbidden(
        `Vous ne pouvez pas passer ce statut. Statuts autorisés : ${statuts_courtier.join(', ')}`,
      );
    }

    const update: any = {statut: body.statut, updatedAt: new Date()};
    if (body.statut === 'publie') {
      update.date_publication = new Date();
    }
    if (isAdmin && body.admin_note !== undefined) {
      update.moderation = {
        ...bien.moderation,
        admin_note:         body.admin_note,
        statut:             body.statut === 'publie' ? 'verifie' : 'signale',
        date_verification:  new Date(),
      };
    }

    await this.bienRepository.updateById(id, update);

    // Recalculer nb_annonces_actives du courtier (best-effort)
    this.bienRepository.count({
      courtier_id: bien.courtier_id,
      statut: {inq: ['publie', 'en_attente']} as any,
    }).then(result => {
      return this.userRepository.findById(bien.courtier_id).then(courtier => {
        return this.userRepository.updateById(bien.courtier_id, {
          stats: {...courtier.stats, nb_annonces_actives: result.count} as any,
        });
      });
    }).catch(() => {});

    // Déclencher les alertes acheteur si le bien passe en publié (best-effort)
    if (body.statut === 'publie') {
      console.log(`[Alertes] Bien ${id} passé en publié — recherche des alertes actives…`);
      this.alerteRepository.find({where: {active: true} as any}).then(alertes => {
        console.log(`[Alertes] ${alertes.length} alerte(s) active(s) trouvée(s) en base`);
        // Recharger le bien depuis la base pour avoir toutes les données fraîches (localisation, etc.)
        return this.bienRepository.findById(id).then(bienFrais => {
          return this.alerteService.notifierAlertes(bienFrais, alertes);
        });
      }).catch(err => {
        console.error('[Alertes] Erreur lors du déclenchement des alertes:', err);
      });
    }
  }

  // ─── POST /api/biens — Créer une annonce (courtier JWT) ──────────────────────

  @authenticate('jwt')
  @post('/api/biens', {
    summary: '[Diwane] Publier une annonce (courtier)',
    responses: {
      '201': {
        description: 'Annonce créée',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async creerBien(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['titre', 'type_bien', 'type_transaction', 'ville', 'quartier'],
            properties: {
              titre:            {type: 'string', maxLength: 100},
              description:      {type: 'string', maxLength: 2000},
              type_bien:        {type: 'string', enum: ['appartement','villa','studio','duplex','bureau','commerce','terrain','entrepot','chambre']},
              type_transaction: {type: 'string', enum: ['vente', 'location']},
              ville:            {type: 'string'},
              quartier:         {type: 'string'},
              loyer:            {type: 'number'},
              prix:             {type: 'number'},
              nb_chambres:      {type: 'number'},
              surface:          {type: 'number'},
              photos:           {type: 'array', items: {type: 'string'}},
              caracteristiques: {type: 'object'},
              caution_mois:     {type: 'number'},
              avance_mois:      {type: 'number'},
            },
          },
        },
      },
    })
    body: {
      titre: string;
      description?: string;
      type_bien: string;
      type_transaction: string;
      ville: string;
      quartier: string;
      loyer?: number;
      prix?: number;
      nb_chambres?: number;
      surface?: number;
      photos?: string[];
      caracteristiques?: object;
      caution_mois?: number;
      avance_mois?: number;
    },
  ): Promise<object> {

    const courtier = await this.userRepository.findById(currentUser[securityId]);

    if (courtier.role !== 'courtier') {
      throw new HttpErrors.Forbidden('Seuls les courtiers peuvent publier des annonces.');
    }
    if (!courtier.actif) {
      throw new HttpErrors.Forbidden('Compte désactivé.');
    }

    // Si le courtier est membre d'une agence Pro, utiliser les limites du propriétaire
    const agenceId = (courtier as any).agence_id;
    const planSource = agenceId
      ? await this.userRepository.findById(agenceId).catch(() => null) ?? courtier
      : courtier;

    const plan = (planSource.abonnement as any)?.plan ?? 'gratuit';
    // Recalculer les limites depuis le plan actuel — ne pas faire confiance au champ limites en base
    // qui peut être absent ou désynchronisé après un changement de plan
    const limitesActuelles = getLimitesParPlan(plan);
    const maxAnnonces = limitesActuelles.max_annonces;
    console.log(`[creerBien] courtier=${currentUser[securityId]} plan="${plan}" max_annonces=${maxAnnonces}`);

    if (maxAnnonces !== null) {
      // Pour un membre d'agence : compter toutes les annonces de l'agence (propriétaire + membres)
      const membres = agenceId
        ? await this.userRepository.find({
            where: {or: [{id: agenceId}, {agence_id: agenceId}]} as any,
            fields: {id: true} as any,
          })
        : [courtier];
      const membreIds = membres.map((m: any) => m.id as string).filter(Boolean);

      const nbActives = await this.bienRepository.count({
        courtier_id: {inq: membreIds} as any,
        statut: {inq: ['publie', 'en_attente']} as any,
      });
      if (nbActives.count >= maxAnnonces) {
        throw new HttpErrors.Forbidden(JSON.stringify({
          code:             'QUOTA_ATTEINT',
          message:          `L'agence a atteint sa limite de ${maxAnnonces} annonces.`,
          upgrade_required: true,
          plan_actuel:      plan,
          limite:           maxAnnonces,
        }));
      }
    }

    // Quota photos — basé sur le plan de l'agence si membre
    const maxPhotos = (planSource.limites as any)?.max_photos_par_annonce ?? 10;
    const nbPhotos = (body.photos ?? []).length;
    if (maxPhotos !== null && nbPhotos > maxPhotos) {
      throw new HttpErrors.Forbidden(JSON.stringify({
        code:    'LIMITE_PHOTOS_ATTEINTE',
        message: `Le plan ${plan} est limité à ${maxPhotos} photos par annonce.`,
        limite:  maxPhotos,
        upgrade_required: plan === 'gratuit',
      }));
    }

    const finances: any = {};
    if (body.type_transaction === 'location' && body.loyer) {
      finances.loyer_mensuel_fcfa = body.loyer;
      finances.caution_mois       = body.caution_mois ?? 2;
      finances.avance_mois        = body.avance_mois  ?? 1;
      finances.total_entree_fcfa  = body.loyer * ((body.caution_mois ?? 2) + (body.avance_mois ?? 1));
    } else if (body.type_transaction === 'vente' && body.prix) {
      finances.prix_vente_fcfa = body.prix;
    }

    const medias = (body.photos ?? []).map((url, i) => ({
      url,
      type:          'photo',
      ordre:         i,
      est_principale: i === 0,
    }));

    const caracteristiques: any = {
      ...(body.caracteristiques ?? {}),
      ...(body.nb_chambres !== undefined ? {nb_chambres: body.nb_chambres} : {}),
      ...(body.surface      !== undefined ? {surface_m2:  body.surface}    : {}),
    };

    const bienData: Partial<Bien> = {
      courtier_id:      currentUser[securityId],
      titre:            body.titre,
      description:      body.description,
      type_bien:        body.type_bien,
      type_transaction: body.type_transaction,
      localisation:     {ville: body.ville, quartier: body.quartier} as any,
      finances:         finances,
      medias:           medias,
      caracteristiques: Object.keys(caracteristiques).length ? caracteristiques : undefined,
      statut:           'publie',
      date_publication: new Date(),
      date_expiration:  new Date(Date.now() + (plan === 'pro' ? 90 : plan === 'premium' ? 60 : 30) * 86400000),
      en_vedette:       false,
      stats: {nb_vues: 0, nb_contacts: 0, nb_favoris: 0, nb_partages_whatsapp: 0, nb_visites_360: 0} as any,
      createdAt:        new Date(),
      updatedAt:        new Date(),
    };

    bienData.reference = await this.bienRepository.generateReference(body.ville, body.type_bien);

    const createdBien = await this.bienRepository.create(bienData);
    console.log(`[creerBien] Bien créé id=${createdBien.id} statut=publie — déclenchement des alertes…`);

    this.userRepository.updateById(currentUser[securityId], {
      stats: {
        ...courtier.stats,
        nb_annonces_actives: (courtier.stats?.nb_annonces_actives ?? 0) + 1,
        nb_annonces_total:   (courtier.stats?.nb_annonces_total ?? 0) + 1,
      } as any,
    }).catch(() => {});

    // Déclencher les alertes acheteur (best-effort, même flux que changerStatut)
    this.alerteRepository.find({where: {active: true} as any}).then(alertes => {
      console.log(`[creerBien][Alertes] ${alertes.length} alerte(s) active(s) trouvée(s) en base`);
      return this.alerteService.notifierAlertes(createdBien, alertes);
    }).catch(err => {
      console.error('[creerBien][Alertes] Erreur lors du déclenchement des alertes:', err);
    });

    return diwaneBien(createdBien, courtier);
  }

  // ─── PATCH /api/biens/{id} — Modifier ────────────────────────────────────────

  @authenticate('jwt')
  @patch('/api/biens/{id}', {
    summary: '[Diwane] Modifier une annonce',
    responses: {'204': {description: 'Mise à jour effectuée'}},
  })
  async modifierBien(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              titre:            {type: 'string'},
              description:      {type: 'string'},
              ville:            {type: 'string'},
              quartier:         {type: 'string'},
              loyer:            {type: 'number'},
              prix:             {type: 'number'},
              nb_chambres:      {type: 'number'},
              surface:          {type: 'number'},
              photos:           {type: 'array', items: {type: 'string'}},
              caracteristiques: {type: 'object'},
              statut:           {type: 'string', enum: ['brouillon', 'en_attente', 'publie', 'archive']},
            },
          },
        },
      },
    })
    body: {
      titre?: string;
      description?: string;
      ville?: string;
      quartier?: string;
      loyer?: number;
      prix?: number;
      nb_chambres?: number;
      surface?: number;
      photos?: string[];
      caracteristiques?: object;
      statut?: string;
    },
  ): Promise<void> {
    const bien = await this.bienRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    const roles: string[] = (currentUser.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');

    if (!isAdmin && bien.courtier_id?.toString() !== currentUser[securityId]?.toString()) {
      throw new HttpErrors.Forbidden('Vous ne pouvez modifier que vos propres annonces.');
    }

    const update: Partial<Bien> = {updatedAt: new Date()};

    if (body.titre)       update.titre       = body.titre;
    if (body.description) update.description = body.description;

    // Si modification prix ou type → repasser en modération
    const prixModifie = body.loyer !== undefined || body.prix !== undefined;
    if (body.statut) {
      update.statut = body.statut;
    } else if (prixModifie && bien.statut === 'publie') {
      update.statut = 'en_attente'; // Re-modération
    }

    if (body.ville || body.quartier) {
      update.localisation = {
        ...bien.localisation,
        ...(body.ville    ? {ville:    body.ville}    : {}),
        ...(body.quartier ? {quartier: body.quartier} : {}),
      } as any;
    }

    if (prixModifie) {
      const f = {...bien.finances};
      if (body.loyer !== undefined) {
        f.loyer_mensuel_fcfa = body.loyer;
        const caution = f.caution_mois ?? 2;
        const avance  = f.avance_mois  ?? 1;
        f.total_entree_fcfa = body.loyer * (caution + avance);
      }
      if (body.prix !== undefined) f.prix_vente_fcfa = body.prix;
      update.finances = f as any;
    }

    if (body.photos) {
      update.medias = body.photos.map((url, i) => ({
        url, type: 'photo', ordre: i, est_principale: i === 0,
      }));
    }

    if (body.nb_chambres !== undefined || body.surface !== undefined || body.caracteristiques) {
      update.caracteristiques = {
        ...bien.caracteristiques,
        ...(body.caracteristiques ?? {}),
        ...(body.nb_chambres !== undefined ? {nb_chambres: body.nb_chambres} : {}),
        ...(body.surface      !== undefined ? {surface_m2:  body.surface}    : {}),
      } as any;
    }

    await this.bienRepository.updateById(id, update);
  }

  // ─── DELETE /api/biens/{id} — Archiver ───────────────────────────────────────

  @authenticate('jwt')
  @del('/api/biens/{id}', {
    summary: '[Diwane] Archiver une annonce',
    responses: {'204': {description: 'Archivé'}},
  })
  async archiverBien(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const bien = await this.bienRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });

    const roles: string[] = (currentUser.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');

    if (!isAdmin && bien.courtier_id?.toString() !== currentUser[securityId]?.toString()) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }

    await this.bienRepository.updateById(id, {
      statut:    'archive',
      updatedAt: new Date(),
    });
  }
}
