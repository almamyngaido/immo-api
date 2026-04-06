/**
 * MODÈLE BIEN — Plateforme Immobilière Sénégal (LoopBack 4)
 * Prix en FCFA, quartiers SN, boost d'annonces, visite 360°
 * Remplace : bien-immo.model.ts (marché France)
 */
import {Entity, model, property} from '@loopback/repository';

// ─── Sous-modèle : Média ──────────────────────────────────────────────────────
@model()
class Media {
  @property({type: 'string', required: true})
  url: string; // URL CDN Cloudflare

  @property({type: 'string', jsonSchema: {enum: ['photo', 'video', '360']}})
  type?: string;

  @property({type: 'number', default: 0})
  ordre?: number; // Ordre d'affichage

  @property({type: 'boolean', default: false})
  est_principale?: boolean;

  @property({type: 'boolean', default: false})
  certifiee?: boolean; // Photo certifiée admin
}

// ─── Sous-modèle : Localisation ───────────────────────────────────────────────
@model()
class Localisation {
  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: [
        'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
        'Mbour', 'Rufisque', 'Diourbel', 'Louga', 'Tambacounda',
        'Kolda', 'Matam', 'Kaffrine', 'Kédougou', 'Sédhiou', 'Fatick',
      ],
    },
  })
  ville: string;

  @property({type: 'string', required: true})
  quartier: string; // Ex : Almadies, Mermoz, Plateau, HLM…

  @property({type: 'string'})
  adresse?: string; // Visible après prise de contact

  // GeoJSON pour recherche géospatiale
  @property({
    type: 'object',
    jsonSchema: {
      type: 'object',
      properties: {
        type: {type: 'string', enum: ['Point']},
        coordinates: {type: 'array', items: {type: 'number'}},
      },
    },
  })
  coordonnees?: {type: string; coordinates: number[]}; // [longitude, latitude]

  @property.array(String)
  proximite?: string[]; // Landmarks : "Près de l'UCAD", "Face à la mosquée"
}

// ─── Sous-modèle : Caractéristiques du bien ───────────────────────────────────
@model()
class Caracteristiques {
  @property({type: 'number'})
  surface_m2?: number;

  @property({type: 'number', default: 0})
  nb_chambres?: number;

  @property({type: 'number', default: 0})
  nb_salles_de_bain?: number;

  @property({type: 'number', default: 0})
  nb_toilettes?: number;

  @property({type: 'number', default: 1})
  nb_salons?: number;

  @property({type: 'number'})
  etage?: number; // null = RDC ou maison individuelle

  @property({type: 'number'})
  nb_etages_total?: number;

  @property({type: 'number'})
  annee_construction?: number;

  @property({
    type: 'string',
    jsonSchema: {enum: ['neuf', 'bon_etat', 'a_renover', 'en_construction']},
  })
  etat?: string;

  // ─── Équipements (très pertinents au Sénégal) ──────────────────────────────
  @property({type: 'boolean', default: false})
  climatisation?: boolean;

  @property({type: 'boolean', default: false})
  groupe_electrogene?: boolean; // Délestage fréquent au SN

  @property({type: 'boolean', default: false})
  fosse_septique?: boolean;

  @property({type: 'boolean', default: false})
  citerne_eau?: boolean; // Coupures eau fréquentes

  @property({type: 'boolean', default: false})
  puits?: boolean;

  @property({type: 'boolean', default: false})
  panneau_solaire?: boolean;

  @property({type: 'boolean', default: false})
  gardien?: boolean;

  @property({type: 'boolean', default: false})
  parking?: boolean;

  @property({type: 'boolean', default: false})
  piscine?: boolean;

  @property({type: 'boolean', default: false})
  jardin?: boolean;

  @property({type: 'boolean', default: false})
  terrasse?: boolean;

  @property({type: 'boolean', default: false})
  ascenseur?: boolean;

  @property({type: 'boolean', default: false})
  digicode?: boolean;

  @property({type: 'boolean', default: false})
  meuble?: boolean; // Loué meublé ?

  @property({type: 'boolean', default: false})
  internet?: boolean;
}

// ─── Sous-modèle : Finances (FCFA) ────────────────────────────────────────────
@model()
class Finances {
  // VENTE
  @property({type: 'number'})
  prix_vente_fcfa?: number;

  @property({type: 'boolean', default: false})
  prix_negociable?: boolean;

  // LOCATION
  @property({type: 'number'})
  loyer_mensuel_fcfa?: number;

  @property({type: 'number', default: 2})
  caution_mois?: number; // Souvent 2-3 mois au Sénégal

  @property({type: 'number', default: 1})
  avance_mois?: number;

  @property({type: 'boolean', default: false})
  charges_incluses?: boolean;

  @property({type: 'number'})
  charges_montant_fcfa?: number;

  // Calculé : total à payer à l'entrée
  @property({type: 'number'})
  total_entree_fcfa?: number;

  // Commission courtier
  @property({type: 'number', default: 5})
  commission_pct?: number; // % du prix ou loyer annuel
}

// ─── Sous-modèle : Boost d'annonce ────────────────────────────────────────────
@model()
class Boost {
  @property({type: 'boolean', default: false})
  actif?: boolean;

  @property({type: 'date'})
  date_debut?: Date;

  @property({type: 'date'})
  date_fin?: Date;

  @property({type: 'number'})
  duree_jours?: number; // 3, 7, 14, 30

  @property({type: 'number'})
  prix_fcfa?: number; // 5000, 10000, 18000, 35000 FCFA

  @property({type: 'string', jsonSchema: {enum: ['standard', 'gratuit_plan']}})
  type?: string;

  @property({type: 'string'})
  transaction_id?: string;
}

// ─── Sous-modèle : Stats annonce ──────────────────────────────────────────────
@model()
class StatsAnnonce {
  @property({type: 'number', default: 0})
  nb_vues?: number;

  @property({type: 'number', default: 0})
  nb_contacts?: number;

  @property({type: 'number', default: 0})
  nb_favoris?: number;

  @property({type: 'number', default: 0})
  nb_partages_whatsapp?: number; // Partages WhatsApp trackés

  @property({type: 'number', default: 0})
  nb_visites_360?: number;

  @property({type: 'date'})
  derniere_vue?: Date;
}

// ─── Sous-modèle : Modération ─────────────────────────────────────────────────
@model()
class Moderation {
  @property({
    type: 'string',
    default: 'non_verifie',
    jsonSchema: {enum: ['non_verifie', 'verifie', 'signale']},
  })
  statut?: string;

  @property({type: 'number', default: 0})
  nb_signalements?: number;

  @property({type: 'string'})
  admin_note?: string;

  @property({type: 'date'})
  date_verification?: Date;
}

// ─── Modèle principal Bien ────────────────────────────────────────────────────
@model({
  settings: {
    mongodb: {collection: 'biens'},
    strict: false,
    indexes: {
      coordonnees_2dsphere: {keys: {'localisation.coordonnees': '2dsphere'}},
      statut_transaction_type: {keys: {statut: 1, type_transaction: 1, type_bien: 1}},
      ville_quartier: {keys: {'localisation.ville': 1, 'localisation.quartier': 1}},
      loyer_idx: {keys: {'finances.loyer_mensuel_fcfa': 1}},
      prix_vente_idx: {keys: {'finances.prix_vente_fcfa': 1}},
      boost_actif_idx: {keys: {'boost.actif': 1, 'boost.date_fin': 1}},
      vedette_vues_idx: {keys: {en_vedette: -1, 'stats.nb_vues': -1}},
      courtier_statut: {keys: {courtier_id: 1, statut: 1}},
      created_idx: {keys: {createdAt: -1}},
    },
  },
})
export class Bien extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  // Référence lisible (ex: DAK-APT-00123)
  @property({type: 'string', index: {unique: true}})
  reference?: string;

  // Courtier propriétaire
  @property({type: 'string', required: true, index: true, mongodb: {dataType: 'ObjectId'}})
  courtier_id: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {enum: ['vente', 'location']},
  })
  type_transaction: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {
      enum: ['appartement', 'villa', 'studio', 'duplex', 'bureau', 'commerce', 'terrain', 'entrepot', 'chambre'],
    },
  })
  type_bien: string;

  @property({type: 'string', required: true, jsonSchema: {maxLength: 100}})
  titre: string;

  @property({type: 'string', jsonSchema: {maxLength: 2000}})
  description?: string;

  @property({type: 'object', required: true})
  localisation: Localisation;

  @property({type: 'object'})
  caracteristiques?: Caracteristiques;

  @property({type: 'object', required: true})
  finances: Finances;

  @property.array(Object)
  medias?: Media[];

  @property({type: 'object'})
  boost?: Boost;

  @property({type: 'object'})
  stats?: StatsAnnonce;

  @property({
    type: 'string',
    default: 'brouillon',
    jsonSchema: {
      enum: ['brouillon', 'en_attente', 'publie', 'loue', 'vendu', 'archive', 'rejete'],
    },
  })
  statut?: string;

  @property({type: 'object'})
  moderation?: Moderation;

  @property({type: 'boolean', default: false})
  en_vedette?: boolean; // Badge "En vedette" - top de liste

  @property({
    type: 'string',
    default: 'disponible',
    jsonSchema: {enum: ['disponible', 'visite_en_cours', 'loue', 'vendu']},
  })
  disponibilite?: string;

  @property({type: 'date'})
  date_maj_disponibilite?: Date;

  @property({type: 'date'})
  disponible_des?: Date;

  @property({type: 'date'})
  date_publication?: Date;

  @property({type: 'date'})
  date_expiration?: Date; // Auto: +30/60/90 jours selon plan

  @property({type: 'string'})
  qr_code_visite?: string; // URL unique pour avis post-visite

  // Timestamps auto
  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<Bien>) {
    super(data);
  }

  // Boost encore valide ?
  estBoostActif(): boolean {
    return !!(this.boost?.actif && this.boost.date_fin && this.boost.date_fin > new Date());
  }
}

export interface BienRelations {}
export type BienWithRelations = Bien & BienRelations;
