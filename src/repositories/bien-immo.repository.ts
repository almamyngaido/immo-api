import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienImmo, BienImmoRelations, Utilisateur} from '../models';
import {UtilisateurRepository} from './utilisateur.repository';

export class BienImmoRepository extends DefaultCrudRepository<
  BienImmo,
  typeof BienImmo.prototype.id,
  BienImmoRelations
> {

  public readonly utilisateur: BelongsToAccessor<Utilisateur, typeof BienImmo.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource, @repository.getter('UtilisateurRepository') protected utilisateurRepositoryGetter: Getter<UtilisateurRepository>,
  ) {
    super(BienImmo, dataSource);
    this.utilisateur = this.createBelongsToAccessorFor('utilisateur', utilisateurRepositoryGetter,);
    this.registerInclusionResolver('utilisateur', this.utilisateur.inclusionResolver);
  }
}
