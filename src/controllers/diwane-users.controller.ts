/**
 * DIWANE — Controller Users B2C
 * Routes : POST /api/users, POST /api/users/login, GET /api/users/me
 *
 * Différences vs AuthController existant (B2B) :
 *  - Inscription B2C : email_verifie = true, JWT retourné immédiatement
 *  - Login simplifié : { email, mot_de_passe } → { user, token }
 *  - /me : profil + annonces actives si courtier
 */
import {authenticate} from '@loopback/authentication';
import {TokenServiceBindings} from '@loopback/authentication-jwt';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
import * as crypto from 'crypto';
import {
  get,
  HttpErrors,
  param,
  post,
  requestBody,
  Response,
  RestBindings,
  SchemaObject,
} from '@loopback/rest';
import {diwaneEmail} from '../services/diwane-email.service';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import {Bien, getLimitesParPlan, User} from '../models';
import {BienRepository, UserRepository} from '../repositories';
import {comparePassword} from '../services/hash.password';
import {JwtService} from '../services/jwt.service';
import {diwaneBien} from '../utils/diwane-bien.utils';

const SENEGAL_PHONE_REGEX = /^\+221[37][0-9]{8}$/;

function validatePhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  if (!SENEGAL_PHONE_REGEX.test(cleaned)) {
    throw new HttpErrors.UnprocessableEntity(
      'Numéro invalide. Format attendu : +221771234567',
    );
  }
  return cleaned;
}

function safeUser(user: User): Omit<User, 'mot_de_passe' | 'otp' | 'otp_expiry' | 'token_email' | 'reset_password_token'> {
  const {mot_de_passe, otp, otp_expiry, token_email, reset_password_token, ...safe} = user as any;
  return safe;
}

// ─── Schémas ──────────────────────────────────────────────────────────────────

const RegisterSchema: SchemaObject = {
  type: 'object',
  required: ['prenom', 'nom', 'email', 'telephone', 'mot_de_passe', 'role'],
  properties: {
    prenom:             {type: 'string'},
    nom:                {type: 'string'},
    email:              {type: 'string', format: 'email'},
    telephone:          {type: 'string', description: 'Format : +221771234567'},
    mot_de_passe:       {type: 'string', minLength: 8},
    role:               {type: 'string', enum: ['courtier', 'acheteur']},
    nom_agence:         {type: 'string'},
    ville:              {type: 'string'},
    zones_intervention: {type: 'array', items: {type: 'string'}},
  },
};

const LoginSchema: SchemaObject = {
  type: 'object',
  required: ['email', 'mot_de_passe'],
  properties: {
    email:        {type: 'string', format: 'email'},
    mot_de_passe: {type: 'string', minLength: 8},
  },
};

// ─── Controller ──────────────────────────────────────────────────────────────

export class DiwaneUsersController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @repository(BienRepository)
    public bienRepository: BienRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JwtService,
  ) {}

  // ─── POST /api/users — Inscription B2C ───────────────────────────────────────

  @post('/api/users', {
    summary: '[Diwane] Inscription B2C — retourne JWT immédiatement',
    responses: {
      '201': {
        description: 'Compte créé',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user:  {type: 'object'},
                token: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async inscrire(
    @requestBody({
      required: true,
      content: {'application/json': {schema: RegisterSchema}},
    })
    data: {
      prenom: string;
      nom: string;
      email: string;
      telephone: string;
      mot_de_passe: string;
      role: string;
      nom_agence?: string;
      ville?: string;
      zones_intervention?: string[];
    },
  ): Promise<{user: object; token: string}> {

    // Validation téléphone Sénégal
    data.telephone = validatePhone(data.telephone);

    // Unicité email + téléphone
    const existing = await this.userRepository.findOne({
      where: {
        or: [
          {email: data.email.toLowerCase().trim()},
          {telephone: data.telephone},
        ],
      },
    });
    if (existing) {
      throw new HttpErrors.Conflict('Email ou téléphone déjà utilisé.');
    }

    // Génération du token de vérification email
    const tokenVerif = crypto.randomBytes(32).toString('hex');

    // Création — email_verifie=false jusqu'à confirmation
    const newUser = await this.userRepository.create({
      prenom:           data.prenom.trim(),
      nom:              data.nom.trim(),
      email:            data.email.toLowerCase().trim(),
      mot_de_passe:     data.mot_de_passe,
      telephone:        data.telephone,
      role:             data.role,
      ville:            data.ville ?? 'Dakar',
      nom_agence:       data.nom_agence,
      zone_intervention: data.zones_intervention,
      email_verifie:    false,
      token_email:      tokenVerif,
      actif:            true,
      derniere_connexion: new Date(),
      abonnement: {plan: 'gratuit', actif: false, prix_fcfa: 0} as any,
      badges: {
        verifie: false,
        top_courtier: false,
        ultra_reactif: false,
        photos_certifiees: false,
        premium: false,
      } as any,
      verification: {statut: 'en_attente'} as any,
      stats: {
        nb_annonces_actives: 0,
        nb_annonces_total: 0,
        nb_transactions: 0,
        nb_vues_total: 0,
        nb_contacts_recus: 0,
        note_moyenne: 0,
        nb_avis: 0,
        taux_reponse: 0,
      } as any,
      limites: getLimitesParPlan('gratuit') as any,
      createdAt:  new Date(),
      updatedAt:  new Date(),
    });

    const profile: UserProfile = {
      [securityId]: newUser.id!,
      name:     `${newUser.prenom} ${newUser.nom}`.trim(),
      email:    newUser.email,
      telephone: newUser.telephone,
      roles:    [newUser.role],
    };
    const token = await this.jwtService.generateToken(profile);

    // Envoi email de vérification (best-effort — ne bloque pas l'inscription)
    diwaneEmail.envoyerVerification(newUser.email, newUser.prenom, tokenVerif).catch(e => {
      console.error('[Auth] Erreur envoi email vérification:', e);
    });

    return {user: safeUser(newUser), token};
  }

  // ─── GET /api/auth/verifier-email?token=xxx ───────────────────────────────

  @get('/api/auth/verifier-email', {
    summary: '[Diwane] Vérifier l\'email via token (lien email)',
    responses: {'200': {description: 'HTML confirmation'}},
  })
  async verifierEmail(
    @param.query.string('token') token: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<Response> {
    const user = token
      ? await this.userRepository.findOne({where: {token_email: token} as any}).catch(() => null)
      : null;

    let html: string;
    if (user) {
      await this.userRepository.updateById(user.id!, {
        email_verifie: true,
        token_email: undefined,
        updatedAt: new Date(),
      } as any);
      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Email vérifié</title>
<style>body{font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:440px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#1B2A4A}.badge{font-size:56px;margin-bottom:16px}</style></head>
<body><div class="box"><div class="badge">✅</div><h2>Email vérifié !</h2>
<p>Bonjour <strong>${user.prenom}</strong>, votre adresse email a été vérifiée avec succès.</p>
<p>Vous pouvez maintenant vous connecter sur l'application Diwane.</p></div></body></html>`;
    } else {
      html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Lien invalide</title>
<style>body{font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:440px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#e53e3e}.badge{font-size:56px;margin-bottom:16px}</style></head>
<body><div class="box"><div class="badge">❌</div><h2>Lien invalide</h2>
<p>Ce lien de vérification est invalide ou a déjà été utilisé.</p></div></body></html>`;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    return res;
  }

  // ─── POST /api/auth/renvoyer-verification ─────────────────────────────────

  @authenticate('jwt')
  @post('/api/auth/renvoyer-verification', {
    summary: '[Diwane] Renvoyer l\'email de vérification',
    responses: {'200': {description: 'Email envoyé'}},
  })
  async renvoyerVerification(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{message: string}> {
    const userId = currentUser[securityId];
    const user = await this.userRepository.findById(userId);

    if (user.email_verifie) {
      throw new HttpErrors.Conflict('Votre email est déjà vérifié.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.userRepository.updateById(userId, {
      token_email: token,
      updatedAt: new Date(),
    } as any);

    await diwaneEmail.envoyerVerification(user.email, user.prenom, token);
    return {message: 'Email de vérification envoyé.'};
  }

  // ─── POST /api/users/login — Connexion simplifiée ─────────────────────────

  @post('/api/users/login', {
    summary: '[Diwane] Connexion par email + mot de passe',
    responses: {
      '200': {
        description: 'Authentifié',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                user:  {type: 'object'},
                token: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async connecter(
    @requestBody({
      required: true,
      content: {'application/json': {schema: LoginSchema}},
    })
    credentials: {email: string; mot_de_passe: string},
  ): Promise<{user: object; token: string}> {

    const user = await this.userRepository.findOne({
      where: {email: credentials.email.toLowerCase().trim()},
    });

    if (!user) {
      throw new HttpErrors.Unauthorized('Identifiants incorrects.');
    }
    if (!user.actif) {
      throw new HttpErrors.Unauthorized('Compte désactivé. Contactez le support.');
    }
    if (!user.email_verifie) {
      throw new HttpErrors.Unauthorized('Email non vérifié. Vérifiez votre boîte mail.');
    }

    const passwordOk = await comparePassword(credentials.mot_de_passe, user.mot_de_passe);
    if (!passwordOk) {
      throw new HttpErrors.Unauthorized('Identifiants incorrects.');
    }

    // Mise à jour dernière connexion (best-effort)
    this.userRepository.updateById(user.id!, {
      derniere_connexion: new Date(),
    }).catch(() => {});

    const profile: UserProfile = {
      [securityId]: user.id!,
      name:     `${user.prenom} ${user.nom}`.trim(),
      email:    user.email,
      telephone: user.telephone,
      roles:    [user.role],
    };
    const token = await this.jwtService.generateToken(profile);

    return {user: safeUser(user), token};
  }

  // ─── GET /api/users/me — Profil courant ───────────────────────────────────

  @authenticate('jwt')
  @get('/api/users/me', {
    summary: '[Diwane] Profil utilisateur connecté',
    responses: {
      '200': {
        description: 'Profil',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async monProfil(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object> {
    const user = await this.userRepository.findById(currentUser[securityId]);

    let annoncesActives: Partial<Bien>[] = [];
    if (user.role === 'courtier') {
      annoncesActives = await this.bienRepository.find({
        where: {
          courtier_id: user.id!,
          statut: {inq: ['publie', 'en_attente', 'brouillon']},
        } as any,
        order: ['createdAt DESC'],
        limit: 50,
        fields: {
          id: true,
          reference: true,
          titre: true,
          statut: true,
          type_transaction: true,
          type_bien: true,
          localisation: true,
          finances: true,
          medias: true,
          en_vedette: true,
          createdAt: true,
        } as any,
      });
    }

    return {
      ...safeUser(user),
      annonces_actives: annoncesActives,
    };
  }

  // ─── GET /api/courtiers/{id}/biens — Biens d'un courtier ─────────────────────

  @get('/api/courtiers/{id}/biens', {
    summary: '[Diwane] Biens publiés par un courtier',
    responses: {
      '200': {
        description: 'Liste des biens du courtier',
        content: {'application/json': {schema: {type: 'array'}}},
      },
    },
  })
  async biensDuCourtier(
    @param.path.string('id') id: string,
    @param.query.string('statut') statut?: string,
    @param.query.number('limit')  limit = 20,
    @param.query.number('skip')   skip  = 0,
  ): Promise<object[]> {
    const courtier = await this.userRepository.findById(id).catch(() => {
      throw new HttpErrors.NotFound('Courtier introuvable.');
    });

    const where: any = {courtier_id: id};

    if (statut && statut !== 'tous') {
      where.statut = statut;
    }
    // Sans filtre statut : retourne tous les biens sauf archivés/rejetés
    // pour la vue publique du profil courtier
    else if (!statut) {
      where.statut = 'publie';
    }

    const biens = await this.bienRepository.find({
      where,
      order: ['createdAt DESC'],
      limit: Math.min(limit, 100),
      skip,
    });

    return biens.map(b => diwaneBien(b, courtier));
  }
}
