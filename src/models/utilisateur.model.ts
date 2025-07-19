import {Entity, model, property, hasMany, hasOne} from '@loopback/repository';
import {Role} from './role.model';
import {UtilisateurRole} from './utilisateur-role.model';
import {Panier} from './panier.model';
import {BienImmo} from './bien-immo.model';

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
  })
  email: string;

  @property({
    type: 'string',
    required: true,
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
