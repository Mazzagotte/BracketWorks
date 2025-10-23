type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogSize = 1000; // Keep last 1000 logs in memory

  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context
    };

    // Add to internal log storage
    this.logs.push(entry);
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Console output in development
    if (this.isDevelopment) {
      const timestamp = entry.timestamp.toISOString();
      const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
      
      switch (level) {
        case 'debug':
          logger.debug(`[${timestamp}] DEBUG: ${message}${contextStr}`);
          break;
        case 'info':
          console.info(`[${timestamp}] INFO: ${message}${contextStr}`);
          break;
        case 'warn':
          logger.warn(`[${timestamp}] WARN: ${message}${contextStr}`);
          break;
        case 'error':
          logger.error(`[${timestamp}] ERROR: ${message}${contextStr}`);
          break;
      }
    }

    // In production, only log errors and warnings
    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      // Could send to external logging service here
      this.sendToExternalLogger(entry);
    }
  }

  private sendToExternalLogger(entry: LogEntry) {
    // Placeholder for external logging service
    // Could integrate with services like LogRocket, Sentry, etc.
    try {
      // Example: Send to backend logging endpoint
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      }).catch(() => {
        // Silently fail if logging service is unavailable
      });
    } catch {
      // Silently fail to avoid breaking the app
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }

  // Utility methods for common use cases
  apiCall(method: string, url: string, status?: number, duration?: number) {
    this.info(`API ${method} ${url}`, { status, duration });
  }

  userAction(action: string, context?: LogContext) {
    this.info(`User action: ${action}`, context);
  }

  performanceMetric(name: string, value: number, unit = 'ms') {
    this.info(`Performance: ${name} = ${value}${unit}`, { metric: name, value, unit });
  }

  // Get recent logs for debugging
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs (useful for testing)
  clearLogs() {
    this.logs = [];
  }
}

// Create singleton instance
export const logger = new Logger();

// Export type for external use
export type { LogLevel, LogEntry };

// Convenience function for conditional logging
export function logIf(condition: boolean, level: LogLevel, message: string, context?: LogContext) {
  if (condition) {
    logger[level](message, context);
  }
}

// Development-only logging
export function devLog(message: string, context?: LogContext) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(message, context);
  }
}

// Error wrapper for async operations
export async function loggedOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();
  logger.info(`Starting: ${operationName}`, context);
  
  try {
    const result = await operation();
    const duration = Date.now() - startTime;
    logger.info(`Completed: ${operationName}`, { ...context || {}, duration });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed: ${operationName}`, { 
      ...context || {}, 
      duration, 
      error: error instanceof Error ? error.message : String(error) 
    });
    throw error;
  }
}