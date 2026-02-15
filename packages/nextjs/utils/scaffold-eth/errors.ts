/**
 * Custom error classes for API endpoints with HTTP status codes
 */

/**
 * Base class for API errors with HTTP status codes
 */
export abstract class ApiError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 Bad Request - Client error (invalid input, malformed request, etc.)
 */
export class BadRequestError extends ApiError {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

/**
 * 401 Unauthorized - Authentication required or failed
 */
export class UnauthorizedError extends ApiError {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends ApiError {
  readonly statusCode = 404;

  constructor(message: string) {
    super(message);
  }
}

/**
 * 500 Internal Server Error - Server-side errors
 */
export class InternalServerError extends ApiError {
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Type guard to check if an error has a statusCode property
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError ||
    (error instanceof Error && "statusCode" in error && typeof (error as any).statusCode === "number")
  );
}

/**
 * Get status code from error, defaulting to 500 if not an ApiError
 */
export function getErrorStatusCode(error: unknown): number {
  if (isApiError(error)) {
    return error.statusCode;
  }
  return 500;
}
