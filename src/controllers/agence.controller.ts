/**
 * DIWANE — AgenceController
 * Gestion des agents d'une agence Pro (max 7 par agence)
 */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import {
  del,
  get,
  HttpErrors,
  param,
  post,
  requestBody,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import * as bcrypt from 'bcryptjs';
import {getLimitesParPlan} from '../models';
import {UserRepository} from '../repositories';

function genMotDePasse(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export class AgenceController {
  constructor(
    @repository(UserRepository)
    private userRepo: UserRepository,
  ) {}

  // ── GET /api/agence/membres ────────────────────────────────────────────────

  @authenticate('jwt')
  @get('/api/agence/membres', {
    summary: '[Diwane] Lister les agents de mon agence (Pro)',
    responses: {
      '200': {
        description: 'Liste des agents',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async listerMembres(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    const owner = await this.userRepo.findById(userId);

    if (owner.role !== 'courtier') throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    if ((owner as any).abonnement?.plan !== 'pro') {
      throw new HttpErrors.Forbidden('Fonctionnalité réservée au plan Pro.');
    }

    const membres = await this.userRepo.find({
      where: {agence_id: userId} as any,
      fields: {
        mot_de_passe: false,
        token_email: false,
        reset_password_token: false,
        otp: false,
        otp_expiry: false,
      } as any,
    });

    return membres;
  }

  // ── POST /api/agence/inviter ────────────────────────────────────────────────

  @authenticate('jwt')
  @post('/api/agence/inviter', {
    summary: '[Diwane] Ajouter un agent à l\'agence (Pro)',
    responses: {
      '200': {
        description: 'Agent créé ou lié',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                agent: {type: 'object'},
                mot_de_passe_temporaire: {type: 'string'},
                nouveau_compte: {type: 'boolean'},
              },
            },
          },
        },
      },
    },
  })
  async inviterAgent(
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['prenom', 'nom', 'telephone', 'email'],
            properties: {
              prenom:    {type: 'string'},
              nom:       {type: 'string'},
              telephone: {type: 'string', description: 'Format +221XXXXXXXXX'},
              email:     {type: 'string', format: 'email'},
            },
          },
        },
      },
    })
    body: {prenom: string; nom: string; telephone: string; email: string},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{agent: object; mot_de_passe_temporaire?: string; nouveau_compte: boolean}> {
    const userId = currentUser[securityId];
    const owner = await this.userRepo.findById(userId);

    if (owner.role !== 'courtier') throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    if ((owner as any).abonnement?.plan !== 'pro') {
      throw new HttpErrors.Forbidden('Fonctionnalité réservée au plan Pro.');
    }

    // Vérifier quota
    const maxAgents = owner.limites?.max_utilisateurs_agence ?? 7;
    const existants = await this.userRepo.count({agence_id: userId} as any);
    if (existants.count >= maxAgents - 1) { // -1 car le propriétaire compte comme 1
      throw new HttpErrors.UnprocessableEntity(
        `Quota atteint : votre agence ne peut pas dépasser ${maxAgents} utilisateurs (vous inclus).`,
      );
    }

    // Vérifier si un compte existe déjà avec ce téléphone ou email
    const existingByPhone = await this.userRepo.findOne({where: {telephone: body.telephone} as any});
    const existingByEmail = await this.userRepo.findOne({where: {email: body.email.toLowerCase()} as any});
    const existing = existingByPhone ?? existingByEmail;

    if (existing) {
      // Le compte existe — vérifier qu'il n'est pas déjà dans une autre agence
      if ((existing as any).agence_id && (existing as any).agence_id !== userId) {
        throw new HttpErrors.Conflict('Cet utilisateur appartient déjà à une autre agence.');
      }
      // Lier à l'agence
      await this.userRepo.updateById(existing.id!, {
        agence_id: userId,
        role: 'courtier',
        updatedAt: new Date(),
      } as any);

      const updated = await this.userRepo.findById(existing.id!, {
        fields: {mot_de_passe: false, token_email: false, reset_password_token: false, otp: false} as any,
      });

      return {agent: updated, nouveau_compte: false};
    }

    // Créer un nouveau compte agent
    const tempPassword = genMotDePasse();
    const hash = await bcrypt.hash(tempPassword, 10);
    const limites = getLimitesParPlan('pro'); // hérite du plan Pro de l'agence

    const nouvelAgent = await this.userRepo.create({
      prenom:    body.prenom,
      nom:       body.nom,
      email:     body.email.toLowerCase(),
      telephone: body.telephone,
      mot_de_passe: hash,
      role:      'courtier',
      agence_id: userId,
      nom_agence: (owner as any).nom_agence, // hérite du nom d'agence
      ville:     owner.ville ?? 'Dakar',
      abonnement: {
        plan: 'pro',
        actif: true,
        prix_fcfa: 0,
        date_debut: new Date(),
        date_fin: (owner as any).abonnement?.date_fin ?? new Date(Date.now() + 30 * 86400000),
        paiement_methode: 'agence',
        transaction_id: `agence_${userId}`,
      },
      limites,
      email_verifie: true,
      actif: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Ne pas exposer le mot de passe hashé
    const {mot_de_passe: _pwd, ...agentSafe} = nouvelAgent as any;

    return {
      agent: agentSafe,
      mot_de_passe_temporaire: tempPassword,
      nouveau_compte: true,
    };
  }

  // ── DELETE /api/agence/membres/:membreId ────────────────────────────────────

  @authenticate('jwt')
  @del('/api/agence/membres/{membreId}', {
    summary: '[Diwane] Retirer un agent de l\'agence',
    responses: {'204': {description: 'Agent retiré'}},
  })
  async retirerMembre(
    @param.path.string('membreId') membreId: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<void> {
    const userId = currentUser[securityId];
    const owner = await this.userRepo.findById(userId);

    if (owner.role !== 'courtier') throw new HttpErrors.Forbidden();
    if ((owner as any).abonnement?.plan !== 'pro') throw new HttpErrors.Forbidden();

    const membre = await this.userRepo.findById(membreId).catch(() => {
      throw new HttpErrors.NotFound('Agent introuvable.');
    });

    if ((membre as any).agence_id !== userId) {
      throw new HttpErrors.Forbidden('Cet agent n\'appartient pas à votre agence.');
    }

    // Détacher l'agent de l'agence (ne pas supprimer le compte)
    await this.userRepo.updateById(membreId, {
      agence_id: undefined,
      abonnement: {
        plan: 'gratuit',
        actif: false,
        prix_fcfa: 0,
        paiement_methode: 'agence',
      },
      limites: getLimitesParPlan('gratuit'),
      updatedAt: new Date(),
    } as any);
  }
}
