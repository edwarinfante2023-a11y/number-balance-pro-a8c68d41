const fs = require('fs');

const current = fs.readFileSync('src/lib/carteraEngine.ts', 'utf8');
const old = fs.readFileSync('/tmp/carteraEngine_may13.ts', 'utf8');

// Extract Phase 14 additions from current
const dualSystemStart = current.indexOf('// ─── SISTEMA DUAL AI (Fase 14)');
const dualSystemEnd = current.indexOf('// ─── 1. Frecuencia por hora'); // Actually buildCartera comes after evaluateDualSystem
const buildCarteraStartCurrent = current.indexOf('export function buildCartera');

const phase14Code = current.substring(dualSystemStart, buildCarteraStartCurrent);

// We need to inject phase14Code into old, right before buildCartera
const buildCarteraStartOld = old.indexOf('export function buildCartera');

let newContent = old.substring(0, buildCarteraStartOld) + '\n' + phase14Code + '\n' + old.substring(buildCarteraStartOld);

// Add Phase 14 fields to interfaces in newContent
newContent = newContent.replace(
  'tipo?: string | null;',
  'tipo?: string | null;\n  condiciones?: Record<string, unknown> | null;'
);

newContent = newContent.replace(
  'strategy?: typeof ADAPTIVE_STRATEGY;',
  'strategy?: typeof ADAPTIVE_STRATEGY;\n  godModeQuadrant?: string | null;\n  weekType?: WeekClassification;'
);

newContent = newContent.replace(
  'estrategia: string;',
  'estrategia: string;\n    dualSystem?: { applied: boolean; motor: string; godModeQuadrant: string | null; weekType: string | null; };'
);

// In buildCartera, let's inject dualSystem options into contexto so the UI doesn't break
const returnContextoMatch = 'estrategia: options.strategy ?? ADAPTIVE_STRATEGY,';
newContent = newContent.replace(
  returnContextoMatch,
  returnContextoMatch + '\n      dualSystem: {\n        applied: false,\n        motor: "NONE",\n        godModeQuadrant: options.godModeQuadrant ?? null,\n        weekType: options.weekType ?? null,\n      },'
);

fs.writeFileSync('src/lib/carteraEngine.ts', newContent);
console.log('Patched carteraEngine.ts successfully!');
