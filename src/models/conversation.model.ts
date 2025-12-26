import {belongsTo, Entity, hasMany, model, property} from '@loopback/repository';
import {BienImmo} from './bien-immo.model';
import {Message} from './message.model';

/**
 * Conversation model
 * Represents a message thread between a buyer and seller about a specific property
 */
@model({
  settings: {
    strict: true,
    indexes: {
      // Index for finding conversations by property
      bienImmoId: {keys: {bienImmoId: 1}},
      // Composite index for finding user's conversations sorted by last message
      userConversations: {keys: {participantIds: 1, lastMessageAt: -1}},
    },
  },
})
export class Conversation extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @belongsTo(() => BienImmo)
  bienImmoId: string;

  @property.array(String, {
    required: true,
  })
  participantIds: string[]; // [buyerId, sellerId]

  @property({
    type: 'date',
    default: () => new Date().toISOString(),
  })
  createdAt: string;

  @property({
    type: 'date',
    default: () => new Date().toISOString(),
  })
  lastMessageAt: string;

  @property({
    type: 'number',
    default: 0,
  })
  unreadCountBuyer: number; // Unread count for the buyer

  @property({
    type: 'number',
    default: 0,
  })
  unreadCountSeller: number; // Unread count for the seller

  @property({
    type: 'string',
  })
  lastMessagePreview?: string; // Preview of the last message (first 100 chars)

  @hasMany(() => Message)
  messages: Message[];

  constructor(data?: Partial<Conversation>) {
    super(data);
  }
}

export interface ConversationRelations {
  bienImmo?: BienImmo;
  messages?: Message[];
}

export type ConversationWithRelations = Conversation & ConversationRelations;
