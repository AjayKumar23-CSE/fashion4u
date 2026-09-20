import { QueryClient } from '@tanstack/react-query'

// Its own module so that non-React code — the 401 handler, the auth store —
// can reach the cache without importing the app entry point.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})
