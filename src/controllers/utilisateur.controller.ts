import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {Utilisateur} from '../models';
import {UtilisateurRepository} from '../repositories';

export class UtilisateurController {
  constructor(
    @repository(UtilisateurRepository)
    public utilisateurRepository: UtilisateurRepository,
  ) { }

  @post('/utilisateurs')
  @response(200, {
    description: 'Utilisateur model instance',
    content: {'application/json': {schema: getModelSchemaRef(Utilisateur)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {
            title: 'NewUtilisateur',
            exclude: ['id'],
          }),
        },
      },
    })
    utilisateur: Omit<Utilisateur, 'id'>,
  ): Promise<Utilisateur> {
    return this.utilisateurRepository.create(utilisateur);
  }

  @get('/utilisateurs/count')
  @response(200, {
    description: 'Utilisateur model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Utilisateur) where?: Where<Utilisateur>,
  ): Promise<Count> {
    return this.utilisateurRepository.count(where);
  }

  @get('/utilisateurs')
  @response(200, {
    description: 'Array of Utilisateur model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Utilisateur, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Utilisateur) filter?: Filter<Utilisateur>,
  ): Promise<Utilisateur[]> {
    return this.utilisateurRepository.find(filter);
  }

  @patch('/utilisateurs')
  @response(200, {
    description: 'Utilisateur PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {partial: true}),
        },
      },
    })
    utilisateur: Utilisateur,
    @param.where(Utilisateur) where?: Where<Utilisateur>,
  ): Promise<Count> {
    return this.utilisateurRepository.updateAll(utilisateur, where);
  }

  @get('/utilisateurs/{id}')
  @response(200, {
    description: 'Utilisateur model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Utilisateur, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Utilisateur, {exclude: 'where'}) filter?: FilterExcludingWhere<Utilisateur>
  ): Promise<Utilisateur> {
    return this.utilisateurRepository.findById(id, filter);
  }

  @patch('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {partial: true}),
        },
      },
    })
    utilisateur: Utilisateur,
  ): Promise<void> {
    await this.utilisateurRepository.updateById(id, utilisateur);
  }

  @put('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() utilisateur: Utilisateur,
  ): Promise<void> {
    await this.utilisateurRepository.replaceById(id, utilisateur);
  }

  @del('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.utilisateurRepository.deleteById(id);
  }

  @authenticate('jwt')
  @get('/me')
  @response(200, {
    description: 'Current authenticated user',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Utilisateur, {includeRelations: true}),
      },
    },
  })
  async me(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Partial<Utilisateur>> {
    const userId = currentUser[securityId];
    const user = await this.utilisateurRepository.findById(userId);
    const {motDePasse, otp, otpExpiry, resetPasswordToken, resetPasswordTokenExpiry, verificationToken, ...safeUser} = user;
    return safeUser;
  }
}
