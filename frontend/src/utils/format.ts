import type { Option } from '../components/OptionSelect'

export const itemOption = (i: { id: number; sku: string; name: string }): Option => ({
  value: i.id,
  label: `${i.sku} — ${i.name}`,
})

export const locationOption = (l: { id: number; code: string; name: string }): Option => ({
  value: l.id,
  label: `${l.code} — ${l.name}`,
})

export function formatDateTime(isoUtc: string | null | undefined) {
  if (!isoUtc) return '—'
  // Backend sends UTC timestamps without a zone suffix; treat them as UTC.
  const value = /[zZ]|[+-]\d\d:\d\d$/.test(isoUtc) ? isoUtc : `${isoUtc}Z`
  return new Date(value).toLocaleString()
}

/** Parses a whole-number form value; returns null for blank or non-integer input. */
export function parseWholeNumber(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null
  return Number(raw.trim())
}

/** Required + allowed-characters check for SKU and location codes (the backend remains authoritative). */
export function codeFormatError(raw: string, label: string): string | undefined {
  const value = raw.trim()
  if (!value) return `${label} is required.`
  return /^[A-Za-z0-9._-]+$/.test(value) ? undefined : `${label} may contain only letters, digits, '.', '_' and '-'.`
}
