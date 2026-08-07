/**
 * CONTROLLER TRANSACTION — Paiements mobile money
 * Wave / Orange Money / Free Money
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
import {Transaction} from '../models';
import {BienRepository, TransactionRepository, UserRepository} from '../repositories';

export class TransactionController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepo: TransactionRepository,
    @repository(UserRepository)
    public userRepo: UserRepository,
    @repository(BienRepository)
    public bienRepo: BienRepository,
  ) {}

  // ─── Initier un paiement ────────────────────────────────────────────────────
  @authenticate('jwt')
  @post('/transactions', {
    summary: 'Initier un paiement (abonnement ou boost)',
    responses: {'201': {description: 'Transaction initiée'}},
  })
  async create(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['type', 'montant_fcfa', 'methode'],
            properties: {
              type: {type: 'string', enum: ['abonnement_premium', 'abonnement_pro', 'boost_annonce', 'service_premium']},
              montant_fcfa: {type: 'number'},
              methode: {type: 'string', enum: ['wave', 'orange_money', 'free_money']},
              numero_paiement: {type: 'string'},
              bien_id: {type: 'string'},
              boost_duree_jours: {type: 'number'},
              abonnement_plan: {type: 'string'},
            },
          },
        },
      },
    })
    data: Partial<Transaction>,
  ): Promise<Transaction> {
    data.user_id = currentUser[securityId];
    data.statut = 'initiee';
    data.createdAt = new Date();
    data.updatedAt = new Date();

    return this.transactionRepo.create(data);
  }

  // ─── Callback webhook Wave/Orange ──────────────────────────────────────────
  @post('/transactions/webhook', {
    summary: 'Webhook callback paiement mobile money',
    responses: {'200': {description: 'OK'}},
  })
  async webhook(
    @requestBody({content: {'application/json': {schema: {type: 'object'}}}})
    payload: object,
  ): Promise<{status: string}> {
    // Identifier la transaction via l'ID externe
    const p = payload as any;
    const externalId = p.id || p.transaction_id || p.checkout_id;
    if (!externalId) return {status: 'ignored'};

    const transaction = await this.transactionRepo.findOne({
      where: {
        or: [
          {reference_externe: externalId},
          {wave_checkout_id: externalId},
          {orange_transaction_id: externalId},
        ],
      } as any,
    });
    if (!transaction) return {status: 'not_found'};

    const isSuccess = p.status === 'succeeded' || p.status === 'SUCCESSFUL' || p.payment_status === 'success';
    const newStatut = isSuccess ? 'succes' : 'echec';

    await this.transactionRepo.updateById(transaction.id!, {
      statut: newStatut,
      date_paiement: isSuccess ? new Date() : undefined,
      webhook_payload: payload,
      updatedAt: new Date(),
    } as any);

    if (isSuccess) {
      await this.applyTransaction(transaction);
    }

    return {status: 'processed'};
  }

  // ─── Mes transactions (utilisateur connecté) ───────────────────────────────
  @authenticate('jwt')
  @get('/mes-transactions', {
    summary: 'Historique de mes paiements',
    responses: {'200': {description: 'Transactions'}},
  })
  async myTransactions(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.number('limit') limit = 20,
  ): Promise<Transaction[]> {
    return this.transactionRepo.find({
      where: {user_id: currentUser[securityId]} as any,
      limit,
      order: ['createdAt DESC'],
    });
  }

  // ─── Admin : toutes les transactions ───────────────────────────────────────
  @authenticate('jwt')
  @get('/transactions', {
    summary: 'Admin : toutes les transactions',
    responses: {'200': {description: 'Transactions'}},
  })
  async listAll(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('statut') statut?: string,
    @param.query.number('limit') limit = 50,
  ): Promise<Transaction[]> {
    const roles: string[] = (currentUser.roles as string[]) || [];
    if (!roles.some(r => String(r).toLowerCase() === 'admin')) {
      throw new HttpErrors.Forbidden('Accès admin requis.');
    }
    const where: any = {};
    if (statut) where.statut = statut;
    return this.transactionRepo.find({where, limit, order: ['createdAt DESC']});
  }

  // ─── Appliquer les effets d'une transaction réussie ─────────────────────────
  private async applyTransaction(transaction: Transaction): Promise<void> {
    try {
      if (transaction.type === 'abonnement_premium' || transaction.type === 'abonnement_pro') {
        const plan = transaction.type === 'abonnement_premium' ? 'premium' : 'pro';
        const dateDebut = new Date();
        const dateFin = new Date(dateDebut);
        dateFin.setMonth(dateFin.getMonth() + 1);
        const user = await this.userRepo.findById(transaction.user_id);

        await this.userRepo.updateById(transaction.user_id, {
          abonnement: {
            plan,
            actif: true,
            prix_fcfa: transaction.montant_fcfa,
            date_debut: dateDebut,
            date_fin: dateFin,
            paiement_methode: transaction.methode,
            transaction_id: transaction.id,
          } as any,
          badges: {...(user.badges as any), premium: true},
        } as any);
      } else if (transaction.type === 'boost_annonce' && transaction.bien_id) {
        const dateDebut = new Date();
        const dateFin = new Date(dateDebut);
        dateFin.setDate(dateFin.getDate() + (transaction.boost_duree_jours ?? 7));

        await this.bienRepo.updateById(transaction.bien_id, {
          boost: {
            actif: true,
            date_debut: dateDebut,
            date_fin: dateFin,
            duree_jours: transaction.boost_duree_jours,
            prix_fcfa: transaction.montant_fcfa,
            type: 'standard',
            transaction_id: transaction.id,
          } as any,
        });
      }
    } catch (e) {
      console.error('Erreur application transaction:', e);
    }
  }
}
