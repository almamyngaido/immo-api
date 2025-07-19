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
  BienImmo,
} from '../models';
import {UtilisateurRepository} from '../repositories';

export class UtilisateurBienImmoController {
  constructor(
    @repository(UtilisateurRepository) protected utilisateurRepository: UtilisateurRepository,
  ) { }

  @get('/utilisateurs/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Array of Utilisateur has many BienImmo',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(BienImmo)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<BienImmo>,
  ): Promise<BienImmo[]> {
    return this.utilisateurRepository.bienImmos(id).find(filter);
  }

  @post('/utilisateurs/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Utilisateur model instance',
        content: {'application/json': {schema: getModelSchemaRef(BienImmo)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Utilisateur.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {
            title: 'NewBienImmoInUtilisateur',
            exclude: ['id'],
            optional: ['utilisateurId']
          }),
        },
      },
    }) bienImmo: Omit<BienImmo, 'id'>,
  ): Promise<BienImmo> {
    return this.utilisateurRepository.bienImmos(id).create(bienImmo);
  }

  @patch('/utilisateurs/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Utilisateur.BienImmo PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {partial: true}),
        },
      },
    })
    bienImmo: Partial<BienImmo>,
    @param.query.object('where', getWhereSchemaFor(BienImmo)) where?: Where<BienImmo>,
  ): Promise<Count> {
    return this.utilisateurRepository.bienImmos(id).patch(bienImmo, where);
  }

  @del('/utilisateurs/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Utilisateur.BienImmo DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(BienImmo)) where?: Where<BienImmo>,
  ): Promise<Count> {
    return this.utilisateurRepository.bienImmos(id).delete(where);
  }
}
