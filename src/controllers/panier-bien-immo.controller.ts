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
Panier,
BienPanier,
BienImmo,
} from '../models';
import {PanierRepository} from '../repositories';

export class PanierBienImmoController {
  constructor(
    @repository(PanierRepository) protected panierRepository: PanierRepository,
  ) { }

  @get('/paniers/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Array of Panier has many BienImmo through BienPanier',
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
    return this.panierRepository.bienImmos(id).find(filter);
  }

  @post('/paniers/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'create a BienImmo model instance',
        content: {'application/json': {schema: getModelSchemaRef(BienImmo)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Panier.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(BienImmo, {
            title: 'NewBienImmoInPanier',
            exclude: ['id'],
          }),
        },
      },
    }) bienImmo: Omit<BienImmo, 'id'>,
  ): Promise<BienImmo> {
    return this.panierRepository.bienImmos(id).create(bienImmo);
  }

  @patch('/paniers/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Panier.BienImmo PATCH success count',
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
    return this.panierRepository.bienImmos(id).patch(bienImmo, where);
  }

  @del('/paniers/{id}/bien-immos', {
    responses: {
      '200': {
        description: 'Panier.BienImmo DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(BienImmo)) where?: Where<BienImmo>,
  ): Promise<Count> {
    return this.panierRepository.bienImmos(id).delete(where);
  }
}
