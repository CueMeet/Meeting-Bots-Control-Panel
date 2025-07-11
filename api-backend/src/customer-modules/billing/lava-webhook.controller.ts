import {
  Controller,
  Post,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/sequelize';
import { Customer } from '../../database/models/customer/customer.model';

@Controller('api/v1/webhooks/lavapayments')
export class LavaWebhookController {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Customer)
    private readonly customerModel: typeof Customer,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    const signature = req.headers['x-webhook-signature'] as string;
    const secret = this.configService.get('lavapayments.webhookSecret');
    const payload = req.body; // Buffer (raw body)

    // Verify signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('hex');
    const isValid =
      signature &&
      crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid signature' });
    }

    let event: any;
    try {
      event = JSON.parse(payload.toString());
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid JSON payload' });
    }

    // Handle events
    switch (event.event) {
      case 'connection.created': {
        const data = event.data;
        // Find customer by reference_id if available
        const referenceId = data.reference_id;
        if (referenceId) {
          const customer = await this.customerModel.findByPk(referenceId);
          if (customer) {
            await customer.update({
              lavaConnectionId: data.connection_id,
              lavaConnectionSecret: data.connection_secret,
              billingStatus: 'active',
            });
          }
        }
        break;
      }
      case 'connection.wallet.balance.updated': {
        // Optionally update customer balance/status
        // You may want to fetch the customer by connection_id
        break;
      }
      case 'connection.deleted': {
        const data = event.data;
        // Find customer by connection_id
        const customer = await this.customerModel.findOne({
          where: { lavaConnectionId: data.connection_id },
        });
        if (customer) {
          await customer.update({
            lavaConnectionId: null,
            lavaConnectionSecret: null,
            billingStatus: 'inactive',
          });
        }
        break;
      }
      default:
        // Ignore unknown events
        break;
    }

    return res.status(200).json({ success: true });
  }
}
