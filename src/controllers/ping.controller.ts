import {inject} from '@loopback/core';
import {
  Request,
  RestBindings,
  get,
  response,
  ResponseObject,
} from '@loopback/rest';
import * as https from 'https';

/**
 * OpenAPI response for ping()
 */
const PING_RESPONSE: ResponseObject = {
  description: 'Ping Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        title: 'PingResponse',
        properties: {
          greeting: {type: 'string'},
          date: {type: 'string'},
          url: {type: 'string'},
          headers: {
            type: 'object',
            properties: {
              'Content-Type': {type: 'string'},
            },
            additionalProperties: true,
          },
        },
      },
    },
  },
};

/**
 * A simple controller to bounce back http requests
 */
export class PingController {
  constructor(@inject(RestBindings.Http.REQUEST) private req: Request) {}

  // Map to `GET /ping`
  @get('/ping')
  @response(200, PING_RESPONSE)
  ping(): object {
    // Reply with a greeting, the current time, the url, and request headers
    return {
      greeting: 'Hello from LoopBack',
      date: new Date(),
      url: this.req.url,
      headers: Object.assign({}, this.req.headers),
    };
  }

  // Railway n'a pas d'IP sortante fixe sur ce plan — elle tourne à chaque déploiement/restart.
  // Cette route sert à relever l'IP courante pour la mettre à jour dans la whitelist Wave.
  // À retirer seulement après la migration vers un VPS à IP fixe.
  @get('/api/debug/outbound-ip')
  outboundIp(): Promise<{outbound_ip: string}> {
    return new Promise((resolve, reject) => {
      https
        .get('https://api.ipify.org', res => {
          let ip = '';
          res.on('data', chunk => (ip += chunk));
          res.on('end', () => resolve({outbound_ip: ip}));
        })
        .on('error', reject);
    });
  }
}
