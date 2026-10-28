
/** Field name (camelCase, matching request properties) → messages from the server. */
export type FieldErrors = Record<string, string[]>

/** Error raised for any non-2xx API response, carrying the server's problem details. */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

interface ProblemDetails {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

type QueryValue = string | number | boolean | null | undefined

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT'
  body?: unknown
  query?: Record<string, QueryValue>
}

let unauthorizedHandler: (() => void) | null = null

/** Registers a callback for 401s on authenticated calls (e.g. expired session → log out). */
export function onUnauthorized(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

const API_BASE = '/api'

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

function toCamelCase(key: string) {
  return key
    .split('.')
    .map((part) => part.charAt(0).toLowerCase() + part.slice(1))
    .join('.')
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails = {}
  try {
    problem = (await response.json()) as ProblemDetails
  } catch {
    // Body was empty or not JSON; fall back to a status-based message.
  }

  const fieldErrors: FieldErrors = {}
  for (const [key, messages] of Object.entries(problem.errors ?? {})) {
    fieldErrors[toCamelCase(key)] = messages
  }

  const message =
    problem.detail ??
    (Object.keys(fieldErrors).length > 0 ? 'Please correct the highlighted fields.' : undefined) ??
    defaultMessage(response.status)

  return new ApiError(response.status, message, fieldErrors)
}

function defaultMessage(status: number) {
  switch (status) {
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'The requested record was not found.'
    case 429:
      return 'Too many attempts. Please wait a minute and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/**
 * Calls the backend API and returns the parsed JSON body.
 * @param path API path below /api, e.g. '/items'.
 * @param options HTTP method, JSON body and query-string values.
 * @returns The response body (undefined for 204).
 * @throws ApiError for network failures and non-2xx responses.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      // Auth rides on the HttpOnly, SameSite=Strict session cookie,
      // never on a script-readable token.
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.')
  }

  if (!response.ok) {
    // A 401 from a normal call means the session ended; the auth endpoints report their own 401s.
    if (response.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler?.()
    throw await toApiError(response)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Normalizes anything thrown by an API call into a user-facing message. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}
