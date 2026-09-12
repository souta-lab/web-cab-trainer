import { readFileSync } from 'node:fs';
const refs = JSON.parse(readFileSync(new URL('../research/dataset/references.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('../research/sources.json', import.meta.url)));
const by = (k) => { const m = new Map(); for (const r of refs) { const v = r[k] ?? r.section; m.set(v, (m.get(v) ?? 0) + 1); } return Object.fromEntries(m); };
const ruleFreq = {}; const comp = { '1': 0, '2': 0, '3+': 0 };
for (const r of refs) {
  for (const rule of (r.rules ?? [])) { const t = rule.type; ruleFreq[t] = (ruleFreq[t] ?? 0) + 1; }
  const n = r.ruleCount ?? 0; if (n <= 1) comp['1']++; else if (n === 2) comp['2']++; else comp['3+']++;
}
console.log('total references:', refs.length);
console.log('sources:', sources.sources.length);
console.log('by section:', JSON.stringify(by('section')));
console.log('rule frequency:', JSON.stringify(ruleFreq));
console.log('ruleCount distribution:', JSON.stringify(comp));
