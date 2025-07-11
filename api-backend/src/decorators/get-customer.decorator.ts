import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Customer } from '../database/models/customer/customer.model';

export const GetCustomer = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Customer => {
    const request = ctx.switchToHttp().getRequest();
    return request.customer;
  },
);
