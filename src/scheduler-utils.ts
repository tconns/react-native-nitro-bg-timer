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
