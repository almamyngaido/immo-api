import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Conversation, Message, MessageRelations, Utilisateur} from '../models';
import {ConversationRepository} from './conversation.repository';
import {UtilisateurRepository} from './utilisateur.repository';

export class MessageRepository extends DefaultCrudRepository<
  Message,
  typeof Message.prototype.id,
  MessageRelations
> {
  public readonly conversation: BelongsToAccessor<Conversation, typeof Message.prototype.id>;
  public readonly sender: BelongsToAccessor<Utilisateur, typeof Message.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
    @repository.getter('ConversationRepository') protected conversationRepositoryGetter: Getter<ConversationRepository>,
    @repository.getter('UtilisateurRepository') protected utilisateurRepositoryGetter: Getter<UtilisateurRepository>,
  ) {
    super(Message, dataSource);

    this.conversation = this.createBelongsToAccessorFor('conversation', conversationRepositoryGetter);
    this.registerInclusionResolver('conversation', this.conversation.inclusionResolver);

    this.sender = this.createBelongsToAccessorFor('sender', utilisateurRepositoryGetter);
    this.registerInclusionResolver('sender', this.sender.inclusionResolver);
  }
}
