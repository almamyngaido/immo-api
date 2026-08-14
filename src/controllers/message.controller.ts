/**
 * CONTROLLER MESSAGE — Chat courtier ↔ acheteur
 * Plateforme Immobilière Sénégal
 * conversation_id = `${userId1}_${userId2}_${bienId}` (tri alphabétique)
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
import {Message} from '../models';
import {MessageRepository} from '../repositories';

export class MessageController {
  constructor(
    @repository(MessageRepository)
    public messageRepository: MessageRepository,
  ) {}

  // ─── Construire conversation_id déterministe ────────────────────────────────
  static buildConversationId(userId1: string, userId2: string, bienId: string): string {
    const sorted = [userId1, userId2].sort();
    return `${sorted[0]}_${sorted[1]}_${bienId}`;
  }

  // ─── Envoyer un message ────────────────────────────────────────────────────
  @authenticate('jwt')
  @post('/messages', {
    summary: 'Envoyer un message à un courtier ou acheteur',
    responses: {'201': {description: 'Message envoyé'}},
  })
  async send(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['destinataire_id', 'contenu'],
            properties: {
              destinataire_id: {type: 'string'},
              bien_id: {type: 'string'},
              contenu: {type: 'string', maxLength: 1000},
              type: {type: 'string', enum: ['texte', 'image', 'document', 'proposition_visite']},
              media_url: {type: 'string'},
              proposition_visite: {
                type: 'object',
                properties: {
                  date: {type: 'string', format: 'date-time'},
                  acceptee: {type: 'boolean'},
                },
              },
            },
          },
        },
      },
    })
    data: {
      destinataire_id: string;
      bien_id?: string;
      contenu: string;
      type?: string;
      media_url?: string;
      proposition_visite?: {date?: string; acceptee?: boolean};
    },
  ): Promise<Message> {
    const expediteurId = currentUser[securityId];
    const conversationId = MessageController.buildConversationId(
      expediteurId,
      data.destinataire_id,
      data.bien_id ?? 'general',
    );

    return this.messageRepository.create({
      conversation_id: conversationId,
      bien_id: data.bien_id,
      expediteur_id: expediteurId,
      destinataire_id: data.destinataire_id,
      contenu: data.contenu,
      type: data.type ?? 'texte',
      media_url: data.media_url,
      proposition_visite: data.proposition_visite as any,
      lu: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ─── Lire une conversation ─────────────────────────────────────────────────
  @authenticate('jwt')
  @get('/messages/conversation/{destinataireId}', {
    summary: 'Lire les messages d\'une conversation',
    responses: {'200': {description: 'Messages'}},
  })
  async getConversation(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('destinataireId') destinataireId: string,
    @param.query.string('bien_id') bienId?: string,
    @param.query.number('limit') limit = 50,
  ): Promise<Message[]> {
    const conversationId = MessageController.buildConversationId(
      currentUser[securityId],
      destinataireId,
      bienId ?? 'general',
    );

    const messages = await this.messageRepository.findByConversation(conversationId, limit);

    // Marquer les messages reçus comme lus
    await this.messageRepository.markConversationAsRead(conversationId, currentUser[securityId]);

    return messages;
  }

  // ─── Mes conversations (liste) ─────────────────────────────────────────────
  @authenticate('jwt')
  @get('/conversations', {
    summary: 'Mes conversations actives',
    responses: {'200': {description: 'Conversations'}},
  })
  async myConversations(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{conversation_id: string; dernier_message: Message; non_lus: number}[]> {
    const userId = currentUser[securityId];

    // Tous les messages impliquant cet utilisateur
    const messages = await this.messageRepository.find({
      where: {
        or: [
          {expediteur_id: userId} as any,
          {destinataire_id: userId} as any,
        ],
      },
      order: ['createdAt DESC'],
      limit: 200,
    });

    // Grouper par conversation_id et garder le dernier message
    const conversationMap = new Map<string, Message>();
    const unreadMap = new Map<string, number>();

    for (const msg of messages) {
      if (!conversationMap.has(msg.conversation_id)) {
        conversationMap.set(msg.conversation_id, msg);
      }
      if (String(msg.destinataire_id) === String(userId) && !msg.lu) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) ?? 0) + 1);
      }
    }

    return Array.from(conversationMap.entries()).map(([id, msg]) => ({
      conversation_id: id,
      dernier_message: msg,
      non_lus: unreadMap.get(id) ?? 0,
    }));
  }

  // ─── Nombre de messages non lus ────────────────────────────────────────────
  @authenticate('jwt')
  @get('/messages/unread-count', {
    summary: 'Nombre de messages non lus',
    responses: {'200': {description: 'Compteur'}},
  })
  async unreadCount(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{count: number}> {
    const count = await this.messageRepository.countUnread(currentUser[securityId]);
    return {count};
  }

  // ─── Marquer un message comme lu ──────────────────────────────────────────
  @authenticate('jwt')
  @patch('/messages/{id}/read', {
    summary: 'Marquer un message comme lu',
    responses: {'204': {description: 'Marqué comme lu'}},
  })
  async markAsRead(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    const msg = await this.messageRepository.findById(id);
    if (String(msg.destinataire_id) !== String(currentUser[securityId])) {
      throw new HttpErrors.Forbidden('Non autorisé.');
    }
    await this.messageRepository.updateById(id, {lu: true, date_lecture: new Date()});
  }
}
