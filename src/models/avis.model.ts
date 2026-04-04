/**
 * MODÈLE AVIS
 * Système post-visite : acheteur scanne QR → 24h après → invitation avis
 * Seuls les visiteurs ayant un code_visite validé peuvent noter
 * Plateforme Immobilière Sénégal (LoopBack 4)
 */
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'avis'},
    strict: false,
    indexes: {
      courtier_statut: {keys: {courtier_id: 1, statut: 1}},
      demande_unique: {keys: {demande_id: 1}, options: {unique: true}},
    },
  },
})
export class Avis extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  courtier_id: string;

  @property({type: 'string', mongodb: {dataType: 'ObjectId'}})
  bien_id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  auteur_id: string;

  // Un seul avis par demande de contact
  @property({type: 'string', required: true, index: {unique: true}, mongodb: {dataType: 'ObjectId'}})
  demande_id: string;

  // Notes détaillées 1-5
  @property({type: 'number', required: true, jsonSchema: {minimum: 1, maximum: 5}})
  note_globale: number;

  @property({type: 'number', jsonSchema: {minimum: 1, maximum: 5}})
  note_ponctualite?: number;

  @property({type: 'number', jsonSchema: {minimum: 1, maximum: 5}})
  note_information?: number; // Info du bien correspondait ?

  @property({type: 'number', jsonSchema: {minimum: 1, maximum: 5}})
  note_professionnalisme?: number;

  @property({type: 'string', jsonSchema: {maxLength: 800}})
  commentaire?: string;

  @property({
    type: 'string',
    default: 'en_attente',
    jsonSchema: {enum: ['en_attente', 'publie', 'signale', 'supprime']},
  })
  statut?: string;

  @property({type: 'date'})
  date_moderation?: Date;

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<Avis>) {
    super(data);
  }
}

export interface AvisRelations {}
export type AvisWithRelations = Avis & AvisRelations;
