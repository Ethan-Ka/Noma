import { useEffect, useMemo, useState } from 'react'
import type { Macro } from '@shared/types'
import { useMacrosStore } from '../stores/macrosStore'
import { useUiStore } from '../stores/uiStore'
import { useApplicationsStore } from '../stores/applicationsStore'
import { useStoreSync } from '../lib/useStoreSync'
import { MacroEditor } from '../components/MacroEditor'
import { plural } from '../lib/plural'

export function MacroStudio() {
  const { macros, isLoading, refresh } = useMacrosStore()
  const { byId: applicationsById, refresh: refreshApplications } = useApplicationsStore()
  const applications = useMemo(() => Object.values(applicationsById), [applicationsById])
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const pendingMacroId = useUiStore((state) => state.pendingMacroId)
  const clearPendingMacro = useUiStore((state) => state.clearPendingMacro)

  // Jump to a macro requested from elsewhere (Workflows) once macros load.
  useEffect(() => {
    if (!pendingMacroId || isLoading) return
    if (macros.some((macro) => macro.id === pendingMacroId)) {
      setIsCreatingNew(false)
      setSelectedMacroId(pendingMacroId)
    }
    clearPendingMacro()
  }, [pendingMacroId, isLoading, macros, clearPendingMacro])

  useStoreSync({ refresh }, { refresh: refreshApplications })

  const selectedMacro = macros.find((macro) => macro.id === selectedMacroId) ?? null
  const applicationNameById = new Map(applications.map((application) => [application.id, application.name]))

  const handleSelect = (macro: Macro): void => {
    setIsCreatingNew(false)
    setSelectedMacroId(macro.id)
  }

  const handleNew = (): void => {
    setIsCreatingNew(true)
    setSelectedMacroId(null)
  }

  const handleSaved = (macro: Macro): void => {
    setIsCreatingNew(false)
    setSelectedMacroId(macro.id)
    refresh()
  }

  const handleDeleted = (): void => {
    setSelectedMacroId(null)
    refresh()
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 p-6">
        <div className="mb-1 font-display text-xl font-semibold text-neutral-100">Macro Studio</div>
        <p className="mb-5 text-xs text-neutral-500">
          Build a sequence of actions once, then assign it to any control.
        </p>
        <button
          type="button"
          onClick={handleNew}
          className="mb-4 rounded-md border border-accent-muted bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition-transform duration-150 hover:bg-accent/20 active:scale-[0.97]"
        >
          + New Macro
        </button>

        {isLoading ? (
          <p className="text-xs text-neutral-600">Loading…</p>
        ) : macros.length === 0 ? (
          <p className="text-xs text-neutral-600">No macros yet.</p>
        ) : (
          <ul className="flex-1 space-y-1 overflow-y-auto">
            {macros.map((macro) => (
              <li key={macro.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(macro)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                    !isCreatingNew && selectedMacroId === macro.id
                      ? 'bg-white/5 text-neutral-100'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{macro.name}</span>
                    {!macro.enabled && (
                      <span className="text-[10px] uppercase tracking-widest text-neutral-700">Off</span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    {macro.actions.length} {plural(macro.actions.length, 'step')}
                    {/* Which application this macro was scoped to: set
                        automatically when Flow creates a macro from an
                        accepted sequence suggestion (suggestionResolution.ts),
                        or left unset for a macro built from scratch here. */}
                    {macro.applicationId && applicationNameById.get(macro.applicationId) && (
                      <> · {applicationNameById.get(macro.applicationId)}</>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {isCreatingNew ? (
        <MacroEditor
          macro={null}
          applications={applications}
          allMacros={macros}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDiscardNew={() => setIsCreatingNew(false)}
        />
      ) : selectedMacro ? (
        <MacroEditor
          key={selectedMacro.id}
          macro={selectedMacro}
          applications={applications}
          allMacros={macros}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDiscardNew={() => {}}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-600">
          Select a macro, or create a new one.
        </div>
      )}
    </div>
  )
}
