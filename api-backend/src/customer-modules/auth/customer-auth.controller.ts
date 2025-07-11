import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  CustomerAuthService,
  CustomerOAuthCallbackDto,
} from './customer-auth.service';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { Customer } from '../../database/models/customer/customer.model';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { UpdateProfileDto } from '../../dto/customer/update-profile.dto';

@Controller('customer/auth')
export class CustomerAuthController {
  private readonly logger = new Logger(CustomerAuthController.name);

  constructor(private readonly customerAuthService: CustomerAuthService) {}

  /**
   * Generate OAuth login URL - redirects to ZITADEL
   */
  @Get('login')
  async generateOAuthLoginUrl(@Query('redirect_uri') redirectUri?: string) {
    const { authUrl, state } =
      this.customerAuthService.generateOAuthLoginUrl(redirectUri);

    return {
      success: true,
      data: {
        authUrl,
        state,
      },
    };
  }

  /**
   * Handle OAuth callback from ZITADEL
   */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  async handleOAuthCallback(
    @Body() callbackDto: CustomerOAuthCallbackDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!callbackDto.code || !callbackDto.state) {
      throw new BadRequestException('Missing required parameters');
    }

    const authResponse =
      await this.customerAuthService.handleOAuthCallback(callbackDto);

    // Set HTTP-only cookie for refresh token
    this.setRefreshTokenCookie(res, authResponse.refreshToken);

    return {
      success: true,
      message: 'Authentication successful',
      data: {
        customer: this.sanitizeCustomer(authResponse.customer),
        accessToken: authResponse.accessToken,
        expiresIn: authResponse.expiresIn,
      },
    };
  }

  /**
   * Logout customer
   */
  @Post('logout')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.clearRefreshTokenCookie(res);

    return {
      success: true,
      message: 'Logout successful',
    };
  }

  /**
   * Get current customer profile
   */
  @Get('me')
  @UseGuards(CustomerAuthGuard)
  async getCurrentCustomer(@GetCustomer() customer: Customer) {
    return {
      success: true,
      data: {
        customer: this.sanitizeCustomer(customer),
      },
    };
  }

  /**
   * Update customer profile
   */
  @Put('profile')
  @UseGuards(CustomerAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @GetCustomer() customer: Customer,
    @Body() updateDto: UpdateProfileDto,
  ) {
    const updatedCustomer = await this.customerAuthService.updateProfile(
      customer.id,
      updateDto,
    );

    return {
      success: true,
      message: 'Profile updated successfully',
      data: {
        customer: this.sanitizeCustomer(updatedCustomer),
      },
    };
  }

  /**
   * Set refresh token as HTTP-only cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/v1/customer/auth',
    });
  }

  /**
   * Clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/customer/auth',
    });
  }

  /**
   * Sanitize customer data for response
   */
  private sanitizeCustomer(customer: Customer) {
    const sanitized = customer.toJSON();
    // Remove any sensitive fields if needed in the future
    return sanitized;
  }
}
