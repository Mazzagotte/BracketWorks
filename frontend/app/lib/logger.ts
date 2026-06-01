type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
}

const externalLogEndpoint = process.env.NEXT_PUBLIC_LOG_ENDPOINT?.trim();

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logs: LogEntry[] = [];
  private maxLogSize = 1000; // Keep last 1000 logs in memory

  private normalizeContext(context?: unknown): LogContext | undefined {
    if (context === undefined) {
      return undefined;
    }

    if (context && typeof context === 'object' && !Array.isArray(context)) {
      return context as LogContext;
    }

    if (context instanceof Error) {
      return {
        error: context.message,
        ...(context.stack ? { stack: context.stack } : {}),
      };
    }

    return { value: context };
  }

  private log(level: LogLevel, message: string, context?: unknown) {
    const normalizedContext = this.normalizeContext(context);
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: normalizedContext
    };

    // Add to internal log storage
    this.logs.push(entry);
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Console output in development
    if (this.isDevelopment) {
      const timestamp = entry.timestamp.toISOString();
      const contextStr = normalizedContext ? ` | Context: ${JSON.stringify(normalizedContext)}` : '';
      
      switch (level) {
        case 'debug':
          console.debug(`[${timestamp}] DEBUG: ${message}${contextStr}`);
          break;
        case 'info':
          console.info(`[${timestamp}] INFO: ${message}${contextStr}`);
          break;
        case 'warn':
          console.warn(`[${timestamp}] WARN: ${message}${contextStr}`);
          break;
        case 'error':
          console.error(`[${timestamp}] ERROR: ${message}${contextStr}`);
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
    if (!externalLogEndpoint) {
      return;
    }

    try {
      fetch(externalLogEndpoint, {
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

  debug(message: string, context?: unknown) {
    this.log('debug', message, context);
  }

  info(message: string, context?: unknown) {
    this.log('info', message, context);
  }

  warn(message: string, context?: unknown) {
    this.log('warn', message, context);
  }

  error(message: string, context?: unknown) {
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
