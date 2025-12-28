import {HttpErrors} from '@loopback/rest';
import {securityId, UserProfile} from '@loopback/security';
import * as jwt from 'jsonwebtoken';
import {SignOptions} from 'jsonwebtoken';

const jwtSecret: string = process.env.JWT_SECRET || 'your-secret-key-here-change-in-production';
const jwtExpiry: string = process.env.JWT_EXPIRY || '24h'; // Token expiry time

export interface TokenService {
  generateToken(userProfile: UserProfile): Promise<string>;
  verifyToken(token: string): Promise<UserProfile>;
}

export class JwtService implements TokenService {
  async generateToken(userProfile: UserProfile): Promise<string> {
    if (!userProfile) {
      throw new HttpErrors.Unauthorized('Error generating token: userProfile is null');
    }

    // Create a plain object for JWT (Symbol properties don't serialize well)
    const payload = {
      id: userProfile[securityId],
      name: userProfile.name,
      email: userProfile.email,
      phoneNumber: userProfile.phoneNumber,
      roles: userProfile.roles || [],
    };

    console.log('📝 JWT Payload to sign:', JSON.stringify(payload, null, 2));

    const options: SignOptions = {expiresIn: jwtExpiry as any};
    const token = jwt.sign(payload, jwtSecret, options);

    // Verify what we just created
    const decoded = jwt.decode(token);
    console.log('✅ Decoded token after signing:', JSON.stringify(decoded, null, 2));

    return token;
  }

  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      console.log('🔍 JWT Decoded Payload:', JSON.stringify(decoded, null, 2));

      const userProfile = {
        [securityId]: decoded.id,
        name: decoded.name,
        email: decoded.email,
        phoneNumber: decoded.phoneNumber,
        roles: decoded.roles || [],
      };

      console.log('🔍 Constructed UserProfile from JWT:', JSON.stringify(userProfile, null, 2));

      return userProfile;
    } catch (err) {
      throw new HttpErrors.Unauthorized('Invalid token');
    }
  }
}
