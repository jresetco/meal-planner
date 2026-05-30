import type { ZodError } from 'zod'

/**
 * Minimal structured logger — emits one JSON line per event to stdout/stderr so
 * Railway (which only captures the container's streams) has a searchable, machine
 * -parseable trace of what the app is doing. No external dependencies.
 *
 * Why this exists: a class of failures (e.g. Zod validation rejections that return
 * a bare 400) used to produce no log output at all, making them invisible in
 * production. Route those failures through this logger so they always leave a trace.
 *
 * Usage:
 *   import { logger, logValidationFailure } from '@/lib/logger'
 *   logger.info('plan_generation_started', { householdId, recipes: 42 })
 *   logger.error('db_write_failed', { err, householdId })
 *   logValidationFailure('/api/recipes', parsed.error, { householdId })
 *
 * Pass an Error under the `err` key and it is serialized to { name, message, stack }.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

type LogFields = Record<string, unknown>

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

// LOG_LEVEL gates output. Defaults to 'info' in production, 'debug' elsewhere.
function resolveMinLevel(): Level {
  const fromEnv = process.env.LOG_LEVEL as Level | undefined
  if (fromEnv && fromEnv in LEVEL_ORDER) return fromEnv
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return { value: String(err) }
}

function emit(level: Level, event: string, fields: LogFields = {}): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[resolveMinLevel()]) return

  // `err` is treated specially so callers can pass a raw Error/unknown.
  const { err, ...rest } = fields
  const record: LogFields = {
    level,
    event,
    ...(err !== undefined ? { err: serializeError(err) } : {}),
    ...rest,
    ts: new Date().toISOString(),
  }

  let line: string
  try {
    line = JSON.stringify(record)
  } catch {
    // Guard against circular references in caller-supplied fields.
    line = JSON.stringify({ level, event, ts: record.ts, note: 'unserializable fields' })
  }

  // warn/error go to stderr so platforms can separate error streams; rest to stdout.
  if (level === 'error' || level === 'warn') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
}

/**
 * Standardizes logging for the most common API failure: a Zod `safeParse`
 * rejection. Logs the field-level issues (path/code/message) — metadata only,
 * never the raw input values, to avoid leaking user-submitted content into logs.
 */
export function logValidationFailure(
  route: string,
  error: ZodError,
  fields?: LogFields
): void {
  logger.warn('validation_failed', {
    route,
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    })),
    ...fields,
  })
}
