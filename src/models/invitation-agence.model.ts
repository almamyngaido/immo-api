import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'invitations_agence'},
    strict: false,
    indexes: {
      token_unique: {keys: {token: 1}, options: {unique: true}},
      email_idx:    {keys: {email_invite: 1}},
      agence_idx:   {keys: {agence_id: 1}},
    },
  },
})
export class InvitationAgence extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  // Propriétaire de l'agence (courtier Pro)
  @property({type: 'string', required: true})
  agence_id: string;

  @property({type: 'string', required: true})
  agence_nom: string;  // nom de l'agence au moment de l'invitation

  @property({type: 'string', required: true})
  proprietaire_nom: string;

  // Invité
  @property({type: 'string', required: true})
  email_invite: string;

  @property({type: 'string'})
  prenom_invite?: string;

  @property({type: 'string'})
  nom_invite?: string;

  // Si l'invité a déjà un compte : son user_id
  @property({type: 'string'})
  user_id_existant?: string;

  // Token unique pour le lien d'invitation
  @property({type: 'string', required: true})
  token: string;

  // Statut
  @property({
    type: 'string',
    required: true,
    default: 'en_attente',
    jsonSchema: {enum: ['en_attente', 'acceptee', 'refusee', 'expiree']},
  })
  statut: string;

  @property({type: 'date', required: true})
  expires_at: Date;

  @property({type: 'date'})
  repondu_at?: Date;

  @property({type: 'date'})
  createdAt?: Date;

  constructor(data?: Partial<InvitationAgence>) {
    super(data);
  }
}

export interface InvitationAgenceRelations {}
export type InvitationAgenceWithRelations = InvitationAgence & InvitationAgenceRelations;
