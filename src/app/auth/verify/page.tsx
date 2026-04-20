'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  )
}

function VerifyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>(
    'verifying',
  )
  const [message, setMessage] = useState('Verifying magic link…')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing magic link token.')
      return
    }

    const verify = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()
        if (!response.ok || !data.success) {
          setStatus('error')
          setMessage(data.error || 'Magic link is invalid or expired.')
          return
        }

        setStatus('success')
        setMessage('Signed in. Redirecting…')
        const redirectTo =
          typeof data.redirectTo === 'string' && data.redirectTo
            ? data.redirectTo
            : '/'
        router.replace(redirectTo)
        router.refresh()
      } catch (error) {
        console.error('Error verifying magic link:', error)
        setStatus('error')
        setMessage('Something went wrong. Please request a new link.')
      }
    }

    void verify()
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          {status === 'verifying'
            ? 'Verifying…'
            : status === 'success'
              ? 'Signed in'
              : 'Sign-in failed'}
        </h1>
        <p
          className={`text-sm ${
            status === 'error'
              ? 'text-red-700 dark:text-red-400'
              : 'text-gray-700 dark:text-gray-300'
          }`}
        >
          {message}
        </p>
        {status === 'error' && (
          <a
            href="/auth/login"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Request a new link
          </a>
        )}
      </div>
    </div>
  )
}
