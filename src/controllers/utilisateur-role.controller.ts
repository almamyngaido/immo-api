import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
  import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
Utilisateur,
UtilisateurRole,
Role,
} from '../models';
import {UtilisateurRepository} from '../repositories';

export class UtilisateurRoleController {
  constructor(
    @repository(UtilisateurRepository) protected utilisateurRepository: UtilisateurRepository,
  ) { }

  @get('/utilisateurs/{id}/roles', {
    responses: {
      '200': {
        description: 'Array of Utilisateur has many Role through UtilisateurRole',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Role)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Role>,
  ): Promise<Role[]> {
    return this.utilisateurRepository.roles(id).find(filter);
  }

  @post('/utilisateurs/{id}/roles', {
    responses: {
      '200': {
        description: 'create a Role model instance',
        content: {'application/json': {schema: getModelSchemaRef(Role)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Utilisateur.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Role, {
            title: 'NewRoleInUtilisateur',
            exclude: ['id'],
          }),
        },
      },
    }) role: Omit<Role, 'id'>,
  ): Promise<Role> {
    return this.utilisateurRepository.roles(id).create(role);
  }

  @patch('/utilisateurs/{id}/roles', {
    responses: {
      '200': {
        description: 'Utilisateur.Role PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Role, {partial: true}),
        },
      },
    })
    role: Partial<Role>,
    @param.query.object('where', getWhereSchemaFor(Role)) where?: Where<Role>,
  ): Promise<Count> {
    return this.utilisateurRepository.roles(id).patch(role, where);
  }

  @del('/utilisateurs/{id}/roles', {
    responses: {
      '200': {
        description: 'Utilisateur.Role DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Role)) where?: Where<Role>,
  ): Promise<Count> {
    return this.utilisateurRepository.roles(id).delete(where);
  }
}
