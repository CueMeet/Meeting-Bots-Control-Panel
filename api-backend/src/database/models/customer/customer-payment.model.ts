import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { Customer } from './customer.model';

export enum CustomerPaymentType {
  USAGE = 'USAGE',
  BASE_FEE = 'BASE_FEE',
  TOPUP = 'TOPUP',
  REFUND = 'REFUND',
}

export enum CustomerPaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Table({
  tableName: 'customer_payments',
  timestamps: true,
})
export class CustomerPayment extends Model<CustomerPayment> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @ForeignKey(() => Customer)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  customerId: string;

  @BelongsTo(() => Customer)
  customer: Customer;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerPaymentType)),
    allowNull: false,
  })
  type: CustomerPaymentType;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  amount: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'USD',
  })
  currency: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  periodKey: string; // e.g., '2024-06' for monthly fees/usage

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerPaymentStatus)),
    allowNull: false,
    defaultValue: CustomerPaymentStatus.PAID,
  })
  status: CustomerPaymentStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  externalPaymentId: string; // LavaPayments/Stripe/etc

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  metadata: object;
}
