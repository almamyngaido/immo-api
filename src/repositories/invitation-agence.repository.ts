import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {InvitationAgence, InvitationAgenceRelations} from '../models';

export class InvitationAgenceRepository extends DefaultCrudRepository<
  InvitationAgence,
  typeof InvitationAgence.prototype.id,
  InvitationAgenceRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(InvitationAgence, dataSource);
  }
}
