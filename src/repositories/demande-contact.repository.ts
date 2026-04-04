import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {DemandeContact, DemandeContactRelations} from '../models';

export class DemandeContactRepository extends DefaultCrudRepository<
  DemandeContact,
  typeof DemandeContact.prototype.id,
  DemandeContactRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(DemandeContact, dataSource);
  }
}
