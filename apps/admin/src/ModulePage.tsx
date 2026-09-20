import type { AdminModule } from './modules'

// Placeholder screen for a module until it is built; shows its scope from the spec.
export function ModulePage({ module }: { module: AdminModule }) {
  return (
    <>
      <p className="text-xs font-semibold text-neutral-500">{module.id}</p>
      <h1 className="mt-1 text-2xl font-bold">{module.label}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{module.summary}</p>
      <p className="mt-8 inline-block rounded-md border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-500">
        Not built yet.
      </p>
    </>
  )
}
