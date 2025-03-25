# Worker Backend Service

Django REST + gRPC backend service with async workers.

## Development

### Prerequisites
- Python 3.8+
- PostgreSQL
- Redis

### Services
- REST API: Django REST framework
- gRPC: Django Socio gRPC
- Worker: Celery based task processing

## Quick Start

Django REST + gRPC backend service with Celery workers.

## Setup & Development

```bash
make install         # Install poetry and dependencies
make migrate         # Run migrations
make dev            # Run Django development server (port 8000)
```

## Services

### REST & gRPC

```bash
make grpc-dev       # Run gRPC server in dev mode (port 2000)
make grpc-prod      # Run gRPC server in prod mode (port 5000)
make run           # Run with gunicorn (port 8000)
```

### Workers

```bash
make worker         # Run Celery worker (threaded, 4 concurrent)
make worker-logs    # Run worker with logging to celery-worker.log
make worker-beats   # Run Celery beat scheduler
make flower         # Run Flower monitoring (port 5555)
```

### Development Tools

```bash
make poetry-shell   # Start poetry shell
make shell         # Start Django shell
make proto-gen     # Generate protobuf files
```

### Documentation

```bash
npm start          # Start documentation dev server
npm run build      # Build static documentation
npm run serve      # Serve built documentation
npm run gen-api-docs    # Generate API documentation
```

See `Makefile` for all available commands.