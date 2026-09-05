import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

// Get tsx's internal load function
const tsxPkg = await import('tsx');
console.log('tsx module keys:', Object.keys(tsxPkg));

// Check if we can access the internal loader
const loader = tsxPkg.default || tsxPkg;
console.log('loader type:', typeof loader);

// Test direct Node.js load
const fileUrl = 'file:///G:/mimocode/deepseek-harness/packages/llm/llm/lib/index.js';
console.log('\nFile URL:', fileUrl);
console.log('File exists:', readFileSync('G:/mimocode/deepseek-harness/packages/llm/llm/lib/index.js', 'utf8').length);

// Try importing via Node's internal loader
const Module = await import('node:module');
const mod = await import(fileUrl);
console.log('Direct import result:', typeof mod);
