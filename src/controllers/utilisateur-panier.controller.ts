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
  Panier,
} from '../models';
import {UtilisateurRepository} from '../repositories';

export class UtilisateurPanierController {
  constructor(
    @repository(UtilisateurRepository) protected utilisateurRepository: UtilisateurRepository,
  ) { }

  @get('/utilisateurs/{id}/panier', {
    responses: {
      '200': {
        description: 'Utilisateur has one Panier',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Panier),
          },
        },
      },
    },
  })
  async get(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Panier>,
  ): Promise<Panier> {
    return this.utilisateurRepository.panier(id).get(filter);
  }

  @post('/utilisateurs/{id}/panier', {
    responses: {
      '200': {
        description: 'Utilisateur model instance',
        content: {'application/json': {schema: getModelSchemaRef(Panier)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Utilisateur.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Panier, {
            title: 'NewPanierInUtilisateur',
            exclude: ['id'],
            optional: ['utilisateurId']
          }),
        },
      },
    }) panier: Omit<Panier, 'id'>,
  ): Promise<Panier> {
    return this.utilisateurRepository.panier(id).create(panier);
  }

  @patch('/utilisateurs/{id}/panier', {
    responses: {
      '200': {
        description: 'Utilisateur.Panier PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Panier, {partial: true}),
        },
      },
    })
    panier: Partial<Panier>,
    @param.query.object('where', getWhereSchemaFor(Panier)) where?: Where<Panier>,
  ): Promise<Count> {
    return this.utilisateurRepository.panier(id).patch(panier, where);
  }

  @del('/utilisateurs/{id}/panier', {
    responses: {
      '200': {
        description: 'Utilisateur.Panier DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Panier)) where?: Where<Panier>,
  ): Promise<Count> {
    return this.utilisateurRepository.panier(id).delete(where);
  }
}
