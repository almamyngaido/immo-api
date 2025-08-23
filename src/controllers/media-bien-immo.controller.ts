import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Media,
  BienImmo,
} from '../models';
import {MediaRepository} from '../repositories';

export class MediaBienImmoController {
  constructor(
    @repository(MediaRepository)
    public mediaRepository: MediaRepository,
  ) { }

  @get('/media/{id}/bien-immo', {
    responses: {
      '200': {
        description: 'BienImmo belonging to Media',
        content: {
          'application/json': {
            schema: getModelSchemaRef(BienImmo),
          },
        },
      },
    },
  })
  async getBienImmo(
    @param.path.string('id') id: typeof Media.prototype.id,
  ): Promise<BienImmo> {
    return this.mediaRepository.bienImmo(id);
  }
}
