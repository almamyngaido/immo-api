/**
 * MODÈLE ALERTE RECHERCHE — Notification push quand un bien correspond
 */
import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'alertes_recherche'},
    strict: false,
    indexes: {
      acheteur_idx: {keys: {acheteur_id: 1}},
      active_idx: {keys: {active: 1}},
    },
  },
})
export class AlerteRecherche extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true, mongodb: {dataType: 'ObjectId'}})
  acheteur_id: string;

  // OneSignal subscription ID du device
  @property({type: 'string', required: true})
  onesignal_subscription_id: string;

  // Critères de l'alerte
  @property({type: 'object'})
  criteres: {
    type_transaction?: 'vente' | 'location' | 'les_deux';
    type_bien?: string[];
    villes?: string[];
    quartier?: string;
    loyer_max_fcfa?: number;
    prix_max_fcfa?: number;
    nb_chambres_min?: number;
  };

  @property({type: 'string', jsonSchema: {maxLength: 60}})
  label?: string; // Nom lisible ex: "Location Dakar ≤ 200k"

  @property({type: 'boolean', default: true})
  active?: boolean;

  @property({type: 'number', default: 0})
  nb_notifications_envoyees?: number;

  @property({type: 'date'})
  derniere_notification?: Date;

  @property({type: 'date'})
  createdAt?: Date;

  @property({type: 'date'})
  updatedAt?: Date;

  constructor(data?: Partial<AlerteRecherche>) {
    super(data);
  }
}

export interface AlerteRechercheRelations {}
export type AlerteRechercheWithRelations = AlerteRecherche & AlerteRechercheRelations;
