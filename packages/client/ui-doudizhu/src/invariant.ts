import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller, InvariantRegistry } from '@deepseek-ai/dsh-invariants'
declare module '@deepseek-ai/cordis' { interface Context { invariants: InvariantRegistry } }
export const name = 'client-ui-doudizhu-invariant'
export const inject = ['invariants']
/** No runtime invariant: slot ownership and shared-store scope are enforced by the Client slot registry. */
const install: InvariantInstaller = () => {}
/** Register package ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register('@deepseek-ai/dsh-client-ui-doudizhu', install))
