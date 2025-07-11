import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes } from 'crypto';
import {
  Customer,
  CustomerAuthProvider,
  CustomerStatus,
} from '../../database/models/customer/customer.model';
import { ZitadelService, ZitadelUserInfo } from './zitadel.service';
import { UpdateProfileDto } from '../../dto/customer/update-profile.dto';
import { AuthService } from '../../auth/auth.service';

export interface CustomerOAuthCallbackDto {
  code: string;
  state: string;
  redirectUri?: string;
}

export interface CustomerAuthResponse {
  customer: Customer;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly zitadelService: ZitadelService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Handle OAuth callback from ZITADEL
   */
  async handleOAuthCallback(
    callbackDto: CustomerOAuthCallbackDto,
  ): Promise<CustomerAuthResponse> {
    this.logger.log(
      `Processing OAuth callback with state: ${callbackDto.state}`,
    );

    // Exchange code for tokens
    const tokenResponse = await this.zitadelService.exchangeCodeForTokens(
      callbackDto.code,
      callbackDto.state,
      callbackDto.redirectUri,
    );

    this.logger.log('Token exchange successful', {
      hasIdToken: !!tokenResponse.id_token,
      hasAccessToken: !!tokenResponse.access_token,
      tokenType: tokenResponse.token_type,
      expiresIn: tokenResponse.expires_in,
    });

    // Get user info from ID token or userinfo endpoint
    let userInfo: ZitadelUserInfo;
    if (tokenResponse.id_token) {
      try {
        userInfo = await this.zitadelService.verifyIdToken(
          tokenResponse.id_token,
        );
        this.logger.log('User info extracted from ID token', {
          sub: userInfo.sub,
        });
      } catch (error) {
        this.logger.error(
          'Failed to verify ID token, falling back to userinfo endpoint',
          error.message,
        );
        // Fallback to userinfo endpoint
        userInfo = await this.zitadelService.getUserInfo(
          tokenResponse.access_token,
        );
        this.logger.log('User info extracted from userinfo endpoint', {
          sub: userInfo.sub,
        });
      }
    } else {
      this.logger.log('No ID token provided, using userinfo endpoint');
      userInfo = await this.zitadelService.getUserInfo(
        tokenResponse.access_token,
      );
      this.logger.log('User info extracted from userinfo endpoint', {
        sub: userInfo.sub,
      });
    }

    // Find or create customer
    let customer = await this.customerModel.findOne({
      where: { zitadelUserId: userInfo.sub },
    });

    if (!customer && userInfo.email) {
      // Try to find by email
      customer = await this.customerModel.findOne({
        where: { email: userInfo.email },
      });

      if (customer) {
        // Link existing account with ZITADEL
        await customer.update({
          zitadelUserId: userInfo.sub,
          connectedProviders: [
            ...customer.connectedProviders,
            CustomerAuthProvider.ZITADEL,
          ],
          isEmailVerified: userInfo.email_verified || customer.isEmailVerified,
          emailVerifiedAt:
            userInfo.email_verified && !customer.emailVerifiedAt
              ? new Date()
              : customer.emailVerifiedAt,
        });

        // Ensure customer has a user associated
        if (!customer.userId) {
          try {
            let user = await this.authService.findUserByEmail(userInfo.email);

            if (!user) {
              user = await this.authService.createUser({
                email: userInfo.email,
                name: `${userInfo.given_name} ${userInfo.family_name}`,
              });
              this.logger.log('Created new user for existing customer', {
                userId: user.id,
              });
            } else {
              this.logger.log('Found existing user for existing customer', {
                userId: user.id,
              });
            }

            await customer.update({ userId: user.id });
          } catch (error) {
            this.logger.error(
              'Failed to create or link user for existing customer',
              {
                customerId: customer.id,
                email: userInfo.email,
                error: error.message,
              },
            );
            // Continue without failing the entire OAuth flow
          }
        }

        this.logger.log('Linked existing customer with Zitadel', {
          customerId: customer.id,
        });
      }
    }

    if (!customer) {
      // Create new customer from OAuth
      customer = await this.customerModel.create({
        email: userInfo.email,
        firstName: userInfo.given_name,
        lastName: userInfo.family_name,
        avatarUrl: userInfo.picture,
        zitadelUserId: userInfo.sub,
        primaryAuthProvider: CustomerAuthProvider.ZITADEL,
        connectedProviders: [CustomerAuthProvider.ZITADEL],
        isEmailVerified: userInfo.email_verified || false,
        emailVerifiedAt: userInfo.email_verified ? new Date() : null,
        status: CustomerStatus.ACTIVE,
      });

      // Check if user already exists, if not create one
      try {
        let user = await this.authService.findUserByEmail(userInfo.email);

        if (!user) {
          user = await this.authService.createUser({
            email: userInfo.email,
            name: `${userInfo.given_name} ${userInfo.family_name}`,
          });
          this.logger.log('Created new user for customer', { userId: user.id });
        } else {
          this.logger.log('Found existing user for customer', {
            userId: user.id,
          });
        }

        await customer.update({ userId: user.id });
      } catch (error) {
        this.logger.error('Failed to create or link user for new customer', {
          customerId: customer.id,
          email: userInfo.email,
          error: error.message,
        });
        // Continue without failing the entire OAuth flow
      }

      this.logger.log('Created new customer from OAuth', {
        customerId: customer.id,
      });
    }

    // Update login activity
    await customer.update({
      lastLoginAt: new Date(),
    });

    // Generate tokens
    const { accessToken, refreshToken, expiresIn } =
      await this.generateTokens(customer);

    this.logger.log('Authentication successful', { customerId: customer.id });

    return {
      customer,
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Validate access token and return customer
   */
  async validateToken(accessToken: string): Promise<Customer> {
    try {
      const payload = this.jwtService.verify(accessToken, {
        secret: this.configService.get('customerJwt.secret'),
      });

      const customer = await this.customerModel.findByPk(payload.sub);
      if (!customer || customer.status !== CustomerStatus.ACTIVE) {
        throw new UnauthorizedException('Invalid token');
      }

      return customer;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate OAuth login URL
   */
  generateOAuthLoginUrl(redirectUri?: string): {
    authUrl: string;
    state: string;
  } {
    const { authUrl, state } = this.zitadelService.generateAuthUrl(redirectUri);
    return { authUrl, state };
  }

  /**
   * Generate logout URL
   */
  generateLogoutUrl(idTokenHint?: string): string {
    return this.zitadelService.generateLogoutUrl(idTokenHint);
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    updateDto: UpdateProfileDto,
  ): Promise<Customer> {
    this.logger.log(`Updating profile for customer: ${customerId}`);

    const customer = await this.customerModel.findByPk(customerId);
    if (!customer || customer.status !== CustomerStatus.ACTIVE) {
      throw new UnauthorizedException('Customer not found or inactive');
    }

    // Only allow updating firstName, lastName, and autoDeleteAfterDays
    const updateData: Partial<Customer> = {};

    if (updateDto.firstName !== undefined) {
      updateData.firstName = updateDto.firstName;
    }

    if (updateDto.lastName !== undefined) {
      updateData.lastName = updateDto.lastName;
    }

    if (updateDto.autoDeleteAfterDays !== undefined) {
      updateData.autoDeleteAfterDays = updateDto.autoDeleteAfterDays;
    }

    await customer.update(updateData);

    this.logger.log('Profile updated successfully', { customerId });

    return customer;
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(customer: Customer): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload = {
      sub: customer.id,
      email: customer.email,
      type: 'customer',
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('customerJwt.secret'),
      expiresIn: this.configService.get('customerJwt.expiresIn'),
      issuer: this.configService.get('customerJwt.issuer'),
      audience: this.configService.get('customerJwt.audience'),
    });

    const refreshToken = randomBytes(32).toString('hex');

    // No update to customer, as there are no accessToken/refreshToken fields

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }
}
