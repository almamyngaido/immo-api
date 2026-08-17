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
import {getLimitesParPlan, Transaction} from '../models';
import {BienRepository, TransactionRepository, UserRepository} from '../repositories';
import {WaveService} from '../services/wave.service';
import {diwaneEmail} from '../services/diwane-email.service';
import {smsService} from '../services/sms.service';
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
    summary: '[Diwane] Initier un paiement d\'abonnement (Wave pour Android/Web, Email+SMS pour iOS)',
    responses: {
      '200': {
        description: 'Session créée (Wave ou iOS pending)',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                checkout_url:   {type: 'string'},
                transaction_id: {type: 'string'},
                reference:      {type: 'string'},
                message:        {type: 'string'},
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
            properties: {
              plan:  {type: 'string', enum: ['premium', 'pro']},
              email: {type: 'string'},
              phone: {type: 'string'},
            },
          },
        },
      },
    })
    body: {plan: 'premium' | 'pro'; email?: string; phone?: string},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<any> {
    const userId = currentUser[securityId];
    const courtier = await this.userRepo.findById(userId);

    if (courtier.role !== 'courtier') {
      throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    }

    const platform = (req.headers['x-platform'] as string ?? '').toLowerCase();

    // iOS → Email + SMS
    if (platform === 'ios') {
      return await this._initierAbonnementIOS(body, courtier);
    }

    // Android/Web → Wave (existant)
    return await this._initierAbonnementWave(body, courtier);
  }

  // ── Flux iOS : Email + SMS ──────────────────────────────────────────────────
  private async _initierAbonnementIOS(
    body: {plan: 'premium' | 'pro'; email?: string; phone?: string},
    courtier: any,
  ): Promise<{transaction_id: string; message: string}> {
    const userId = courtier.id;
    const montants: Record<string, number> = {premium: 10000, pro: 35000};
    const montant = montants[body.plan];

    // Utiliser email/phone du body ou fallback sur l'utilisateur
    const email = body.email ?? courtier.email;
    const phone = body.phone ?? courtier.telephone;

    // Vérifier s'il y a déjà une transaction en attente
    const pending = await this._transactionPendanteRecente({
      user_id: userId,
      type: `abonnement_${body.plan}`,
      statut: {inq: ['pending_payment', 'initiee']},
    });
    if (pending) {
      return {
        transaction_id: pending.id!,
        message: 'Email et SMS déjà envoyés pour cette souscription',
      };
    }

    // Créer la transaction
    const transaction = await this.transactionRepo.create({
      user_id: userId,
      type: `abonnement_${body.plan}`,
      montant_fcfa: montant,
      methode: 'external_payment',
      numero_paiement: phone,
      abonnement_plan: body.plan,
      statut: 'pending_payment',
      createdAt: new Date(),
      updatedAt: new Date(),
      date_expiration_service: new Date(Date.now() + 30 * 86400000),
    } as any);

    // Lien de paiement (à remplacer par l'URL réelle du provider)
    const lienPaiement = `${process.env.EXTERNAL_PAYMENT_URL ?? 'https://paiement.diwane.sn'}/pay/${transaction.id}`;

    // Envoyer EMAIL
    try {
      await diwaneEmail.envoyerAbonnementIOS(
        email,
        courtier.prenom ?? courtier.nom ?? 'Utilisateur',
        body.plan,
        lienPaiement,
      );
    } catch (e) {
      console.error('[Payment] Erreur envoi email iOS:', e);
    }

    // Envoyer SMS
    try {
      const smsMessage = `Diwane: Finalisez votre abonnement ${body.plan} ici: ${lienPaiement}`;
      await smsService.envoyerSMS(phone, smsMessage, 'subscription');
    } catch (e) {
      console.error('[Payment] Erreur envoi SMS iOS:', e);
    }

    return {
      transaction_id: transaction.id!,
      message: 'Email et SMS envoyés pour finaliser votre paiement',
    };
  }

  // ── Flux Wave : Android/Web (existant) ──────────────────────────────────────
  private async _initierAbonnementWave(
    body: {plan: 'premium' | 'pro'},
    courtier: any,
  ): Promise<{checkout_url: string; transaction_id: string; reference: string}> {
    const userId = courtier.id;
    const montants: Record<string, number> = {premium: 10000, pro: 35000};
    const montant = montants[body.plan];

    const pending = await this._transactionPendanteRecente({
      user_id: userId,
      type: `abonnement_${body.plan}`,
    });
    if (pending) {
      return {
        checkout_url: pending.checkout_url!,
        transaction_id: pending.id!,
        reference: pending.reference_externe!,
      };
    }

    const reference = genRef('SUB', userId);

    const transaction = await this.transactionRepo.create({
      user_id: userId,
      type: `abonnement_${body.plan}`,
      montant_fcfa: montant,
      methode: 'wave',
      numero_paiement: courtier.telephone,
      abonnement_plan: body.plan,
      statut: 'initiee',
      reference_externe: reference,
      createdAt: new Date(),
      updatedAt: new Date(),
      date_expiration_service: new Date(Date.now() + 30 * 86400000),
    } as any);

    const {checkout_url, wave_session_id} = await this.waveService.creerCheckoutSession({
      montant_fcfa: montant,
      description: `Abonnement Diwane ${body.plan.charAt(0).toUpperCase() + body.plan.slice(1)} — 1 mois`,
      reference,
      transaction_id: transaction.id!,
      telephone_client: courtier.telephone,
    });

    await this.transactionRepo.updateById(transaction.id!, {
      wave_checkout_id: wave_session_id,
      checkout_url,
    } as any);

    return {checkout_url, transaction_id: transaction.id!, reference};
  }

  // ── Réutilise une session Wave encore valide plutôt que d'en créer une nouvelle ─
  // Évite de facturer deux fois le même abonnement/boost si le client réessaie
  // pendant qu'une session précédente est toujours ouverte côté Wave (~30 min).
  private async _transactionPendanteRecente(where: object): Promise<Transaction | undefined> {
    const seuil = new Date(Date.now() - 25 * 60 * 1000);
    const [pending] = await this.transactionRepo.find({
      where: {
        ...where,
        statut: {inq: ['initiee', 'en_attente']},
        wave_checkout_id: {neq: null},
        checkout_url: {neq: null},
        createdAt: {gte: seuil},
      } as any,
      order: ['createdAt DESC'],
      limit: 1,
    });
    return pending;
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

    // TODO(test-wave): remettre {3: 5000, 7: 10000, 14: 18000, 30: 35000} après les tests de paiement réel.
    const tarifs: Record<number, number> = {3: 20, 7: 30, 14: 40, 30: 50};
    const montant = tarifs[body.duree_jours];
    if (!montant) throw new HttpErrors.BadRequest('Durée invalide. Choisir 3, 7, 14 ou 30 jours.');

    const pendingBoost = await this._transactionPendanteRecente({
      user_id: userId,
      bien_id: body.bien_id,
      type: 'boost_annonce',
    });
    if (pendingBoost) {
      return {
        checkout_url:   pendingBoost.checkout_url!,
        transaction_id: pendingBoost.id!,
        reference:      pendingBoost.reference_externe!,
      };
    }

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
      checkout_url,
    } as any);

    return {checkout_url, transaction_id: transaction.id!, reference};
  }

  // ── POST /api/webhooks/wave (LEGACY) ──────────────────────────────────────────
  // Redirige vers le webhook unifié pour backward compatibility
  @post('/api/webhooks/wave', {
    summary: '[Diwane][LEGACY] Webhook Wave (redirige vers /webhooks/payment)',
    responses: {'200': {description: 'OK'}},
  })
  async webhookWave(
    @requestBody({
      content: {
        'application/json': {'x-parser': 'raw'},
      },
    })
    rawBody: Buffer,
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<{received: boolean}> {
    // Valider la signature Wave
    const signature = req.headers['wave-signature'] as string ?? '';
    const rawPayload = rawBody.toString('utf8');

    if (process.env.WAVE_WEBHOOK_SECRET && !this.waveService.validerSignatureWebhook(rawPayload, signature)) {
      throw new HttpErrors.Unauthorized('Signature Wave invalide.');
    }

    // Réutilise la logique du webhook unifié
    req.headers['x-payment-provider'] = 'wave';
    return await this.webhookPayment(Buffer.from(rawPayload), req);
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

  // ── POST /api/webhooks/payment (webhook unifié pour tous les providers) ────

  @post('/api/webhooks/payment', {
    summary: '[Diwane] Webhook paiement unifié (Wave, Stripe, PayPal, etc.)',
    responses: {'200': {description: 'OK'}},
  })
  async webhookPayment(
    @requestBody({
      content: {
        'application/json': {'x-parser': 'raw'},
      },
    })
    rawBody: Buffer,
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<{received: boolean}> {
    const rawPayload = rawBody.toString('utf8');
    const body = JSON.parse(rawPayload);

    // Identifier le provider
    const provider = (req.headers['x-payment-provider'] as string ?? 'wave').toLowerCase();

    // Trouver la transaction selon le provider
    let transaction;

    if (provider === 'wave') {
      // Wave: chercher par wave_checkout_id
      const sessionId = body?.data?.id ?? body?.id;
      if (!sessionId) return {received: true};

      const transactions = await this.transactionRepo.find({
        where: {wave_checkout_id: sessionId} as any,
      });

      if (!transactions.length) {
        console.warn(`[Webhook] transaction non trouvée pour session Wave ${sessionId}`);
        return {received: true};
      }
      transaction = transactions[0];
    } else {
      // Autres providers (Stripe, PayPal, iOS): chercher par transaction_id
      const transactionId = body?.metadata?.transaction_id ?? body?.transaction_id;
      if (!transactionId) return {received: true};

      transaction = await this.transactionRepo.findById(transactionId).catch(() => {
        console.warn(`[Webhook] transaction non trouvée pour ID ${transactionId}`);
        return null;
      });

      if (!transaction) return {received: true};
    }

    // Vérifier le succès selon le provider
    const isSuccess = this._checkPaymentSuccess(body, provider);

    // Mettre à jour la transaction
    await this.transactionRepo.updateById(transaction.id!, {
      statut: isSuccess ? 'succes' : 'echec',
      date_paiement: isSuccess ? new Date() : undefined,
      webhook_payload: body,
      updatedAt: new Date(),
    } as any);

    // Confirmer le paiement si succès
    if (isSuccess) {
      await this._confirmerPaiement(transaction);
    }

    console.log(`[Webhook ${provider}] transaction ${transaction.id} → ${isSuccess ? 'succes' : 'echec'}`);
    return {received: true};
  }

  // ── GET /api/payments/ios-success (redirect après paiement via lien email) ───
  // Endpoint pour redirection depuis le lien de paiement dans l'email/SMS
  @get('/api/payments/ios-success', {
    summary: '[Diwane] Redirect iOS après paiement (depuis lien email/SMS)',
    responses: {'200': {description: 'HTML avec deep link'}},
  })
  async confirmPaymentIOSRedirect(
    @param.query.string('transactionId') transactionId: string,
    @param.query.string('status') status: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<void> {
    if (!transactionId) {
      throw new HttpErrors.BadRequest('transactionId manquant');
    }

    const transaction = await this.transactionRepo.findById(transactionId).catch(() => {
      throw new HttpErrors.NotFound('Transaction introuvable.');
    });

    if (status === 'success') {
      // Confirmer le paiement
      await this.transactionRepo.updateById(transaction.id!, {
        statut: 'succes',
        date_paiement: new Date(),
        updatedAt: new Date(),
      } as any);

      await this._confirmerPaiement(transaction);

      // Retourner un deep link pour l'app
      const deepLink = `diwane://subscription/success?transactionId=${transaction.id}&plan=${(transaction as any).abonnement_plan}`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(appLinkInterstitialHtml({
        appUrl: deepLink,
        webUrl: webAppUrl(`/payment-result?status=success&transactionId=${encodeURIComponent(transactionId)}`),
      }));
    } else {
      // Marquer comme échoué
      await this.transactionRepo.updateById(transaction.id!, {
        statut: 'echec',
        updatedAt: new Date(),
      } as any);

      const deepLink = `diwane://subscription/failed?transactionId=${transaction.id}`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(appLinkInterstitialHtml({
        appUrl: deepLink,
        webUrl: webAppUrl(`/payment-result?status=failed&transactionId=${encodeURIComponent(transactionId)}`),
      }));
    }
  }

  // ── POST /api/payments/ios-confirm/:transactionId (DEV ONLY) ────────────────

  @post('/api/payments/ios-confirm/{transactionId}', {
    summary: '[Diwane][DEV] Confirmer manuellement un paiement iOS (dev/test)',
    responses: {'200': {description: 'OK'}},
  })
  async confirmPaymentIOSManual(
    @param.path.string('transactionId') transactionId: string,
  ): Promise<{ok: boolean}> {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PAYMENTS !== 'true') {
      throw new HttpErrors.Forbidden('Endpoint dev non disponible en production');
    }

    const transaction = await this.transactionRepo.findById(transactionId).catch(() => {
      throw new HttpErrors.NotFound('Transaction introuvable.');
    });

    await this.transactionRepo.updateById(transaction.id!, {
      statut: 'succes',
      date_paiement: new Date(),
      updatedAt: new Date(),
    } as any);

    await this._confirmerPaiement(transaction);

    return {ok: true};
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

  // ── Helper: Vérifier le succès du paiement selon le provider ───────────────

  private _checkPaymentSuccess(body: any, provider: string = 'wave'): boolean {
    switch (provider) {
      case 'wave':
        return body?.data?.payment_status === 'succeeded' ||
          body?.type === 'checkout.session.completed';
      case 'stripe':
        return body?.type === 'checkout.session.completed' ||
          body?.data?.object?.payment_status === 'paid';
      case 'paypal':
        return body?.event_type === 'CHECKOUT.ORDER.COMPLETED' &&
          body?.resource?.status === 'COMPLETED';
      default:
        return body?.status === 'succeeded';
    }
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
            paiement_methode: transaction.methode, // Utilise la vraie méthode (wave, stripe, external_payment, etc.)
            transaction_id: transaction.id,
          },
          badges: {...(user.badges as any), premium: true},
          limites,
          updatedAt: new Date(),
        } as any);

        // Le plan Pro inclut jusqu'à 7 comptes d'agence (voir agence.controller.ts) dont
        // l'accès est dérivé de celui du propriétaire — sans ça, un renouvellement du
        // propriétaire ne prolonge pas date_fin des membres, qui expirent seuls à leur
        // date de join même si le propriétaire est resté actif tout du long.
        if (plan === 'pro') {
          const membres = await this.userRepo.find({where: {agence_id: transaction.user_id} as any});
          await Promise.all(membres.map(membre => this.userRepo.updateById(membre.id!, {
            abonnement: {
              ...(membre as any).abonnement,
              plan: 'pro',
              actif: true,
              date_fin: dateFin,
              paiement_methode: 'agence',
            },
            limites,
            updatedAt: new Date(),
          } as any)));
        }
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
