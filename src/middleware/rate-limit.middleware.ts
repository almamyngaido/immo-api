import rateLimit from 'express-rate-limit';

/** 5 tentatives de connexion / 15 min par IP */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {error: {message: 'Trop de tentatives. Réessayez dans 15 minutes.', statusCode: 429}},
  keyGenerator: (req: any) => req.ip ?? 'unknown',
  skip: () => process.env.NODE_ENV !== 'production', // désactivé en dev
});

/** 10 inscriptions / heure par IP */
export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {error: {message: 'Trop de tentatives d\'inscription. Réessayez plus tard.', statusCode: 429}},
  keyGenerator: (req: any) => req.ip ?? 'unknown',
  skip: () => process.env.NODE_ENV !== 'production',
});

/** 10 refreshes / min par IP */
export const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {error: {message: 'Trop de requêtes de refresh.', statusCode: 429}},
  skip: () => process.env.NODE_ENV !== 'production',
});
