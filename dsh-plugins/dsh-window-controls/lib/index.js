/**
 * dsh-window-controls host entry: minimal bundle root so the package mounts as a
 * valid Cordis bundle. All rendering happens client-side.
 */
export const name = 'window-controls'

export function apply(ctx) {
  ctx.on('dispose', () => {})
}