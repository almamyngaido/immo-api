/**
 * MODÈLE DEMANDE DE CONTACT
 * Quand un acheteur clique "Contacter le courtier" sur une annonce
 * Plateforme Immobilière Sénégal (LoopBack 4)
 */
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'demandes_contact'},
    strict: false,
    indexes: {
      courtier_statut: {keys: {courtier_id: 1, statut: 1}},
      bien_idx: {keys: {bien_id: 1}},
      acheteur_idx: {keys: {acheteur_id: 1}},
      code_visite_idx: {keys: {code_visite: 1}, options: {sparse: true}},
    },
  },
})
export class DemandeContact extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  bien_id: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  courtier_id: string;

  // null si non connecté
  @property({type: 'string', mongodb: {dataType: 'ObjectId'}})
  acheteur_id?: string;

  // Coordonnées si l'acheteur n'est pas connecté
  @property({type: 'string'})
  contact_nom?: string;

  @property({
    type: 'string',
    jsonSchema: {pattern: '^\\+221[37][0-9]{8}$'},
  })
  contact_telephone?: string;

  @property({type: 'string'})
  contact_email?: string;

  @property({type: 'string', jsonSchema: {maxLength: 500}})
  message?: string;

  @property({
    type: 'string',
    default: 'information',
    jsonSchema: {enum: ['information', 'visite', 'offre']},
  })
  type_demande?: string;

  @property({type: 'date'})
  date_visite_souhaitee?: Date;

  @property({
    type: 'string',
    default: 'nouvelle',
    jsonSchema: {
      enum: ['nouvelle', 'vue', 'en_cours', 'visite_planifiee', 'cloturee', 'annulee'],
    },
  })
  statut?: string;

  // Canal de réponse préféré du courtier
  @property({type: 'string', jsonSchema: {enum: ['chat', 'telephone', 'whatsapp']}})
  reponse_canal?: string;

  @property({type: 'date'})
  date_reponse?: Date;

  @property({type: 'number'})
  heure_reponse_minutes?: number; // Pour calcul badge ultra_reactif

  // QR code généré après visite physique planifiée
  @property({type: 'string', index: {unique: true, sparse: true}})
  code_visite?: string;

  @property({type: 'boolean', default: false})
  visite_effectuee?: boolean;

  @property({type: 'date'})
  date_visite_reelle?: Date;

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<DemandeContact>) {
    super(data);
  }
}

export interface DemandeContactRelations {}
export type DemandeContactWithRelations = DemandeContact & DemandeContactRelations;
