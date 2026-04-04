/**
 * REPOSITORY USER — Plateforme Immobilière Sénégal
 * Hash automatique du mot de passe sur create/update
 */
import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {User, UserRelations} from '../models';
import {hashPassword} from '../services/hash.password';

export class UserRepository extends DefaultCrudRepository<
  User,
  typeof User.prototype.id,
  UserRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(User, dataSource);
  }

  // Hash mot_de_passe à la création
  async create(entity: Partial<User>): Promise<User> {
    if (entity.mot_de_passe) {
      entity.mot_de_passe = await hashPassword(entity.mot_de_passe);
    }
    return super.create(entity);
  }

  // Hash mot_de_passe si fourni dans un patch
  async updateById(id: string, data: Partial<User>): Promise<void> {
    if (data.mot_de_passe) {
      data.mot_de_passe = await hashPassword(data.mot_de_passe);
    }
    return super.updateById(id, data);
  }

  async replaceById(id: string, data: Partial<User>): Promise<void> {
    if (data.mot_de_passe) {
      data.mot_de_passe = await hashPassword(data.mot_de_passe);
    }
    return super.replaceById(id, data);
  }

  async updateAll(data: Partial<User>, where?: object): Promise<{count: number}> {
    if (data.mot_de_passe) {
      data.mot_de_passe = await hashPassword(data.mot_de_passe);
    }
    return super.updateAll(data, where);
  }
}
