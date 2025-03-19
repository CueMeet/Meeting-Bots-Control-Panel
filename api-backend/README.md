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

Create a `.env` file in the root directory

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