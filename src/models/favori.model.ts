/**
 * MODÈLE FAVORI — Liste de souhaits acheteur
 * Remplace : panier.model.ts + bien-panier.model.ts (logique B2B)
 * Plateforme Immobilière Sénégal (LoopBack 4)
 */
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'favoris'},
    strict: false,
    indexes: {
      acheteur_bien_unique: {
        keys: {acheteur_id: 1, bien_id: 1},
        options: {unique: true},
      },
      bien_idx: {keys: {bien_id: 1}},
    },
  },
})
export class Favori extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  acheteur_id: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  bien_id: string;

  @property({type: 'string', jsonSchema: {maxLength: 200}})
  note_personnelle?: string; // Mémo privé de l'acheteur

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<Favori>) {
    super(data);
  }
}

export interface FavoriRelations {}
export type FavoriWithRelations = Favori & FavoriRelations;
