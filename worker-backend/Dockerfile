FROM public.ecr.aws/docker/library/python:3.10-slim-bullseye AS builder

WORKDIR /app

# Prevent Python from writing pyc files to disc and buffering stdout and stderr
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH /app/web
# Add timeout configuration for pip
ENV PIP_DEFAULT_TIMEOUT=300

# Install system dependencies required for your Django app and build tools
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    python3-dev \
    musl-dev \
    libssl-dev \
    jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install --no-cache-dir "poetry>=1.2.0" && poetry self add "poetry-plugin-export"

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Use Poetry to install dependencies with increased timeout
# Breaking up the pip wheel command to use more reliable pip options
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes && \
    pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt --timeout 300 --retries 10


# Start the final build stage
FROM public.ecr.aws/docker/library/python:3.10-slim-bullseye

# Create a non-root user
RUN addgroup --system app && adduser --system --group app

# Set environment variables
ENV APP_HOME=/app/web \
    PYTHONPATH=/app/web \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR $APP_HOME

EXPOSE 8000
EXPOSE 5500

# Install runtime dependencies
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
    libpq-dev \
    make \
    jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the Python dependencies from the builder stage
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache-dir /wheels/* && \
    rm -rf /wheels && \
    rm requirements.txt

# Create and set permissions for the .aws directory
RUN chown -R app:app /app /home/app

# Copy the Django project into the container
COPY . .

# Change ownership of the application files
RUN chown -R app:app $APP_HOME

# Switch to the non-root user
USER app

# Collect static files
RUN python manage.py collectstatic --noinput


CMD ["gunicorn", "worker_backend.wsgi:application", "--workers", "4", "-b", "0.0.0.0:8000"]