import {Entity, model, property, hasMany, belongsTo} from '@loopback/repository';
import {BienImmo} from './bien-immo.model';
import {BienPanier} from './bien-panier.model';
import {Utilisateur} from './utilisateur.model';

@model({settings: {strict: false}})
export class Panier extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true, // si tu veux que l’ID soit auto-incrémenté
  })
  id?: string;
  @hasMany(() => BienImmo, {through: {model: () => BienPanier}})
  bienImmos: BienImmo[];

  @belongsTo(() => Utilisateur)
  utilisateurId: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Panier>) {
    super(data);
  }
}

export interface PanierRelations {
  // describe navigational properties here
}

export type PanierWithRelations = Panier & PanierRelations;
