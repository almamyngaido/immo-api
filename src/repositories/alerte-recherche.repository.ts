import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {AlerteRecherche, AlerteRechercheRelations} from '../models';

export class AlerteRechercheRepository extends DefaultCrudRepository<
  AlerteRecherche,
  typeof AlerteRecherche.prototype.id,
  AlerteRechercheRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(AlerteRecherche, dataSource);
  }
}
