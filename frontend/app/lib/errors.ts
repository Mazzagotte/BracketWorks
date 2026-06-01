// Standardized error handling utilities
export interface AppError {
  message: string
  code?: string
  statusCode?: number
  details?: unknown
}

export class ApiError extends Error implements AppError {
  public code?: string
  public statusCode?: number
  public details?: unknown

  constructor(message: string, statusCode?: number, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export class ValidationError extends Error implements AppError {
  public code: string = 'VALIDATION_ERROR'
  public statusCode: number = 400
  public details?: unknown

  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ValidationError'
    this.details = details
  }
}

type ErrorWithStatus = Error & { status: number }

function hasNumericStatus(error: Error): error is ErrorWithStatus {
  return 'status' in error && typeof (error as Partial<ErrorWithStatus>).status === 'number'
}

export function handleApiError(error: unknown): AppError {
  if (error instanceof ApiError || error instanceof ValidationError) {
    return error
  }

  if (error instanceof Error) {
    // Check if it's a fetch error with status
    if (hasNumericStatus(error)) {
      return new ApiError(error.message, error.status)
    }
    
    return new ApiError(error.message)
  }

  if (typeof error === 'string') {
    return new ApiError(error)
  }

  return new ApiError('An unexpected error occurred')
}

export function getErrorMessage(error: unknown): string {
  const appError = handleApiError(error)
  return appError.message
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.toLowerCase().includes('fetch') ||
           error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('connection')
  }
  return false
}

export function isAuthError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 401 || error.statusCode === 403
  }
  return false
}

export function shouldRetry(error: unknown): boolean {
  if (error instanceof ApiError) {
    // Retry on server errors, but not client errors
    return (error.statusCode || 0) >= 500
  }
  
  // Retry on network errors
  return isNetworkError(error)
}
