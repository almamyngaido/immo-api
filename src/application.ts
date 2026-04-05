import {TokenServiceBindings} from '@loopback/authentication-jwt';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, BindingScope} from '@loopback/core';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {ServiceMixin} from '@loopback/service-proxy';
import * as dotenv from 'dotenv';
import path from 'path';
import {MySequence} from './sequence';
import {JwtService} from './services/jwt.service';
export {ApplicationConfig};

import {AuthenticationComponent} from '@loopback/authentication';
import {JWTAuthenticationComponent} from '@loopback/authentication-jwt';
import {EmailService} from './services/mailer';
import {FirebaseStorageService} from './services/firebase-storage.service';
import {WaveService} from './services/wave.service';
import {loginRateLimit, registerRateLimit, refreshRateLimit} from './middleware/rate-limit.middleware';

const isProd = process.env.NODE_ENV === 'production';

// Origines autorisées (Railway + local dev)
const ALLOWED_ORIGINS = [
  'https://immo-api-production-dba2.up.railway.app',
  'http://localhost:3000',
  'http://localhost:8080',
  // L'app Flutter envoie des requêtes sans Origin header → géré ci-dessous
];

export class ImmoApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super({
      ...options,
      rest: {
        ...options.rest,
        cors: {
          // En prod : origines strictes ; en dev : tout accepter
          origin: isProd
            ? (origin: string | undefined, callback: Function) => {
                // Flutter mobile n'envoie pas d'Origin header → autoriser
                if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                  callback(null, true);
                } else {
                  callback(new Error(`CORS: origine non autorisée: ${origin}`));
                }
              }
            : true,
          methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          allowedHeaders: 'Content-Type, Authorization',
          credentials: true,
        },
      },
    });

    dotenv.config();
    this.sequence(MySequence);

    // Services
    this.bind('services.EmailService').toClass(EmailService).inScope(BindingScope.SINGLETON);
    this.bind('services.WaveService').toClass(WaveService).inScope(BindingScope.SINGLETON);
    this.bind('services.FirebaseStorageService').toClass(FirebaseStorageService).inScope(BindingScope.SINGLETON);

    // Auth
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JwtService).inScope(BindingScope.SINGLETON);

    // Static files
    this.static('/', path.join(__dirname, '../public'));
    this.static('/admin', path.join(__dirname, '../public/admin'));
    this.static('/uploads', path.join(__dirname, '../uploads'));

    // Explorer — désactivé en production
    if (!isProd) {
      this.configure(RestExplorerBindings.COMPONENT).to({path: '/explorer', useSelfHostedSpec: true});
      this.component(RestExplorerComponent);
    }

    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {dirs: ['controllers'], extensions: ['.controller.js'], nested: true},
    };
  }

}

// Middlewares montés via index.ts au démarrage
export function applySecurityMiddlewares(expressApp: any): void {
  // Security headers
  expressApp.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Rate limiting
  expressApp.use('/api/users/login',                loginRateLimit);
  expressApp.use('/api/users/refresh',              refreshRateLimit);
  expressApp.use('/api/auth/renvoyer-verification', loginRateLimit);
}
