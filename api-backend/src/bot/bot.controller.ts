import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKey } from 'src/database/models/api-key.model';
import { CreateBotDto } from 'src/dto/bot/create-bot.dto';
import { PaginationDto } from 'src/dto/common/pagination.dto';
import { ApiKeyGuard } from 'src/guards/api-key.guard';
import { BotService } from './bot.service';

@Controller('bot')
@UseGuards(ApiKeyGuard)
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post()
  async createBot(
    @Body() createBotDto: CreateBotDto,
    @Req() req: Request & { apiKey: ApiKey },
  ) {
    return this.botService.createBot(createBotDto, req.apiKey);
  }

  @Get()
  async getBotList(@Query() paginationDto: PaginationDto) {
    return this.botService.getBotList(paginationDto);
  }

  @Post(':id/leave')
  async leaveCall(@Param('id') id: string) {
    return this.botService.leaveCall(id);
  }

  @Get(':id')
  async getBot(@Param('id') id: string) {
    return this.botService.getBot(id);
  }

  @Get(':id/transcript')
  async getTranscript(
    @Param('id') id: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.botService.getTranscript(id, {
      page: paginationDto?.page ?? 1,
      page_size: paginationDto?.limit ?? 10,
    });
  }
}
