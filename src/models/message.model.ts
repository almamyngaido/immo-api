/**
 * MODÈLE MESSAGE — Chat intégré courtier ↔ acheteur
 * conversation_id = `${userId1}_${userId2}_${bienId}` (trié alphabétiquement)
 * Plateforme Immobilière Sénégal (LoopBack 4)
 * Remplace : message.model.ts (ancienne version liée à Conversation)
 */
import {Entity, model, property} from '@loopback/repository';

@model()
class PropositionVisite {
  @property({type: 'date'})
  date?: Date;

  @property({type: 'boolean'})
  acceptee?: boolean;
}

@model({
  settings: {
    mongodb: {collection: 'messages'},
    strict: false,
    indexes: {
      conversation_date: {keys: {conversation_id: 1, createdAt: -1}},
      destinataire_lu: {keys: {destinataire_id: 1, lu: 1}},
    },
  },
})
export class Message extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  // conversation_id = ${userId1}_${userId2}_${bienId} (tri alphabétique)
  @property({type: 'string', required: true, index: true})
  conversation_id: string;

  @property({type: 'string', mongodb: {dataType: 'ObjectId'}})
  bien_id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  expediteur_id: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  destinataire_id: string;

  @property({type: 'string', required: true, jsonSchema: {maxLength: 1000}})
  contenu: string;

  @property({
    type: 'string',
    default: 'texte',
    jsonSchema: {enum: ['texte', 'image', 'document', 'proposition_visite']},
  })
  type?: string;

  @property({type: 'string'})
  media_url?: string; // URL CDN si image ou document

  @property({type: 'object'})
  proposition_visite?: PropositionVisite;

  @property({type: 'boolean', default: false})
  lu?: boolean;

  @property({type: 'date'})
  date_lecture?: Date;

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<Message>) {
    super(data);
  }
}

export interface MessageRelations {}
export type MessageWithRelations = Message & MessageRelations;
