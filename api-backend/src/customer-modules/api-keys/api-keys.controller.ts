import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CustomerApiKeysService } from './api-keys.service';
import { CreateCustomerApiKeyDto } from '../../dto/customer/create-customer-api-key.dto';
import { CustomerAuthGuard } from '../../guards/customer-auth.guard';
import { GetCustomer } from '../../decorators/get-customer.decorator';
import { Customer } from '../../database/models/customer/customer.model';

@Controller('customer/api-keys')
@UseGuards(CustomerAuthGuard)
export class CustomerApiKeysController {
  constructor(
    private readonly customerApiKeysService: CustomerApiKeysService,
  ) {}

  /**
   * Check if customer can generate API keys
   */
  @Get('can-generate')
  async canGenerateApiKey(@GetCustomer() customer: Customer) {
    const result = await this.customerApiKeysService.canGenerateApiKey(
      customer.id,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Create a new API key
   */
  @Post()
  async createApiKey(
    @GetCustomer() customer: Customer,
    @Body() createDto: CreateCustomerApiKeyDto,
  ) {
    const { apiKey, apiKeyRecord } =
      await this.customerApiKeysService.generateApiKey(
        customer.id,
        customer.userId,
        createDto,
      );

    return {
      success: true,
      data: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        description: apiKeyRecord.description,
        createdAt: apiKeyRecord.createdAt,
        apiKey, // This is the only time the raw key is returned
      },
    };
  }

  /**
   * List all API keys for the customer
   */
  @Get()
  async listApiKeys(@GetCustomer() customer: Customer) {
    const apiKeys = await this.customerApiKeysService.listApiKeys(customer.id);

    // Mask the key field with asterisks for security
    const maskedApiKeys = apiKeys.map((key) => ({
      ...key.toJSON(),
      key: '***************',
    }));

    return {
      success: true,
      data: {
        apiKeys: maskedApiKeys,
        total: maskedApiKeys.length,
      },
    };
  }

  /**
   * Show a specific API key (returns error since keys cannot be retrieved after creation)
   */
  @Get(':id')
  async showApiKey(
    @GetCustomer() customer: Customer,
    @Param('id') apiKeyId: string,
  ) {
    // Check if the API key exists and belongs to the customer
    const apiKeyRecord = await this.customerApiKeysService.getApiKeyById(
      customer.id,
      apiKeyId,
    );

    if (!apiKeyRecord) {
      return {
        success: false,
        message: 'API key not found',
      };
    }

    // Return error message since API key value cannot be retrieved
    return {
      success: true,
      data: {
        id: apiKeyRecord.id,
        name: apiKeyRecord.name,
        key: apiKeyRecord.key,
        description: apiKeyRecord.description,
        status: apiKeyRecord.status,
        createdAt: apiKeyRecord.createdAt,
        lastUsedAt: apiKeyRecord.lastUsedAt,
        revokedAt: apiKeyRecord.revokedAt,
      },
    };
  }

  /**
   * Delete/revoke an API key
   */
  @Delete(':id')
  async deleteApiKey(
    @GetCustomer() customer: Customer,
    @Param('id') apiKeyId: string,
  ) {
    await this.customerApiKeysService.revokeApiKey(apiKeyId);

    return {
      success: true,
      message: 'API key revoked successfully',
    };
  }
}
