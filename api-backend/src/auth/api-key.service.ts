import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomBytes, createHash } from 'crypto';
import { CreateApiKeyDto } from 'src/dto/api-key/create-api-key.dto';
import { ApiKey } from 'src/database/models/api-key.model';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectModel(ApiKey)
    private apiKeyModel: typeof ApiKey,
  ) {}

  /**
   * Generate a new API key for a user
   */
  async generateApiKey(
    userId: string,
    createApiKeyDto: CreateApiKeyDto,
  ): Promise<{ apiKey: string; apiKeyRecord: ApiKey }> {
    const { name, expiresAt, permissions } = createApiKeyDto;

    // Check if user has reached maximum number of API keys
    const userKeyCount = await this.apiKeyModel.count({ where: { userId } });
    if (userKeyCount >= 5) {
      throw new BadRequestException('Maximum number of API keys reached');
    }

    // Generate a secure random API key
    const apiKey = `sk_${randomBytes(24).toString('hex')}`;

    // Store hashed version in database for security
    const hashedKey = this.hashApiKey(apiKey);

    const apiKeyRecord = await this.apiKeyModel.create({
      key: hashedKey,
      name,
      userId,
      expiresAt,
      permissions,
      lastUsedAt: new Date(),
    });

    // Return the raw API key only once - it won't be retrievable later
    return { apiKey, apiKeyRecord };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string): Promise<ApiKey> {
    const hashedKey = this.hashApiKey(apiKey);

    const apiKeyRecord = await this.apiKeyModel.findOne({
      where: {
        key: hashedKey,
        isActive: true,
      },
    });

    if (!apiKeyRecord) {
      return null;
    }

    // Check if API key is expired
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    await apiKeyRecord.update({ lastUsedAt: new Date() });

    return apiKeyRecord;
  }

  /**
   * List all API keys for a user (without the actual key values)
   */
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyModel.findAll({
      where: { userId },
      attributes: { exclude: ['key'] },
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    const apiKey = await this.apiKeyModel.findOne({
      where: {
        id: apiKeyId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await apiKey.update({ isActive: false });
  }

  /**
   * Hash an API key for secure storage
   */
  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
