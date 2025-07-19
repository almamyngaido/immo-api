import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class BienPanier extends Entity {
    @property({
    type: 'string',
    id: true, // <-- cette ligne est essentielle
    generated: true, // auto-incrémenté si tu veux
  })
  id?: string;
  @property({
    type: 'string',
    required: true,
  })
  statutDemande: string;

  @property({
    type: 'string',
  })
  panierId?: string;

  @property({
    type: 'string',
  })
  bienImmoId?: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<BienPanier>) {
    super(data);
  }
}

export interface BienPanierRelations {
  // describe navigational properties here
}

export type BienPanierWithRelations = BienPanier & BienPanierRelations;
