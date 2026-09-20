import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './pagination'

interface PrefsState {
  pageSize: number
  setPageSize: (pageSize: number) => void
}

/** Staff preferences that outlive a page, remembered per browser. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      pageSize: DEFAULT_PAGE_SIZE,
      setPageSize: (pageSize) => set({ pageSize }),
    }),
    {
      name: 'fashion4u.adminPrefs',
      storage: createJSONStorage(() => localStorage),
      // A size dropped from PAGE_SIZES would leave the select with no match.
      merge: (persisted, current) => {
        const saved = (persisted as Partial<PrefsState> | undefined)?.pageSize
        return { ...current, pageSize: PAGE_SIZES.includes(saved as number) ? (saved as number) : DEFAULT_PAGE_SIZE }
      },
    },
  ),
)
