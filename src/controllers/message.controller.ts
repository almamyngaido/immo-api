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
import {Message} from '../models';
import {ConversationRepository, MessageRepository, UtilisateurRepository} from '../repositories';

export class MessageController {
  constructor(
    @repository(MessageRepository)
    public messageRepository: MessageRepository,
    @repository(ConversationRepository)
    public conversationRepository: ConversationRepository,
    @repository(UtilisateurRepository)
    public utilisateurRepository: UtilisateurRepository,
  ) {}

  /**
   * Send a new message
   * POST /messages
   */
  @post('/messages')
  @response(200, {
    description: 'Message model instance',
    content: {'application/json': {schema: getModelSchemaRef(Message)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['conversationId', 'senderId', 'content'],
            properties: {
              conversationId: {type: 'string'},
              senderId: {type: 'string'},
              content: {type: 'string', minLength: 1, maxLength: 5000},
            },
          },
        },
      },
    })
    data: {
      conversationId: string;
      senderId: string;
      content: string;
    },
  ): Promise<Message> {
    // Create the message
    const message = await this.messageRepository.create({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      timestamp: new Date().toISOString(),
      isRead: false,
    });

    // Update conversation's lastMessageAt and unread count
    const conversation = await this.conversationRepository.findById(
      data.conversationId,
    );

    const isBuyer = conversation.participantIds[0] === data.senderId;

    await this.conversationRepository.updateById(data.conversationId, {
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: data.content.substring(0, 100),
      // Increment unread count for the receiver
      unreadCountBuyer: isBuyer
        ? conversation.unreadCountBuyer
        : conversation.unreadCountBuyer + 1,
      unreadCountSeller: !isBuyer
        ? conversation.unreadCountSeller
        : conversation.unreadCountSeller + 1,
    });

    // TODO: Send email/SMS notification to receiver
    // await this.notificationService.sendMessageNotification(...)

    return message;
  }

  /**
   * Get count of messages matching a filter
   * GET /messages/count
   */
  @get('/messages/count')
  @response(200, {
    description: 'Message model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(@param.where(Message) where?: Where<Message>): Promise<Count> {
    return this.messageRepository.count(where);
  }

  /**
   * Get all messages
   * GET /messages
   */
  @get('/messages')
  @response(200, {
    description: 'Array of Message model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Message, {includeRelations: true}),
        },
      },
    },
  })
  async find(@param.filter(Message) filter?: Filter<Message>): Promise<Message[]> {
    return this.messageRepository.find(filter);
  }

  /**
   * Get a specific message by ID
   * GET /messages/:id
   */
  @get('/messages/{id}')
  @response(200, {
    description: 'Message model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Message, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Message, {exclude: 'where'})
    filter?: FilterExcludingWhere<Message>,
  ): Promise<Message> {
    return this.messageRepository.findById(id, filter);
  }

  /**
   * Mark a single message as read
   * PATCH /messages/:id/mark-read
   */
  @patch('/messages/{id}/mark-read')
  @response(204, {
    description: 'Message marked as read',
  })
  async markAsRead(@param.path.string('id') id: string): Promise<void> {
    await this.messageRepository.updateById(id, {
      isRead: true,
      readAt: new Date().toISOString(),
    });
  }

  /**
   * Update a message
   * PATCH /messages/:id
   */
  @patch('/messages/{id}')
  @response(204, {
    description: 'Message PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Message, {partial: true}),
        },
      },
    })
    message: Partial<Message>,
  ): Promise<void> {
    await this.messageRepository.updateById(id, message);
  }

  /**
   * Delete a message
   * DELETE /messages/:id
   */
  @del('/messages/{id}')
  @response(204, {
    description: 'Message DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.messageRepository.deleteById(id);
  }
}
