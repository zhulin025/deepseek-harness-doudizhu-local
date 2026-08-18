import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createGameSurfaceStore } from './store.ts'
import css from './Doudizhu.module.css'

type Props = PropsRuntime<'shell.center.overlay'> & PropsStore<ReturnType<typeof createGameSurfaceStore>>

/** Render the same-origin game inside the Harness center column. */
export function DoudizhuSurface({ useStore, actions }: Props) {
  const open = useStore(state => state.open)
  if (!open) return null
  return <section className={css.surface} aria-label="Agent 斗地主">
    <div className={css.toolbar}><button onClick={actions.close} aria-label="返回对话">←</button><strong>斗地主 · Agent 房间</strong></div>
    <iframe className={css.table} src="/doudizhu?embedded=1" title="Agent 斗地主牌桌" />
  </section>
}
