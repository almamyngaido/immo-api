import {Entity, model, property, belongsTo} from '@loopback/repository';
import {BienImmo} from './bien-immo.model';

@model()
export class Media extends Entity {
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
    required: true,
  })
  url: string;

  @belongsTo(() => BienImmo)
  bienImmoId: string;

  constructor(data?: Partial<Media>) {
    super(data);
  }
}

export interface MediaRelations {
  // describe navigational properties here
}

export type MediaWithRelations = Media & MediaRelations;
