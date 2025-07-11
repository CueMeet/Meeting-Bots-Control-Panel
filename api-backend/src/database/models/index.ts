import { ApiKey } from './api-key.model';
import { Bot } from './bot.model';
import { User } from './user.model';

import { Customer } from './customer/customer.model';
import { CustomerApiKey } from './customer/customer-api-key.model';
import { CustomerBot } from './customer/customer-bot.model';
import { CustomerUsage } from './customer/customer-usage.model';

export default [
  Bot,
  ApiKey,
  User,

  // Customer portal models
  Customer,
  CustomerApiKey,
  CustomerBot,
  CustomerUsage,
];
