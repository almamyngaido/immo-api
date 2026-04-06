// ─── Nouveaux modèles Sénégal B2C ────────────────────────────────────────────
export * from './user.model';
export * from './bien.model';
export * from './demande-contact.model';
export * from './avis.model';
export * from './transaction.model';
export * from './favori.model';
export * from './message.model';
export * from './invitation-agence.model';
export * from './refresh-token.model';
export * from './alerte-recherche.model';

// ─── Anciens modèles France B2B (conservés pour compatibilité) ───────────────
// @deprecated — Seront supprimés après migration complète des données
export * from './utilisateur.model';
export * from './role.model';
export * from './bien-immo.model';
export * from './panier.model';
export * from './bien-panier.model';
export * from './utilisateur-role.model';
export * from './media.model';
export * from './conversation.model';
