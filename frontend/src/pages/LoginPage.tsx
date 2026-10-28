import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { homePathFor, safeRedirectPath, useAuth } from '../auth/useAuth'
import { FormField } from '../components/FormField'
import { ErrorMessage } from '../components/StatusMessage'
import { useAsyncAction } from '../hooks/useAsyncAction'

/**
 * Sign-in form. Validates required fields, signs in via the auth context (the API sets the
 * HttpOnly session cookie) and returns the user to a safe same-app path or their role home.
 */
export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({})
  const signIn = useAsyncAction(login)

  if (user) return <Navigate to={homePathFor(user.role)} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors = {
      username: username.trim() ? undefined : 'Username is required.',
      password: password ? undefined : 'Password is required.',
    }
    setErrors(nextErrors)
    if (nextErrors.username || nextErrors.password) return

    const session = await signIn.run(username.trim(), password)
    if (!session) {
      setPassword('')
      return
    }
    const from = safeRedirectPath((location.state as { from?: unknown } | null)?.from)
    navigate(from ?? homePathFor(session.role), { replace: true })
  }

  return (
    <main className="login">
      <form
        className="card login__card"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="login-title"
      >
        <h1 id="login-title">Warehouse Inventory</h1>
        <p>Sign in to continue.</p>
        {signIn.error && <ErrorMessage message={signIn.error} />}
        <FormField label="Username" error={errors.username} required>
          {(props) => (
            <input
              {...props}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Password" error={errors.password} required>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>
        <button type="submit" className="button" disabled={signIn.pending}>
          {signIn.pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
