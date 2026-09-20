import { Navigate } from 'react-router'
import { Button, ErrorBanner, Field, Form, TextInput } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useLogin } from '../lib/auth-queries'
import { loginSchema } from '../lib/schemas'
import { useZodForm } from '../lib/useZodForm'

export function LoginPage() {
  const staff = useAuth((state) => state.staff)
  const login = useLogin()
  const form = useZodForm(loginSchema, { email: '', password: '' })

  // The store is updated by the mutation, and the guard below redirects once it is.
  const submit = form.handleSubmit((credentials) => login.mutateAsync(credentials))

  if (staff) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <Form
        onSubmit={submit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6"
      >
        <h1 className="text-xl font-extrabold tracking-tight">Store admin</h1>
        <ErrorBanner message={form.formError} />

        <Field label="Email" errors={form.errors.email}>
          {({ invalid, describedBy }) => (
            <TextInput
              type="email"
              autoComplete="username"
              invalid={invalid}
              aria-describedby={describedBy}
              value={form.values.email}
              onChange={(e) => form.setField('email', e.target.value)}
            />
          )}
        </Field>

        <Field label="Password" errors={form.errors.password}>
          {({ invalid, describedBy }) => (
            <TextInput
              type="password"
              autoComplete="current-password"
              invalid={invalid}
              aria-describedby={describedBy}
              value={form.values.password}
              onChange={(e) => form.setField('password', e.target.value)}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" disabled={form.submitting} className="w-full">
          {form.submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </Form>
    </div>
  )
}
