/**
 * DIWANE — Utilitaires Bien partagés
 * Utilisé par : DiwaneBiensController, DiwaneFavorisController, DiwaneUsersController
 */
import {Bien, User} from '../models';

/** Transforme un Bien + courtier optionnel → format Diwane Flutter */
export function diwaneBien(bien: Bien, courtier?: Partial<User>): object {
  const photos = (bien.medias ?? [])
    .filter(m => (m.type ?? 'photo') !== 'video' && (m.type ?? 'photo') !== '360')
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    .map(m => m.url);

  return {
    id:               bien.id,
    reference:        bien.reference,
    titre:            bien.titre,
    description:      bien.description,
    type_bien:        bien.type_bien,
    type_transaction: bien.type_transaction,
    ville:            bien.localisation?.ville,
    quartier:         bien.localisation?.quartier,
    adresse:          bien.localisation?.adresse,
    loyer:            bien.finances?.loyer_mensuel_fcfa,
    prix:             bien.finances?.prix_vente_fcfa,
    total_entree_fcfa:bien.finances?.total_entree_fcfa,
    prix_negociable:  bien.finances?.prix_negociable,
    caution_mois:     bien.finances?.caution_mois,
    avance_mois:      bien.finances?.avance_mois,
    nb_chambres:      bien.caracteristiques?.nb_chambres,
    surface:          bien.caracteristiques?.surface_m2,
    caracteristiques: bien.caracteristiques,
    photos,
    statut:           bien.statut,
    en_vedette:       bien.en_vedette ?? false,
    boost:            {actif: bien.estBoostActif()},
    stats:            bien.stats,
    courtier_id:      bien.courtier_id,
    courtier: courtier ? {
      id:         courtier.id,
      nom:        courtier.nom,
      prenom:     courtier.prenom,
      telephone:  (courtier as any).telephone,
      badges:     courtier.badges,
      stats:      {
        note_moyenne: courtier.stats?.note_moyenne ?? 0,
        nb_avis:      courtier.stats?.nb_avis ?? 0,
      },
      ville:      courtier.ville,
    } : undefined,
    date_publication: bien.date_publication,
    createdAt:        bien.createdAt,
  };
}

/** Ordre MongoDB selon le param sort */
export function buildOrder(sort: string, typeTransaction?: string): string[] {
  switch (sort) {
    case 'prix_asc':
      return typeTransaction === 'vente'
        ? ['finances.prix_vente_fcfa ASC']
        : ['finances.loyer_mensuel_fcfa ASC'];
    case 'prix_desc':
      return typeTransaction === 'vente'
        ? ['finances.prix_vente_fcfa DESC']
        : ['finances.loyer_mensuel_fcfa DESC'];
    case 'vedette':
      return ['en_vedette DESC', 'boost.actif DESC', 'boost.date_fin DESC', 'stats.nb_vues DESC', 'createdAt DESC'];
    case 'recent':
    default:
      return ['en_vedette DESC', 'boost.actif DESC', 'createdAt DESC'];
  }
}
