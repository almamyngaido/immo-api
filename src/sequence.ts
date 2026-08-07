import {MiddlewareSequence, RequestContext} from '@loopback/rest';
import {loginRateLimit, refreshRateLimit, registerRateLimit} from './middleware/rate-limit.middleware';

const isProd = process.env.NODE_ENV === 'production';

const RATE_LIMITS: Array<{path: string; middleware: typeof loginRateLimit}> = [
  {path: '/api/users/login', middleware: loginRateLimit},
  {path: '/api/users/refresh', middleware: refreshRateLimit},
  {path: '/api/auth/renvoyer-verification', middleware: loginRateLimit},
  {path: '/api/users', middleware: registerRateLimit},
];

/**
 * Adapte un middleware Express (req, res, next) en promesse : resolve(true)
 * si next() est appelé (on continue), resolve(false) si le middleware a
 * lui-même terminé la réponse (ex: 429 rate limit dépassé).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runExpressMiddleware(
  middleware: any,
  req: unknown,
  res: {once: (event: string, cb: () => void) => void},
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    res.once('finish', () => resolve(false));
    middleware(req, res, (err?: unknown) => (err ? reject(err) : resolve(true)));
  });
}

export class MySequence extends MiddlewareSequence {
  async handle(context: RequestContext): Promise<void> {
    const {request, response} = context;

    // En-têtes de sécurité — doivent être posés ici (pas via _expressApp.use
    // après app.start()) : une fois démarré, le dispatcher de LoopBack gère
    // et termine déjà les requêtes de route, donc du middleware Express
    // ajouté après ne s'exécute jamais dessus.
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProd) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Charset UTF-8 sur les réponses JSON — writeResultToResponse() de LoopBack
    // fixe 'Content-Type: application/json' sans charset, ce qui fait que le
    // package http de Dart/Flutter décode en Latin-1 par défaut et corrompt
    // les accents. On intercepte cet appel précis pour y ajouter le charset,
    // sans toucher aux autres types de réponse (fichiers, texte brut, etc.).
    const originalSetHeader = response.setHeader.bind(response);
    response.setHeader = ((name: string, value: unknown) => {
      if (typeof name === 'string' && name.toLowerCase() === 'content-type' && value === 'application/json') {
        value = 'application/json; charset=utf-8';
      }
      return originalSetHeader(name, value as string | number | readonly string[]);
    }) as typeof response.setHeader;

    // Rate limiting — même raison que les en-têtes ci-dessus : doit tourner
    // avant que LoopBack ne trouve/exécute la route.
    const limit = RATE_LIMITS.find(r => request.path === r.path);
    if (limit) {
      const shouldContinue = await runExpressMiddleware(limit.middleware, request, response);
      if (!shouldContinue) return; // réponse 429 déjà envoyée par express-rate-limit
    }

    return super.handle(context);
  }
}
