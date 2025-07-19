import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Utilisateur} from './utilisateur.model';

@model({settings: {strict: false}})
export class BienImmo extends Entity {
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
  titre: string;

  @property({
    type: 'string',
    required: true,
  })
  description: string;

  @property({
    type: 'string',
    required: true,
  })
  typeBien: string;

  @property({
    type: 'string',
    required: true,
  })
  statut: string;

  @property({
    type: 'number',
    required: true,
  })
  prix: number;

  @property({
    type: 'string',
    required: true,
  })
  localisation: string;

  @property({
    type: 'date',
    required: true,
  })
  datePublication: string;

  @property({
    type: 'array',
    itemType: 'string',
    required: true,
  })
  listeImages: string[];

  @belongsTo(() => Utilisateur)
  utilisateurId: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<BienImmo>) {
    super(data);
  }
}

export interface BienImmoRelations {
  // describe navigational properties here
}

export type BienImmoWithRelations = BienImmo & BienImmoRelations;
