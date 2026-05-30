import type { Instrumentation } from 'next'

/**
 * Next.js instrumentation. `register` runs once on server startup; `onRequestError`
 * is a global hook that fires for any error Next.js surfaces from a route handler,
 * server component, or middleware that wasn't caught locally.
 *
 * This is the safety net for the 5xx class of failures: deliberate 4xx responses
 * (e.g. validation rejections) are logged at their call sites via `logValidationFailure`,
 * but anything that throws and bubbles up to the framework is captured here so it can
 * never again disappear silently from production logs.
 */

export async function register(): Promise<void> {
  // Reserved for future startup wiring (e.g. OpenTelemetry registration).
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  // Dynamically import so this file stays lightweight and edge-safe.
  const { logger } = await import('@/lib/logger')
  logger.error('unhandled_request_error', {
    err,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  })
}
