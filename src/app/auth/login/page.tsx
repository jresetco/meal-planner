'use client'

import { useEffect, useState, Suspense, type FormEvent } from 'react'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [from, setFrom] = useState('/')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const param = url.searchParams.get('from')
      setFrom(param || '/')
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email) {
      setError('Please enter your email.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, from }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        setError(data.error || 'Unable to send magic link.')
        return
      }

      setSent(true)
    } catch (err) {
      console.error('Error logging in:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Meal Planner
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sign in with a magic link. If your email is on the allowlist, a
          one-time link will arrive in your inbox.
        </p>

        {sent ? (
          <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              Magic link sent. Check your email — the link expires in 30 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  )
}
