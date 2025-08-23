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
  BienImmo,
  Media,
} from '../models';
import {BienImmoRepository} from '../repositories';

export class BienImmoMediaController {
  constructor(
    @repository(BienImmoRepository) protected bienImmoRepository: BienImmoRepository,
  ) { }

  @get('/bien-immos/{id}/media', {
    responses: {
      '200': {
        description: 'Array of BienImmo has many Media',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Media)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Media>,
  ): Promise<Media[]> {
    return this.bienImmoRepository.media(id).find(filter);
  }

  @post('/bien-immos/{id}/media', {
    responses: {
      '200': {
        description: 'BienImmo model instance',
        content: {'application/json': {schema: getModelSchemaRef(Media)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof BienImmo.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Media, {
            title: 'NewMediaInBienImmo',
            exclude: ['id'],
            optional: ['bienImmoId']
          }),
        },
      },
    }) media: Omit<Media, 'id'>,
  ): Promise<Media> {
    return this.bienImmoRepository.media(id).create(media);
  }

  @patch('/bien-immos/{id}/media', {
    responses: {
      '200': {
        description: 'BienImmo.Media PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Media, {partial: true}),
        },
      },
    })
    media: Partial<Media>,
    @param.query.object('where', getWhereSchemaFor(Media)) where?: Where<Media>,
  ): Promise<Count> {
    return this.bienImmoRepository.media(id).patch(media, where);
  }

  @del('/bien-immos/{id}/media', {
    responses: {
      '200': {
        description: 'BienImmo.Media DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Media)) where?: Where<Media>,
  ): Promise<Count> {
    return this.bienImmoRepository.media(id).delete(where);
  }
}
