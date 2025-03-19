from django_socio_grpc.services.app_handler_registry import AppHandlerRegistry
from django.conf import settings
from importlib import import_module


def load_grpc_services(application, module_name):
    """Dynamically imports and registers gRPC services for a given Django app."""
    try:
        grpc_module = import_module(f"{module_name}.grpc.endpoints")
        services = getattr(grpc_module, "services", [])
        for service in services:
            application.register(service)
    except (ImportError, AttributeError) as error:
        print(f"Failed to import gRPC services from {module_name}: {error}")


def register_grpc_handlers(server, app_path):
    """Registers gRPC handlers for a specific app using the provided server instance."""
    app_label = app_path.split('.')[1]  # Extracting app name
    app_registry = AppHandlerRegistry(app_label, server)
    load_grpc_services(app_registry, app_path)


def initialize_grpc_apps(server):
    """Iterates over all configured gRPC apps and registers their handlers."""
    for grpc_app in settings.GRPC_APPS:
        register_grpc_handlers(server, grpc_app)

