type ConvexLogLevel = 'info' | 'warn' | 'error'

type ConvexLogContext = Record<string, unknown>

const REDACTED_KEY_PATTERN =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret/i
const MAX_DEPTH = 4
const MAX_ARRAY_ITEMS = 20
const MAX_OBJECT_KEYS = 40
const MAX_STRING_LENGTH = 500
const SLOW_FUNCTION_THRESHOLD_MS = 750

function serializeUnknown(
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

function emit(level: ConvexLogLevel, event: string, context?: ConvexLogContext, error?: unknown) {
  const record: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    source: 'convex',
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

function summarizeResult(result: unknown): Record<string, unknown> {
  if (result === null) return { type: 'null' }
  if (result === undefined) return { type: 'undefined' }
  if (typeof result === 'string') return { type: 'string', length: result.length }
  if (typeof result === 'number' || typeof result === 'boolean') return { type: typeof result }
  if (Array.isArray(result)) return { type: 'array', length: result.length }
  if (typeof result === 'object') {
    return {
      type: 'object',
      keys: Object.keys(result as Record<string, unknown>).slice(0, 20),
    }
  }
  return { type: typeof result }
}

export function logConvexInfo(event: string, context?: ConvexLogContext) {
  emit('info', event, context)
}

export function logConvexWarn(event: string, context?: ConvexLogContext) {
  emit('warn', event, context)
}

export function logConvexError(event: string, error?: unknown, context?: ConvexLogContext) {
  emit('error', event, context, error)
}

/**
 * Emit a single wide event for a Convex function execution (success or error).
 * Follows the wide-event pattern: one rich log line per function call,
 * emitted in `finally` so errors are never missed.
 */
export function logConvexFunctionComplete(event: Record<string, unknown>) {
  const context: ConvexLogContext = { ...event }

  // Summarize result to avoid logging full payloads
  if (context.result !== undefined) {
    context.result = summarizeResult(context.result)
  }

  if (event.outcome === 'error') {
    emit('error', 'convex.function.error', context)
    return
  }

  const durationMs = (event.durationMs as number) ?? 0
  if (durationMs >= SLOW_FUNCTION_THRESHOLD_MS) {
    emit('warn', 'convex.function.slow_success', context)
    return
  }

  emit('info', 'convex.function.success', context)
}
