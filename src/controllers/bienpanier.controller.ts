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
import {BienPanier} from '../models';
import {BienPanierRepository} from '../repositories';

export class BienpanierController {
  constructor(
    @repository(BienPanierRepository)
    public bienPanierRepository: BienPanierRepository,
  ) { }

  @post('/bien-paniers')
  @response(200, {
    description: 'BienPanier model instance',
    content: {'application/json': {schema: getModelSchemaRef(BienPanier)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienPanier, {
            title: 'NewBienPanier',
            exclude: ['id'],
          }),
        },
      },
    })
    bienPanier: Omit<BienPanier, 'id'>,
  ): Promise<BienPanier> {
    return this.bienPanierRepository.create(bienPanier);
  }

  @get('/bien-paniers/count')
  @response(200, {
    description: 'BienPanier model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(BienPanier) where?: Where<BienPanier>,
  ): Promise<Count> {
    return this.bienPanierRepository.count(where);
  }

  @get('/bien-paniers')
  @response(200, {
    description: 'Array of BienPanier model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(BienPanier, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(BienPanier) filter?: Filter<BienPanier>,
  ): Promise<BienPanier[]> {
    return this.bienPanierRepository.find(filter);
  }

  @patch('/bien-paniers')
  @response(200, {
    description: 'BienPanier PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienPanier, {partial: true}),
        },
      },
    })
    bienPanier: BienPanier,
    @param.where(BienPanier) where?: Where<BienPanier>,
  ): Promise<Count> {
    return this.bienPanierRepository.updateAll(bienPanier, where);
  }

  @get('/bien-paniers/{id}')
  @response(200, {
    description: 'BienPanier model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(BienPanier, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(BienPanier, {exclude: 'where'}) filter?: FilterExcludingWhere<BienPanier>
  ): Promise<BienPanier> {
    return this.bienPanierRepository.findById(id, filter);
  }

  @patch('/bien-paniers/{id}')
  @response(204, {
    description: 'BienPanier PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienPanier, {partial: true}),
        },
      },
    })
    bienPanier: BienPanier,
  ): Promise<void> {
    await this.bienPanierRepository.updateById(id, bienPanier);
  }

  @put('/bien-paniers/{id}')
  @response(204, {
    description: 'BienPanier PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() bienPanier: BienPanier,
  ): Promise<void> {
    await this.bienPanierRepository.replaceById(id, bienPanier);
  }

  @del('/bien-paniers/{id}')
  @response(204, {
    description: 'BienPanier DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.bienPanierRepository.deleteById(id);
  }
}
