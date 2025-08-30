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
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
  response,
} from '@loopback/rest';
import {BienImmo} from '../models';
import {BienImmoRepository} from '../repositories';

export class BienImmoController {
  constructor(
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,
  ) { }

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
    try {
      // Validate required embedded objects
      this.validateCreateRequest(bienImmo);

      // The repository will handle auto-numbering and validation
      const created = await this.bienImmoRepository.create(bienImmo);

      return created;
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpErrors.BadRequest(`Validation failed: ${error.message}`);
      }
      throw error;
    }
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
    try {
      // Validate partial update data if pieces are being updated
      if (bienImmo.pieces) {
        this.validatePieces(bienImmo.pieces);
      }

      await this.bienImmoRepository.updateById(id, bienImmo);
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpErrors.BadRequest(`Validation failed: ${error.message}`);
      }
      throw error;
    }
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

  // Additional endpoints for the embedded structure

  @get('/bien-immos/{id}/surfaces')
  @response(200, {
    description: 'Get formatted surfaces for display',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {type: 'string'},
              surface: {type: 'number'},
              type: {type: 'string'}
            }
          }
        },
      },
    },
  })
  async getSurfaces(
    @param.path.string('id') id: string,
  ): Promise<Array<{label: string, surface: number, type: string}>> {
    const property = await this.bienImmoRepository.findById(id);
    return property.getSurfacesForDisplay();
  }

  @get('/bien-immos/search/rooms')
  @response(200, {
    description: 'Search properties by room criteria',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(BienImmo, {includeRelations: true}),
        },
      },
    },
  })
  async searchByRooms(
    @param.query.string('roomType') roomType: string,
    @param.query.number('minCount') minCount: number = 1,
    @param.query.number('minSurface') minSurface?: number,
  ): Promise<BienImmo[]> {
    let properties = await this.bienImmoRepository.findWithMinRooms(roomType, minCount);

    if (minSurface) {
      properties = await this.bienImmoRepository.findWithLargeRooms(roomType, minSurface);
    }

    return properties;
  }

  @get('/bien-immos/search/surface')
  @response(200, {
    description: 'Search properties by surface range',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(BienImmo, {includeRelations: true}),
        },
      },
    },
  })
  async searchBySurface(
    @param.query.number('minSurface') minSurface: number = 0,
    @param.query.number('maxSurface') maxSurface: number = 10000,
  ): Promise<BienImmo[]> {
    return this.bienImmoRepository.findBySurfaceRange(minSurface, maxSurface);
  }

  @get('/bien-immos/search/characteristics')
  @response(200, {
    description: 'Search properties by characteristics',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(BienImmo, {includeRelations: true}),
        },
      },
    },
  })
  async searchByCharacteristics(
    @param.query.string('characteristics') characteristicsStr: string,
  ): Promise<BienImmo[]> {
    const characteristics = characteristicsStr.split(',');
    return this.bienImmoRepository.findWithCharacteristics(characteristics);
  }

  @get('/bien-immos/statistics/types')
  @response(200, {
    description: 'Get properties grouped by type',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: {
            type: 'array',
            items: getModelSchemaRef(BienImmo)
          }
        },
      },
    },
  })
  async getPropertiesByType(): Promise<{[typeBien: string]: BienImmo[]}> {
    return this.bienImmoRepository.getPropertiesByType();
  }

  @get('/bien-immos/statistics/average-surfaces')
  @response(200, {
    description: 'Get average surface by property type',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: {
            type: 'number'
          }
        },
      },
    },
  })
  async getAverageSurfaces(): Promise<{[typeBien: string]: number}> {
    return this.bienImmoRepository.getAverageSurfaceByType();
  }

  // Private validation methods
  private validateCreateRequest(bienImmo: Omit<BienImmo, 'id'>): void {
    // Validate required embedded objects
    if (!bienImmo.localisation) {
      throw new Error('Localisation is required');
    }

    if (!bienImmo.surfaces) {
      throw new Error('Surfaces information is required');
    }

    if (!bienImmo.prix) {
      throw new Error('Prix information is required');
    }

    if (!bienImmo.description) {
      throw new Error('Description is required');
    }

    // Validate pieces if provided
    if (bienImmo.pieces) {
      this.validatePieces(bienImmo.pieces);
    }
  }

  private validatePieces(pieces: any[]): void {
    pieces.forEach((piece, index) => {
      if (!piece.type) {
        throw new Error(`Piece ${index + 1}: type is required`);
      }
      if (!piece.surface || piece.surface <= 0) {
        throw new Error(`Piece ${index + 1}: surface must be positive`);
      }
    });
  }
}
