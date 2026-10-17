/** Minimal .env reader — same semantics as v1 env-file.mjs (KEY=VALUE, optional quotes, # comments). */

import { readFileSync } from 'node:fs';

export function readDotEnv(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    const key = match?.[1];
    if (!match || !key) continue;
    let value = line.slice(match[0].length).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) values[key] = value;
  }
  return values;
}
