/**
 * MODÈLE TRANSACTION — Paiements mobile money
 * Abonnements + Boosts via Wave / Orange Money / Free Money
 * Plateforme Immobilière Sénégal (LoopBack 4)
 */
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'transactions'},
    strict: false,
    indexes: {
      user_statut: {keys: {user_id: 1, statut: 1}},
      ref_externe: {keys: {reference_externe: 1}, options: {sparse: true}},
      wave_idx: {keys: {wave_checkout_id: 1}, options: {sparse: true}},
      statut_type: {keys: {statut: 1, type: 1}},
    },
  },
})
export class Transaction extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  user_id: string;

  @property({type: 'string', mongodb: {dataType: 'ObjectId'}})
  bien_id?: string; // Si boost annonce

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['abonnement_premium', 'abonnement_pro', 'boost_annonce', 'service_premium'],
    },
  })
  type: string;

  // Montant en FCFA (jamais USD pour éviter les frictions)
  @property({type: 'number', required: true})
  montant_fcfa: number;

  @property({type: 'number'})
  boost_duree_jours?: number; // 3, 7, 14, 30

  @property({type: 'string', jsonSchema: {enum: ['premium', 'pro']}})
  abonnement_plan?: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {enum: ['wave', 'orange_money', 'free_money']},
  })
  methode: string;

  @property({type: 'string', jsonSchema: {pattern: '^\\+221[37][0-9]{8}$'}})
  numero_paiement?: string; // Numéro mobile money utilisé

  // IDs retournés par les APIs Wave / Orange
  @property({type: 'string'})
  reference_externe?: string;

  @property({type: 'string'})
  wave_checkout_id?: string;

  @property({type: 'string'})
  checkout_url?: string;

  @property({type: 'string'})
  orange_transaction_id?: string;

  @property({
    type: 'string',
    default: 'initiee',
    jsonSchema: {enum: ['initiee', 'en_attente', 'succes', 'echec', 'rembourse']},
  })
  statut?: string;

  @property({type: 'date'})
  date_paiement?: Date;

  @property({type: 'date'})
  date_expiration_service?: Date; // Fin abonnement ou boost

  // Payload brut du webhook Wave/Orange
  @property({type: 'object'})
  webhook_payload?: object;

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {}
export type TransactionWithRelations = Transaction & TransactionRelations;
