import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import { ApiError } from './api'

/** Issues keyed by dotted path — the same shape the API returns in `fields`. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    ;(errors[key] ??= []).push(issue.message)
  }
  return errors
}

/**
 * One place where a zod schema, the form's values and both sources of error
 * meet: what the schema rejects before submitting, and what the API rejects
 * afterwards. Both land in the same `errors` map, so a field renders its
 * message without caring where it came from.
 */
// The input is constrained to an object so the field setter can spread it.
export function useZodForm<Schema extends z.ZodType<unknown, Record<string, unknown>>>(
  schema: Schema,
  initialValues: z.input<Schema>,
) {
  type Values = z.input<Schema>

  const [values, setValues] = useState<Values>(initialValues)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [submitting, setSubmitting] = useState(false)

  const setField = useCallback(<Key extends keyof Values>(key: Key, value: Values[Key]) => {
    setValues((current) => ({ ...current, [key]: value }))
    // Clear the message as soon as the field is touched again.
    setErrors((current) => {
      if (!(key in current)) return current
      const rest = { ...current }
      delete rest[key as string]
      return rest
    })
  }, [])

  const handleSubmit = (onValid: (data: z.output<Schema>) => Promise<unknown>) =>
    async function submit(event: FormEvent) {
      event.preventDefault()
      const result = schema.safeParse(values)
      if (!result.success) {
        setErrors(fieldErrors(result.error))
        return
      }

      setErrors({})
      setSubmitting(true)
      try {
        await onValid(result.data)
      } catch (error) {
        setErrors(
          error instanceof ApiError && Object.keys(error.fields).length > 0
            ? error.fields
            : { _form: [(error as Error).message] },
        )
      } finally {
        setSubmitting(false)
      }
    }

  return {
    values,
    setValues,
    setField,
    errors,
    /** Errors with no field of their own, shown as a banner. */
    formError: errors._form?.join(' · ') ?? null,
    submitting,
    handleSubmit,
    setErrors,
  }
}
