import type {
  ButtonHTMLAttributes,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/**
 * The shared vocabulary for every admin screen. Pages compose these rather
 * than repeating Tailwind strings, so a change to, say, input focus styling
 * happens in one place.
 */

const control =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-100'

const invalid = 'border-red-400 focus:border-red-500 focus:ring-red-500'

const BUTTON_VARIANTS = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
  secondary: 'border border-neutral-300 bg-white hover:bg-neutral-100',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
} as const

export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

// Kept for the few places that need the classes on a link rather than a button.
export const primaryButton = `rounded-md px-4 py-2 text-sm font-semibold transition-colors ${BUTTON_VARIANTS.primary}`
export const secondaryButton = `rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${BUTTON_VARIANTS.secondary}`

/**
 * Every admin form goes through here, and every one is `noValidate`: zod is
 * the single source of validation. Without this the browser runs its own
 * checks first on inputs like `type="email"`, silently blocking submit so our
 * schema never runs and the user sees a native bubble instead of the message
 * under the field.
 */
export function Form({
  onSubmit,
  className = '',
  children,
}: {
  onSubmit: (event: FormEvent) => void
  className?: string
  children: ReactNode
}) {
  return (
    <form noValidate onSubmit={onSubmit} className={className}>
      {children}
    </form>
  )
}

interface FieldProps {
  label: string
  hint?: string
  errors?: string[]
  className?: string
  children: (props: { invalid: boolean; describedBy?: string }) => ReactNode
}

/** Label, control, hint and any error — from the schema or from the API. */
export function Field({ label, hint, errors, className = '', children }: FieldProps) {
  const hasError = Boolean(errors?.length)
  const id = `${label.replace(/\W+/g, '-').toLowerCase()}-help`

  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-neutral-700">{label}</span>
      {children({ invalid: hasError, describedBy: hasError || hint ? id : undefined })}
      {hasError ? (
        <span id={id} className="mt-1 block text-xs text-red-700">
          {errors!.join(' · ')}
        </span>
      ) : (
        hint && (
          <span id={id} className="mt-1 block text-xs text-neutral-500">
            {hint}
          </span>
        )
      )}
    </label>
  )
}

export const TextInput = ({
  invalid: isInvalid,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => (
  <input {...props} className={`${control} ${isInvalid ? invalid : ''} ${className}`} />
)

export const TextArea = ({
  invalid: isInvalid,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) => (
  <textarea {...props} className={`${control} ${isInvalid ? invalid : ''} ${className}`} />
)

export const Select = ({
  invalid: isInvalid,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) => (
  <select {...props} className={`${control} ${isInvalid ? invalid : ''} ${className}`} />
)

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" {...props} className="h-4 w-4 accent-neutral-900" />
      {label}
    </label>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {actions}
    </header>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">{title}</h2>
      {children}
    </section>
  )
}

const BADGE_TONES = {
  neutral: 'bg-neutral-200 text-neutral-700',
  positive: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
} as const

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: keyof typeof BADGE_TONES
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500">
      {children}
    </div>
  )
}

export function Thumbnail({ src, alt = '' }: { src: string | null; alt?: string }) {
  if (!src) return <span className="h-12 w-9 shrink-0 rounded bg-neutral-200" />
  return <img src={src} alt={alt} className="h-12 w-9 shrink-0 rounded object-cover" />
}
