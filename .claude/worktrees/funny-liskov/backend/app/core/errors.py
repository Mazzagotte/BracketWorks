"""
Standardized error handling for the backend API
"""
from fastapi import HTTPException
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class AppError(Exception):
    """Base application error"""
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class ValidationError(AppError):
    """Validation error"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 400, details)

class NotFoundError(AppError):
    """Resource not found error"""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 404, details)

class AuthenticationError(AppError):
    """Authentication error"""
    def __init__(self, message: str = "Authentication required", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 401, details)

class AuthorizationError(AppError):
    """Authorization error"""
    def __init__(self, message: str = "Access denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, 403, details)

def handle_error(error: Exception) -> HTTPException:
    """Convert application errors to HTTP exceptions"""
    if isinstance(error, AppError):
        logger.error(f"{error.__class__.__name__}: {error.message}", extra={"details": error.details})
        return HTTPException(
            status_code=error.status_code,
            detail={
                "message": error.message,
                "type": error.__class__.__name__,
                "details": error.details
            }
        )
    
    # Log unexpected errors
    logger.error(f"Unexpected error: {str(error)}", exc_info=True)
    
    return HTTPException(
        status_code=500,
        detail={
            "message": "An unexpected error occurred",
            "type": "InternalServerError"
        }
    )

def safe_execute(func, *args, **kwargs):
    """Safely execute a function and handle errors"""
    try:
        return func(*args, **kwargs)
    except AppError:
        raise  # Re-raise app errors as-is
    except Exception as e:
        logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)
        raise AppError(f"Operation failed: {str(e)}")

def validate_required_fields(data: Dict[str, Any], required_fields: list) -> None:
    """Validate that required fields are present"""
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        raise ValidationError(f"Missing required fields: {', '.join(missing_fields)}")

def validate_positive_integer(value: Any, field_name: str) -> int:
    """Validate that a value is a positive integer"""
    try:
        int_value = int(value)
        if int_value <= 0:
            raise ValidationError(f"{field_name} must be a positive integer")
        return int_value
    except (ValueError, TypeError):
        raise ValidationError(f"{field_name} must be a valid integer")