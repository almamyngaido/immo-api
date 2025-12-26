import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
import {BienImmo, Conversation, Message} from '../models';
import {
  BienImmoRepository,
  ConversationRepository,
  MessageRepository,
  UtilisateurRepository,
} from '../repositories';

export class ConversationController {
  constructor(
    @repository(ConversationRepository)
    public conversationRepository: ConversationRepository,
    @repository(MessageRepository)
    public messageRepository: MessageRepository,
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,
    @repository(UtilisateurRepository)
    public utilisateurRepository: UtilisateurRepository,
  ) {}

  /**
   * Create a new conversation
   * POST /conversations
   */
  @post('/conversations')
  @response(200, {
    description: 'Conversation model instance',
    content: {'application/json': {schema: getModelSchemaRef(Conversation)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bienImmoId', 'buyerId'],
            properties: {
              bienImmoId: {type: 'string'},
              buyerId: {type: 'string'},
              initialMessage: {type: 'string'},
            },
          },
        },
      },
    })
    data: {
      bienImmoId: string;
      buyerId: string;
      initialMessage?: string;
    },
  ): Promise<Conversation> {
    // Get the property to find the seller
    const property = await this.bienImmoRepository.findById(data.bienImmoId);
    const sellerId = property.utilisateurId;

    // Check if conversation already exists between these users for this property
    const existingConversations = await this.conversationRepository.find({
      where: {
        bienImmoId: data.bienImmoId,
      },
    });

    const existingConversation = existingConversations.find(
      conv =>
        conv.participantIds.includes(data.buyerId) &&
        conv.participantIds.includes(sellerId),
    );

    if (existingConversation) {
      // Return existing conversation
      return existingConversation;
    }

    // Create new conversation
    const conversation = await this.conversationRepository.create({
      bienImmoId: data.bienImmoId,
      participantIds: [data.buyerId, sellerId],
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      unreadCountBuyer: 0,
      unreadCountSeller: data.initialMessage ? 1 : 0,
      lastMessagePreview: data.initialMessage?.substring(0, 100),
    });

    // Create initial message if provided
    if (data.initialMessage) {
      await this.messageRepository.create({
        conversationId: conversation.id!,
        senderId: data.buyerId,
        content: data.initialMessage,
        timestamp: new Date().toISOString(),
        isRead: false,
      });
    }

    return conversation;
  }

  /**
   * Get all conversations
   * GET /conversations
   */
  @get('/conversations')
  @response(200, {
    description: 'Array of Conversation model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Conversation, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Conversation) filter?: Filter<Conversation>,
  ): Promise<Conversation[]> {
    return this.conversationRepository.find(filter);
  }

  /**
   * Get conversations for a specific user
   * GET /conversations/user/:userId
   */
  @get('/conversations/user/{userId}')
  @response(200, {
    description: 'Array of conversations for a user',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Conversation, {includeRelations: true}),
        },
      },
    },
  })
  async findByUser(
    @param.path.string('userId') userId: string,
    @param.filter(Conversation) filter?: Filter<Conversation>,
  ): Promise<any[]> {
    // Get all conversations and filter by participantIds in memory
    const allConversations = await this.conversationRepository.find({
      ...filter,
      include: [
        {
          relation: 'bienImmo',
        },
      ],
      order: ['lastMessageAt DESC'],
    });

    // Filter conversations where user is a participant
    const userConversations = allConversations.filter(conv =>
      conv.participantIds.includes(userId),
    );

    // Enhance conversations with participant user information
    const enhancedConversations = await Promise.all(
      userConversations.map(async conv => {
        // Get the other participant (not the current user)
        const otherParticipantId = conv.participantIds.find(
          id => id !== userId,
        );

        let otherParticipant = null;
        if (otherParticipantId) {
          try {
            // Fetch user details for the other participant
            otherParticipant = await this.utilisateurRepository.findById(
              otherParticipantId,
              {
                fields: ['id', 'nom', 'prenom', 'email', 'phoneNumber'],
              },
            );
          } catch (error) {
            console.error(
              `Error fetching user ${otherParticipantId}:`,
              error,
            );
          }
        }

        return {
          ...conv,
          otherParticipant,
        };
      }),
    );

    return enhancedConversations;
  }

  /**
   * Get a specific conversation by ID
   * GET /conversations/:id
   */
  @get('/conversations/{id}')
  @response(200, {
    description: 'Conversation model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Conversation, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Conversation, {exclude: 'where'})
    filter?: FilterExcludingWhere<Conversation>,
  ): Promise<Conversation> {
    return this.conversationRepository.findById(id, filter);
  }

  /**
   * Get messages in a conversation
   * GET /conversations/:id/messages
   */
  @get('/conversations/{id}/messages')
  @response(200, {
    description: 'Array of messages in a conversation',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Message, {includeRelations: true}),
        },
      },
    },
  })
  async getMessages(
    @param.path.string('id') id: string,
    @param.filter(Message) filter?: Filter<Message>,
  ): Promise<Message[]> {
    return this.messageRepository.find({
      ...filter,
      where: {
        ...filter?.where,
        conversationId: id,
      },
      include: [
        {
          relation: 'sender',
          scope: {
            fields: ['id', 'nom', 'prenom', 'email'],
          },
        },
      ],
      order: ['timestamp ASC'],
    });
  }

  /**
   * Mark conversation as read for a user
   * PATCH /conversations/:id/mark-read
   */
  @patch('/conversations/{id}/mark-read')
  @response(200, {
    description: 'Conversation marked as read',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: {type: 'boolean'},
            markedCount: {type: 'number'},
          },
        },
      },
    },
  })
  async markAsRead(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['userId'],
            properties: {
              userId: {type: 'string'},
            },
          },
        },
      },
    })
    data: {userId: string},
  ): Promise<{success: boolean; markedCount: number}> {
    const conversation = await this.conversationRepository.findById(id);
    const isBuyer = conversation.participantIds[0] === data.userId;

    // Mark all unread messages as read
    const messages = await this.messageRepository.find({
      where: {
        conversationId: id,
        senderId: {neq: data.userId}, // Messages not sent by this user
        isRead: false,
      },
    });

    const updatePromises = messages.map(msg =>
      this.messageRepository.updateById(msg.id!, {
        isRead: true,
        readAt: new Date().toISOString(),
      }),
    );

    await Promise.all(updatePromises);

    // Update conversation unread count
    if (isBuyer) {
      await this.conversationRepository.updateById(id, {
        unreadCountBuyer: 0,
      });
    } else {
      await this.conversationRepository.updateById(id, {
        unreadCountSeller: 0,
      });
    }

    return {
      success: true,
      markedCount: messages.length,
    };
  }

  /**
   * Update a conversation
   * PATCH /conversations/:id
   */
  @patch('/conversations/{id}')
  @response(204, {
    description: 'Conversation PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Conversation, {partial: true}),
        },
      },
    })
    conversation: Partial<Conversation>,
  ): Promise<void> {
    await this.conversationRepository.updateById(id, conversation);
  }

  /**
   * Delete a conversation
   * DELETE /conversations/:id
   */
  @del('/conversations/{id}')
  @response(204, {
    description: 'Conversation DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    // Delete all messages in the conversation first
    await this.messageRepository.deleteAll({conversationId: id});
    // Then delete the conversation
    await this.conversationRepository.deleteById(id);
  }

  /**
   * Get unread count for a user
   * GET /conversations/user/:userId/unread-count
   */
  @get('/conversations/user/{userId}/unread-count')
  @response(200, {
    description: 'Total unread message count for user',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            totalUnread: {type: 'number'},
          },
        },
      },
    },
  })
  async getUnreadCount(
    @param.path.string('userId') userId: string,
  ): Promise<{totalUnread: number}> {
    const allConversations = await this.conversationRepository.find();

    // Filter conversations where user is a participant
    const conversations = allConversations.filter(conv =>
      conv.participantIds.includes(userId),
    );

    let totalUnread = 0;
    for (const conv of conversations) {
      const isBuyer = conv.participantIds[0] === userId;
      totalUnread += isBuyer ? conv.unreadCountBuyer : conv.unreadCountSeller;
    }

    return {totalUnread};
  }
}
