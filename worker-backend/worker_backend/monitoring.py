import highlight_io
from highlight_io.integrations.django import DjangoIntegration


def init_highlight(project_id, environment_name, service_name):
    return highlight_io.H(
        project_id=project_id,
        integrations=[DjangoIntegration()],
        instrument_logging=True,
        service_name=service_name,
        environment=environment_name,
    )