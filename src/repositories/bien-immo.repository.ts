import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor, HasManyRepositoryFactory} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienImmo, BienImmoRelations, Utilisateur, Media} from '../models';
import {UtilisateurRepository} from './utilisateur.repository';
import {MediaRepository} from './media.repository';

export class BienImmoRepository extends DefaultCrudRepository<
  BienImmo,
  typeof BienImmo.prototype.id,
  BienImmoRelations
> {

  public readonly utilisateur: BelongsToAccessor<Utilisateur, typeof BienImmo.prototype.id>;

  public readonly media: HasManyRepositoryFactory<Media, typeof BienImmo.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource, @repository.getter('UtilisateurRepository') protected utilisateurRepositoryGetter: Getter<UtilisateurRepository>, @repository.getter('MediaRepository') protected mediaRepositoryGetter: Getter<MediaRepository>,
  ) {
    super(BienImmo, dataSource);
    this.media = this.createHasManyRepositoryFactoryFor('media', mediaRepositoryGetter,);
    this.registerInclusionResolver('media', this.media.inclusionResolver);
    this.utilisateur = this.createBelongsToAccessorFor('utilisateur', utilisateurRepositoryGetter,);
    this.registerInclusionResolver('utilisateur', this.utilisateur.inclusionResolver);
  }
}
