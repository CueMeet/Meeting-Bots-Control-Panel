from django.core.management.base import BaseCommand, CommandError
from api.transcript_management.worker import _transcript_generator_worker
from api.transcript_management.models import FileLog
import time

class Command(BaseCommand):
    help = 'Enqueues tasks to reprocess transcripts by all, by specific user ID, or by specific file keys.'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='Enqueue tasks for all transcripts')
        parser.add_argument('--user-id', help='Enqueue tasks for transcripts created by a specific user')
        parser.add_argument('--file-keys', nargs='+', help='Enqueue tasks using specific file keys directly')

    def handle(self, *args, **options):
        tasks = []
        description = "specified criteria"

        if options['file_keys']:
            tasks = options['file_keys']
            description = "direct file keys"
        elif options['user_id']:
            tasks = FileLog.objects.filter(created_by_user_id=options['user_id']).values_list('raw_file_key', flat=True)
            description = f"user ID {options['user_id']}"
        elif options['all']:
            tasks = FileLog.objects.values_list('raw_file_key', flat=True)
            description = "all records"
        else:
            raise CommandError('Specify --all, --user-id <id>, or --file-keys <key1 key2 ...> to enqueue tasks.')

        count = len(tasks)
        if count == 0:
            self.stdout.write(self.style.WARNING('No transcripts found to process.'))
            return

        self.stdout.write(self.style.SUCCESS(f'Found {count} transcripts to reprocess for {description}.'))

        answer = input("Do you want to proceed? (yes/no): ")
        if answer.lower() != 'yes':
            self.stdout.write(self.style.NOTICE('Task enqueuing cancelled.'))
            return

        for raw_file_key in tasks:
            _transcript_generator_worker.delay(raw_file_key)
            self.stdout.write(f"Task enqueued for {raw_file_key}")
            time.sleep(30)
