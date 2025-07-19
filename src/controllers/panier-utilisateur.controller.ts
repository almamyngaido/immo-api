import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Panier,
  Utilisateur,
} from '../models';
import {PanierRepository} from '../repositories';

export class PanierUtilisateurController {
  constructor(
    @repository(PanierRepository)
    public panierRepository: PanierRepository,
  ) { }

  @get('/paniers/{id}/utilisateur', {
    responses: {
      '200': {
        description: 'Utilisateur belonging to Panier',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Utilisateur),
          },
        },
      },
    },
  })
  async getUtilisateur(
    @param.path.string('id') id: typeof Panier.prototype.id,
  ): Promise<Utilisateur> {
    return this.panierRepository.utilisateur(id);
  }
}
