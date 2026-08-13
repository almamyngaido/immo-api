import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Favori, FavoriRelations} from '../models';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {ObjectId} = require('mongodb');

export class FavoriRepository extends DefaultCrudRepository<
  Favori,
  typeof Favori.prototype.id,
  FavoriRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(Favori, dataSource);
  }

  // Supprime le favori (acheteur, bien)
  // Les champs acheteur_id/bien_id sont stockés en ObjectId côté Mongo : le
  // connecteur ne les caste PAS automatiquement dans un filtre where (contrairement
  // au champ id primaire), donc un filtre en string ne matche jamais silencieusement.
  async removeByAcheteurAndBien(acheteurId: string, bienId: string): Promise<{count: number}> {
    return this.deleteAll({
      acheteur_id: new ObjectId(acheteurId),
      bien_id: new ObjectId(bienId),
    } as any);
  }

  // Compte les favoris d'un bien (pour stats.nb_favoris)
  async countForBien(bienId: string): Promise<number> {
    const result = await this.count({bien_id: new ObjectId(bienId)} as any);
    return result.count;
  }
}
