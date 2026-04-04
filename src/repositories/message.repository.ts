/**
 * REPOSITORY MESSAGE — Plateforme Immobilière Sénégal
 * Remplace l'ancienne version liée à Conversation + Utilisateur
 */
import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Message, MessageRelations} from '../models';

export class MessageRepository extends DefaultCrudRepository<
  Message,
  typeof Message.prototype.id,
  MessageRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(Message, dataSource);
  }

  // Tous les messages d'une conversation, triés du plus récent
  async findByConversation(conversationId: string, limit = 50): Promise<Message[]> {
    return this.find({
      where: {conversation_id: conversationId} as any,
      order: ['createdAt DESC'],
      limit,
    });
  }

  // Nombre de messages non lus pour un destinataire
  async countUnread(destinataireId: string): Promise<number> {
    const result = await this.count({
      destinataire_id: destinataireId,
      lu: false,
    } as any);
    return result.count;
  }

  // Marque tous les messages d'une conversation comme lus pour un destinataire
  async markConversationAsRead(conversationId: string, destinataireId: string): Promise<void> {
    await this.updateAll(
      {lu: true, date_lecture: new Date()} as any,
      {conversation_id: conversationId, destinataire_id: destinataireId, lu: false} as any,
    );
  }
}
