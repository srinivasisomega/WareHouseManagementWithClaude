import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, errorMessage, onUnauthorized } from './client'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError)
    return err as ApiError
  }
  throw new Error('Expected the request to fail.')
}

describe('apiRequest', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    onUnauthorized(null)
  })

  it('builds the query string and skips empty, null and undefined values', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await apiRequest('/inventory', {
      query: { search: 'bolt', locationId: 3, lowStockOnly: true, empty: '', missing: undefined, nothing: null },
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/inventory?search=bolt&locationId=3&lowStockOnly=true')
  })

  it('omits the query string entirely when every value is empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await apiRequest('/items', { query: { search: '', includeInactive: undefined } })

    expect(fetchMock.mock.calls[0][0]).toBe('/api/items')
  })

  it('authenticates with the same-origin session cookie and JSON-encodes the body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }))

    const result = await apiRequest<{ id: number }>('/items', { method: 'POST', body: { sku: 'A-1' } })

    expect(result).toEqual({ id: 1 })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ sku: 'A-1' }))
  })

  it('never sends a script-readable Authorization header or stores auth data in web storage', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]))

    await apiRequest('/items')

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('GET')
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.body).toBeUndefined()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
  })

  it('uses the ProblemDetails detail as the error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ title: 'Conflict', detail: 'SKU A-1 already exists.' }, 409))

    const error = await captureError(apiRequest('/items', { method: 'POST', body: {} }))

    expect(error.status).toBe(409)
    expect(error.message).toBe('SKU A-1 already exists.')
  })

  it('maps validation error keys to camelCase field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          title: 'One or more validation errors occurred.',
          errors: { Sku: ['SKU is required.'], 'Lines[0].Quantity': ['Quantity must be positive.'] },
        },
        400,
      ),
    )

    const error = await captureError(apiRequest('/orders', { method: 'POST', body: {} }))

    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({
      sku: ['SKU is required.'],
      'lines[0].quantity': ['Quantity must be positive.'],
    })
    expect(error.message).toBe('Please correct the highlighted fields.')
  })

  it('falls back to a status-based message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('oops', { status: 500 }))

    const error = await captureError(apiRequest('/items'))

    expect(error.status).toBe(500)
    expect(error.message).toBe('Something went wrong. Please try again.')
  })

  it('calls the unauthorized handler on a 401 from a normal call (session ended)', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    const error = await captureError(apiRequest('/items'))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Your session has expired. Please sign in again.')
  })

  it('does not call the unauthorized handler on a 401 from an auth endpoint (failed login)', async () => {
    const handler = vi.fn()
    onUnauthorized(handler)
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Invalid username or password.' }, 401))

    const error = await captureError(apiRequest('/auth/login', { method: 'POST', body: {} }))

    expect(handler).not.toHaveBeenCalled()
    expect(error.message).toBe('Invalid username or password.')
  })

  it('turns a network failure into an ApiError with status 0 and a friendly message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await captureError(apiRequest('/items'))

    expect(error.status).toBe(0)
    expect(error.message).toBe('Unable to reach the server. Check your connection and try again.')
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(apiRequest('/items/1', { method: 'PUT', body: {} })).resolves.toBeUndefined()
  })
})

describe('errorMessage', () => {
  it('returns the ApiError message or a generic fallback that hides internal details', () => {
    expect(errorMessage(new ApiError(404, 'Not here.'))).toBe('Not here.')
    expect(errorMessage(new Error('internal stack detail'))).toBe('Something went wrong. Please try again.')
  })
})
