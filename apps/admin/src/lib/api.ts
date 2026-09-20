import { useAuth } from './auth'
import { API_URL } from './config'

// Mirrors the API's error shape: { code, message, fields }.
export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string[]>

  constructor(status: number, code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (res.status === 204) return undefined as T
  const data = await res.json()
  if (!res.ok) {
    // An expired or revoked token sends the user back to login.
    if (res.status === 401 && token) useAuth.getState().signOut()
    throw new ApiError(res.status, data.code, data.message, data.fields)
  }
  return data as T
}
