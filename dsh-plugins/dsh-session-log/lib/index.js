/**
 * dsh-session-log host entry: minimal bundle root.
 */
export const name = 'session-log'

export function apply(ctx) {
  ctx.on('dispose', () => {})
}