import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class UtilisateurRole extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
  })
  utilisateurId?: string;

  @property({
    type: 'string',
  })
  roleId?: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<UtilisateurRole>) {
    super(data);
  }
}

export interface UtilisateurRoleRelations {
  // describe navigational properties here
}

export type UtilisateurRoleWithRelations = UtilisateurRole & UtilisateurRoleRelations;
