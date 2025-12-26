import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import * as jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
const jwtExpiry = process.env.JWT_EXPIRY || '24h'; // Token expiry time

export interface TokenService {
  generateToken(userProfile: UserProfile): Promise<string>;
  verifyToken(token: string): Promise<UserProfile>;
}

export class JwtService implements TokenService {
  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized('Error generating token: userProfile is null');
    }
    return jwt.sign(userProfile, jwtSecret, {expiresIn: jwtExpiry});
  }

  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      return {
        [securityId]: decoded.id,
        name: decoded.name,
        email: decoded.email,
        roles: decoded.roles,
      };
    } catch (err) {
      throw new HttpErrors.Unauthorized('Invalid token');
    }
  }
}
