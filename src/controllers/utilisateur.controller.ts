import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
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
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {Utilisateur} from '../models';
import {UtilisateurRepository} from '../repositories';

export class UtilisateurController {
  constructor(
    @repository(UtilisateurRepository)
    public utilisateurRepository: UtilisateurRepository,
  ) { }

  @post('/utilisateurs')
  @response(200, {
    description: 'Utilisateur model instance',
    content: {'application/json': {schema: getModelSchemaRef(Utilisateur)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {
            title: 'NewUtilisateur',
            exclude: ['id'],
          }),
        },
      },
    })
    utilisateur: Omit<Utilisateur, 'id'>,
  ): Promise<Utilisateur> {
    return this.utilisateurRepository.create(utilisateur);
  }

  @get('/utilisateurs/count')
  @response(200, {
    description: 'Utilisateur model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Utilisateur) where?: Where<Utilisateur>,
  ): Promise<Count> {
    return this.utilisateurRepository.count(where);
  }

  @get('/utilisateurs')
  @response(200, {
    description: 'Array of Utilisateur model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Utilisateur, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Utilisateur) filter?: Filter<Utilisateur>,
  ): Promise<Utilisateur[]> {
    return this.utilisateurRepository.find(filter);
  }

  @get('/utilisateurs/inactif')
  @response(200, {
    description: 'Array of Utilisateur model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Utilisateur, {includeRelations: true}),
        },
      },
    },
  })
  async findinactif(
    @param.filter(Utilisateur) filter?: Filter<Utilisateur>,
  ): Promise<Utilisateur[]> {
    return this.utilisateurRepository.find({where: {verified: false}, ...filter});
  }

  @get('utilisateurs/verified')
  @response(200, {
    description: 'Array of Utilisateur model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Utilisateur, {includeRelations: true}),
        },
      },
    },
  })
  async findactif(
    @param.filter(Utilisateur) filter?: Filter<Utilisateur>,
  ): Promise<Utilisateur[]> {
    return this.utilisateurRepository.find({where: {verified: true}, ...filter});
  }

  @patch('/utilisateurs')
  @response(200, {
    description: 'Utilisateur PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {partial: true}),
        },
      },
    })
    utilisateur: Utilisateur,
    @param.where(Utilisateur) where?: Where<Utilisateur>,
  ): Promise<Count> {
    return this.utilisateurRepository.updateAll(utilisateur, where);
  }




  @get('/utilisateurs/{id}')
  @response(200, {
    description: 'Utilisateur model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Utilisateur, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Utilisateur, {exclude: 'where'}) filter?: FilterExcludingWhere<Utilisateur>
  ): Promise<Utilisateur> {
    return this.utilisateurRepository.findById(id, filter);
  }

  @patch('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Utilisateur, {partial: true}),
        },
      },
    })
    utilisateur: Utilisateur,
  ): Promise<void> {
    await this.utilisateurRepository.updateById(id, utilisateur);
  }

  @put('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() utilisateur: Utilisateur,
  ): Promise<void> {
    await this.utilisateurRepository.replaceById(id, utilisateur);
  }



  @del('/utilisateurs/{id}')
  @response(204, {
    description: 'Utilisateur DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.utilisateurRepository.deleteById(id);
  }

  @authenticate('jwt')
  @get('/me')
  @response(200, {
    description: 'Current authenticated user',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Utilisateur, {includeRelations: true}),
      },
    },
  })
  async me(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Partial<Utilisateur>> {
    const userId = currentUser[securityId];
    const user = await this.utilisateurRepository.findById(userId);
    const {motDePasse, otp, otpExpiry, resetPasswordToken, resetPasswordTokenExpiry, verificationToken, ...safeUser} = user;
    return safeUser;
  }


  @put('/utilisateurs/{id}/verification')
  @response(200, {
    description: 'Mise à jour du statut de vérification',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            message: {type: 'string'},
            user: {$ref: '#/components/schemas/Utilisateur'},
          },
        },
      },
    },
  })
  async updateVerificationStatus(
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              verified: {type: 'boolean'},
            },
            required: ['verified'],
          },
        },
      },
    })
    body: {verified: boolean},
  ): Promise<object> {
    // Vérifie que l'utilisateur existe
    const user = await this.utilisateurRepository.findById(id);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Met à jour la propriété verified
    await this.utilisateurRepository.updateById(id, {verified: body.verified});

    // Récupère l'utilisateur mis à jour
    const updatedUser = await this.utilisateurRepository.findById(id);

    return {
      message: `Statut de vérification mis à jour à ${body.verified}`,
      user: updatedUser,
    };
  }

  @put('/users/{id}/role')
  @response(200, {
    description: 'Mise à jour du rôle de l’utilisateur',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            message: {type: 'string'},
            user: {$ref: '#/components/schemas/Utilisateur'},
          },
        },
      },
    },
  })
  async updateUserRole(
    @param.path.string('id') id: string,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['role'],
            properties: {
              role: {
                type: 'string',
                description: 'Nouveau rôle de l’utilisateur (ex: admin, user, etc.)',
              },
            },
          },
        },
      },
    })
    body: {role: string},
  ): Promise<object> {
    // Vérifier que l'utilisateur existe
    const user = await this.utilisateurRepository.findById(id);
    if (!user) {
      throw new HttpErrors.NotFound('Utilisateur non trouvé');
    }

    // Mettre à jour le rôle
    await this.utilisateurRepository.updateById(id, {role: body.role});

    // Récupérer l'utilisateur mis à jour
    const updatedUser = await this.utilisateurRepository.findById(id);

    return {
      message: `Rôle de l’utilisateur mis à jour en "${body.role}"`,
      user: updatedUser,
    };
  }

}
