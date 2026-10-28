import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './useAuth'

describe('safeRedirectPath', () => {
  it.each(['/orders/5', '/admin/items', '/receive?itemId=3'])('allows same-app path %s', (path) => {
    expect(safeRedirectPath(path)).toBe(path)
  })

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/phish',
    'javascript:alert(1)',
    'orders/5',
    '/login',
    '/ spaced',
    '',
    undefined,
    42,
  ])('rejects %s', (candidate) => {
    expect(safeRedirectPath(candidate)).toBeNull()
  })
})
