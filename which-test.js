// Check which.sync('pnpm') resolution inside electron-builder env
const path = require('path')
const which = require(path.resolve('node_modules/.pnpm', 'which@2.0.2/node_modules/which/which.js'))

try {
  console.log('which.sync(pnpm):', which.sync('pnpm'))
} catch (e) {
  console.log('Error:', e.message)
}