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

@Controller('/webhooks/lavapayments')
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
      console.error('[LavaWebhook] Invalid JSON payload', e);
      return res
        .status(400)
        .json({ success: false, message: 'Invalid JSON payload' });
    }

    console.log('[LavaWebhook] Parsed event:', event);

    // Handle events
    switch (event.event) {
      case 'connection.created': {
        const data = event.data;
        console.log('[LavaWebhook] Handling connection.created', data);
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
            console.log(
              `[LavaWebhook] Updated customer ${referenceId} with new connection info`,
            );
          } else {
            console.warn(
              `[LavaWebhook] No customer found with reference_id ${referenceId}`,
            );
          }
        } else {
          console.warn(
            '[LavaWebhook] No reference_id found in connection.created event',
          );
        }
        break;
      }
      case 'connection.wallet.balance.updated': {
        console.log(
          '[LavaWebhook] Received connection.wallet.balance.updated event',
          event.data,
        );
        const data = event.data;
        const referenceId = data.reference_id;
        if (referenceId) {
          const customer = await this.customerModel.findByPk(referenceId);
          if (customer) {
            await customer.update({
              lavaConnectionId: data.connection_id,
              lavaConnectionSecret: data.connection_secret,
              billingStatus: 'active',
            });
            console.log(
              `[LavaWebhook] Updated customer ${referenceId} with new connection info from balance update`,
            );
          } else {
            console.warn(
              `[LavaWebhook] No customer found with reference_id ${referenceId} in balance update`,
            );
          }
        } else {
          console.warn(
            '[LavaWebhook] No reference_id found in connection.wallet.balance.updated event',
          );
        }
        break;
      }
      case 'connection.deleted': {
        const data = event.data;
        console.log('[LavaWebhook] Handling connection.deleted', data);

        // Prefer reference_id if available
        if (data.reference_id) {
          const customer = await this.customerModel.findByPk(data.reference_id);
          if (customer) {
            await customer.update({
              lavaConnectionId: null,
              lavaConnectionSecret: null,
              billingStatus: 'cancelled',
            });
            console.log(
              `[LavaWebhook] Cancelled customer ${customer.id} account and removed connection info (by reference_id)`,
            );
          } else {
            console.warn(
              `[LavaWebhook] No customer found with reference_id ${data.reference_id} in connection.deleted`,
            );
          }
        } else {
          // Fallback to old logic: find by connection_id
          const customer = await this.customerModel.findOne({
            where: { lavaConnectionId: data.connection_id },
          });
          if (customer) {
            await customer.update({
              lavaConnectionId: null,
              lavaConnectionSecret: null,
              billingStatus: 'cancelled',
            });
            console.log(
              `[LavaWebhook] Cancelled customer ${customer.id} account and removed connection info (by connection_id)`,
            );
          } else {
            console.warn(
              `[LavaWebhook] No customer found with lavaConnectionId ${data.connection_id} in connection.deleted`,
            );
          }
        }
        break;
      }
      default:
        console.warn(
          `[LavaWebhook] Unknown or unhandled event type: ${event.event}`,
        );
        // Ignore unknown events
        break;
    }

    console.log('[LavaWebhook] Webhook processed successfully');
    return res.status(200).json({ success: true });
  }
}
