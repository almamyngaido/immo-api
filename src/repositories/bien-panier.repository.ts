import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {BienPanier, BienPanierRelations} from '../models';

export class BienPanierRepository extends DefaultCrudRepository<
  BienPanier,
  typeof BienPanier.prototype.id,
  BienPanierRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(BienPanier, dataSource);
  }
}
