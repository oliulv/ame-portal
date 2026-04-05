type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type LogChannel = 'server' | 'client'

type LogContext = Record<string, unknown>

const REDACTED_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret/i
const MAX_DEPTH = 4
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 40
const MAX_STRING_LENGTH = 500

export function serializeUnknown(
  value: unknown,
  depth = 0,
  key = '',
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: serializeUnknown(value.cause, depth + 1, 'cause', seen),
    }
  }

  if (REDACTED_KEY_PATTERN.test(key)) return '[REDACTED]'

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return `[Array(${value.length})]`
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((entry) => serializeUnknown(entry, depth + 1, '', seen))
  }

  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '[Object]'
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)

    const out: Record<string, unknown> = {}
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS)
    for (const [entryKey, entryValue] of entries) {
      out[entryKey] = serializeUnknown(entryValue, depth + 1, entryKey, seen)
    }
    return out
  }

  return String(value)
}

function emit(
  channel: LogChannel,
  level: LogLevel,
  event: string,
  context?: LogContext,
  error?: unknown
) {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    channel,
    level,
    event,
  }

  if (context && Object.keys(context).length > 0) {
    record.context = serializeUnknown(context)
  }
  if (error !== undefined) {
    record.error = serializeUnknown(error)
  }

  const payload = JSON.stringify(record)

  if (level === 'error') {
    console.error(payload)
    return
  }
  if (level === 'warn') {
    console.warn(payload)
    return
  }
  console.log(payload)
}

export function logServerInfo(event: string, context?: LogContext) {
  emit('server', 'info', event, context)
}

export function logServerWarn(event: string, context?: LogContext) {
  emit('server', 'warn', event, context)
}

export function logServerError(event: string, error?: unknown, context?: LogContext) {
  emit('server', 'error', event, context, error)
}

export function logClientError(event: string, error?: unknown, context?: LogContext) {
  emit('client', 'error', event, context, error)
}
