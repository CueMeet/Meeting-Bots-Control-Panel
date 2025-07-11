import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  CustomerApiKey,
  CustomerApiKeyStatus,
} from '../../database/models/customer/customer-api-key.model';
import { Customer } from '../../database/models/customer/customer.model';
import { CreateCustomerApiKeyDto } from '../../dto/customer/create-customer-api-key.dto';
import { ApiKeyService } from '../../auth/api-key.service';

@Injectable()
export class CustomerApiKeysService {
  constructor(
    @InjectModel(CustomerApiKey)
    private customerApiKeyModel: typeof CustomerApiKey,
    @InjectModel(Customer)
    private customerModel: typeof Customer,
    private apiKeyService: ApiKeyService,
  ) {}

  /**
   * Generate a new API key for a customer using the existing ApiKeyService
   */
  async generateApiKey(
    customerId: string,
    userId: string,
    createApiKeyDto: CreateCustomerApiKeyDto,
  ): Promise<{ apiKey: string; apiKeyRecord: CustomerApiKey }> {
    const { name, description } = createApiKeyDto;

    // Check if customer has active subscription
    const customer = await this.customerModel.findByPk(customerId);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (!customer.lavaConnectionId || customer.billingStatus !== 'active') {
      throw new BadRequestException(
        'Active subscription required. Please complete payment setup to generate API keys.',
      );
    }

    const { apiKey, apiKeyRecord } = await this.apiKeyService.generateApiKey(
      userId,
      {
        userId,
        name,
      },
    );

    // Store the generated API key data in the customer API key table
    const customerApiKeyRecord = await this.customerApiKeyModel.create({
      key: apiKey,
      apiKeyId: apiKeyRecord.id,
      name,
      description,
      customerId,
      status: CustomerApiKeyStatus.ACTIVE,
      lastUsedAt: new Date(),
    });

    // Return the raw API key and customer API key record
    return { apiKey, apiKeyRecord: customerApiKeyRecord };
  }

  /**
   * Validate an API key using the existing ApiKeyService
   */
  async validateApiKey(apiKey: string): Promise<CustomerApiKey> {
    // Use the existing ApiKeyService to validate the key
    const userApiKeyRecord = await this.apiKeyService.validateApiKey(apiKey);

    if (!userApiKeyRecord) {
      return null;
    }

    // Find the corresponding customer API key record
    const customerApiKeyRecord = await this.customerApiKeyModel.findOne({
      where: {
        key: userApiKeyRecord.key,
        status: CustomerApiKeyStatus.ACTIVE,
      },
    });

    if (!customerApiKeyRecord) {
      return null;
    }

    // Update last used timestamp
    await customerApiKeyRecord.update({ lastUsedAt: new Date() });

    return customerApiKeyRecord;
  }

  /**
   * Get a specific API key by ID for a customer
   */
  async getApiKeyById(
    customerId: string,
    apiKeyId: string,
  ): Promise<CustomerApiKey> {
    return this.customerApiKeyModel.findOne({
      where: {
        id: apiKeyId,
        customerId,
      },
    });
  }

  /**
   * List all API keys for a customer (without the actual key values)
   */
  async listApiKeys(customerId: string): Promise<CustomerApiKey[]> {
    return this.customerApiKeyModel.findAll({
      where: { customerId },
      attributes: { exclude: ['key'] },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Check if customer can generate API keys
   */
  async canGenerateApiKey(customerId: string): Promise<{
    canGenerate: boolean;
    reason?: string;
    subscriptionStatus?: string;
  }> {
    const customer = await this.customerModel.findByPk(customerId);
    if (!customer) {
      return {
        canGenerate: false,
        reason: 'Customer not found',
      };
    }

    if (!customer.lavaConnectionId || customer.billingStatus !== 'active') {
      return {
        canGenerate: false,
        reason: 'Active subscription required',
        subscriptionStatus: customer.billingStatus || 'inactive',
      };
    }

    return {
      canGenerate: true,
      subscriptionStatus: customer.billingStatus,
    };
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(apiKeyId: string): Promise<void> {
    const apiKey = await this.customerApiKeyModel.findOne({
      where: {
        id: apiKeyId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await apiKey.update({
      status: CustomerApiKeyStatus.REVOKED,
      revokedAt: new Date(),
    });
  }
}
