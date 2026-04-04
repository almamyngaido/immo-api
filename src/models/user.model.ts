/**
 * MODÈLE USER — Plateforme Immobilière Sénégal (LoopBack 4)
 * Roles : courtier | acheteur | admin
 * Remplace : utilisateur.model.ts (marché France B2B)
 */
import {Entity, model, property} from '@loopback/repository';

// ─── Sous-modèle : Abonnement courtier ───────────────────────────────────────
@model()
class Abonnement {
  @property({type: 'string', jsonSchema: {enum: ['gratuit', 'premium', 'pro']}, default: 'gratuit'})
  plan: string;

  @property({type: 'number', default: 0})
  prix_fcfa: number;

  @property({type: 'date'})
  date_debut?: Date;

  @property({type: 'date'})
  date_fin?: Date;

  @property({type: 'boolean', default: false})
  actif: boolean;

  @property({type: 'string', jsonSchema: {enum: ['wave', 'orange_money', 'free_money', 'virement']}})
  paiement_methode?: string;

  @property({type: 'string'})
  transaction_id?: string;
}

// ─── Sous-modèle : Badges courtier ───────────────────────────────────────────
@model()
class Badges {
  @property({type: 'boolean', default: false})
  verifie: boolean;           // CNI vérifiée par admin

  @property({type: 'boolean', default: false})
  top_courtier: boolean;      // +50 transactions, note >4.5

  @property({type: 'boolean', default: false})
  ultra_reactif: boolean;     // Réponse <15 min

  @property({type: 'boolean', default: false})
  photos_certifiees: boolean;

  @property({type: 'boolean', default: false})
  premium: boolean;           // Abonnement payant actif
}

// ─── Sous-modèle : Vérification identité ─────────────────────────────────────
@model()
class VerificationIdentite {
  @property({
    type: 'string',
    default: 'en_attente',
    jsonSchema: {enum: ['en_attente', 'en_cours', 'verifie', 'rejete']},
  })
  statut: string;

  @property({type: 'string'})
  cni_url?: string;            // URL S3/Cloudflare scan CNI

  @property({type: 'string'})
  registre_commerce_url?: string; // Si agence

  @property({type: 'date'})
  date_soumission?: Date;

  @property({type: 'date'})
  date_validation?: Date;

  @property({type: 'string'})
  admin_note?: string;
}

// ─── Sous-modèle : Stats courtier ────────────────────────────────────────────
@model()
class StatsCourtier {
  @property({type: 'number', default: 0})
  nb_annonces_actives: number;

  @property({type: 'number', default: 0})
  nb_annonces_total: number;

  @property({type: 'number', default: 0})
  nb_transactions: number;

  @property({type: 'number', default: 0})
  nb_vues_total: number;

  @property({type: 'number', default: 0})
  nb_contacts_recus: number;

  @property({type: 'number', default: 0, jsonSchema: {minimum: 0, maximum: 5}})
  note_moyenne: number;

  @property({type: 'number', default: 0})
  nb_avis: number;

  @property({type: 'number', default: 0})
  taux_reponse: number; // % réponses en <15 min
}

// ─── Sous-modèle : Limites selon plan ────────────────────────────────────────
// null = illimité (plans premium/pro)
@model()
class Limites {
  @property({type: 'number', default: 5, jsonSchema: {type: ['number', 'null']}})
  max_annonces: number | null;   // gratuit:5, premium/pro: null (illimité)

  @property({type: 'number', default: 10, jsonSchema: {type: ['number', 'null']}})
  max_photos_par_annonce: number | null;

  @property({type: 'number', default: 0, jsonSchema: {type: ['number', 'null']}})
  visites_360_restantes: number | null;

  @property({type: 'number', default: 0, jsonSchema: {type: ['number', 'null']}})
  videos_restantes: number | null;

  @property({type: 'number', default: 0})
  boosts_gratuits_restants: number;

  @property({type: 'number', default: 1})
  max_utilisateurs_agence: number;
}

/** Renvoie les limites initiales selon le plan — source de vérité unique */
export function getLimitesParPlan(plan: string): {
  max_annonces: number | null;
  max_photos_par_annonce: number | null;
  visites_360_restantes: number | null;
  videos_restantes: number | null;
  boosts_gratuits_restants: number;
  max_utilisateurs_agence: number;
} {
  switch (plan) {
    case 'premium':
      return {
        max_annonces:           null, // illimité
        max_photos_par_annonce: 15,
        visites_360_restantes:  5,
        videos_restantes:       2,
        boosts_gratuits_restants: 1,
        max_utilisateurs_agence:  1,
      };
    case 'pro':
      return {
        max_annonces:           null, // illimité
        max_photos_par_annonce: null, // illimité
        visites_360_restantes:  null, // illimité
        videos_restantes:       null, // illimité
        boosts_gratuits_restants: 3,
        max_utilisateurs_agence:  7,
      };
    case 'gratuit':
    default:
      return {
        max_annonces:           5,
        max_photos_par_annonce: 10,
        visites_360_restantes:  0,
        videos_restantes:       0,
        boosts_gratuits_restants: 0,
        max_utilisateurs_agence:  1,
      };
  }
}

// ─── Sous-modèle : Préférences acheteur/locataire ────────────────────────────
@model()
class PreferencesRecherche {
  @property.array(String)
  type_bien?: string[];

  @property({type: 'string', jsonSchema: {enum: ['vente', 'location', 'les_deux']}})
  type_transaction?: string;

  @property({type: 'number'})
  budget_min_fcfa?: number;

  @property({type: 'number'})
  budget_max_fcfa?: number;

  @property.array(String)
  villes_souhaitees?: string[];

  @property({type: 'number'})
  nb_chambres_min?: number;

  @property({type: 'boolean', default: false})
  alerte_active?: boolean;     // Notif push nouvelles annonces
}

// ─── Modèle principal User ────────────────────────────────────────────────────
@model({
  settings: {
    mongodb: {collection: 'users'},
    strict: false,
    indexes: {
      email_unique: {keys: {email: 1}, options: {unique: true}},
      telephone_idx: {keys: {telephone: 1}},
      role_ville_idx: {keys: {role: 1, ville: 1}},
      badges_verifie_idx: {keys: {'badges.verifie': 1}},
      note_moyenne_idx: {keys: {'stats.note_moyenne': -1}},
    },
  },
})
export class User extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  // ─── Identité ───────────────────────────────────────────────────────────────
  @property({type: 'string', required: true})
  prenom: string;

  @property({type: 'string', required: true})
  nom: string;

  @property({type: 'string', required: true, index: {unique: true}})
  email: string;

  @property({type: 'string', required: true, hidden: true})
  mot_de_passe: string; // bcrypt hash

  // Téléphone format Sénégal : +221 7X XXX XX XX ou +221 3X XXX XX XX
  @property({
    type: 'string',
    required: true,
    index: {unique: true},
    jsonSchema: {
      pattern: '^\\+221[37][0-9]{8}$',
      description: 'Format Sénégal: +221771234567',
    },
  })
  telephone: string;

  @property({
    type: 'string',
    required: true,
    jsonSchema: {enum: ['courtier', 'acheteur', 'admin']},
  })
  role: string;

  // ─── Profil ─────────────────────────────────────────────────────────────────
  @property({type: 'string'})
  avatar_url?: string;

  @property({type: 'string', jsonSchema: {maxLength: 500}})
  bio?: string;

  // ─── Localisation Sénégal ───────────────────────────────────────────────────
  @property({
    type: 'string',
    default: 'Dakar',
    jsonSchema: {
      enum: [
        'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
        'Mbour', 'Rufisque', 'Diourbel', 'Louga', 'Tambacounda',
        'Kolda', 'Matam', 'Kaffrine', 'Kédougou', 'Sédhiou', 'Fatick',
      ],
    },
  })
  ville?: string;

  @property({type: 'string'})
  quartier?: string;

  @property({type: 'string'})
  adresse?: string;

  // ─── Champs spécifiques courtier ────────────────────────────────────────────
  @property({type: 'string'})
  nom_agence?: string; // Plan Pro uniquement

  @property.array(String)
  zone_intervention?: string[]; // ['Dakar', 'Thiès', 'Mbour']

  @property({type: 'number'})
  annees_experience?: number;

  @property.array(String, {
    jsonSchema: {
      items: {enum: ['wolof', 'français', 'anglais', 'arabe', 'diola', 'pulaar']},
    },
  })
  langues?: string[];

  // ─── Abonnement & badges ────────────────────────────────────────────────────
  @property({type: 'object'})
  abonnement?: Abonnement;

  @property({type: 'object'})
  badges?: Badges;

  @property({type: 'object'})
  verification?: VerificationIdentite;

  @property({type: 'object'})
  stats?: StatsCourtier;

  @property({type: 'object'})
  limites?: Limites;

  // ─── Préférences acheteur/locataire ─────────────────────────────────────────
  @property({type: 'object'})
  preferences_recherche?: PreferencesRecherche;

  // ─── Notifications ──────────────────────────────────────────────────────────
  @property({type: 'string'})
  fcm_token?: string; // Firebase Cloud Messaging

  @property({type: 'boolean', default: true})
  notifications_actives?: boolean;

  // ─── Sécurité & vérification ────────────────────────────────────────────────
  @property({type: 'boolean', default: false})
  email_verifie?: boolean;

  @property({type: 'string'})
  token_email?: string;

  @property({type: 'string'})
  reset_password_token?: string;

  @property({type: 'date'})
  reset_password_expiry?: Date;

  @property({type: 'date'})
  derniere_connexion?: Date;

  @property({type: 'boolean', default: true})
  actif?: boolean;

  // OTP (flux approbation admin conservé)
  @property({type: 'string'})
  otp?: string;

  @property({type: 'string'})
  otp_expiry?: string;

  // Timestamps auto
  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<User>) {
    super(data);
  }
}

export interface UserRelations {}
export type UserWithRelations = User & UserRelations;
