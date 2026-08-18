import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

interface GameSurfaceState { open: boolean }
type GameSurfaceActions = {
  open: (draft: GameSurfaceState) => void
  close: (draft: GameSurfaceState) => void
  toggle: (draft: GameSurfaceState) => void
}

/** Create the root-scoped navigation state shared by the trigger and table. */
export function createGameSurfaceStore(): EngineStoreHandle<GameSurfaceState, GameSurfaceActions> {
  return defineStore({
    init: (): GameSurfaceState => ({ open: false }),
    actions: {
      open: (draft) => { draft.open = true },
      close: (draft) => { draft.open = false },
      toggle: (draft) => { draft.open = !draft.open },
    },
  })
}
