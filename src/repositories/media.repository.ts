import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources/immo-api.datasource';
import {BienImmo, Media, MediaRelations} from '../models';
import {BienImmoRepository} from './bien-immo.repository';

export class MediaRepository extends DefaultCrudRepository<
  Media,
  typeof Media.prototype.id,
  MediaRelations
> {

  public readonly bienImmo: BelongsToAccessor<BienImmo, typeof Media.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource, @repository.getter('BienImmoRepository') protected bienImmoRepositoryGetter: Getter<BienImmoRepository>,
  ) {
    super(Media, dataSource);
    this.bienImmo = this.createBelongsToAccessorFor('bienImmo', bienImmoRepositoryGetter,);
    this.registerInclusionResolver('bienImmo', this.bienImmo.inclusionResolver);
  }
}
