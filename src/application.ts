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
          origin: true,  // Allow any origin in development (reflects request origin)
          methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
          allowedHeaders: 'Content-Type, Authorization',
          credentials: true,
        },
      },
    });

    dotenv.config(); // Load .env variables

    // Set up the custom sequence
    this.sequence(MySequence);

    // Bind services with singleton scope to prevent multiple instances
    this.bind('services.EmailService').toClass(EmailService).inScope(BindingScope.SINGLETON);

    // Mount authentication component first
    this.component(AuthenticationComponent);
    this.component(JWTAuthenticationComponent);

    // Then override the default token service with our custom one
    this.bind(TokenServiceBindings.TOKEN_SERVICE).toClass(JwtService).inScope(BindingScope.SINGLETON);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // Serve uploaded files
    this.static('/uploads', path.join(__dirname, '../uploads'));

    // Configure REST explorer
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
      useSelfHostedSpec: true,
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
