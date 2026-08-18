/** Runtime invariants for the multiplayer DouDizhu package. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantRegistry } from '@deepseek-ai/dsh-invariants'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

declare module '@deepseek-ai/cordis' {
  interface Context { invariants: InvariantRegistry }
}

export const name = 'doudizhu-invariant'
export const inject = ['invariants']

/** No runtime invariant: the room engine validates state before it publishes any externally observable revision. */
const install: InvariantInstaller = () => {}

/** Register package ownership with the invariant registry. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-doudizhu', install))
