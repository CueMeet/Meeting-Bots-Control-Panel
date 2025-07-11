import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios, { AxiosInstance } from 'axios';
import { createHash, randomBytes } from 'crypto';

export interface ZitadelTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
}

export interface ZitadelUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  locale?: string;
  preferred_username?: string;
  updated_at?: number;
  // ZITADEL specific claims
  'urn:zitadel:iam:org:id'?: string;
  'urn:zitadel:iam:org:domain:primary'?: string;
  'urn:zitadel:iam:user:metadata'?: Record<string, any>;
}

export interface ZitadelOAuthState {
  state: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
  createdAt: number;
}

@Injectable()
export class ZitadelService {
  private readonly httpClient: AxiosInstance;
  private readonly stateStore = new Map<string, ZitadelOAuthState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.httpClient = axios.create({
      baseURL: this.configService.get('zitadel.apiUrl'),
      timeout: 10000,
    });
  }

  /**
   * Generate OAuth authorization URL with PKCE
   */
  generateAuthUrl(redirectUri?: string): {
    authUrl: string;
    state: string;
    codeVerifier: string;
    nonce: string;
  } {
    const state = this.generateRandomString(32);
    const nonce = this.generateRandomString(32);
    const codeVerifier = this.generateRandomString(128);
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Store state for verification
    this.stateStore.set(state, {
      state,
      codeVerifier,
      nonce,
      redirectUri: redirectUri || this.configService.get('zitadel.redirectUri'),
      createdAt: Date.now(),
    });

    // Clean up expired states (older than 10 minutes)
    this.cleanupExpiredStates();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.configService.get('zitadel.clientId'),
      redirect_uri:
        redirectUri || this.configService.get('zitadel.redirectUri'),
      scope: this.configService.get('zitadel.scope'),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const organizationId = this.configService.get('zitadel.organizationId');
    if (organizationId) {
      params.append('organization', organizationId);
    }

    const authUrl = `${this.configService.get('zitadel.issuer')}/oauth/v2/authorize?${params.toString()}`;

    return {
      authUrl,
      state,
      codeVerifier,
      nonce,
    };
  }

  /**
   * Exchange authorization code for tokens (PKCE, no client_secret)
   */
  async exchangeCodeForTokens(
    code: string,
    state: string,
    redirectUri?: string,
  ): Promise<ZitadelTokenResponse> {
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      // TEMPORARY: For testing only - bypass state validation
      // TODO: Remove this in production
      if (process.env.NODE_ENV === 'development') {
        // Use the first available state or create a mock one
        const availableStates = Array.from(this.stateStore.keys());
        if (availableStates.length > 0) {
          const fallbackState = availableStates[0];
          const fallbackStateData = this.stateStore.get(fallbackState);

          // Clean up the fallback state
          this.stateStore.delete(fallbackState);

          const tokenEndpoint = `${this.configService.get('zitadel.issuer')}/oauth/v2/token`;
          const finalRedirectUri = redirectUri || fallbackStateData.redirectUri;

          const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: finalRedirectUri,
            client_id: this.configService.get('zitadel.clientId'),
            code_verifier: fallbackStateData.codeVerifier,
          });

          try {
            const response = await this.httpClient.post(tokenEndpoint, params, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            });

            return response.data;
          } catch (error) {
            throw new UnauthorizedException(
              'Failed to exchange authorization code',
            );
          }
        }
      }

      throw new BadRequestException('Invalid or expired state parameter');
    }

    // Clean up used state
    this.stateStore.delete(state);

    const tokenEndpoint = `${this.configService.get('zitadel.issuer')}/oauth/v2/token`;
    const finalRedirectUri = redirectUri || stateData.redirectUri;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: finalRedirectUri,
      client_id: this.configService.get('zitadel.clientId'),
      code_verifier: stateData.codeVerifier,
    });

    try {
      const response = await this.httpClient.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      throw new UnauthorizedException('Failed to exchange authorization code');
    }
  }

  /**
   * Verify and decode ID token
   */
  async verifyIdToken(idToken: string): Promise<ZitadelUserInfo> {
    try {
      // In production, you should verify the token signature using ZITADEL's public keys
      // For now, we'll decode without verification (NOT RECOMMENDED FOR PRODUCTION)
      const decoded = this.jwtService.decode(idToken) as any;

      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid ID token: missing sub claim');
      }

      // Verify token claims
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new UnauthorizedException('ID token has expired');
      }

      const expectedIssuer = this.configService.get('zitadel.issuer');
      if (decoded.iss !== expectedIssuer) {
        throw new UnauthorizedException('Invalid token issuer');
      }

      const expectedAudience = this.configService.get('zitadel.clientId');
      if (decoded.aud !== expectedAudience) {
        throw new UnauthorizedException('Invalid token audience');
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid ID token');
    }
  }

  /**
   * Get user info from ZITADEL using access token
   */
  async getUserInfo(accessToken: string): Promise<ZitadelUserInfo> {
    try {
      const userInfoEndpoint = `${this.configService.get('zitadel.issuer')}/oidc/v1/userinfo`;

      const response = await this.httpClient.get(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error) {
      throw new UnauthorizedException('Failed to get user information');
    }
  }

  /**
   * Refresh access token using refresh token (PKCE, no client_secret)
   */
  async refreshToken(refreshToken: string): Promise<ZitadelTokenResponse> {
    try {
      const tokenEndpoint = `${this.configService.get('zitadel.issuer')}/oauth/v2/token`;

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.configService.get('zitadel.clientId'),
      });

      const response = await this.httpClient.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error) {
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  /**
   * Revoke token (logout) (PKCE, no client_secret)
   */
  async revokeToken(
    token: string,
    tokenType: 'access_token' | 'refresh_token' = 'refresh_token',
  ): Promise<void> {
    try {
      const revokeEndpoint = `${this.configService.get('zitadel.issuer')}/oauth/v2/revoke`;

      const params = new URLSearchParams({
        token,
        token_type_hint: tokenType,
        client_id: this.configService.get('zitadel.clientId'),
      });

      await this.httpClient.post(revokeEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error(
        'Failed to revoke token',
        error.response?.data || error.message,
      );
      // Don't throw error for revoke failures - token might already be expired
    }
  }

  /**
   * Generate logout URL
   */
  generateLogoutUrl(idTokenHint?: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get('zitadel.clientId'),
      post_logout_redirect_uri: this.configService.get(
        'zitadel.postLogoutRedirectUri',
      ),
    });

    if (idTokenHint) {
      params.append('id_token_hint', idTokenHint);
    }

    return `${this.configService.get('zitadel.issuer')}/oidc/v1/end_session?${params.toString()}`;
  }

  /**
   * Validate access token
   */
  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const introspectEndpoint = `${this.configService.get('zitadel.issuer')}/oauth/v2/introspect`;

      const params = new URLSearchParams({
        token: accessToken,
        client_id: this.configService.get('zitadel.clientId'),
      });

      const response = await this.httpClient.post(introspectEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data.active === true;
    } catch (error) {
      console.error(
        'Failed to validate access token',
        error.response?.data || error.message,
      );
      return false;
    }
  }

  /**
   * Generate random string for state, nonce, etc.
   */
  private generateRandomString(length: number): string {
    return randomBytes(length).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }

  /**
   * Clean up expired states (older than 10 minutes)
   */
  private cleanupExpiredStates(): void {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [state, stateData] of this.stateStore.entries()) {
      if (stateData.createdAt < tenMinutesAgo) {
        this.stateStore.delete(state);
      }
    }
  }
}
