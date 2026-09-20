import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { queryClient } from './query-client'
import type { Staff } from './types'

interface AuthState {
  token: string | null
  staff: Staff | null
  signIn: (token: string, staff: Staff) => void
  signOut: () => void
}

/**
 * The signed-in staff member. A store rather than a context because the fetch
 * wrapper needs the token on every request and has to sign the user out on a
 * 401 — neither of which can call a hook.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      staff: null,
      signIn: (token, staff) => set({ token, staff }),
      signOut: () => {
        // Another staff member must not inherit the last one's cached rows.
        queryClient.clear()
        set({ token: null, staff: null })
      },
    }),
    {
      name: 'fashion4u.staff',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, staff }) => ({ token, staff }),
    },
  ),
)
