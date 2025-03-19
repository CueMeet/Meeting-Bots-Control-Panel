import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Global,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from 'src/auth/api-key.service';

@Injectable()
@Global()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.get<string[]>('permissions', context.getHandler()) || [];
    const request = context.switchToHttp().getRequest();

    // Extract API key from headers
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    // Validate the API key
    const apiKeyRecord = await this.apiKeyService.validateApiKey(apiKey);
    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Check permissions if required
    if (requiredPermissions.length > 0) {
      const hasPermission = this.checkPermissions(
        apiKeyRecord.permissions,
        requiredPermissions,
      );
      if (!hasPermission) {
        throw new UnauthorizedException('Insufficient permissions');
      }
    }

    // Attach user and API key info to the request
    request.user = { id: apiKeyRecord.userId };
    request.apiKey = apiKeyRecord;

    return true;
  }

  private extractApiKey(request: any): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // Check query parameter
    if (request.query.apiKey) {
      return request.query.apiKey;
    }

    return null;
  }

  private checkPermissions(
    userPermissions: any,
    requiredPermissions: string[],
  ): boolean {
    if (!userPermissions) return false;

    return requiredPermissions.every((permission) => {
      const [resource, action] = permission.split(':');
      return (
        userPermissions[resource] && userPermissions[resource].includes(action)
      );
    });
  }
}
