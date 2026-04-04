import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Transaction, TransactionRelations} from '../models';

export class TransactionRepository extends DefaultCrudRepository<
  Transaction,
  typeof Transaction.prototype.id,
  TransactionRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(Transaction, dataSource);
  }
}
