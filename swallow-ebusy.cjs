// swallow-ebusy.cjs - preload hook for TDSH web-only mode
// dsh web's bundled chokidar tries to watch C:\Users\<user>\NTUSER.DAT
// (registry hive, system-locked) and crashes the whole node process with
// an uncaught EBUSY UVException. The watch failure is harmless - swallow it.
process.on('uncaughtException', (e) => {
  const msg = e && e.message ? String(e.message) : String(e)
  if (msg.includes('EBUSY') && msg.includes('watch')) {
    console.error('[hook] swallowed EBUSY watcher error (NTUSER.DAT etc.)')
    return
  }
  console.error('[hook] uncaughtException: ' + msg)
  console.error(e && e.stack ? e.stack : '')
})