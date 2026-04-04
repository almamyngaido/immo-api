/**
 * DIWANE — VerificationController
 * Vérification CNI des courtiers via Firebase Storage privé.
 *
 * POST /api/courtiers/verification/soumettre  (JWT, courtier)
 * GET  /api/courtiers/verification/statut     (JWT, courtier)
 * GET  /api/admin/courtiers/:id/verification/documents  (JWT, admin) → URLs signées 1h
 * PATCH /api/admin/courtiers/:id/verification (JWT, admin) → approuver / rejeter
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
  Request,
  requestBody,
  Response,
  RestBindings,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import multer from 'multer';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {AvisRepository, BienRepository, UserRepository} from '../repositories';
import {FirebaseStorageService, verifyLocalToken} from '../services/firebase-storage.service';

// ── Multer en mémoire temporaire (os.tmpdir) ──────────────────────────────────

const upload = multer({
  dest: os.tmpdir(),
  limits: {fileSize: 10 * 1024 * 1024, files: 3},
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(file.mimetype) || allowedExt.includes(ext));
  },
});

function runMulter(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.fields([
      {name: 'cni_recto', maxCount: 1},
      {name: 'cni_verso', maxCount: 1},
      {name: 'registre_commerce', maxCount: 1},
    ])(req as any, res as any, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Controller ────────────────────────────────────────────────────────────────

export class VerificationController {
  constructor(
    @repository(UserRepository)
    private userRepo: UserRepository,
    @repository(BienRepository)
    private bienRepo: BienRepository,
    @repository(AvisRepository)
    private avisRepo: AvisRepository,
    @inject('services.FirebaseStorageService')
    private storage: FirebaseStorageService,
  ) {}

  // ── POST /api/courtiers/verification/soumettre ────────────────────────────

  @authenticate('jwt')
  @post('/api/courtiers/verification/soumettre', {
    summary: '[Diwane] Soumettre CNI pour vérification',
    responses: {'200': {description: 'Documents soumis'}},
  })
  async soumettre(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{message: string}> {
    const userId = currentUser[securityId];
    const courtier = await this.userRepo.findById(userId);

    if (courtier.role !== 'courtier') {
      throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    }
    if ((courtier.verification as any)?.statut === 'verifie') {
      throw new HttpErrors.Conflict('Compte déjà vérifié.');
    }

    // Parser le multipart
    await runMulter(req, res);
    const files = (req as any).files as Record<string, Express.Multer.File[]>;

    if (!files?.cni_recto?.[0] || !files?.cni_verso?.[0]) {
      throw new HttpErrors.UnprocessableEntity('cni_recto et cni_verso sont obligatoires.');
    }

    if (!this.storage.isConfigured()) {
      throw new HttpErrors.ServiceUnavailable('Stockage de documents non configuré. Contactez le support.');
    }

    // Upload vers Firebase Storage (bucket privé)
    const [rectoPath, versoPath, registrePath] = await Promise.all([
      this.storage.uploadCniDocument({
        localFilePath: files.cni_recto[0].path,
        userId,
        documentType: 'cni_recto',
        mimeType: files.cni_recto[0].mimetype,
      }),
      this.storage.uploadCniDocument({
        localFilePath: files.cni_verso[0].path,
        userId,
        documentType: 'cni_verso',
        mimeType: files.cni_verso[0].mimetype,
      }),
      files.registre_commerce?.[0]
        ? this.storage.uploadCniDocument({
            localFilePath: files.registre_commerce[0].path,
            userId,
            documentType: 'registre_commerce',
            mimeType: files.registre_commerce[0].mimetype,
          })
        : Promise.resolve(undefined),
    ]);

    // Mettre à jour le profil
    await this.userRepo.updateById(userId, {
      verification: {
        statut: 'en_attente',
        cni_recto_path: rectoPath,
        cni_verso_path: versoPath,
        ...(registrePath ? {registre_commerce_path: registrePath} : {}),
        date_soumission: new Date(),
      } as any,
      updatedAt: new Date(),
    } as any);

    console.log(`[Verification] CNI soumis — courtier ${userId}`);
    return {message: 'Documents soumis. Vérification sous 24–48h.'};
  }

  // ── GET /api/courtiers/verification/statut ────────────────────────────────

  @authenticate('jwt')
  @get('/api/courtiers/verification/statut', {
    summary: '[Diwane] Statut de vérification du courtier connecté',
    responses: {'200': {description: 'Statut vérification'}},
  })
  async monStatut(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object> {
    const user = await this.userRepo.findById(currentUser[securityId]);
    const v = (user.verification as any) ?? {};
    return {
      statut:           v.statut ?? 'non_soumis',
      date_soumission:  v.date_soumission,
      date_validation:  v.date_validation,
      admin_note:       v.admin_note,
    };
  }

  // ── GET /api/admin/verifications — Liste des courtiers en attente ─────────

  @authenticate('jwt')
  @get('/api/admin/verifications', {
    summary: '[Admin] Liste des courtiers avec vérification en attente',
    responses: {'200': {description: 'Liste courtiers'}},
  })
  async listeVerifications(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    this._assertAdmin(currentUser);
    const courtiers = await this.userRepo.find({
      where: {role: 'courtier'} as any,
      fields: {
        id: true, prenom: true, nom: true, email: true,
        telephone: true, verification: true, badges: true, createdAt: true,
      } as any,
    });
    return courtiers
      .filter((c: any) => (c.verification as any)?.statut)
      .map((c: any) => {
        const v = (c.verification as any) ?? {};
        return {
          id: c.id,
          prenom: c.prenom,
          nom: c.nom,
          email: c.email,
          telephone: c.telephone,
          statut_verification: v.statut,
          date_soumission: v.date_soumission,
          date_validation: v.date_validation,
          admin_note: v.admin_note,
          badge_verifie: (c.badges as any)?.verifie ?? false,
          createdAt: c.createdAt,
        };
      })
      .sort((a: any, b: any) =>
        new Date(b.date_soumission ?? 0).getTime() - new Date(a.date_soumission ?? 0).getTime()
      );
  }

  // ── GET /api/admin/courtiers/:id/verification/documents (admin) ───────────

  @authenticate('jwt')
  @get('/api/admin/courtiers/{id}/verification/documents', {
    summary: '[Admin] URLs signées 1h pour les documents CNI',
    responses: {'200': {description: 'URLs signées'}},
  })
  async documentsAdmin(
    @param.path.string('id') id: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object> {
    this._assertAdmin(currentUser);

    const user = await this.userRepo.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Courtier introuvable.');
    });

    const v = (user.verification as any) ?? {};
    if (!v.cni_recto_path) {
      throw new HttpErrors.NotFound('Aucun document soumis.');
    }

    // Générer les URLs signées (expire dans 1h)
    const [cniRecto, cniVerso, registre] = await Promise.all([
      this.storage.genererUrlSignee(v.cni_recto_path),
      this.storage.genererUrlSignee(v.cni_verso_path),
      v.registre_commerce_path
        ? this.storage.genererUrlSignee(v.registre_commerce_path)
        : Promise.resolve(null),
    ]);

    return {
      cni_recto_url:            cniRecto,
      cni_verso_url:            cniVerso,
      registre_commerce_url:    registre,
      expires_in_seconds:       3600,
      courtier: {
        id:        user.id,
        prenom:    user.prenom,
        nom:       user.nom,
        email:     user.email,
        statut_verification: v.statut ?? 'non_soumis',
        date_soumission: v.date_soumission,
      },
    };
  }

  // ── PATCH /api/admin/courtiers/:id/verification (admin) ──────────────────

  @authenticate('jwt')
  @patch('/api/admin/courtiers/{id}/verification', {
    summary: '[Admin] Approuver ou rejeter une vérification CNI',
    responses: {'200': {description: 'Mise à jour OK'}},
  })
  async validerVerification(
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statut'],
            properties: {
              statut:     {type: 'string', enum: ['verifie', 'rejete']},
              admin_note: {type: 'string'},
            },
          },
        },
      },
    })
    body: {statut: 'verifie' | 'rejete'; admin_note?: string},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{ok: boolean}> {
    this._assertAdmin(currentUser);

    if (body.statut === 'rejete' && !body.admin_note?.trim()) {
      throw new HttpErrors.UnprocessableEntity('admin_note obligatoire en cas de rejet.');
    }

    const user = await this.userRepo.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Courtier introuvable.');
    });

    const verificationUpdate: any = {
      ...(user.verification as any),
      statut: body.statut,
      date_validation: new Date(),
      ...(body.admin_note ? {admin_note: body.admin_note} : {}),
    };

    await this.userRepo.updateById(id, {
      verification: verificationUpdate,
      badges: {
        ...(user.badges as any),
        verifie: body.statut === 'verifie',
      },
      updatedAt: new Date(),
    } as any);

    console.log(`[Verification] Courtier ${id} → ${body.statut} par admin ${currentUser[securityId]}`);
    return {ok: true};
  }

  // ── GET /api/admin/cni/view/:token — Servir un fichier CNI local ────────────
  // URL signée locale (mode dev) — expire 1h

  @get('/api/admin/cni/view/{token}', {
    summary: '[Admin][Dev] Visualiser un document CNI local via token signé',
    responses: {
      '200': {
        description: 'Fichier image',
        content: {'application/octet-stream': {schema: {type: 'string', format: 'binary'}}},
      },
    },
  })
  async viewLocalCni(
    @param.path.string('token') token: string,
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<Response> {
    const relativePath = verifyLocalToken(token);
    if (!relativePath) {
      (res as any).status(403).json({error: 'Token invalide ou expiré.'});
      return res;
    }

    const absPath = path.join(__dirname, '../../uploads', relativePath);
    if (!fs.existsSync(absPath)) {
      (res as any).status(404).json({error: 'Fichier introuvable.'});
      return res;
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png',  '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    const mime = mimeMap[ext] ?? 'application/octet-stream';
    (res as any).status(200);
    (res as any).setHeader('Content-Type', mime);
    (res as any).setHeader('Cache-Control', 'no-store');
    fs.createReadStream(absPath).pipe(res as any);
    return res;
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  // ── GET /api/admin/stats ─────────────────────────────────────────────────

  @authenticate('jwt')
  @get('/api/admin/stats', {
    summary: '[Admin] Statistiques générales du dashboard',
    responses: {'200': {description: 'Stats'}},
  })
  async stats(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object> {
    this._assertAdmin(currentUser);

    const [courtiers, biens, avis] = await Promise.all([
      this.userRepo.find({where: {role: 'courtier'} as any}),
      this.bienRepo.count({statut: 'publie'} as any),
      this.avisRepo.count({statut: 'en_attente'} as any),
    ]);

    const nb_verifications_en_attente = courtiers.filter(
      (c: any) => ['en_attente', 'en_cours'].includes((c.verification as any)?.statut)
    ).length;
    const nb_courtiers_verifies = courtiers.filter(
      (c: any) => (c.verification as any)?.statut === 'verifie'
    ).length;

    // Revenus du mois en cours
    const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const transactions = await (this.userRepo.dataSource as any)
      .connector.collection('Transaction')
      .find({statut: 'complete', createdAt: {$gte: debutMois}})
      .toArray().catch(() => []);
    const revenus_mois = transactions.reduce((sum: number, t: any) => sum + (t.montant_fcfa || 0), 0);

    return {
      nb_courtiers: courtiers.length,
      nb_verifications_en_attente,
      nb_courtiers_verifies,
      nb_biens_actifs: biens.count,
      nb_avis_en_attente: avis.count,
      revenus_mois,
    };
  }

  // ── GET /api/admin/avis ───────────────────────────────────────────────────

  @authenticate('jwt')
  @get('/api/admin/avis', {
    summary: '[Admin] Liste des avis à modérer',
    responses: {'200': {description: 'Avis'}},
  })
  async listeAvis(
    @param.query.string('statut') statut: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    this._assertAdmin(currentUser);
    const where: any = {};
    if (statut && statut !== 'tous') where.statut = statut;
    const avis = await this.avisRepo.find({
      where,
      order: ['createdAt DESC'],
      limit: 100,
    });

    // Enrich with courtier name
    const enriched = await Promise.all(avis.map(async (a: any) => {
      let courtier_prenom = '', courtier_nom = '';
      try {
        const c = await this.userRepo.findById(a.courtier_id);
        courtier_prenom = c.prenom ?? '';
        courtier_nom = c.nom ?? '';
      } catch (_) {}
      return {...a, courtier_prenom, courtier_nom};
    }));
    return enriched;
  }

  // ── PATCH /api/admin/avis/:id ────────────────────────────────────────────

  @authenticate('jwt')
  @patch('/api/admin/avis/{id}', {
    summary: '[Admin] Modérer un avis (publier / supprimer)',
    responses: {'200': {description: 'OK'}},
  })
  async modererAvis(
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {'application/json': {schema: {type: 'object', required: ['statut'],
        properties: {statut: {type: 'string', enum: ['publie', 'supprime']}}}}},
    })
    body: {statut: 'publie' | 'supprime'},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{ok: boolean}> {
    this._assertAdmin(currentUser);
    await this.avisRepo.updateById(id, {statut: body.statut} as any);
    return {ok: true};
  }

  private _assertAdmin(user: UserProfile): void {
    const roles: string[] = (user.roles as string[]) ?? [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin') ||
      String((user as any).role ?? '').toLowerCase() === 'admin';
    if (!isAdmin) throw new HttpErrors.Forbidden('Réservé aux administrateurs.');
  }
}
