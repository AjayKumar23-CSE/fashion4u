import { NavLink, Outlet } from 'react-router'
import { useAuth } from './lib/auth'
import { MODULE_GROUPS } from './modules'

export function AdminLayout() {
  const staff = useAuth((state) => state.staff)
  const signOut = useAuth((state) => state.signOut)

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 text-neutral-900">
      <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-neutral-200 bg-white">
        <div className="sticky top-0 bg-white px-5 py-4 text-lg font-extrabold tracking-tight">
          Store admin
        </div>
        <nav className="px-3 pb-6" aria-label="Modules">
          {MODULE_GROUPS.map((group) => (
            <section key={group.title} className="mt-4">
              <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {group.title}
              </h2>
              {group.modules.map((module) => (
                <NavLink
                  key={module.path}
                  to={`/${module.path}`}
                  end={module.path === ''}
                  className={({ isActive }) =>
                    `block rounded-md px-2 py-1.5 text-sm ${
                      isActive ? 'bg-neutral-900 font-semibold text-white' : 'hover:bg-neutral-100'
                    }`
                  }
                >
                  {module.label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <div className="sticky bottom-0 mt-auto border-t border-neutral-200 bg-white px-5 py-4 text-sm">
          <p className="truncate font-semibold">{staff?.name}</p>
          <p className="truncate text-xs text-neutral-500">{staff?.email}</p>
          <button type="button" onClick={signOut} className="mt-2 text-xs font-semibold underline">
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-8 pb-8">
        <div className="pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
