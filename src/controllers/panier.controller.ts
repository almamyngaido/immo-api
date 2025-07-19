import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Panier} from '../models';
import {PanierRepository} from '../repositories';

export class PanierController {
  constructor(
    @repository(PanierRepository)
    public panierRepository : PanierRepository,
  ) {}

  @post('/paniers')
  @response(200, {
    description: 'Panier model instance',
    content: {'application/json': {schema: getModelSchemaRef(Panier)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Panier, {
            title: 'NewPanier',
            exclude: ['id'],
          }),
        },
      },
    })
    panier: Omit<Panier, 'id'>,
  ): Promise<Panier> {
    return this.panierRepository.create(panier);
  }

  @get('/paniers/count')
  @response(200, {
    description: 'Panier model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Panier) where?: Where<Panier>,
  ): Promise<Count> {
    return this.panierRepository.count(where);
  }

  @get('/paniers')
  @response(200, {
    description: 'Array of Panier model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Panier, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Panier) filter?: Filter<Panier>,
  ): Promise<Panier[]> {
    return this.panierRepository.find(filter);
  }

  @patch('/paniers')
  @response(200, {
    description: 'Panier PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Panier, {partial: true}),
        },
      },
    })
    panier: Panier,
    @param.where(Panier) where?: Where<Panier>,
  ): Promise<Count> {
    return this.panierRepository.updateAll(panier, where);
  }

  @get('/paniers/{id}')
  @response(200, {
    description: 'Panier model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Panier, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Panier, {exclude: 'where'}) filter?: FilterExcludingWhere<Panier>
  ): Promise<Panier> {
    return this.panierRepository.findById(id, filter);
  }

  @patch('/paniers/{id}')
  @response(204, {
    description: 'Panier PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Panier, {partial: true}),
        },
      },
    })
    panier: Panier,
  ): Promise<void> {
    await this.panierRepository.updateById(id, panier);
  }

  @put('/paniers/{id}')
  @response(204, {
    description: 'Panier PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() panier: Panier,
  ): Promise<void> {
    await this.panierRepository.replaceById(id, panier);
  }

  @del('/paniers/{id}')
  @response(204, {
    description: 'Panier DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.panierRepository.deleteById(id);
  }
}
