#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINTS = [
  { name: 'Pollinations-Text', url: 'https://text.pollinations.ai/openai', model: 'openai', timeout: 30000 },
  { name: 'Pollinations-Fast', url: 'https://text.pollinations.ai/openai', model: 'openai-fast', timeout: 30000 },
  { name: 'OVHcloud', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', timeout: 25000 },
  { name: 'LLM7', url: 'https://api.llm7.io/v1', timeout: 25000 },
  { name: 'Kilo-AI', url: 'https://api.kilo.ai/api/gateway', timeout: 25000 },
  { name: 'NVIDIA-NIM', url: 'https://integrate.api.nvidia.com/v1', timeout: 20000 },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1', timeout: 15000 },
  { name: 'Cerebras', url: 'https://api.cerebras.ai/v1', timeout: 15000 },
  { name: 'ModelScope', url: 'https://api-inference.modelscope.cn/v1', timeout: 20000 }
];

async function checkEndpoint(ep) {
  const start = Date.now();
  const result = { name: ep.name, url: ep.url, status: 'unknown', latency: null, error: null };
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), ep.timeout);
    const resp = await fetch(ep.url + '/models', { signal: ctrl.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(tid);
    result.latency = Date.now() - start;
    if (resp.ok) { result.status = 'healthy'; const d = await resp.json(); result.models = d.data ? d.data.length : 0; }
    else if (resp.status === 401 || resp.status === 403) { result.status = 'needs_key'; result.error = 'HTTP ' + resp.status; }
    else if (resp.status === 429) { result.status = 'rate_limited'; result.error = 'HTTP 429'; }
    else { result.status = 'error'; result.error = 'HTTP ' + resp.status; }
  } catch (e) {
    result.latency = Date.now() - start;
    if (e.name === 'AbortError') { result.status = 'timeout'; result.error = 'Timeout'; }
    else { result.status = 'unreachable'; result.error = e.message; }
  }
  return result;
}

async function main() {
  console.log('=== Free API Health Monitor ===\n');
  const results = [];
  for (const ep of ENDPOINTS) {
    console.log('Checking ' + ep.name + '...');
    const r = await checkEndpoint(ep);
    results.push(r);
    console.log('  Status: ' + r.status + (r.latency ? ' (' + r.latency + 'ms)' : ''));
    if (r.error) console.log('  Error: ' + r.error);
  }
  const healthy = results.filter(r => r.status === 'healthy').length;
  const needsKey = results.filter(r => r.status === 'needs_key').length;
  const rateLimited = results.filter(r => r.status === 'rate_limited').length;
  const timeout = results.filter(r => r.status === 'timeout').length;
  const unreachable = results.filter(r => r.status === 'unreachable').length;
  const error = results.filter(r => r.status === 'error').length;
  console.log('\n=== Summary ===');
  console.log('Total: ' + results.length);
  console.log('Healthy: ' + healthy);
  console.log('Needs Key: ' + needsKey);
  console.log('Rate Limited: ' + rateLimited);
  console.log('Timeout: ' + timeout);
  console.log('Unreachable: ' + unreachable);
  console.log('Error: ' + error);
  const report = { timestamp: new Date().toISOString(), results, summary: { total: results.length, healthy, needsKey, rateLimited, timeout, unreachable, error } };
  if (!existsSync('D:/tdsh/sub2api/health-reports')) mkdirSync('D:/tdsh/sub2api/health-reports', { recursive: true });
  writeFileSync('D:/tdsh/sub2api/health-reports/latest.json', JSON.stringify(report, null, 2));
  console.log('\nReport saved to health-reports/latest.json');
}
main().catch(console.error);