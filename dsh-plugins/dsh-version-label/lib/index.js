/**
 * dsh-version-label host entry: minimal bundle root so the package mounts as a
 * valid Cordis bundle. All rendering happens client-side; the version value is
 * read from URL param ?dshDesktopVersion (injected by main.js, no IPC bridge).
 */
export const name = 'version-label'

export function apply(ctx) {
  // No host-side services needed; this exists so the bundle row mounts and the
  // paired client entry (package.json dsh.client → ./lib/client.js) is loaded
  // by the web app's module loader.
  ctx.on('dispose', () => {})
}