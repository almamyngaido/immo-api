import {TokenServiceBindings} from '@loopback/authentication-jwt';
import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
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

export class ImmoApiApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super({
      ...options,
      rest: {
        ...options.rest,
        // 🔹 Activation CORS
        cors: {
          origin: [
            'http://localhost:56111',         // Frontend local
            'https://ton-projet.netlify.app', // Frontend Netlify
          ],
          methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          allowedHeaders: 'Content-Type, Authorization',
          credentials: true,
        },
      },
    });

    dotenv.config(); // Load .env variables

    // Set up the custom sequence
    this.sequence(MySequence);

    // Bind services
    this.bind('services.EmailService').toClass(EmailService);
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JwtService);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // LoopBack Explorer
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;

    // Boot options
    this.bootOptions = {
      controllers: {
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }
}
