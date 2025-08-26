import {Getter, inject} from '@loopback/core';
import {
  DefaultCrudRepository,
  HasManyRepositoryFactory,
  HasManyThroughRepositoryFactory,
  HasOneRepositoryFactory,
  repository,
} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienImmo, Panier, Role, Utilisateur, UtilisateurRelations, UtilisateurRole} from '../models';
import {hashPassword} from '../services/hash.password'; // Import the hashPassword function
import {BienImmoRepository} from './bien-immo.repository';
import {PanierRepository} from './panier.repository';
import {RoleRepository} from './role.repository';
import {UtilisateurRoleRepository} from './utilisateur-role.repository';

export class UtilisateurRepository extends DefaultCrudRepository<
  Utilisateur,
  typeof Utilisateur.prototype.id,
  UtilisateurRelations
> {
  public readonly roles: HasManyThroughRepositoryFactory<
    Role,
    typeof Role.prototype.id,
    UtilisateurRole,
    typeof Utilisateur.prototype.id
  >;

  public readonly panier: HasOneRepositoryFactory<Panier, typeof Utilisateur.prototype.id>;

  public readonly bienImmos: HasManyRepositoryFactory<BienImmo, typeof Utilisateur.prototype.id>;

  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
    @repository.getter('UtilisateurRoleRepository') protected utilisateurRoleRepositoryGetter: Getter<UtilisateurRoleRepository>,
    @repository.getter('RoleRepository') protected roleRepositoryGetter: Getter<RoleRepository>,
    @repository.getter('PanierRepository') protected panierRepositoryGetter: Getter<PanierRepository>,
    @repository.getter('BienImmoRepository') protected bienImmoRepositoryGetter: Getter<BienImmoRepository>,
  ) {
    super(Utilisateur, dataSource);
    this.bienImmos = this.createHasManyRepositoryFactoryFor('bienImmos', bienImmoRepositoryGetter);
    this.registerInclusionResolver('bienImmos', this.bienImmos.inclusionResolver);
    this.panier = this.createHasOneRepositoryFactoryFor('panier', panierRepositoryGetter);
    this.registerInclusionResolver('panier', this.panier.inclusionResolver);
    this.roles = this.createHasManyThroughRepositoryFactoryFor('roles', roleRepositoryGetter, utilisateurRoleRepositoryGetter);
    this.registerInclusionResolver('roles', this.roles.inclusionResolver);
  }

  // Override create to hash password
  async create(entity: Partial<Utilisateur>): Promise<Utilisateur> {
    if (entity.motDePasse) {
      entity.motDePasse = await hashPassword(entity.motDePasse);
    }
    return super.create(entity);
  }

  // Override updateById to hash password if provided
  async updateById(id: string, data: Partial<Utilisateur>): Promise<void> {
    if (data.motDePasse) {
      data.motDePasse = await hashPassword(data.motDePasse);
    }
    return super.updateById(id, data);
  }

  // Optionally override replaceById to handle full entity replacement
  async replaceById(id: string, data: Partial<Utilisateur>): Promise<void> {
    if (data.motDePasse) {
      data.motDePasse = await hashPassword(data.motDePasse);
    }
    return super.replaceById(id, data);
  }

  // Optionally override updateAll to handle bulk updates
  async updateAll(data: Partial<Utilisateur>, where?: any): Promise<{count: number}> {
    if (data.motDePasse) {
      data.motDePasse = await hashPassword(data.motDePasse);
    }
    return super.updateAll(data, where);
  }
}
