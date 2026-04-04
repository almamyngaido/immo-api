import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Favori, FavoriRelations} from '../models';

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
  async removeByAcheteurAndBien(acheteurId: string, bienId: string): Promise<{count: number}> {
    return this.deleteAll({acheteur_id: acheteurId, bien_id: bienId} as any);
  }

  // Compte les favoris d'un bien (pour stats.nb_favoris)
  async countForBien(bienId: string): Promise<number> {
    const result = await this.count({bien_id: bienId} as any);
    return result.count;
  }
}
