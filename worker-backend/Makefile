migrate:
	poetry run python manage.py migrate

install:
	@if command -v poetry >/dev/null 2>&1; then \
		echo "Poetry already installed"; \
	else \
		python3 -m pip install --user poetry; \
	fi
	poetry config virtualenvs.in-project true
	poetry install

create-migrations:
	poetry run python manage.py makemigrations

dev:
	export DJANGO_SETTINGS_MODULE='worker_backend.settings';
	poetry run python manage.py runserver 8000 

run:
	export DJANGO_SETTINGS_MODULE='worker_backend.settings';
	poetry run gunicorn worker_backend.wsgi:application --workers 2 -b 0.0.0.0:8000

poetry-shell:
	@echo 'Starting poetry shell. Press Ctrl-d to exit from the shell'
	poetry shell

worker-logs: 
	python -m celery -A worker_backend worker -l info --concurrency=4 --logfile=celery_worker.log

worker: 
	python -m celery -A worker_backend worker -l info --pool threads --concurrency=4

worker-beats: 
	python -m celery -A worker_backend beat -l info

flower: 
	celery -A worker_backend flower --port=5555

shell: 
	python manage.py shell

proto-gen: 
	poetry run python manage.py generateproto

grpc-dev:
	python manage.py grpcrunaioserver 127.0.0.1:2000 --dev

grpc-prod:
	python manage.py grpcrunaioserver 127.0.0.1:5000 --max-workers 4