import {Entity, hasMany, hasOne, model, property} from '@loopback/repository';
import {BienImmo} from './bien-immo.model';
import {Panier} from './panier.model';
import {Role} from './role.model';
import {UtilisateurRole} from './utilisateur-role.model';

@model()
export class Utilisateur extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  nom: string;

  @property({
    type: 'string',
  })
  prenom?: string;

  @property({
    type: 'string',
    required: true,
    index: {unique: true},
  })
  email: string;

  @property({
    type: 'string',
    required: true,
    hidden: true, // Cache le mot de passe dans les réponses API
    jsonSchema: {
      minLength: 8,
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$', // 1 minuscule, 1 majuscule, 1 chiffre
    },
  })
  motDePasse: string;

  @property({
    type: 'string',
    required: true,
  })
  role: string;

  @property({
    type: 'string',
    required: true,
  })
  dateInscription: string;
  @property({
    type: 'boolean',
    default: false,
  })
  verified: boolean; // Add this for email verification
  // Add these properties to the Utilisateur class
  @property({
    type: 'string',
  })
  verificationToken?: string;
  @property({
    type: 'string',
    required: true,
    index: {unique: true},
  })
  phoneNumber: string;

  @property({
    type: 'string',
  })
  otp?: string;

  @property({
    type: 'string',
  })
  otpExpiry?: string;

  @property({
    type: 'string',
  })
  resetPasswordToken?: string;

  @property({
    type: 'string',
  })
  resetPasswordTokenExpiry?: string;
  @hasMany(() => Role, {through: {model: () => UtilisateurRole}})
  roles: Role[];

  @hasOne(() => Panier)
  panier: Panier;

  @hasMany(() => BienImmo)
  bienImmos: BienImmo[];

  constructor(data?: Partial<Utilisateur>) {
    super(data);
  }
}

export interface UtilisateurRelations {
  // describe navigational properties here
}

export type UtilisateurWithRelations = Utilisateur & UtilisateurRelations;
