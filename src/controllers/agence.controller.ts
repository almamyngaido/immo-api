/**
 * DIWANE — AgenceController
 * Gestion des agents d'une agence Pro (max 7 par agence)
 * Flux invitation par email + rejoindre via lien ou depuis l'app
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
  Response,
  RestBindings,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {getLimitesParPlan} from '../models';
import {InvitationAgenceRepository, UserRepository} from '../repositories';
import {diwaneEmail} from '../services/diwane-email.service';

function genToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

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
    @repository(InvitationAgenceRepository)
    private invitationRepo: InvitationAgenceRepository,
  ) {}

  // ── GET /api/agence/membres ────────────────────────────────────────────────

  @authenticate('jwt')
  @get('/api/agence/membres', {
    summary: '[Diwane] Lister les agents de mon agence (Pro)',
    responses: {'200': {description: 'Liste des agents'}},
  })
  async listerMembres(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    const owner = await this.userRepo.findById(userId);
    if (owner.role !== 'courtier') throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    if ((owner as any).abonnement?.plan !== 'pro') throw new HttpErrors.Forbidden('Plan Pro requis.');

    return this.userRepo.find({
      where: {agence_id: userId} as any,
      fields: {mot_de_passe: false, token_email: false, reset_password_token: false, otp: false} as any,
    });
  }

  // ── GET /api/agence/invitations-envoyees ───────────────────────────────────

  @authenticate('jwt')
  @get('/api/agence/invitations-envoyees', {
    summary: '[Diwane] Invitations envoyées par l\'agence (en attente)',
    responses: {'200': {description: 'Liste'}},
  })
  async invitationsEnvoyees(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    return this.invitationRepo.find({
      where: {agence_id: userId, statut: 'en_attente'} as any,
      order: ['createdAt DESC'],
    });
  }

  // ── GET /api/agence/invitations-recues ─────────────────────────────────────
  // Utilisateur connecté voit les invitations en attente pour son email

  @authenticate('jwt')
  @get('/api/agence/invitations-recues', {
    summary: '[Diwane] Invitations reçues pour l\'utilisateur connecté',
    responses: {'200': {description: 'Liste'}},
  })
  async invitationsRecues(
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<object[]> {
    const userId = currentUser[securityId];
    const user = await this.userRepo.findById(userId);

    // Cherche par email ET par user_id_existant
    const invitations = await this.invitationRepo.find({
      where: {
        or: [
          {email_invite: user.email, statut: 'en_attente'} as any,
          {user_id_existant: userId, statut: 'en_attente'} as any,
        ],
      } as any,
      order: ['createdAt DESC'],
    });

    return invitations;
  }

  // ── POST /api/agence/inviter-email ─────────────────────────────────────────

  @authenticate('jwt')
  @post('/api/agence/inviter-email', {
    summary: '[Diwane] Envoyer une invitation par email',
    responses: {'200': {description: 'Invitation envoyée'}},
  })
  async inviterParEmail(
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['prenom', 'nom', 'email'],
            properties: {
              prenom: {type: 'string'},
              nom:    {type: 'string'},
              email:  {type: 'string', format: 'email'},
            },
          },
        },
      },
    })
    body: {prenom: string; nom: string; email: string},
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{message: string; utilisateur_existant: boolean}> {
    const userId = currentUser[securityId];
    const owner = await this.userRepo.findById(userId);

    if (owner.role !== 'courtier') throw new HttpErrors.Forbidden('Réservé aux courtiers.');
    if ((owner as any).abonnement?.plan !== 'pro') throw new HttpErrors.Forbidden('Plan Pro requis.');

    // Vérifier quota (membres actifs + invitations en attente)
    const maxAgents = owner.limites?.max_utilisateurs_agence ?? 7;
    const [membresCount, invitationsCount] = await Promise.all([
      this.userRepo.count({agence_id: userId} as any),
      this.invitationRepo.count({agence_id: userId, statut: 'en_attente'} as any),
    ]);
    const total = membresCount.count + invitationsCount.count + 1; // +1 pour le propriétaire
    if (total >= maxAgents) {
      throw new HttpErrors.UnprocessableEntity(
        `Quota atteint : ${maxAgents} utilisateurs maximum (membres actifs + invitations en attente).`,
      );
    }

    const emailLower = body.email.toLowerCase();

    // Vérifier qu'une invitation en attente n'existe pas déjà
    const dejaInvite = await this.invitationRepo.findOne({
      where: {agence_id: userId, email_invite: emailLower, statut: 'en_attente'} as any,
    });
    if (dejaInvite) {
      throw new HttpErrors.Conflict('Une invitation est déjà en attente pour cet email.');
    }

    const token = genToken();
    const nomAgence = (owner as any).nom_agence ?? `${owner.prenom} ${owner.nom}`;
    const proprietaireNom = `${owner.prenom} ${owner.nom}`;

    // Chercher si l'utilisateur existe déjà
    const userExistant = await this.userRepo.findOne({where: {email: emailLower} as any});

    // Créer l'invitation en DB
    await this.invitationRepo.create({
      agence_id:        userId,
      agence_nom:       nomAgence,
      proprietaire_nom: proprietaireNom,
      email_invite:     emailLower,
      prenom_invite:    body.prenom,
      nom_invite:       body.nom,
      user_id_existant: userExistant?.id,
      token,
      statut:    'en_attente',
      expires_at: new Date(Date.now() + 7 * 86400000), // 7 jours
      createdAt:  new Date(),
    } as any);

    // Envoyer l'email (best-effort — ne bloque pas la réponse)
    const emailPromise = userExistant
      ? diwaneEmail.envoyerInvitationExistant(emailLower, body.prenom, nomAgence, proprietaireNom, token)
      : diwaneEmail.envoyerInvitationNouveauCompte(emailLower, body.prenom, nomAgence, proprietaireNom, token);

    emailPromise.catch(e => {
      console.error(`[Agence] Email invitation échoué (non-bloquant): ${e.message}`);
    });

    return {
      message: userExistant
        ? 'Invitation créée. L\'utilisateur peut accepter depuis l\'application ou par email.'
        : 'Invitation créée. L\'utilisateur recevra un lien pour créer son compte.',
      utilisateur_existant: !!userExistant,
    };
  }

  // ── POST /api/agence/rejoindre/:token (utilisateur connecté) ──────────────

  @authenticate('jwt')
  @post('/api/agence/rejoindre/{token}', {
    summary: '[Diwane] Accepter une invitation (utilisateur connecté)',
    responses: {'200': {description: 'Agence rejointe'}},
  })
  async rejoindreConnecte(
    @param.path.string('token') token: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{message: string}> {
    const userId = currentUser[securityId];
    const user = await this.userRepo.findById(userId);

    const invitation = await this.invitationRepo.findOne({
      where: {token, statut: 'en_attente'} as any,
    });

    if (!invitation) throw new HttpErrors.NotFound('Invitation introuvable ou déjà utilisée.');
    if (new Date() > new Date(invitation.expires_at)) {
      await this.invitationRepo.updateById(invitation.id!, {statut: 'expiree'} as any);
      throw new HttpErrors.Gone('Cette invitation a expiré.');
    }

    // Vérifier que l'email correspond ou que c'est bien le bon user
    if (
      invitation.email_invite !== user.email &&
      invitation.user_id_existant !== userId
    ) {
      throw new HttpErrors.Forbidden('Cette invitation ne vous est pas destinée.');
    }

    // Vérifier que l'utilisateur n'est pas déjà dans une agence
    if ((user as any).agence_id) {
      throw new HttpErrors.Conflict('Vous appartenez déjà à une agence.');
    }

    const limites = getLimitesParPlan('pro');
    const owner = await this.userRepo.findById(invitation.agence_id);

    // Mettre à jour le compte
    await this.userRepo.updateById(userId, {
      agence_id: invitation.agence_id,
      nom_agence: invitation.agence_nom,
      role: 'courtier',
      abonnement: {
        plan: 'pro',
        actif: true,
        prix_fcfa: 0,
        date_debut: new Date(),
        date_fin: (owner as any).abonnement?.date_fin ?? new Date(Date.now() + 30 * 86400000),
        paiement_methode: 'agence',
        transaction_id: `agence_${invitation.agence_id}`,
      },
      limites,
      updatedAt: new Date(),
    } as any);

    // Marquer l'invitation comme acceptée
    await this.invitationRepo.updateById(invitation.id!, {
      statut: 'acceptee',
      user_id_existant: userId,
      repondu_at: new Date(),
    } as any);

    // Email de confirmation
    await diwaneEmail.envoyerConfirmationRejoindre(
      user.email, user.prenom, invitation.agence_nom,
    ).catch(() => {});

    return {message: `Vous avez rejoint l'agence ${invitation.agence_nom}.`};
  }

  // ── POST /api/agence/refuser/:token (utilisateur connecté) ────────────────

  @authenticate('jwt')
  @post('/api/agence/refuser/{token}', {
    summary: '[Diwane] Refuser une invitation',
    responses: {'200': {description: 'Invitation refusée'}},
  })
  async refuserInvitation(
    @param.path.string('token') token: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<{message: string}> {
    const userId = currentUser[securityId];
    const user = await this.userRepo.findById(userId);

    const invitation = await this.invitationRepo.findOne({
      where: {token, statut: 'en_attente'} as any,
    });
    if (!invitation) throw new HttpErrors.NotFound('Invitation introuvable.');

    if (invitation.email_invite !== user.email && invitation.user_id_existant !== userId) {
      throw new HttpErrors.Forbidden('Cette invitation ne vous est pas destinée.');
    }

    await this.invitationRepo.updateById(invitation.id!, {
      statut: 'refusee',
      repondu_at: new Date(),
    } as any);

    return {message: 'Invitation refusée.'};
  }

  // ── GET /agence/rejoindre?token=xxx  (page web — nouveau compte) ───────────

  @get('/agence/rejoindre', {
    summary: '[Diwane] Page web pour créer un compte et rejoindre une agence',
    responses: {'200': {description: 'HTML'}},
  })
  async pageRejoindre(
    @param.query.string('token') token: string,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<Response> {
    // Chercher l'invitation
    const invitation = await this.invitationRepo.findOne({
      where: {token, statut: 'en_attente'} as any,
    }).catch(() => null);

    const html = this._pageRejoindreHtml(token, invitation);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    return res;
  }

  // ── POST /api/agence/rejoindre-nouveau  (public — nouveau compte) ──────────

  @post('/api/agence/rejoindre-nouveau', {
    summary: '[Diwane] Créer un compte et rejoindre une agence (public)',
    responses: {'200': {description: 'Compte créé et agence rejointe'}},
  })
  async rejoindreSansCompte(
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['token', 'prenom', 'nom', 'telephone', 'mot_de_passe'],
            properties: {
              token:        {type: 'string'},
              prenom:       {type: 'string'},
              nom:          {type: 'string'},
              telephone:    {type: 'string'},
              mot_de_passe: {type: 'string', minLength: 6},
            },
          },
        },
      },
    })
    body: {token: string; prenom: string; nom: string; telephone: string; mot_de_passe: string},
  ): Promise<{message: string; email: string}> {
    const invitation = await this.invitationRepo.findOne({
      where: {token: body.token, statut: 'en_attente'} as any,
    });
    if (!invitation) throw new HttpErrors.NotFound('Invitation introuvable ou déjà utilisée.');
    if (new Date() > new Date(invitation.expires_at)) {
      await this.invitationRepo.updateById(invitation.id!, {statut: 'expiree'} as any);
      throw new HttpErrors.Gone('Cette invitation a expiré.');
    }

    // Vérifier si un compte existe déjà (email ou téléphone)
    const exist = await this.userRepo.findOne({
      where: {or: [{email: invitation.email_invite}, {telephone: body.telephone}]} as any,
    });
    if (exist) throw new HttpErrors.Conflict('Un compte avec cet email ou ce téléphone existe déjà. Connectez-vous et acceptez l\'invitation depuis l\'application.');

    const hash = await bcrypt.hash(body.mot_de_passe, 10);
    const limites = getLimitesParPlan('pro');
    const owner = await this.userRepo.findById(invitation.agence_id);

    const nouvelAgent = await this.userRepo.create({
      prenom:    body.prenom,
      nom:       body.nom,
      email:     invitation.email_invite,
      telephone: body.telephone,
      mot_de_passe: hash,
      role:      'courtier',
      agence_id: invitation.agence_id,
      nom_agence: invitation.agence_nom,
      ville:     (owner as any).ville ?? 'Dakar',
      abonnement: {
        plan: 'pro',
        actif: true,
        prix_fcfa: 0,
        date_debut: new Date(),
        date_fin: (owner as any).abonnement?.date_fin ?? new Date(Date.now() + 30 * 86400000),
        paiement_methode: 'agence',
        transaction_id: `agence_${invitation.agence_id}`,
      },
      limites,
      email_verifie: true,
      actif: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await this.invitationRepo.updateById(invitation.id!, {
      statut: 'acceptee',
      user_id_existant: nouvelAgent.id,
      repondu_at: new Date(),
    } as any);

    await diwaneEmail.envoyerConfirmationRejoindre(
      invitation.email_invite, body.prenom, invitation.agence_nom,
    ).catch(() => {});

    return {message: 'Compte créé et agence rejointe. Vous pouvez maintenant vous connecter.', email: invitation.email_invite};
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

    await this.userRepo.updateById(membreId, {
      agence_id: undefined,
      abonnement: {plan: 'gratuit', actif: false, prix_fcfa: 0, paiement_methode: 'agence'},
      limites: getLimitesParPlan('gratuit'),
      updatedAt: new Date(),
    } as any);
  }

  // ── DELETE /api/agence/invitations/:id ─────────────────────────────────────

  @authenticate('jwt')
  @del('/api/agence/invitations/{invitationId}', {
    summary: '[Diwane] Annuler une invitation envoyée',
    responses: {'204': {description: 'Invitation annulée'}},
  })
  async annulerInvitation(
    @param.path.string('invitationId') invitationId: string,
    @inject(SecurityBindings.USER) currentUser: UserProfile,
  ): Promise<void> {
    const userId = currentUser[securityId];
    const inv = await this.invitationRepo.findById(invitationId).catch(() => {
      throw new HttpErrors.NotFound('Invitation introuvable.');
    });
    if (inv.agence_id !== userId) throw new HttpErrors.Forbidden();
    await this.invitationRepo.updateById(invitationId, {statut: 'refusee'} as any);
  }

  // ── Page HTML rejoindre ───────────────────────────────────────────────────

  private _pageRejoindreHtml(token: string, invitation: any): string {
    if (!invitation) {
      return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Invitation invalide</title>
<style>body{font-family:Arial;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:440px;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}
h2{color:#e53e3e}</style></head><body>
<div class="box"><h2>❌ Invitation invalide</h2><p>Cette invitation est introuvable, déjà utilisée ou expirée.</p></div></body></html>`;
    }

    const APP_URL_JS = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rejoindre ${invitation.agence_nom} — Diwane</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f4f6f9;margin:0;padding:20px;display:flex;align-items:flex-start;justify-content:center;min-height:100vh}
    .wrap{background:#fff;border-radius:12px;overflow:hidden;max-width:460px;width:100%;box-shadow:0 2px 16px rgba(0,0,0,.1)}
    .header{background:#1B2A4A;padding:24px;text-align:center;color:#fff}
    .header h1{margin:0;font-size:22px}
    .body{padding:28px}
    h2{color:#1B2A4A;margin-top:0}
    label{display:block;font-size:13px;font-weight:600;color:#555;margin:12px 0 4px}
    input{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:7px;font-size:14px;outline:none}
    input:focus{border-color:#1B2A4A}
    .btn{display:block;width:100%;background:#E8621A;color:#fff;border:none;padding:13px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;margin-top:20px}
    .btn:hover{background:#c94e10}
    .msg{padding:10px;border-radius:7px;margin-top:14px;font-size:13px;display:none}
    .msg.ok{background:#d4edda;color:#155724;display:block}
    .msg.err{background:#f8d7da;color:#721c24;display:block}
    .footer{background:#f4f6f9;padding:16px;text-align:center;font-size:12px;color:#999}
  </style>
</head>
<body>
<div class="wrap">
  <div class="header"><h1>Diwane</h1></div>
  <div class="body">
    <h2>Rejoindre ${invitation.agence_nom}</h2>
    <p style="color:#555;font-size:14px">
      <strong>${invitation.proprietaire_nom}</strong> vous invite à rejoindre son agence.<br>
      Complétez le formulaire pour créer votre compte avec le <strong>plan Pro</strong>.
    </p>
    <form id="f" onsubmit="soumettre(event)">
      <label>Prénom</label>
      <input id="prenom" type="text" value="${invitation.prenom_invite ?? ''}" required>
      <label>Nom</label>
      <input id="nom" type="text" value="${invitation.nom_invite ?? ''}" required>
      <label>Téléphone (+221XXXXXXXXX)</label>
      <input id="tel" type="tel" placeholder="+221771234567" required>
      <label>Mot de passe (min. 6 caractères)</label>
      <input id="pwd" type="password" minlength="6" required>
      <label>Confirmer le mot de passe</label>
      <input id="pwd2" type="password" minlength="6" required>
      <button class="btn" type="submit" id="btn">Créer mon compte et rejoindre</button>
    </form>
    <div id="msg" class="msg"></div>
  </div>
  <div class="footer">Vous avez déjà un compte ? Connectez-vous sur l'application Diwane et acceptez l'invitation depuis votre profil.</div>
</div>
<script>
async function soumettre(e) {
  e.preventDefault();
  const msg = document.getElementById('msg');
  msg.className = 'msg'; msg.style.display = 'none';
  const pwd = document.getElementById('pwd').value;
  const pwd2 = document.getElementById('pwd2').value;
  if (pwd !== pwd2) { msg.className='msg err'; msg.textContent='Les mots de passe ne correspondent pas.'; return; }
  document.getElementById('btn').disabled = true;
  document.getElementById('btn').textContent = 'Création en cours…';
  try {
    const r = await fetch('${APP_URL_JS}/api/agence/rejoindre-nouveau', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        token: '${token}',
        prenom: document.getElementById('prenom').value.trim(),
        nom: document.getElementById('nom').value.trim(),
        telephone: document.getElementById('tel').value.trim(),
        mot_de_passe: pwd,
      })
    });
    const data = await r.json();
    if (r.ok) {
      msg.className='msg ok';
      msg.textContent = 'Compte créé ! Vous pouvez maintenant vous connecter sur l\\'application Diwane avec l\\'email : ' + data.email;
      document.getElementById('f').style.display='none';
    } else {
      throw new Error(data.error?.message ?? data.message ?? 'Erreur');
    }
  } catch(err) {
    msg.className='msg err'; msg.textContent = err.message;
    document.getElementById('btn').disabled = false;
    document.getElementById('btn').textContent = 'Créer mon compte et rejoindre';
  }
}
</script>
</body></html>`;
  }
}
