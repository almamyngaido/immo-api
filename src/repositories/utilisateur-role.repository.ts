import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {UtilisateurRole, UtilisateurRoleRelations} from '../models';

export class UtilisateurRoleRepository extends DefaultCrudRepository<
  UtilisateurRole,
  typeof UtilisateurRole.prototype.id,
  UtilisateurRoleRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(UtilisateurRole, dataSource);
  }
}
