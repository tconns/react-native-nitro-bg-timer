/* eslint-disable no-bitwise -- FNV-style mixing requires bitwise ops */

const FNV32_OFFSET = 0x811c9dc5 >>> 0
const FNV32_PRIME = 0x01000193 >>> 0

export function cronToIntervalMs(expression: string): number {
  const trimmed = expression.trim()
  if (/^\*\/\d+ \* \* \* \*$/.test(trimmed)) {
    const value = Number(trimmed.slice(2, trimmed.indexOf(' ')))
    if (!Number.isNaN(value) && value > 0) {
      return value * 60_000
    }
  }
  throw new Error(
    `Unsupported cron expression "${expression}". V2 currently supports "*/N * * * *" minute expressions.`
  )
}

/**
 * Lightweight FNV‑1a 32‑bit bitmask for grouping tags inside JS until native policy routing lands.
 */
export function tagMaskFromStrings(tags: readonly string[]): number {
  let hash = FNV32_OFFSET
  const mix = () => {
    hash = Math.imul(hash, FNV32_PRIME)
    hash >>>= 0
  }
  for (const tag of tags) {
    const t = typeof tag === 'string' ? tag : String(tag)
    for (let i = 0; i < t.length; i += 1) {
      hash ^= t.charCodeAt(i)
      mix()
    }
    hash ^= 0xb3b3 >>> 0
    mix()
  }
  return hash >>> 0
}
