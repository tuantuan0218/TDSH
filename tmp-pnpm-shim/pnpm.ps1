#!/usr/bin/env pwsh
$node = "H:\nodejs\v24.16.0\node.exe"
$corepack = "H:\nodejs\v24.16.0\node_modules\corepack\dist\corepack.js"
& $node $corepack pnpm @args
exit $LASTEXITCODE
