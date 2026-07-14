from django.conf import settings
from django.utils.cache import patch_vary_headers


DEV_CORS_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


def is_allowed_origin(origin):
    if not origin:
        return False
    configured = set(getattr(settings, "CORS_ALLOWED_ORIGINS", [])) | DEV_CORS_ORIGINS
    return origin in configured or origin.endswith(".ngrok-free.dev")


class DevCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not request.path.startswith("/api/"):
            return response

        origin = request.META.get("HTTP_ORIGIN")
        if is_allowed_origin(origin):
            response["Access-Control-Allow-Origin"] = origin
            patch_vary_headers(response, ("Origin",))
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response
