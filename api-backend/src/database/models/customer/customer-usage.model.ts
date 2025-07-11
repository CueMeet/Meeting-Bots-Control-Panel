import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from 'sequelize-typescript';
import { Customer } from './customer.model';

export enum CustomerUsageType {
  RECORDING_HOURS = 'RECORDING_HOURS',
  STORAGE_GB = 'STORAGE_GB',
  API_CALLS = 'API_CALLS',
  TRANSCRIPTION_MINUTES = 'TRANSCRIPTION_MINUTES',
  BANDWIDTH_GB = 'BANDWIDTH_GB',
}

export enum CustomerUsagePeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CURRENT = 'CURRENT', // Current billing period
}

export enum CustomerBillingStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Table({
  tableName: 'customer_usage',
  timestamps: true,
})
export class CustomerUsage extends Model<CustomerUsage> {
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

  // Time Period
  @Column({
    type: DataType.ENUM(...Object.values(CustomerUsagePeriod)),
    allowNull: false,
    defaultValue: CustomerUsagePeriod.MONTHLY,
  })
  period: CustomerUsagePeriod;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  periodKey: string; // e.g., "2024-01", "2024-W01", "2024-01-15"

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  periodStartDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  periodEndDate: Date;

  // Recording Usage
  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  recordingHours: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  recordingCount: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  activeRecordings: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  recordingCost: number;

  // Storage Usage
  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0,
  })
  storageUsedGB: number;

  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0,
  })
  storageQuotaGB: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  storageCost: number;

  // API Usage
  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  apiCalls: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  apiCallsQuota: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  apiCallsCost: number;

  // Transcription Usage
  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  transcriptionMinutes: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  transcriptionCost: number;

  // Bandwidth Usage
  @Column({
    type: DataType.DECIMAL(15, 2),
    defaultValue: 0,
  })
  bandwidthUsedGB: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  bandwidthCost: number;

  // Total Costs
  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  totalCost: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  discountAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  taxAmount: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  finalAmount: number;

  // Billing Integration (LavaPayments)
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lavaPaymentId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lavaInvoiceId: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lavaTransactionId: string;

  @Column({
    type: DataType.ENUM(...Object.values(CustomerBillingStatus)),
    allowNull: false,
    defaultValue: CustomerBillingStatus.PENDING,
  })
  billingStatus: CustomerBillingStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  billingDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  paidDate: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  dueDate: Date;

  // Detailed Breakdown
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  usageBreakdown: object; // Detailed usage by service/feature

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  costBreakdown: object; // Detailed cost breakdown

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  billingMetadata: object; // Additional billing information

  // Quotas and Limits
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  quotas: object; // Usage quotas and limits

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  overageCharges: object; // Overage charges if any

  // Subscription Information
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  subscriptionTier: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  subscriptionId: string;

  // LavaPayments Integration Fields
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  connectionId: string; // LavaPayments connection ID

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  totalMinutes: number; // Total recording minutes used

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  overageMinutes: number; // Minutes over the included limit

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  overageCost: number; // Cost for overage minutes

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  periodStart: Date; // Start of billing period

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  periodEnd: Date; // End of billing period

  @Column({
    type: DataType.DECIMAL(10, 2),
    defaultValue: 0,
  })
  subscriptionBaseCost: number;

  // Analytics and Insights
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  analytics: object; // Usage analytics and insights

  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  trends: object; // Usage trends and patterns

  // Alerts and Notifications
  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  quotaWarningTriggered: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  quotaExceededTriggered: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  billingAlertTriggered: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  lastAlertSentAt: Date;

  // Audit and Compliance
  @Column({
    type: DataType.JSONB,
    defaultValue: {},
  })
  auditLog: object; // Audit trail for usage changes

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  lastUpdatedBy: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  notes: string;
}
