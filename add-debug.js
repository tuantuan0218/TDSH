const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'node_modules/.pnpm/app-builder-lib@26.15.3_dmg_01824dc9324d6793a361db92056c078b/node_modules/app-builder-lib/out/node-module-collector/pnpmNodeModulesCollector.js')
let content = fs.readFileSync(filePath, 'utf8')

// Add debug to parseDependenciesTree
const original = `async parseDependenciesTree(jsonBlob) {
        const dependencyTree = this.extractJsonFromPollutedOutput(jsonBlob);
        this._allWorkspacePackages = dependencyTree;
        this._pnpmMajorVersion = await this.pnpmVersion.value;
        return dependencyTree[0];
    }`

const debugged = `async parseDependenciesTree(jsonBlob) {
        console.error("DEBUG parseDependenciesTree: input length =", jsonBlob.length, "first 200 =", jsonBlob.substring(0, 200));
        const dependencyTree = this.extractJsonFromPollutedOutput(jsonBlob);
        console.error("DEBUG parseDependenciesTree: dependencyTree type =", typeof dependencyTree, "isArray =", Array.isArray(dependencyTree), "value =", JSON.stringify(dependencyTree).substring(0, 300));
        this._allWorkspacePackages = dependencyTree;
        console.error("DEBUG parseDependenciesTree: after setting _allWorkspacePackages, type =", typeof this._allWorkspacePackages, "isArray =", Array.isArray(this._allWorkspacePackages));
        this._pnpmMajorVersion = await this.pnpmVersion.value;
        console.error("DEBUG parseDependenciesTree: after pnpmVersion, _pnpmMajorVersion =", this._pnpmMajorVersion);
        return dependencyTree[0];
    }`

if (content.includes(original)) {
  content = content.replace(original, debugged)
  fs.writeFileSync(filePath, content, 'utf8')
  console.log('Debug logging added successfully')
} else {
  console.log('Could not find target code to replace')
  console.log('Looking for:', original.substring(0, 100))
}