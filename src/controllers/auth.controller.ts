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
  SchemaObject,
} from '@loopback/rest';
import {SecurityBindings, securityId, UserProfile} from '@loopback/security';
import disposableEmailDomains from 'disposable-email-domains';
import {parsePhoneNumber} from 'libphonenumber-js';
import {Utilisateur} from '../models';
import {UtilisateurRepository} from '../repositories';
import {comparePassword} from '../services/hash.password';
import {JwtService} from '../services/jwt.service';
import {EmailService} from '../services/mailer';

// Load environment variables
require('dotenv').config();

// Schema definitions (unchanged from your provided code)
const CredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['identifier', 'type'],
  properties: {
    identifier: {type: 'string'},
    type: {type: 'string', enum: ['email', 'phone']},
    motDePasse: {type: 'string', minLength: 8},
    otp: {type: 'string', pattern: '^[0-9]{6}$'},
  },
};

export const CredentialsRequestBody = {
  description: 'The input of login function',
  required: true,
  content: {
    'application/json': {schema: CredentialsSchema},
  },
};

const SignupSchema: SchemaObject = {
  type: 'object',
  required: ['nom', 'email', 'phoneNumber', 'motDePasse', 'role', 'dateInscription'],
  properties: {
    nom: {type: 'string'},
    prenom: {type: 'string'},
    email: {type: 'string', format: 'email'},
    phoneNumber: {type: 'string'},
    motDePasse: {type: 'string', minLength: 8},
    role: {type: 'string'},
    dateInscription: {type: 'string', format: 'date'},
  },
};

export const SignupRequestBody = {
  description: 'The input of signup function',
  required: true,
  content: {
    'application/json': {schema: SignupSchema},
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

export const VerifyOtpRequestBody = {
  description: 'The input of OTP verification function',
  required: true,
  content: {
    'application/json': {schema: VerifyOtpSchema},
  },
};

const ForgotPasswordSchema: SchemaObject = {
  type: 'object',
  required: ['identifier'],
  properties: {
    identifier: {type: 'string'},
  },
};

export const ForgotPasswordRequestBody = {
  description: 'The input of forgot password function',
  required: true,
  content: {
    'application/json': {schema: ForgotPasswordSchema},
  },
};

const ResetPasswordSchema: SchemaObject = {
  type: 'object',
  required: ['token', 'newPassword'],
  properties: {
    token: {type: 'string'},
    newPassword: {type: 'string', minLength: 8},
  },
};

export const ResetPasswordRequestBody = {
  description: 'The input of reset password function',
  required: true,
  content: {
    'application/json': {schema: ResetPasswordSchema},
  },
};

interface Credentials {
  identifier: string;
  type: 'email' | 'phone';
  motDePasse?: string;
  otp?: string;
}

interface SignupData {
  nom: string;
  prenom?: string;
  email: string;
  phoneNumber: string;
  motDePasse: string;
  role: string;
  dateInscription: string;
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

export class AuthController {
  constructor(
    @repository(UtilisateurRepository)
    public utilisateurRepository: UtilisateurRepository,
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: JwtService,
    @inject('services.EmailService')
    public emailService: EmailService,
  ) { }

  @post('/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: {type: 'string'},
              },
            },
          },
        },
      },
    },
  })
  async login(
    @requestBody(CredentialsRequestBody) credentials: Credentials,
  ): Promise<{token: string}> {
    const {identifier, type, motDePasse, otp} = credentials;
    const user = await this.utilisateurRepository.findOne({
      where: type === 'email' ? {email: identifier} : {phoneNumber: identifier},
    });
    if (!user) {
      throw new HttpErrors.Unauthorized('Invalid credentials.');
    }
    if (!user.verified) {
      throw new HttpErrors.Unauthorized('Email not verified.');
    }

    if (type === 'email') {
      if (!motDePasse) {
        throw new HttpErrors.BadRequest('Password required for email login.');
      }
      const passwordMatched = await comparePassword(motDePasse, user.motDePasse);
      if (!passwordMatched) {
        throw new HttpErrors.Unauthorized('Invalid credentials.');
      }
    } else {
      if (!otp) {
        const newOtp = this.emailService.generateOtp();
        await this.utilisateurRepository.updateById(user.id!, {
          otp: newOtp,
          otpExpiry: this.emailService.getTokenExpiration(),
        });
        await this.emailService.sendOtpEmail(user.email, user.prenom || user.nom, newOtp);
        throw new HttpErrors.Unauthorized('OTP sent to your email. Please verify.');
      }
      if (otp !== user.otp || !user.otpExpiry || new Date(user.otpExpiry) < new Date()) {
        throw new HttpErrors.Unauthorized('Invalid or expired OTP.');
      }
      await this.utilisateurRepository.updateById(user.id!, {
        otp: undefined,
        otpExpiry: undefined,
      });
    }

    const roles = await this.utilisateurRepository.roles(user.id!).find();
    const roleIds = roles.map(role => role.id!);

    const userProfile: UserProfile = {
      [securityId]: user.id!,
      name: `${user.prenom || ''} ${user.nom}`.trim(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      roles: roleIds.length > 0 ? roleIds : [user.role],
    };

    const token = await this.jwtService.generateToken(userProfile);
    console.log("token",token);
    return {token};
  }

  @post('/signup', {
    responses: {
      '200': {
        description: 'User created successfully',
        content: {
          'application/json': {
            schema: {type: 'object'},
          },
        },
      },
    },
  })
  async signup(
    @requestBody(SignupRequestBody) signupData: SignupData,
  ): Promise<Partial<Utilisateur>> {
    const {email, phoneNumber} = signupData;

    // Check for disposable email
    const emailDomain = email.split('@')[1];
    if (disposableEmailDomains.indexOf(emailDomain) !== -1) {
      throw new HttpErrors.BadRequest('Disposable email addresses are not allowed.');
    }

    // Validate phone number format
    try {
      const parsedNumber = parsePhoneNumber(phoneNumber, 'FR'); // Default to France, adjust as needed
      if (!parsedNumber || !parsedNumber.isValid()) {
        throw new HttpErrors.BadRequest('Invalid phone number format.');
      }
      signupData.phoneNumber = parsedNumber.format('E.164'); // Normalize to E.164
    } catch (error) {
      throw new HttpErrors.BadRequest('Invalid phone number format.');
    }

    // Check for existing user
    const existingUser = await this.utilisateurRepository.findOne({
      where: {or: [{email}, {phoneNumber: signupData.phoneNumber}]},
    });
    if (existingUser) {
      throw new HttpErrors.Conflict('Email or phone number already exists.');
    }

    // Generate OTP
    const otp = this.emailService.generateOtp();

    // Create user
    const newUser = await this.utilisateurRepository.create({
      ...signupData,
      verified: false,
      otp,
      otpExpiry: this.emailService.getTokenExpiration(),
    });

    // Send OTP email
    await this.emailService.sendOtpEmail(newUser.email, newUser.prenom || newUser.nom, otp);

    // Return user without sensitive data
    const {motDePasse, otp: _, otpExpiry: __, ...userWithoutSensitive} = newUser;
    return userWithoutSensitive;
  }

  @post('/verify-email-otp', {
    responses: {
      '204': {description: 'Email verified successfully'},
    },
  })
  async verifyEmailOtp(
    @requestBody(VerifyOtpRequestBody) data: VerifyOtpData,
  ): Promise<void> {
    const user = await this.utilisateurRepository.findOne({
      where: {
        email: data.email,
        otp: data.otp,
        otpExpiry: {gt: new Date().toISOString()},
      },
    });
    if (!user) {
      throw new HttpErrors.Unauthorized('Invalid or expired OTP.');
    }

    await this.utilisateurRepository.updateById(user.id!, {
      verified: true,
      otp: undefined,
      otpExpiry: undefined,
    });

    await this.emailService.sendWelcomeEmail(user.email, user.prenom || user.nom);
  }

  @authenticate('jwt')
  @post('/change-password', {
    responses: {
      '204': {description: 'Password changed successfully'},
    },
  })
  async changePassword(
    @inject(SecurityBindings.USER)
    currentUserProfile: UserProfile,
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              oldPassword: {type: 'string'},
              newPassword: {type: 'string'},
            },
          },
        },
      },
    })
    body: {oldPassword: string; newPassword: string},
  ): Promise<void> {
    const userId = currentUserProfile[securityId];
    const user = await this.utilisateurRepository.findById(userId);
    const passwordMatched = await comparePassword(body.oldPassword, user.motDePasse);
    if (!passwordMatched) {
      throw new HttpErrors.Unauthorized('Old password is incorrect.');
    }
    await this.utilisateurRepository.updateById(userId, {motDePasse: body.newPassword});
    await this.emailService.sendPasswordChangedEmail(user.email, user.prenom || user.nom);
  }

  @post('/forgot-password', {
    responses: {
      '204': {description: 'Password reset initiated'},
    },
  })
  async forgotPassword(
    @requestBody(ForgotPasswordRequestBody) data: ForgotPasswordData,
  ): Promise<void> {
    const user = await this.utilisateurRepository.findOne({
      where: {or: [{email: data.identifier}, {phoneNumber: data.identifier}]},
    });
    if (!user) {
      throw new HttpErrors.NotFound('Email or phone number not found.');
    }

    const resetToken = this.emailService.generateResetToken();
    await this.utilisateurRepository.updateById(user.id!, {
      resetPasswordToken: resetToken,
      resetPasswordTokenExpiry: this.emailService.getTokenExpiration(),
    });

    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.prenom || user.nom,
      resetToken,
    );
  }

  @post('/reset-password', {
    responses: {
      '204': {description: 'Password reset successfully'},
    },
  })
  async resetPassword(
    @requestBody(ResetPasswordRequestBody) data: ResetPasswordData,
  ): Promise<void> {
    const user = await this.utilisateurRepository.findOne({
      where: {
        resetPasswordToken: data.token,
        resetPasswordTokenExpiry: {gt: new Date().toISOString()},
      },
    });
    if (!user) {
      throw new HttpErrors.Unauthorized('Invalid or expired reset token.');
    }

    await this.utilisateurRepository.updateById(user.id!, {
      motDePasse: data.newPassword,
      resetPasswordToken: undefined,
      resetPasswordTokenExpiry: undefined,
    });
    await this.emailService.sendPasswordChangedEmail(user.email, user.prenom || user.nom);
  }

  @get('/verify-email', {
    responses: {
      '204': {description: 'Email verified successfully (legacy)'},
    },
  })
  async verifyEmail(
    @param.query.string('token') token: string,
  ): Promise<void> {
    const user = await this.utilisateurRepository.findOne({
      where: {verificationToken: token},
    });
    if (!user) {
      throw new HttpErrors.Unauthorized('Invalid verification token.');
    }

    await this.utilisateurRepository.updateById(user.id!, {
      verified: true,
      verificationToken: undefined,
    });
    await this.emailService.sendWelcomeEmail(user.email, user.prenom || user.nom);
  }

  @authenticate('jwt')
  @post('/logout', {
    responses: {
      '204': {description: 'Logged out successfully'},
    },
  })
  async logout(): Promise<void> {
    console.log('📴 User logged out');
  }
}
