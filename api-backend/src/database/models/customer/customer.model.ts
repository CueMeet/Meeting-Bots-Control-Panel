import { Column, DataType, Model, Table, HasMany } from 'sequelize-typescript';
import { CustomerApiKey } from './customer-api-key.model';
import { CustomerBot } from './customer-bot.model';
import { CustomerUsage } from './customer-usage.model';

export enum CustomerAuthProvider {
  ZITADEL = 'ZITADEL',
  GOOGLE = 'GOOGLE',
  MICROSOFT = 'MICROSOFT',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Table({
  tableName: 'customers',
  timestamps: true,
})
export class Customer extends Model<Customer> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  userId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  firstName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lastName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  avatarUrl: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerStatus)),
    allowNull: false,
    defaultValue: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: true,
  })
  isActive: boolean;

  // ZITADEL Integration Fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  zitadelUserId: string;

  // OAuth Provider Fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  googleId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
  })
  microsoftId: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerAuthProvider)),
    allowNull: false,
    defaultValue: CustomerAuthProvider.ZITADEL,
  })
  primaryAuthProvider: CustomerAuthProvider;

  @Column({
    type: DataType.ARRAY(DataType.ENUM(...Object.values(CustomerAuthProvider))),
    allowNull: false,
    defaultValue: [CustomerAuthProvider.ZITADEL],
  })
  connectedProviders: CustomerAuthProvider[];

  // Account Verification
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isEmailVerified: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  emailVerifiedAt: Date;

  // Subscription & Billing
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  subscriptionTier: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  billingCustomerId: string; // Legacy field - keeping for backward compatibility

  // LavaPayments Integration Fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lavaConnectionId: string; // LavaPayments connection ID

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  // LavaPayments connection secret (store securely, required for forward tokens)
  lavaConnectionSecret: string; // LavaPayments connection secret

  @Column({
    type: DataType.STRING,
    allowNull: true,
    defaultValue: 'inactive',
  })
  billingStatus: string; // 'active', 'inactive', 'cancelled', 'suspended'

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  billingAddress: object;

  // Preferences & Settings
  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'UTC',
  })
  timezone: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'en',
  })
  language: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    defaultValue: '30',
  })
  autoDeleteAfterDays: string;

  // Activity Tracking
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastLoginAt: Date;

  // Relationships
  @HasMany(() => CustomerApiKey)
  apiKeys: CustomerApiKey[];

  @HasMany(() => CustomerBot)
  bots: CustomerBot[];

  @HasMany(() => CustomerUsage)
  usageRecords: CustomerUsage[];
}
