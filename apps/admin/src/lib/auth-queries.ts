import { useMutation } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth'
import type { Staff } from './types'

/** Signing in is a server call, so it is a mutation; the session it returns is store state. */
export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api<{ token: string; staff: Staff }>('/admin/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    onSuccess: ({ token, staff }) => useAuth.getState().signIn(token, staff),
  })
}
