import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  BienImmo,
  Utilisateur,
} from '../models';
import {BienImmoRepository} from '../repositories';

export class BienImmoUtilisateurController {
  constructor(
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,
  ) { }

  @get('/bien-immos/{id}/utilisateur', {
    responses: {
      '200': {
        description: 'Utilisateur belonging to BienImmo',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Utilisateur),
          },
        },
      },
    },
  })
  async getUtilisateur(
    @param.path.string('id') id: typeof BienImmo.prototype.id,
  ): Promise<Utilisateur> {
    return this.bienImmoRepository.utilisateur(id);
  }
}
