import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Conversation} from './conversation.model';
import {Utilisateur} from './utilisateur.model';

/**
 * Message model
 * Represents a single message in a conversation
 */
@model({
  settings: {
    strict: true,
    indexes: {
      // Index for finding messages in a conversation, sorted by timestamp
      conversationMessages: {keys: {conversationId: 1, timestamp: 1}},
      // Index for finding unread messages by user
      unreadMessages: {keys: {conversationId: 1, isRead: 1}},
    },
  },
})
export class Message extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @belongsTo(() => Conversation)
  conversationId: string;

  @belongsTo(() => Utilisateur)
  senderId: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      minLength: 1,
      maxLength: 5000, // Limit message length
    },
  })
  content: string;

  @property({
    type: 'date',
    default: () => new Date().toISOString(),
  })
  timestamp: string;

  @property({
    type: 'boolean',
    default: false,
  })
  isRead: boolean;

  @property({
    type: 'date',
  })
  readAt?: string; // When the message was read

  @property({
    type: 'string',
  })
  attachmentUrl?: string; // Optional: for future image attachments

  @property({
    type: 'string',
  })
  attachmentType?: string; // Optional: 'image', 'document', etc.

  constructor(data?: Partial<Message>) {
    super(data);
  }
}

export interface MessageRelations {
  conversation?: Conversation;
  sender?: Utilisateur;
}

export type MessageWithRelations = Message & MessageRelations;
