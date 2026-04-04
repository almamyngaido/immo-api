import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Avis, AvisRelations} from '../models';

export class AvisRepository extends DefaultCrudRepository<
  Avis,
  typeof Avis.prototype.id,
  AvisRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(Avis, dataSource);
  }

  // Calcule la note moyenne d'un courtier à partir des avis publiés
  async getNotesMoyenneCourtier(courtierId: string): Promise<number> {
    const avis = await this.find({
      where: {courtier_id: courtierId, statut: 'publie'} as any,
    });
    if (!avis.length) return 0;
    const total = avis.reduce((sum, a) => sum + a.note_globale, 0);
    return Math.round((total / avis.length) * 10) / 10;
  }
}
