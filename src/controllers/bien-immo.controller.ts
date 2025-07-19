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
import {BienImmo} from '../models';
import {BienImmoRepository} from '../repositories';

export class BienImmoController {
  constructor(
    @repository(BienImmoRepository)
    public bienImmoRepository : BienImmoRepository,
  ) {}

  @post('/bien-immos')
  @response(200, {
    description: 'BienImmo model instance',
    content: {'application/json': {schema: getModelSchemaRef(BienImmo)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {
            title: 'NewBienImmo',
            exclude: ['id'],
          }),
        },
      },
    })
    bienImmo: Omit<BienImmo, 'id'>,
  ): Promise<BienImmo> {
    return this.bienImmoRepository.create(bienImmo);
  }

  @get('/bien-immos/count')
  @response(200, {
    description: 'BienImmo model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(BienImmo) where?: Where<BienImmo>,
  ): Promise<Count> {
    return this.bienImmoRepository.count(where);
  }

  @get('/bien-immos')
  @response(200, {
    description: 'Array of BienImmo model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(BienImmo, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(BienImmo) filter?: Filter<BienImmo>,
  ): Promise<BienImmo[]> {
    return this.bienImmoRepository.find(filter);
  }

  @patch('/bien-immos')
  @response(200, {
    description: 'BienImmo PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {partial: true}),
        },
      },
    })
    bienImmo: BienImmo,
    @param.where(BienImmo) where?: Where<BienImmo>,
  ): Promise<Count> {
    return this.bienImmoRepository.updateAll(bienImmo, where);
  }

  @get('/bien-immos/{id}')
  @response(200, {
    description: 'BienImmo model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(BienImmo, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(BienImmo, {exclude: 'where'}) filter?: FilterExcludingWhere<BienImmo>
  ): Promise<BienImmo> {
    return this.bienImmoRepository.findById(id, filter);
  }

  @patch('/bien-immos/{id}')
  @response(204, {
    description: 'BienImmo PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {partial: true}),
        },
      },
    })
    bienImmo: BienImmo,
  ): Promise<void> {
    await this.bienImmoRepository.updateById(id, bienImmo);
  }

  @put('/bien-immos/{id}')
  @response(204, {
    description: 'BienImmo PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() bienImmo: BienImmo,
  ): Promise<void> {
    await this.bienImmoRepository.replaceById(id, bienImmo);
  }

  @del('/bien-immos/{id}')
  @response(204, {
    description: 'BienImmo DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.bienImmoRepository.deleteById(id);
  }
}
