# CueMeet Control Backend API

This is the main API backend for CueMeet Control, built with NestJS and BullMQ for robust queue processing.

## Prerequisites

- Node.js (v16 or higher)
- Redis (for BullMQ)
- npm or yarn

## Installation

```bash
yarn install
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password
- `DB_DATABASE` - Database name
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port

### LavaPayments Configuration
- `LAVAPAYMENTS_SECRET_KEY` - Your LavaPayments API secret key
- `LAVAPAYMENTS_BASE_URL` - LavaPayments API base URL (default: https://api.lavapayments.com/v1)
- `LAVAPAYMENTS_WEBHOOK_SECRET` - Webhook secret for signature verification
- `LAVA_PRODUCT_SECRET` - Product secret for usage tracking and forward tokens

### ZITADEL OAuth Configuration
- `ZITADEL_ISSUER` - ZITADEL issuer URL
- `ZITADEL_CLIENT_ID` - ZITADEL client ID
- `ZITADEL_CLIENT_SECRET` - ZITADEL client secret
- `ZITADEL_REDIRECT_URI` - OAuth redirect URI

### Customer Portal Configuration
- `CUSTOMER_JWT_SECRET` - JWT secret for customer authentication
- `CUSTOMER_PORTAL_FRONTEND_URL` - Frontend URL for customer portal

### AWS Configuration
- `AWS_ACCESS_KEY` - AWS access key
- `AWS_SECRET_KEY` - AWS secret key
- `AWS_BUCKET_REGION` - AWS bucket region
- `AWS_ECS_CLUSTER_NAME` - ECS cluster name
- `AWS_MEETING_BOT_BUCKET_NAME` - S3 bucket for meeting bot files

## Running the Application

```bash
# Development mode
npm run yarn:dev

# Debug mode
npm run start:debug

# Production mode
npm run build
npm run yarn:prod
```

## Queue Processing

This application uses BullMQ for reliable queue processing. Make sure Redis is running before starting the application.

## Scripts

- `npm run build` - Build the application
- `npm run format` - Format code using Prettier
- `npm run yarn` - Start the application
- `npm run yarn:dev` - Start in development mode (watch)
- `npm run yarn:debug` - Start in debug mode
- `npm run yarn:prod` - Start in production mode

## API Documentation

API documentation is available at `/api/docs` when running the application.

## Contributing

Please read our contributing guidelines before submitting pull requests.