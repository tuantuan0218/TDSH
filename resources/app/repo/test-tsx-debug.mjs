import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Monkey-patch tsx's load to inspect what it receives
const tsx = require('tsx');
const origLoad = tsx.register;

console.log('Testing tsx file URL loading...');

// Test 1: Package import
try {
  const m1 = await import('@deepseek-ai/dsh-llm');
  console.log('Package import: OK, keys:', Object.keys(m1).slice(0,5));
} catch (e) {
  console.log('Package import FAIL:', e.message.split('\n')[0]);
}

// Test 2: File URL import
const fileUrl = 'file:///G:/mimocode/deepseek-harness/packages/llm/llm/lib/index.js';
try {
  const m2 = await import(fileUrl);
  console.log('File URL import: OK, keys:', Object.keys(m2).slice(0,5));
} catch (e) {
  console.log('File URL import FAIL:', e.message.split('\n')[0]);
}

// Test 3: Check if the file content is readable
const fs = await import('node:fs');
const content = fs.readFileSync('G:/mimocode/deepseek-harness/packages/llm/llm/lib/index.js', 'utf8');
console.log('File content length:', content.length);
console.log('First 50 chars:', JSON.stringify(content.substring(0, 50)));

// Test 4: Read via path
const pathModule = await import('node:path');
const resolvedPath = pathModule.resolve('G:/mimocode/deepseek-harness/packages/llm/llm/lib/index.js');
console.log('Resolved path:', resolvedPath);
