import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import {SignOptions} from 'jsonwebtoken';

const jwtSecret: string  = process.env.JWT_SECRET || 'change-this-in-production-min-32-chars!!';
const accessExpiry: string = process.env.JWT_ACCESS_EXPIRY  || '7d';
const refreshDays          = parseInt(process.env.JWT_REFRESH_DAYS ?? '30', 10);

export interface TokenService {
  generateToken(userProfile: UserProfile): Promise<string>;
  verifyToken(token: string): Promise<UserProfile>;
}

export class JwtService implements TokenService {

  // ── Interface TokenService (utilisé par @authenticate('jwt')) ─────────────

  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) throw new HttpErrors.Unauthorized('Error generating token: userProfile is null');

    const payload = {
      id:          userProfile[securityId],
      name:        userProfile.name,
      email:       userProfile.email,
      telephone:   (userProfile as any).telephone,
      roles:       userProfile.roles ?? [],
    };

    const options: SignOptions = {expiresIn: accessExpiry as any};
    return jwt.sign(payload, jwtSecret, options);
  }

  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      return {
        [securityId]: decoded.id,
        name:         decoded.name,
        email:        decoded.email,
        telephone:    decoded.telephone,
        roles:        decoded.roles ?? [],
      };
    } catch {
      throw new HttpErrors.Unauthorized('Token invalide ou expiré');
    }
  }

  // ── Refresh token helpers ─────────────────────────────────────────────────

  /** Génère un token opaque aléatoire (64 octets hex) */
  generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /** Hash SHA-256 pour stocker en base (jamais le token brut) */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /** Date d'expiration du refresh token */
  refreshExpiresAt(): Date {
    return new Date(Date.now() + refreshDays * 86400000);
  }

  /** Expiry en secondes pour le access token (pour le client Flutter) */
  accessExpiresInSeconds(): number {
    // Parse "15m", "1h", "24h" etc.
    const m = accessExpiry.match(/^(\d+)([mhd])$/);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    switch (m[2]) {
      case 'm': return n * 60;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      default:  return 900;
    }
  }
}
