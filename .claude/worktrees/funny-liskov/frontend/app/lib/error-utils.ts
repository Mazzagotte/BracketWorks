// Utility functions for safe error handling
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

export function getErrorContext(error: unknown): Record<string, string> {
  return {
    error: getErrorMessage(error),
    type: isError(error) ? error.constructor.name : typeof error
  };
}
