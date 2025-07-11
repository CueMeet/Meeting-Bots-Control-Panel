import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CustomerAuthService } from '../customer-modules/auth/customer-auth.service';

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  private readonly logger = new Logger(CustomerAuthGuard.name);

  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if route is marked as public
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );
    if (isPublic) {
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException('Access token is required');
    }

    try {
      const customer = await this.customerAuthService.validateToken(token);

      // Attach customer to request object
      (request as any).customer = customer;

      return true;
    } catch (error) {
      this.logger.warn(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
