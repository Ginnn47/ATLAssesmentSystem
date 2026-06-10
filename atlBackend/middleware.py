from django.utils.cache import patch_vary_headers


DEV_CORS_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}


class DevCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not request.path.startswith("/api/"):
            return response

        origin = request.META.get("HTTP_ORIGIN")
        if origin in DEV_CORS_ORIGINS:
            response["Access-Control-Allow-Origin"] = origin
            patch_vary_headers(response, ("Origin",))
        response["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
        response["Access-Control-Allow-Credentials"] = "true"
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response
