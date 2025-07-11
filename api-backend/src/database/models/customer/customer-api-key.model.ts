import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Customer } from './customer.model';
import { CustomerBot } from './customer-bot.model';

export enum CustomerApiKeyStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Table({
  tableName: 'customer_api_keys',
  timestamps: true,
})
export class CustomerApiKey extends Model<CustomerApiKey> {
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

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  apiKeyId: string;

  @BelongsTo(() => Customer)
  customer: Customer;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  key: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerApiKeyStatus)),
    allowNull: false,
    defaultValue: CustomerApiKeyStatus.ACTIVE,
  })
  status: CustomerApiKeyStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastUsedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  revokedAt: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  revokedReason: string;

  // Relationships
  @HasMany(() => CustomerBot)
  bots: CustomerBot[];
}
