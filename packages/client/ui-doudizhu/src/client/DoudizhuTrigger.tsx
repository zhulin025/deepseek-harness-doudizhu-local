import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { createGameSurfaceStore } from './store.ts'
import css from './Doudizhu.module.css'

type Props = PropsRuntime<'sidebar.footer.action'>
  & PropsStore<ReturnType<typeof createGameSurfaceStore>>
  & SidebarFooterActionOwnerProps

/** Render the Harness sidebar entry that toggles the embedded game. */
export function DoudizhuTrigger({ wide, useStore, actions }: Props) {
  const open = useStore(state => state.open)
  return <button className={css.trigger} data-active={open || undefined} onClick={actions.toggle} title="斗地主">
    <span className={css.triggerIcon}>♠</span>{wide && <span>斗地主</span>}
  </button>
}
