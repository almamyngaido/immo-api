import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyThroughRepositoryFactory, BelongsToAccessor} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Panier, PanierRelations, BienImmo, BienPanier, Utilisateur} from '../models';
import {BienPanierRepository} from './bien-panier.repository';
import {BienImmoRepository} from './bien-immo.repository';
import {UtilisateurRepository} from './utilisateur.repository';

export class PanierRepository extends DefaultCrudRepository<
  Panier,
  typeof Panier.prototype.id,
  PanierRelations
> {

  public readonly bienImmos: HasManyThroughRepositoryFactory<BienImmo, typeof BienImmo.prototype.id,
          BienPanier,
          typeof Panier.prototype.id
        >;

  public readonly utilisateur: BelongsToAccessor<Utilisateur, typeof Panier.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource, @repository.getter('BienPanierRepository') protected bienPanierRepositoryGetter: Getter<BienPanierRepository>, @repository.getter('BienImmoRepository') protected bienImmoRepositoryGetter: Getter<BienImmoRepository>, @repository.getter('UtilisateurRepository') protected utilisateurRepositoryGetter: Getter<UtilisateurRepository>,
  ) {
    super(Panier, dataSource);
    this.utilisateur = this.createBelongsToAccessorFor('utilisateur', utilisateurRepositoryGetter,);
    this.registerInclusionResolver('utilisateur', this.utilisateur.inclusionResolver);
    this.bienImmos = this.createHasManyThroughRepositoryFactoryFor('bienImmos', bienImmoRepositoryGetter, bienPanierRepositoryGetter,);
    this.registerInclusionResolver('bienImmos', this.bienImmos.inclusionResolver);
  }
}
