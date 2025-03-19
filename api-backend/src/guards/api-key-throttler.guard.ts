import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const request = context.switchToHttp().getRequest();
    const apiKey =
      request.headers['x-api-key'] ||
      (request.headers.authorization &&
        request.headers.authorization.split(' ')[1]);

    if (!apiKey) {
      return true; // Skip throttling if no API key (will be caught by auth guard)
    }

    return super.handleRequest(requestProps);
  }
}
