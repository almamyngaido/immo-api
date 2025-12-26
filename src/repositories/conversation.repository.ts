import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, HasManyRepositoryFactory, repository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienImmo, Conversation, ConversationRelations, Message} from '../models';
import {BienImmoRepository} from './bien-immo.repository';
import {MessageRepository} from './message.repository';

export class ConversationRepository extends DefaultCrudRepository<
  Conversation,
  typeof Conversation.prototype.id,
  ConversationRelations
> {
  public readonly bienImmo: BelongsToAccessor<BienImmo, typeof Conversation.prototype.id>;
  public readonly messages: HasManyRepositoryFactory<Message, typeof Conversation.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
    @repository.getter('BienImmoRepository') protected bienImmoRepositoryGetter: Getter<BienImmoRepository>,
    @repository.getter('MessageRepository') protected messageRepositoryGetter: Getter<MessageRepository>,
  ) {
    super(Conversation, dataSource);

    this.bienImmo = this.createBelongsToAccessorFor('bienImmo', bienImmoRepositoryGetter);
    this.registerInclusionResolver('bienImmo', this.bienImmo.inclusionResolver);

    this.messages = this.createHasManyRepositoryFactoryFor('messages', messageRepositoryGetter);
    this.registerInclusionResolver('messages', this.messages.inclusionResolver);
  }
}
