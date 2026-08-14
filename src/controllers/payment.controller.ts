/**
 * DIWANE — PaymentController
 * Routes Wave Checkout : abonnements + boosts
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  get,
  HttpErrors,
  param,
  post,
  requestBody,
  Request,
  Response,
  RestBindings,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {getLimitesParPlan} from '../models';
import {BienRepository, TransactionRepository, UserRepository} from '../repositories';
import {WaveService} from '../services/wave.service';
import {appLinkInterstitialHtml, webAppUrl} from '../utils/app-link.utils';

function genRef(prefix: string, id: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const tail = id.slice(-6).toUpperCase();
  return `${prefix}-${tail}-${ts}`;
}

export class PaymentController {
  constructor(
    @inject('services.WaveService')
    private waveService: WaveService,
    @repository(UserRepository)
    private userRepo: UserRepository,
    @repository(TransactionRepository)
    private transactionRepo: TransactionRepository,
    @repository(BienRepository)
    private bienRepo: BienRepository,
  ) {}

  // ── POST /api/payments/abonnement/initier ────────────────────────────────────

  @authenticate('jwt')
  @post('/api/payments/abonnement/initier', {
    summary: '[Diwane] Initier un paiement d\'abonnement Wave',
    responses: {
      '200': {
        description: 'Session Wave créée',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                checkout_url:   {type: 'string'},
                transaction_id: {type: 'string'},
                reference:      {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async initierAbonnement(
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['plan'],
            properties: {plan: {type: 'string', enum: ['premium', 'pro']}},
          },
        },
      },
    })
    body: {plan: 'premium' | 'pro'},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{checkout_url: string; transaction_id: string; reference: string}> {
    const userId = currentUser[securityId];
    const courtier = await this.userRepo.findById(userId);

    if (courtier.role !== 'courtier') {
      throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    }

    // TODO(test-wave): remettre {premium: 10000, pro: 35000} après les tests de paiement réel.
    const montants: Record<string, number> = {premium: 20, pro: 50};
    const montant = montants[body.plan];
    const reference = genRef('SUB', userId);

    const transaction = await this.transactionRepo.create({
      user_id:    userId,
      type:       `abonnement_${body.plan}`,
      montant_fcfa: montant,
      methode:    'wave',
      numero_paiement: courtier.telephone,
      abonnement_plan: body.plan,
      statut:     'initiee',
      reference_externe: reference,
      createdAt:  new Date(),
      updatedAt:  new Date(),
      date_expiration_service: new Date(Date.now() + 30 * 86400000),
    } as any);

    const {checkout_url, wave_session_id} = await this.waveService.creerCheckoutSession({
      montant_fcfa: montant,
      description:  `Abonnement Diwane ${body.plan.charAt(0).toUpperCase() + body.plan.slice(1)} — 1 mois`,
      reference,
      transaction_id: transaction.id!,
      telephone_client: courtier.telephone,
    });

    await this.transactionRepo.updateById(transaction.id!, {
      wave_checkout_id: wave_session_id,
    } as any);

    return {checkout_url, transaction_id: transaction.id!, reference};
  }

  // ── POST /api/payments/boost/initier ─────────────────────────────────────────

  @authenticate('jwt')
  @post('/api/payments/boost/initier', {
    summary: '[Diwane] Initier un boost d\'annonce Wave',
    responses: {'200': {description: 'Session Wave créée'}},
  })
  async initierBoost(
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bien_id', 'duree_jours'],
            properties: {
              bien_id:     {type: 'string'},
              duree_jours: {type: 'number', enum: [3, 7, 14, 30]},
            },
          },
        },
      },
    })
    body: {bien_id: string; duree_jours: 3 | 7 | 14 | 30},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{checkout_url: string; transaction_id: string; reference: string}> {
    const userId = currentUser[securityId];
    const courtier = await this.userRepo.findById(userId);

    const bien = await this.bienRepo.findById(body.bien_id).catch(() => {
      throw new HttpErrors.NotFound('Annonce introuvable.');
    });
    if (String((bien as any).courtier_id) !== String(userId)) {
      throw new HttpErrors.Forbidden('Ce bien ne vous appartient pas.');
    }

    const tarifs: Record<number, number> = {3: 5000, 7: 10000, 14: 18000, 30: 35000};
    const montant = tarifs[body.duree_jours];
    if (!montant) throw new HttpErrors.BadRequest('Durée invalide. Choisir 3, 7, 14 ou 30 jours.');

    const reference = genRef('BST', body.bien_id);

    const transaction = await this.transactionRepo.create({
      user_id:    userId,
      bien_id:    body.bien_id,
      type:       'boost_annonce',
      montant_fcfa: montant,
      methode:    'wave',
      numero_paiement: courtier.telephone,
      boost_duree_jours: body.duree_jours,
      statut:     'initiee',
      reference_externe: reference,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    } as any);

    const {checkout_url, wave_session_id} = await this.waveService.creerCheckoutSession({
      montant_fcfa: montant,
      description:  `Boost annonce Diwane — ${body.duree_jours} jours (${(bien as any).reference ?? bien.id})`,
      reference,
      transaction_id: transaction.id!,
      telephone_client: courtier.telephone,
    });

    await this.transactionRepo.updateById(transaction.id!, {
      wave_checkout_id: wave_session_id,
    } as any);

    return {checkout_url, transaction_id: transaction.id!, reference};
  }

  // ── POST /api/webhooks/wave ───────────────────────────────────────────────────

  @post('/api/webhooks/wave', {
    summary: '[Diwane] Webhook Wave (paiement confirmé/échoué)',
    responses: {'200': {description: 'OK'}},
  })
  async webhookWave(
    @requestBody({
      content: {
        // Pas de schéma déclaré : LoopBack valide via AJV contre le schéma sinon
        // (or le parser 'raw' renvoie un Buffer, pas un string — la validation échouerait).
        'application/json': {'x-parser': 'raw'},
      },
    })
    rawBody: Buffer,
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<{received: boolean}> {
    // Valider la signature Wave sur les octets bruts exacts reçus (pas une re-sérialisation)
    const signature = req.headers['wave-signature'] as string ?? '';
    const rawPayload = rawBody.toString('utf8');
    const body = JSON.parse(rawPayload);

    // Le secret n'étant pas encore configuré partout, on ne bloque que s'il est présent :
    // dès que WAVE_WEBHOOK_SECRET est renseigné (même hors prod), une signature invalide est rejetée.
    if (process.env.WAVE_WEBHOOK_SECRET && !this.waveService.validerSignatureWebhook(rawPayload, signature)) {
      throw new HttpErrors.Unauthorized('Signature Wave invalide.');
    }

    const sessionId = body?.data?.id ?? body?.id;
    if (!sessionId) return {received: true};

    const transactions = await this.transactionRepo.find({
      where: {wave_checkout_id: sessionId} as any,
    });

    if (!transactions.length) {
      console.warn(`[Wave Webhook] transaction non trouvée pour session ${sessionId}`);
      return {received: true}; // Toujours 200 pour éviter les retries Wave
    }

    const transaction = transactions[0];
    const paymentStatus = body?.data?.payment_status ?? body?.payment_status;
    const isSuccess = paymentStatus === 'succeeded' ||
      body?.type === 'checkout.session.completed';

    await this.transactionRepo.updateById(transaction.id!, {
      statut:         isSuccess ? 'succes' : 'echec',
      date_paiement:  isSuccess ? new Date() : undefined,
      webhook_payload: body,
      updatedAt:      new Date(),
    } as any);

    if (isSuccess) {
      await this._confirmerPaiement(transaction);
    }

    return {received: true};
  }

  // ── GET /api/payments/wave/success ────────────────────────────────────────────

  @get('/api/payments/wave/success', {
    summary: '[Diwane] Redirection Wave → app après succès',
    responses: {'302': {description: 'Redirect'}},
  })
  async paiementSucces(
    @param.query.string('ref') ref: string,
    @param.query.string('tx') tx: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<void> {
    const deepLink = process.env.FLUTTER_DEEP_LINK ?? 'diwane://payment';
    const refParam = encodeURIComponent(ref ?? '');
    const txParam = encodeURIComponent(tx ?? '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(appLinkInterstitialHtml({
      appUrl: `${deepLink}/success?ref=${refParam}&tx=${txParam}`,
      webUrl: webAppUrl(`/diwane/payment-result?status=success&ref=${refParam}&tx=${txParam}`),
    }));
  }

  // ── GET /api/payments/wave/cancel ─────────────────────────────────────────────

  @get('/api/payments/wave/cancel', {
    summary: '[Diwane] Redirection Wave → app après annulation',
    responses: {'302': {description: 'Redirect'}},
  })
  async paiementAnnule(
    @param.query.string('ref') ref: string,
    @param.query.string('tx') tx: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<void> {
    const deepLink = process.env.FLUTTER_DEEP_LINK ?? 'diwane://payment';
    const refParam = encodeURIComponent(ref ?? '');
    const txParam = encodeURIComponent(tx ?? '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(appLinkInterstitialHtml({
      appUrl: `${deepLink}/cancel?ref=${refParam}&tx=${txParam}`,
      webUrl: webAppUrl(`/diwane/payment-result?status=cancel&ref=${refParam}&tx=${txParam}`),
    }));
  }

  // ── GET /api/payments/statut/:transactionId ───────────────────────────────────

  @authenticate('jwt')
  @get('/api/payments/statut/{transactionId}', {
    summary: '[Diwane] Vérifier le statut d\'un paiement',
    responses: {'200': {description: 'Statut'}},
  })
  async verifierStatut(
    @param.path.string('transactionId') transactionId: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{statut: string; type: string; montant_fcfa: number; date_paiement?: Date}> {
    const transaction = await this.transactionRepo.findById(transactionId).catch(() => {
      throw new HttpErrors.NotFound('Transaction introuvable.');
    });

    if (String((transaction as any).user_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden();
    }

    // Si en attente → vérifier auprès de Wave
    if (
      (transaction.statut === 'initiee' || transaction.statut === 'en_attente') &&
      (transaction as any).wave_checkout_id
    ) {
      try {
        const waveStatut = await this.waveService.verifierSession((transaction as any).wave_checkout_id);
        if (waveStatut.statut === 'succeeded') {
          await this.transactionRepo.updateById(transaction.id!, {
            statut: 'succes',
            date_paiement: new Date(),
            updatedAt: new Date(),
          } as any);
          await this._confirmerPaiement(transaction);
          transaction.statut = 'succes';
        } else if (waveStatut.statut === 'cancelled') {
          await this.transactionRepo.updateById(transaction.id!, {
            statut: 'echec',
            updatedAt: new Date(),
          } as any);
          transaction.statut = 'echec';
        }
      } catch (e) {
        console.error('[Payment] Erreur vérification Wave:', e);
      }
    }

    return {
      statut:        transaction.statut ?? 'initiee',
      type:          transaction.type,
      montant_fcfa:  transaction.montant_fcfa,
      date_paiement: transaction.date_paiement,
    };
  }

  // ── POST /api/payments/test/confirmer/:transactionId  (DEV uniquement) ──────────

  @authenticate('jwt')
  @post('/api/payments/test/confirmer/{transactionId}', {
    summary: '[Diwane][DEV] Confirmer manuellement une transaction de test',
    responses: {'200': {description: 'OK'}},
  })
  async confirmerTest(
    @param.path.string('transactionId') transactionId: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{ok: boolean}> {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PAYMENTS !== 'true') throw new HttpErrors.Forbidden();

    // Pour les faux IDs dev_ on crée une transaction factice en mémoire et on confirme
    if (transactionId.startsWith('dev_')) {
      const userId = currentUser[securityId];
      const user = await this.userRepo.findById(userId);
      const isBoost = transactionId.startsWith('dev_boost_');

      if (!isBoost) {
        // Extrait le plan depuis l'ID : dev_abo_premium_XXXX ou dev_abo_pro_XXXX
        const parts = transactionId.split('_'); // ['dev','abo','premium','ts'] ou ['dev','abo','pro','ts']
        const planExtrait = parts[2] === 'pro' ? 'pro' : 'premium';
        const plan = planExtrait as 'premium' | 'pro';
        const montants: Record<string, number> = {premium: 10000, pro: 35000};
        const limites = getLimitesParPlan(plan);
        await this.userRepo.updateById(userId, {
          abonnement: {
            plan,
            actif: true,
            prix_fcfa: montants[plan],
            date_debut: new Date(),
            date_fin: new Date(Date.now() + 30 * 86400000),
            paiement_methode: 'wave_test',
            transaction_id: transactionId,
          },
          badges: {...(user.badges as any), premium: true},
          limites,
          updatedAt: new Date(),
        } as any);
      }
      return {ok: true};
    }

    throw new HttpErrors.NotFound('Transaction introuvable.');
  }

  // ── Activer le service après paiement confirmé ────────────────────────────────

  private async _confirmerPaiement(transaction: any): Promise<void> {
    try {
      if (transaction.type?.startsWith('abonnement_')) {
        const plan = transaction.abonnement_plan as 'premium' | 'pro';
        const limites = getLimitesParPlan(plan);
        const dateDebut = new Date();
        const dateFin = new Date(Date.now() + 30 * 86400000);
        const user = await this.userRepo.findById(transaction.user_id);

        await this.userRepo.updateById(transaction.user_id, {
          abonnement: {
            plan,
            actif: true,
            prix_fcfa: transaction.montant_fcfa,
            date_debut: dateDebut,
            date_fin: dateFin,
            paiement_methode: 'wave',
            transaction_id: transaction.id,
          },
          badges: {...(user.badges as any), premium: true},
          limites,
          updatedAt: new Date(),
        } as any);
      }

      if (transaction.type === 'boost_annonce' && transaction.bien_id) {
        const dateFin = new Date(Date.now() + transaction.boost_duree_jours * 86400000);

        await this.bienRepo.updateById(transaction.bien_id, {
          boost: {
            actif: true,
            date_debut: new Date(),
            date_fin: dateFin,
            duree_jours: transaction.boost_duree_jours,
            prix_fcfa: transaction.montant_fcfa,
            type: 'standard',
            transaction_id: transaction.id,
          },
          en_vedette: true,
          updatedAt: new Date(),
        } as any);
      }
    } catch (e) {
      console.error('[Payment] Erreur _confirmerPaiement:', e);
    }
  }
}
