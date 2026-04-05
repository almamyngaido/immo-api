// ─── Auth (mis à jour pour User SN) ──────────────────────────────────────────
export * from './auth.controller';

// ─── Nouveaux controllers Sénégal B2C ────────────────────────────────────────
export * from './user.controller';
export * from './bien.controller';

// ─── Diwane — API B2C /api/* ──────────────────────────────────────────────────
export * from './diwane-users.controller';
export * from './diwane-biens.controller';
export * from './diwane-plans.controller';
export * from './payment.controller';
export * from './verification.controller';
export * from './diwane-favoris.controller';
export * from './agence.controller';
export * from './demande-contact.controller';
export * from './avis.controller';
export * from './transaction.controller';
export * from './favori.controller';
export * from './message.controller';

// ─── Utilitaires conservés ────────────────────────────────────────────────────
export * from './file-upload.controller';
export * from './temp-upload.controller';
export * from './ping.controller';

// ─── Anciens controllers France B2B (conservés, non exportés si conflit) ─────
// @deprecated — À supprimer après migration complète des données
export * from './bien-immo-media.controller';
export * from './bien-immo-utilisateur.controller';
export * from './bien-immo.controller';
export * from './media-bien-immo.controller';
export * from './media.controller';
export * from './panier-utilisateur.controller';
export * from './panier.controller';
export * from './role.controller';
export * from './utilisateur-bien-immo.controller';
export * from './utilisateur-panier.controller';
export * from './utilisateur-role.controller';
export * from './utilisateur.controller';
export * from './conversation.controller';

