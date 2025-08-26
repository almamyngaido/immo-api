import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import * as jwt from 'jsonwebtoken';

const jwtSecret = 'your-secret-key-here'; // Change this to a secure secret (use env vars in production)
const jwtExpiry = '1h'; // Token expiry time

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
