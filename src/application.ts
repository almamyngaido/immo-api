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
import {AlerteService} from './services/alerte.service';

const isProd = process.env.NODE_ENV === 'production';

// Origines autorisées en production
const ALLOWED_ORIGINS = [
  'https://immo-api-production-dba2.up.railway.app',
  'https://maxim-flutter.vercel.app',
];

// En dev, autoriser tous les localhost (Flutter web, Chrome, etc.)
const LOCALHOST_REGEX = /^https?:\/\/localhost(:\d+)?$/;

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
          origin: (origin: string | undefined, callback: Function) => {
              // Flutter mobile n'envoie pas d'Origin header → autoriser
              if (!origin) return callback(null, true);
              // Localhost toujours autorisé (Flutter web dev, tests)
              if (LOCALHOST_REGEX.test(origin)) return callback(null, true);
              // En prod : seulement les origines connues
              if (isProd && !ALLOWED_ORIGINS.includes(origin)) {
                return callback(new Error(`CORS: origine non autorisée: ${origin}`));
              }
              callback(null, true);
            },
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
    this.bind('services.AlerteService').toClass(AlerteService).inScope(BindingScope.SINGLETON);

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

    // Security headers, UTF-8 charset and rate limiting — all applied in
    // MySequence.handle() (see sequence.ts). They used to be registered here
    // via _expressApp.use() after app.start(), but that runs too late:
    // LoopBack's own route dispatcher is already handling and terminating
    // matched API requests by then, so none of that middleware ever fired.

    this.projectRoot = __dirname;
    this.bootOptions = {
      controllers: {dirs: ['controllers'], extensions: ['.controller.js'], nested: true},
    };
  }

}
