/**
 * AUTH CONTROLLER — Plateforme Immobilière Sénégal
 * Login (email/OTP), Signup (courtier/acheteur), Reset password
 * Remplace : authentification France B2B → Sénégal B2C
 */
import {authenticate} from '@loopback/authentication';
import {TokenServiceBindings} from '@loopback/authentication-jwt';
import {inject} from '@loopback/core';
import {repository} from '@loopback/repository';
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
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import disposableEmailDomains from 'disposable-email-domains';
import {getLimitesParPlan, User} from '../models';
import {UserRepository} from '../repositories';
import {comparePassword} from '../services/hash.password';
import {JwtService} from '../services/jwt.service';
import {EmailService} from '../services/mailer';

require('dotenv').config();

// ─── Validation téléphone Sénégal ─────────────────────────────────────────────
const SENEGAL_PHONE_REGEX = /^\+221[37][0-9]{8}$/;

function validateSenegalPhone(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  if (!SENEGAL_PHONE_REGEX.test(cleaned)) {
    throw new HttpErrors.BadRequest(
      'Format téléphone invalide. Exemple: +221771234567 (Orange/Free) ou +221331234567 (fixe)',
    );
  }
  return cleaned;
}

// ─── Schémas de requête ───────────────────────────────────────────────────────
const CredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['identifier', 'type'],
  properties: {
    identifier: {type: 'string'},
    type: {type: 'string', enum: ['email', 'telephone']},
    mot_de_passe: {type: 'string', minLength: 8},
    otp: {type: 'string', pattern: '^[0-9]{6}$'},
  },
};

const SignupSchema: SchemaObject = {
  type: 'object',
  required: ['prenom', 'nom', 'email', 'telephone', 'mot_de_passe', 'role'],
  properties: {
    prenom: {type: 'string'},
    nom: {type: 'string'},
    email: {type: 'string', format: 'email'},
    telephone: {type: 'string', description: 'Format: +221771234567'},
    mot_de_passe: {type: 'string', minLength: 8},
    role: {type: 'string', enum: ['courtier', 'acheteur']},
    ville: {type: 'string'},
  },
};

const VerifyOtpSchema: SchemaObject = {
  type: 'object',
  required: ['email', 'otp'],
  properties: {
    email: {type: 'string', format: 'email'},
    otp: {type: 'string', pattern: '^[0-9]{6}$'},
  },
};

const ForgotPasswordSchema: SchemaObject = {
  type: 'object',
  required: ['identifier'],
  properties: {identifier: {type: 'string'}},
};

const ResetPasswordSchema: SchemaObject = {
  type: 'object',
  required: ['token', 'newPassword'],
  properties: {
    token: {type: 'string'},
    newPassword: {type: 'string', minLength: 8},
  },
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface Credentials {
  identifier: string;
  type: 'email' | 'telephone';
  mot_de_passe?: string;
  otp?: string;
}

interface SignupData {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  mot_de_passe: string;
  role: string;
  ville?: string;
}

interface VerifyOtpData {
  email: string;
  otp: string;
}

interface ForgotPasswordData {
  identifier: string;
}

interface ResetPasswordData {
  token: string;
  newPassword: string;
}

// ─── Controller ──────────────────────────────────────────────────────────────
export class AuthController {
  constructor(
    @repository(UserRepository)
    public userRepository: UserRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JwtService,
    @inject('services.EmailService')
    public emailService: EmailService,
  ) {}

  // ─── Connexion email ou téléphone ─────────────────────────────────────────
  @post('/login', {
    responses: {
      '200': {
        description: 'JWT token',
        content: {'application/json': {schema: {type: 'object', properties: {token: {type: 'string'}}}}},
      },
    },
  })
  async login(
    @requestBody({description: 'Credentials', required: true, content: {'application/json': {schema: CredentialsSchema}}})
    credentials: Credentials,
  ): Promise<{token: string}> {
    const {identifier, type, mot_de_passe, otp} = credentials;

    const user = await this.userRepository.findOne({
      where: type === 'email'
        ? {email: identifier.toLowerCase().trim()}
        : {telephone: identifier.replace(/\s/g, '')},
    });

    if (!user) throw new HttpErrors.Unauthorized('Identifiants invalides.');
    if (!user.actif) throw new HttpErrors.Unauthorized('Compte désactivé.');
    if (!user.email_verifie) throw new HttpErrors.Unauthorized('Email non vérifié. Contactez votre administrateur.');

    if (type === 'email') {
      if (!mot_de_passe) throw new HttpErrors.BadRequest('Mot de passe requis.');
      const ok = await comparePassword(mot_de_passe, user.mot_de_passe);
      if (!ok) throw new HttpErrors.Unauthorized('Identifiants invalides.');
    } else {
      // Connexion par OTP téléphone
      if (!otp) {
        const newOtp = this.emailService.generateOtp();
        await this.userRepository.updateById(user.id!, {
          otp: newOtp,
          otp_expiry: this.emailService.getTokenExpiration(),
        });
        await this.emailService.sendOtpEmail(user.email, user.prenom, newOtp);
        throw new HttpErrors.Unauthorized('OTP envoyé par email. Veuillez vérifier.');
      }
      if (otp !== user.otp || !user.otp_expiry || new Date(user.otp_expiry) < new Date()) {
        throw new HttpErrors.Unauthorized('OTP invalide ou expiré.');
      }
      await this.userRepository.updateById(user.id!, {otp: undefined, otp_expiry: undefined});
    }

    // Mettre à jour la dernière connexion
    await this.userRepository.updateById(user.id!, {derniere_connexion: new Date()});

    const userProfile: UserProfile = {
      [securityId]: user.id!,
      name: `${user.prenom} ${user.nom}`.trim(),
      email: user.email,
      telephone: user.telephone,
      roles: [user.role],
    };

    const token = await this.jwtService.generateToken(userProfile);
    return {token};
  }

  // ─── Inscription ──────────────────────────────────────────────────────────
  @post('/signup', {
    responses: {
      '200': {
        description: 'Inscription en attente d\'approbation admin',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async signup(
    @requestBody({description: 'Données d\'inscription', required: true, content: {'application/json': {schema: SignupSchema}}})
    signupData: SignupData,
  ): Promise<Partial<User>> {
    // Validation email jetable
    const emailDomain = signupData.email.split('@')[1];
    if (disposableEmailDomains.indexOf(emailDomain) !== -1) {
      throw new HttpErrors.BadRequest('Les adresses email temporaires ne sont pas acceptées.');
    }

    // Validation téléphone Sénégal
    signupData.telephone = validateSenegalPhone(signupData.telephone);

    // Vérification unicité
    const existing = await this.userRepository.findOne({
      where: {or: [{email: signupData.email.toLowerCase()}, {telephone: signupData.telephone}]},
    });
    if (existing) throw new HttpErrors.Conflict('Email ou téléphone déjà utilisé.');

    // Création de l'utilisateur (non vérifié)
    const newUser = await this.userRepository.create({
      prenom: signupData.prenom.trim(),
      nom: signupData.nom.trim(),
      email: signupData.email.toLowerCase().trim(),
      mot_de_passe: signupData.mot_de_passe,
      telephone: signupData.telephone,
      role: signupData.role,
      ville: signupData.ville ?? 'Dakar',
      email_verifie: false,
      actif: true,
      abonnement: {plan: 'gratuit', actif: false, prix_fcfa: 0} as any,
      badges: {verifie: false, top_courtier: false, ultra_reactif: false, photos_certifiees: false, premium: false} as any,
      verification: {statut: 'en_attente'} as any,
      stats: {nb_annonces_actives: 0, nb_annonces_total: 0, nb_transactions: 0, nb_vues_total: 0, nb_contacts_recus: 0, note_moyenne: 0, nb_avis: 0, taux_reponse: 0} as any,
      limites: getLimitesParPlan('gratuit') as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Notifier les admins
    const admins = await this.userRepository.find({where: {role: 'admin'}});
    for (const admin of admins) {
      try {
        await this.emailService.sendAdminRegistrationNotification(
          admin.email,
          admin.prenom,
          `${newUser.prenom} ${newUser.nom}`,
          newUser.email,
          newUser.telephone,
          newUser.role,
          new Date().toLocaleString('fr-FR'),
        );
      } catch (e) {
        console.error(`Notification admin ${admin.email} échouée:`, e);
      }
    }

    // Email "en attente d'approbation" à l'utilisateur
    try {
      await this.emailService.sendRegistrationPendingEmail(
        newUser.email,
        newUser.prenom,
        newUser.role,
      );
    } catch (e) {
      console.error('Email attente inscription échoué:', e);
    }

    const {mot_de_passe, otp, otp_expiry, ...safe} = newUser;
    return safe;
  }

  // ─── Vérification OTP (après approbation admin) ──────────────────────────
  @post('/verify-email-otp', {
    responses: {'204': {description: 'Email vérifié avec succès'}},
  })
  async verifyEmailOtp(
    @requestBody({required: true, content: {'application/json': {schema: VerifyOtpSchema}}})
    data: VerifyOtpData,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        email: data.email.toLowerCase(),
        otp: data.otp,
        otp_expiry: {gt: new Date().toISOString()},
      } as any,
    });
    if (!user) throw new HttpErrors.Unauthorized('OTP invalide ou expiré.');

    await this.userRepository.updateById(user.id!, {
      email_verifie: true,
      otp: undefined,
      otp_expiry: undefined,
    });

    await this.emailService.sendWelcomeEmail(user.email, user.prenom);
  }

  // ─── Changement de mot de passe (authentifié) ────────────────────────────
  @authenticate('jwt')
  @post('/change-password', {
    responses: {'204': {description: 'Mot de passe changé'}},
  })
  async changePassword(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['oldPassword', 'newPassword'],
            properties: {
              oldPassword: {type: 'string'},
              newPassword: {type: 'string', minLength: 8},
            },
          },
        },
      },
    })
    body: {oldPassword: string; newPassword: string},
  ): Promise<void> {
    const user = await this.userRepository.findById(currentUser[securityId]);
    const ok = await comparePassword(body.oldPassword, user.mot_de_passe);
    if (!ok) throw new HttpErrors.Unauthorized('Ancien mot de passe incorrect.');
    await this.userRepository.updateById(currentUser[securityId], {mot_de_passe: body.newPassword});
    await this.emailService.sendPasswordChangedEmail(user.email, user.prenom);
  }

  // ─── Mot de passe oublié ──────────────────────────────────────────────────
  @post('/forgot-password', {
    responses: {'204': {description: 'Lien de réinitialisation envoyé'}},
  })
  async forgotPassword(
    @requestBody({required: true, content: {'application/json': {schema: ForgotPasswordSchema}}})
    data: ForgotPasswordData,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {or: [{email: data.identifier}, {telephone: data.identifier}]},
    });
    if (!user) throw new HttpErrors.NotFound('Email ou téléphone introuvable.');

    const resetToken = this.emailService.generateResetToken();
    await this.userRepository.updateById(user.id!, {
      reset_password_token: resetToken,
      reset_password_expiry: new Date(this.emailService.getTokenExpiration()),
    });
    await this.emailService.sendPasswordResetEmail(user.email, user.prenom, resetToken);
  }

  // ─── Réinitialisation du mot de passe ────────────────────────────────────
  @post('/reset-password', {
    responses: {'204': {description: 'Mot de passe réinitialisé'}},
  })
  async resetPassword(
    @requestBody({required: true, content: {'application/json': {schema: ResetPasswordSchema}}})
    data: ResetPasswordData,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        reset_password_token: data.token,
        reset_password_expiry: {gt: new Date().toISOString()},
      } as any,
    });
    if (!user) throw new HttpErrors.Unauthorized('Token invalide ou expiré.');

    await this.userRepository.updateById(user.id!, {
      mot_de_passe: data.newPassword,
      reset_password_token: undefined,
      reset_password_expiry: undefined,
    });
    await this.emailService.sendPasswordChangedEmail(user.email, user.prenom);
  }

  // ─── Page HTML de réinitialisation (ouverte depuis le lien email) ─────────
  // Le lien email pointe ici plutôt que vers un frontend web séparé (qui
  // n'existe pas pour cette app mobile) — le formulaire appelle POST
  // /reset-password ci-dessus via fetch().
  @get('/reset-password', {
    responses: {'200': {description: 'Page HTML de réinitialisation'}},
  })
  async resetPasswordPage(
    @param.query.string('token') token: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<Response> {
    const style = `body{font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:440px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#1B2A4A}.badge{font-size:56px;margin-bottom:16px}
input{width:100%;box-sizing:border-box;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px;font-size:15px}
button{width:100%;padding:12px;margin-top:8px;background:#1B2A4A;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
.err{color:#e53e3e;font-size:13px;margin-top:8px;min-height:18px}`;

    if (!token) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Lien invalide</title>
<style>${style}</style></head><body><div class="box"><div class="badge">❌</div><h2>Lien invalide</h2>
<p>Ce lien de réinitialisation est invalide.</p></div></body></html>`);
      return res;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nouveau mot de passe</title><style>${style}</style></head>
<body><div class="box" id="box">
<div class="badge">🔑</div><h2>Nouveau mot de passe</h2>
<p>Choisissez un nouveau mot de passe pour votre compte Diwane.</p>
<input type="password" id="pwd" placeholder="Nouveau mot de passe (min. 8 caractères)" minlength="8">
<input type="password" id="pwd2" placeholder="Confirmer le mot de passe" minlength="8">
<div class="err" id="err"></div>
<button id="submit" onclick="submitReset()">Réinitialiser</button>
</div>
<script>
async function submitReset() {
  const pwd = document.getElementById('pwd').value;
  const pwd2 = document.getElementById('pwd2').value;
  const err = document.getElementById('err');
  const btn = document.getElementById('submit');
  err.textContent = '';
  if (pwd.length < 8) { err.textContent = 'Minimum 8 caractères.'; return; }
  if (pwd !== pwd2) { err.textContent = 'Les mots de passe ne correspondent pas.'; return; }
  btn.disabled = true; btn.textContent = 'Réinitialisation…';
  try {
    const res = await fetch('/reset-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token: ${JSON.stringify(token)}, newPassword: pwd}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Une erreur est survenue.');
    }
    document.getElementById('box').innerHTML = '<div class="badge">✅</div><h2>Mot de passe réinitialisé !</h2><p>Vous pouvez maintenant vous connecter sur l\\'application Diwane avec votre nouveau mot de passe.</p>';
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false; btn.textContent = 'Réinitialiser';
  }
}
</script>
</body></html>`);
    return res;
  }

  // ─── Vérification email legacy (lien) ────────────────────────────────────
  @get('/verify-email', {
    responses: {'204': {description: 'Email vérifié (legacy)'}},
  })
  async verifyEmail(@param.query.string('token') token: string): Promise<void> {
    const user = await this.userRepository.findOne({where: {token_email: token}});
    if (!user) throw new HttpErrors.Unauthorized('Token de vérification invalide.');
    await this.userRepository.updateById(user.id!, {email_verifie: true, token_email: undefined});
    await this.emailService.sendWelcomeEmail(user.email, user.prenom);
  }

  // ─── Déconnexion ──────────────────────────────────────────────────────────
  @authenticate('jwt')
  @post('/logout', {
    responses: {'204': {description: 'Déconnecté'}},
  })
  async logout(): Promise<void> {
    // JWT stateless : déconnexion gérée côté client
  }

  // ─── Admin : envoyer un OTP à un utilisateur pour validation ─────────────
  @authenticate('jwt')
  @post('/send-user-otp', {
    responses: {
      '200': {
        description: 'OTP envoyé',
        content: {'application/json': {schema: {type: 'object', properties: {message: {type: 'string'}, userId: {type: 'string'}, email: {type: 'string'}}}}},
      },
    },
  })
  async sendUserOtp(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              userId: {type: 'string'},
              email: {type: 'string'},
            },
          },
        },
      },
    })
    data: {userId?: string; email?: string},
  ): Promise<{message: string; userId: string; email: string}> {
    const roles: string[] = (currentUser.roles as string[]) || [];
    const isAdmin = roles.some(r => String(r).toLowerCase() === 'admin');
    if (!isAdmin) throw new HttpErrors.Forbidden('Réservé aux administrateurs.');

    if (!data.userId && !data.email) {
      throw new HttpErrors.BadRequest('userId ou email requis.');
    }

    const user = data.userId
      ? await this.userRepository.findById(data.userId)
      : await this.userRepository.findOne({where: {email: data.email}});

    if (!user) throw new HttpErrors.NotFound('Utilisateur introuvable.');
    if (user.email_verifie) throw new HttpErrors.BadRequest('Utilisateur déjà vérifié.');

    const newOtp = this.emailService.generateOtp();
    await this.userRepository.updateById(user.id!, {
      otp: newOtp,
      otp_expiry: this.emailService.getTokenExpiration(),
    });

    await this.emailService.sendOtpEmail(user.email, user.prenom, newOtp, true);

    console.log(`Admin ${currentUser.email} a envoyé un OTP à ${user.email}`);

    return {message: 'OTP envoyé avec succès.', userId: user.id!, email: user.email};
  }
}
