import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { DoudizhuSurface } from './DoudizhuSurface.tsx'
import { DoudizhuTrigger } from './DoudizhuTrigger.tsx'
import { createGameSurfaceStore } from './store.ts'

export const inject = ['slots']

/** Register the sidebar entry and center-column game surface. */
export function apply(ctx: ClientContext): void {
  const store = createGameSurfaceStore()
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'doudizhu', order: -10, store,
  }, DoudizhuTrigger))
  ctx.slots.inject('shell.center.overlay', () => ctx.slots.register({
    name: 'shell.center.overlay', id: 'doudizhu', order: 0, store,
  }, DoudizhuSurface))
}
