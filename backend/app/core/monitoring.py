import time
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware to track API performance and log slow requests"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log performance metrics
        logger.info(
            f"API Request: {request.method} {request.url.path} "
            f"Status: {response.status_code} "
            f"Time: {process_time:.3f}s"
        )
        
        # Log slow requests
        if process_time > 2.0:  # Log requests taking more than 2 seconds
            logger.warning(
                f"SLOW REQUEST: {request.method} {request.url.path} "
                f"took {process_time:.3f}s"
            )
        
        # Add performance header
        response.headers["X-Process-Time"] = str(process_time)
        
        return response

class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track and log errors"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            
            # Log client errors (4xx) and server errors (5xx)
            if response.status_code >= 400:
                logger.error(
                    f"HTTP Error {response.status_code}: {request.method} {request.url.path}"
                )
            
            return response
            
        except Exception as e:
            logger.error(
                f"Unhandled exception in {request.method} {request.url.path}: {str(e)}",
                exc_info=True
            )
            raise

def setup_monitoring(app):
    """Add monitoring middleware to FastAPI app"""
    app.add_middleware(PerformanceMiddleware)
    app.add_middleware(ErrorTrackingMiddleware)