/**
 * CONTROLLER USER — Plateforme Immobilière Sénégal
 * CRUD + gestion profil courtier, badges, vérification CNI
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  patch,
  post,
  put,
  requestBody,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {User} from '../models';
import {UserRepository} from '../repositories';

export class UserController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
  ) {}

  // ─── Lister les courtiers (public) ─────────────────────────────────────────
  @get('/courtiers', {
    summary: 'Lister les courtiers vérifiés',
    responses: {'200': {description: 'Liste des courtiers', content: {'application/json': {schema: {type: 'array'}}}}},
  })
  async listCourtiers(
    @param.query.string('ville') ville?: string,
    @param.query.number('limit') limit = 20,
    @param.query.number('skip') skip = 0,
  ): Promise<Partial<User>[]> {
    const where: any = {role: 'courtier', actif: true, email_verifie: true};
    if (ville) where.ville = ville;

    const users = await this.userRepository.find({
      where,
      limit,
      skip,
      order: ['stats.note_moyenne DESC'],
    });

    // Masquer les données sensibles
    return users.map(u => {
      const {mot_de_passe, otp, otp_expiry, token_email, reset_password_token, ...safe} = u;
      return safe;
    });
  }

  // ─── Obtenir un courtier par ID (public) ───────────────────────────────────
  @get('/courtiers/{id}', {
    summary: 'Profil public d\'un courtier',
    responses: {'200': {description: 'Profil courtier'}},
  })
  async getCourtier(@param.path.string('id') id: string): Promise<Partial<User>> {
    const user = await this.userRepository.findById(id);
    if (user.role !== 'courtier') {
      throw new HttpErrors.NotFound('Courtier introuvable');
    }
    const {mot_de_passe, otp, otp_expiry, token_email, reset_password_token, ...safe} = user;
    return safe;
  }

  // ─── Mon profil (authentifié) ───────────────────────────────────────────────
  @authenticate('jwt')
  @get('/me', {
    summary: 'Mon profil',
    responses: {'200': {description: 'Profil utilisateur connecté'}},
  })
  async getMyProfile(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<Partial<User>> {
    const user = await this.userRepository.findById(currentUser[securityId]);
    const {mot_de_passe, otp, otp_expiry, token_email, reset_password_token, ...safe} = user;
    return safe;
  }

  // ─── Mettre à jour mon profil ───────────────────────────────────────────────
  @authenticate('jwt')
  @patch('/me', {
    summary: 'Mettre à jour mon profil',
    responses: {'204': {description: 'Profil mis à jour'}},
  })
  async updateMyProfile(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              prenom: {type: 'string'},
              nom: {type: 'string'},
              bio: {type: 'string'},
              avatar_url: {type: 'string'},
              ville: {type: 'string'},
              quartier: {type: 'string'},
              adresse: {type: 'string'},
              nom_agence: {type: 'string'},
              zone_intervention: {type: 'array', items: {type: 'string'}},
              annees_experience: {type: 'number'},
              langues: {type: 'array', items: {type: 'string'}},
              preferences_recherche: {type: 'object'},
              fcm_token: {type: 'string'},
              notifications_actives: {type: 'boolean'},
            },
          },
        },
      },
    })
    update: Partial<User>,
  ): Promise<void> {
    // Interdire la modification de champs sensibles via cette route
    const forbidden = ['role', 'email', 'telephone', 'mot_de_passe', 'email_verifie', 'badges', 'abonnement', 'verification', 'actif'];
    for (const field of forbidden) {
      if (field in update) {
        throw new HttpErrors.Forbidden(`Le champ '${field}' ne peut pas être modifié via cette route.`);
      }
    }
    await this.userRepository.updateById(currentUser[securityId], update);
  }

  // ─── Admin : lister tous les utilisateurs ──────────────────────────────────
  @authenticate('jwt')
  @get('/users', {
    summary: 'Admin : lister tous les utilisateurs',
    responses: {'200': {description: 'Liste utilisateurs'}},
  })
  async listAll(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.query.string('role') role?: string,
    @param.query.number('limit') limit = 50,
    @param.query.number('skip') skip = 0,
  ): Promise<Partial<User>[]> {
    this.requireAdmin(currentUser);
    const where: any = {};
    if (role) where.role = role;
    const users = await this.userRepository.find({where, limit, skip});
    return users.map(u => {
      const {mot_de_passe, ...safe} = u;
      return safe;
    });
  }

  // ─── Admin : obtenir un utilisateur ────────────────────────────────────────
  @authenticate('jwt')
  @get('/users/{id}', {
    summary: 'Admin : obtenir un utilisateur',
    responses: {'200': {description: 'Utilisateur'}},
  })
  async getUser(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<Partial<User>> {
    this.requireAdmin(currentUser);
    const user = await this.userRepository.findById(id);
    const {mot_de_passe, ...safe} = user;
    return safe;
  }

  // ─── Admin : mettre à jour un utilisateur ──────────────────────────────────
  @authenticate('jwt')
  @patch('/users/{id}', {
    summary: 'Admin : mettre à jour un utilisateur',
    responses: {'204': {description: 'Mis à jour'}},
  })
  async updateUser(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({content: {'application/json': {schema: {type: 'object'}}}})
    update: Partial<User>,
  ): Promise<void> {
    this.requireAdmin(currentUser);
    await this.userRepository.updateById(id, update);
  }

  // ─── Admin : valider/rejeter vérification CNI ──────────────────────────────
  @authenticate('jwt')
  @patch('/users/{id}/verification', {
    summary: 'Admin : valider ou rejeter la vérification CNI',
    responses: {'204': {description: 'Vérification mise à jour'}},
  })
  async updateVerification(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['statut'],
            properties: {
              statut: {type: 'string', enum: ['verifie', 'rejete', 'en_cours']},
              admin_note: {type: 'string'},
            },
          },
        },
      },
    })
    body: {statut: string; admin_note?: string},
  ): Promise<void> {
    this.requireAdmin(currentUser);
    const user = await this.userRepository.findById(id);
    await this.userRepository.updateById(id, {
      verification: {
        statut: body.statut,
        admin_note: body.admin_note,
        date_validation: body.statut === 'verifie' ? new Date() : undefined,
      } as any,
      ...(body.statut === 'verifie'
        ? {badges: {...(user.badges as any), verifie: true}}
        : {}),
    });
  }

  // ─── Admin : désactiver un utilisateur ─────────────────────────────────────
  @authenticate('jwt')
  @del('/users/{id}', {
    summary: 'Admin : désactiver un utilisateur',
    responses: {'204': {description: 'Désactivé'}},
  })
  async deactivateUser(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @param.path.string('id') id: string,
  ): Promise<void> {
    this.requireAdmin(currentUser);
    await this.userRepository.updateById(id, {actif: false});
  }

  // ─── Admin : mettre à jour le FCM token ────────────────────────────────────
  @authenticate('jwt')
  @put('/me/fcm-token', {
    summary: 'Mettre à jour le token FCM (push notifications)',
    responses: {'204': {description: 'FCM token mis à jour'}},
  })
  async updateFcmToken(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['fcm_token'],
            properties: {fcm_token: {type: 'string'}},
          },
        },
      },
    })
    body: {fcm_token: string},
  ): Promise<void> {
    await this.userRepository.updateById(currentUser[securityId], {fcm_token: body.fcm_token});
  }

  // ─── Helper : vérification admin ────────────────────────────────────────────
  private requireAdmin(currentUser: UserProfile): void {
    const roles: string[] = (currentUser.roles as string[]) || [];
    if (!roles.some(r => String(r).toLowerCase() === 'admin')) {
      throw new HttpErrors.Forbidden('Accès réservé aux administrateurs.');
    }
  }
}
