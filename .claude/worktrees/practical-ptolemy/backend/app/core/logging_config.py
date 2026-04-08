import logging
import sys
from pathlib import Path
from ..core.config import settings

def setup_logging():
    """Configure application logging"""
    
    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_dir / "bracketworks.log"),
        ]
    )
    
    # Configure specific loggers
    logger = logging.getLogger("bracketworks")
    logger.setLevel(logging.INFO)
    
    # Suppress verbose third-party loggers in production
    if settings.is_production:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("urllib3").setLevel(logging.WARNING)
    
    return logger