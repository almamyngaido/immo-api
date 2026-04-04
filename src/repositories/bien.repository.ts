/**
 * REPOSITORY BIEN — Plateforme Immobilière Sénégal
 * Méthodes de recherche avancée : prix FCFA, localisation, équipements
 */
import {inject} from '@loopback/core';
import {DefaultCrudRepository, Filter, Where} from '@loopback/repository';
import {ImmoApiDataSource} from '../datasources';
import {Bien, BienRelations} from '../models';

export class BienRepository extends DefaultCrudRepository<
  Bien,
  typeof Bien.prototype.id,
  BienRelations
> {
  constructor(
    @inject('datasources.immoApi') dataSource: ImmoApiDataSource,
  ) {
    super(Bien, dataSource);
  }

  // Recherche par ville + quartier
  async findByLocalisation(
    ville: string,
    quartier?: string,
    filter?: Filter<Bien>,
  ): Promise<Bien[]> {
    const where: Where<Bien> = {
      'localisation.ville': ville,
      statut: 'publie',
      ...(quartier ? {'localisation.quartier': quartier} : {}),
    } as any;
    return this.find({...filter, where});
  }

  // Recherche par fourchette de prix (vente)
  async findByPrixVente(
    prixMin?: number,
    prixMax?: number,
    filter?: Filter<Bien>,
  ): Promise<Bien[]> {
    const priceWhere: any = {'finances.prix_vente_fcfa': {}};
    if (prixMin !== undefined) priceWhere['finances.prix_vente_fcfa'].gte = prixMin;
    if (prixMax !== undefined) priceWhere['finances.prix_vente_fcfa'].lte = prixMax;
    return this.find({...filter, where: priceWhere});
  }

  // Recherche par fourchette de loyer (location)
  async findByLoyer(
    loyerMin?: number,
    loyerMax?: number,
    filter?: Filter<Bien>,
  ): Promise<Bien[]> {
    const loyerWhere: any = {
      type_transaction: 'location',
      statut: 'publie',
      'finances.loyer_mensuel_fcfa': {},
    };
    if (loyerMin !== undefined) loyerWhere['finances.loyer_mensuel_fcfa'].gte = loyerMin;
    if (loyerMax !== undefined) loyerWhere['finances.loyer_mensuel_fcfa'].lte = loyerMax;
    return this.find({...filter, where: loyerWhere});
  }

  // Annonces boostées + en vedette (page d'accueil)
  async findFeatured(limit = 20): Promise<Bien[]> {
    return this.find({
      where: {statut: 'publie'} as any,
      order: ['en_vedette DESC', 'boost.actif DESC', 'stats.nb_vues DESC'],
      limit,
    });
  }

  // Annonces d'un courtier
  async findByCourtier(courtierId: string, filter?: Filter<Bien>): Promise<Bien[]> {
    return this.find({
      ...filter,
      where: {courtier_id: courtierId} as any,
    });
  }

  // Génère la prochaine référence lisible (ex: DAK-APT-00123)
  async generateReference(ville: string, typeBien: string): Promise<string> {
    const count = await this.count();
    const prefixVille = (ville || 'SN').substring(0, 3).toUpperCase();
    const prefixType = (typeBien || 'BIE').substring(0, 3).toUpperCase();
    return `${prefixVille}-${prefixType}-${String((count.count || 0) + 1).padStart(5, '0')}`;
  }
}
