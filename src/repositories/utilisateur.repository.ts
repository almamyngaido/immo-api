import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyThroughRepositoryFactory, HasOneRepositoryFactory, HasManyRepositoryFactory} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Utilisateur, UtilisateurRelations, Role, UtilisateurRole, Panier, BienImmo} from '../models';
import {UtilisateurRoleRepository} from './utilisateur-role.repository';
import {RoleRepository} from './role.repository';
import {PanierRepository} from './panier.repository';
import {BienImmoRepository} from './bien-immo.repository';

export class UtilisateurRepository extends DefaultCrudRepository<
  Utilisateur,
  typeof Utilisateur.prototype.id,
  UtilisateurRelations
> {

  public readonly roles: HasManyThroughRepositoryFactory<Role, typeof Role.prototype.id,
          UtilisateurRole,
          typeof Utilisateur.prototype.id
        >;

  public readonly panier: HasOneRepositoryFactory<Panier, typeof Utilisateur.prototype.id>;

  public readonly bienImmos: HasManyRepositoryFactory<BienImmo, typeof Utilisateur.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource, @repository.getter('UtilisateurRoleRepository') protected utilisateurRoleRepositoryGetter: Getter<UtilisateurRoleRepository>, @repository.getter('RoleRepository') protected roleRepositoryGetter: Getter<RoleRepository>, @repository.getter('PanierRepository') protected panierRepositoryGetter: Getter<PanierRepository>, @repository.getter('BienImmoRepository') protected bienImmoRepositoryGetter: Getter<BienImmoRepository>,
  ) {
    super(Utilisateur, dataSource);
    this.bienImmos = this.createHasManyRepositoryFactoryFor('bienImmos', bienImmoRepositoryGetter,);
    this.registerInclusionResolver('bienImmos', this.bienImmos.inclusionResolver);
    this.panier = this.createHasOneRepositoryFactoryFor('panier', panierRepositoryGetter);
    this.registerInclusionResolver('panier', this.panier.inclusionResolver);
    this.roles = this.createHasManyThroughRepositoryFactoryFor('roles', roleRepositoryGetter, utilisateurRoleRepositoryGetter,);
    this.registerInclusionResolver('roles', this.roles.inclusionResolver);
  }
}
