import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { CreateApiKeyDto } from 'src/dto/api-key/create-api-key.dto';
import { ListApiKeysDto } from 'src/dto/api-key/list-api-keys.dto';
import { ApiKeyService } from './api-key.service';

@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async createApiKey(@Body() createApiKeyDto: CreateApiKeyDto) {
    const { apiKey, apiKeyRecord } = await this.apiKeyService.generateApiKey(
      createApiKeyDto.userId,
      createApiKeyDto,
    );

    // Return the API key only once
    return {
      id: apiKeyRecord.id,
      name: apiKeyRecord.name,
      createdAt: apiKeyRecord.createdAt,
      expiresAt: apiKeyRecord.expiresAt,
      apiKey, // This is the only time the raw key is returned
    };
  }

  @Post('list')
  async listApiKeys(@Body() listApiKeysDto: ListApiKeysDto) {
    return this.apiKeyService.listApiKeys(listApiKeysDto.userId);
  }

  @Delete(':id')
  async revokeApiKey(@Param('id') id: string) {
    await this.apiKeyService.revokeApiKey(id);
    return { success: true };
  }
}
