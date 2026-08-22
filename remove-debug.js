const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'node_modules/.pnpm/app-builder-lib@26.15.3_dmg_01824dc9324d6793a361db92056c078b/node_modules/app-builder-lib/out/node-module-collector/pnpmNodeModulesCollector.js')
let content = fs.readFileSync(filePath, 'utf8')

// Remove debug logging from getter
content = content.replace(/console\.error\("DEBUG: allWorkspacePackages.*\n/g, '')

// Remove debug logging from parseDependenciesTree
content = content.replace(/console\.error\("DEBUG parseDependenciesTree:.*\n/g, '')

fs.writeFileSync(filePath, content, 'utf8')
console.log('Debug logging removed')
