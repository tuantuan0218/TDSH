/**
 * dsh-global-agent host entry: re-enables agent-instructions.
 * File read/write is handled by the TDSH HTTP carrier (main.js).
 */
export const name = 'global-agent'

export function apply(ctx) {
  ctx.on('dispose', () => {})
}