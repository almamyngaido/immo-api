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
  HttpErrors,
} from '@loopback/rest';
import {BienImmo, BienPanier, Panier} from '../models';
  import { PanierRepository, BienPanierRepository, BienImmoRepository } from '../repositories';

export class PanierController {
  constructor(
  @repository(PanierRepository)
    public panierRepository: PanierRepository,
    @repository(BienPanierRepository)
    public bienPanierRepository: BienPanierRepository,
    @repository(BienImmoRepository)
    public bienImmoRepository: BienImmoRepository,

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
  // Vérifier si un panier existe déjà pour cet utilisateur
  const existing = await this.panierRepository.findOne({
    where: {utilisateurId: panier.utilisateurId},
  });

  if (existing) {
    throw new Error(`❌ L'utilisateur ${panier.utilisateurId} a déjà un panier.`);
  }

  return this.panierRepository.create(panier);
}


  @post('/paniers/ajouter-bien')
  @response(200, {
    description: 'Ajouter un bien immobilier au panier de l\'utilisateur',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            panier: { 'x-ts-type': Panier },
            bienPanier: { 'x-ts-type': BienPanier }
          }
        }
      }
    },
  })
  async ajouterBienAuPanier(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['utilisateurId', 'bienImmoId'],
            properties: {
              utilisateurId: { type: 'string' },
              bienImmoId: { type: 'string' },
              statutDemande: { type: 'string' } // optionnel, par défaut "en_attente"
            }
          }
        },
      },
    })
    data: {
      utilisateurId: string;
      bienImmoId: string;
      statutDemande?: string;
    },
  ): Promise<{
    success: boolean;
    message: string;
    panier: Panier;
    bienPanier: BienPanier;
  }> {
    try {
      // 1. Vérifier si un panier existe déjà pour cet utilisateur
      let panier = await this.panierRepository.findOne({
        where: { utilisateurId: data.utilisateurId },
      });

      // 2. Si aucun panier n'existe, en créer un
      if (!panier) {
        console.log(`📝 Création d'un nouveau panier pour l'utilisateur ${data.utilisateurId}`);
        panier = await this.panierRepository.create({
          utilisateurId: data.utilisateurId,
        });
        console.log(`✅ Panier créé avec l'ID: ${panier.id}`);
      } else {
        console.log(`📦 Panier existant trouvé: ${panier.id}`);
      }

      // 3. Vérifier si le bien n'est pas déjà dans le panier
      const bienDejaAjoute = await this.bienPanierRepository.findOne({
        where: {
          panierId: panier.id,
          bienImmoId: data.bienImmoId,
        },
      });

      if (bienDejaAjoute) {
        throw new Error(`❌ Le bien immobilier ${data.bienImmoId} est déjà dans le panier.`);
      }

      // 4. Créer la relation dans BienPanier
      const bienPanier = await this.bienPanierRepository.create({
        panierId: panier.id,
        bienImmoId: data.bienImmoId,
        statutDemande: data.statutDemande || 'en_attente', // statut par défaut
      });

      console.log(`✅ Bien immobilier ${data.bienImmoId} ajouté au panier ${panier.id}`);

      return {
        success: true,
        message: 'Bien immobilier ajouté au panier avec succès',
        panier: panier,
        bienPanier: bienPanier,
      };

    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du bien au panier:', error);
      throw new HttpErrors.BadRequest(error.message || 'Erreur lors de l\'ajout du bien au panier');
    }
  }


  @get('/paniers/utilisateur/{utilisateurId}')
  @response(200, {
    description: 'Récupérer le panier d\'un utilisateur avec ses biens immobiliers',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            panier: { 'x-ts-type': Panier },
            biens: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  bienImmo: { 'x-ts-type': BienImmo },
                  statutDemande: { type: 'string' },
                  bienPanierId: { type: 'string' }
                }
              }
            }
          }
        }
      }
    },
  })
  async getPanierUtilisateur(
    @param.path.string('utilisateurId') utilisateurId: string,
  ): Promise<{
    panier: Panier | null;
    biens: Array<{
      bienImmo: BienImmo;
      statutDemande: string;
      bienPanierId: string;
    }>;
  }> {
    try {
      // Trouver le panier de l'utilisateur
      const panier = await this.panierRepository.findOne({
        where: { utilisateurId: utilisateurId },
      });

      if (!panier) {
        return {
          panier: null,
          biens: [],
        };
      }

      // Récupérer tous les BienPanier pour ce panier
      const biensPanier = await this.bienPanierRepository.find({
        where: { panierId: panier.id },
      });

      // Récupérer les biens immobiliers correspondants
      const biens = [];
      for (const bp of biensPanier) {
        if (bp.bienImmoId) {
          try {
            const bienImmo = await this.bienImmoRepository.findById(bp.bienImmoId);
            biens.push({
              bienImmo: bienImmo,
              statutDemande: bp.statutDemande,
              bienPanierId: bp.id!,
            });
          } catch (error) {
            console.warn(`Bien immobilier non trouvé: ${bp.bienImmoId}`);
          }
        }
      }

      return {
        panier: panier,
        biens: biens,
      };

    } catch (error) {
      console.error('❌ Erreur lors de la récupération du panier:', error);
      throw new HttpErrors.BadRequest('Erreur lors de la récupération du panier');
    }
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
