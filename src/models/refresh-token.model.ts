import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    mongodb: {collection: 'refresh_tokens'},
    indexes: {
      token_idx:   {keys: {token: 1}},
      user_idx:    {keys: {user_id: 1}},
      expiry_idx:  {keys: {expires_at: 1}, options: {expireAfterSeconds: 0}}, // TTL auto-cleanup
    },
  },
})
export class RefreshToken extends Entity {
  @property({type: 'string', id: true, generated: true, mongodb: {dataType: 'ObjectId'}})
  id?: string;

  @property({type: 'string', required: true})
  user_id: string;

  @property({type: 'string', required: true})
  token: string; // hash SHA-256 du token brut

  @property({type: 'date', required: true})
  expires_at: Date;

  @property({type: 'boolean', default: false})
  revoque?: boolean;

  @property({type: 'string'})
  user_agent?: string;

  @property({type: 'string'})
  ip_address?: string;

  @property({type: 'date'})
  createdAt?: Date;

  constructor(data?: Partial<RefreshToken>) {
    super(data);
  }
}

export interface RefreshTokenRelations {}
export type RefreshTokenWithRelations = RefreshToken & RefreshTokenRelations;
