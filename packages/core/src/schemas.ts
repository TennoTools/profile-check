/**
 * Single source of truth for every payload exchanged between core, the server
 * and the web client — this is the fix for the v1 GUI/CLI format drift.
 */

import { z } from 'zod';
import { looksLikeAccountId } from './account-id';
import { PLATFORMS } from './platforms';

export const platformSchema = z.enum(PLATFORMS);

export const accountIdSchema = z
  .string()
  .refine(looksLikeAccountId, 'Not a plausible 24-hex AccountId (ObjectId timestamp out of range)');

export const checkResultSchema = z.object({
  label: z.string(),
  critical: z.boolean(),
  ok: z.boolean(),
  detail: z.string(),
});
export type CheckResultDto = z.infer<typeof checkResultSchema>;

export const runSummarySchema = z.object({
  nickname: z.string().nullable(),
  accountId: z.string().nullable(),
  masteryRank: z.number().nullable(),
  created: z.string().nullable(),
  timePlayedSec: z.number().nullable(),
  missions: z.object({ completed: z.number(), failed: z.number() }),
  clan: z
    .object({
      name: z.string(),
      tier: z.union([z.string(), z.number()]).nullable(),
      class: z.union([z.string(), z.number()]).nullable(),
    })
    .nullable(),
  operatorUnlocked: z.boolean(),
  loadout: z.object({
    warframe: z.string().nullable(),
    primary: z.string().nullable(),
    secondary: z.string().nullable(),
    melee: z.string().nullable(),
  }),
  xpCacheExpiryDate: z.string().nullable(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;

export const runStateSchema = z.enum(['queued', 'running', 'done', 'failed']);
export const verdictSchema = z.enum(['ok', 'warnings', 'broken']);
export const fetchViaSchema = z.enum(['direct', 'scraperapi', 'scraperapi-fallback']);
export const runErrorTypeSchema = z.enum(['fetch', 'parse', 'critical']);

export type RunState = z.infer<typeof runStateSchema>;
export type VerdictType = z.infer<typeof verdictSchema>;

export const runRequestSchema = z.object({
  platform: platformSchema,
  accountId: accountIdSchema.transform((value) => value.toLowerCase()),
  useProxy: z.boolean().optional().default(false),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const runSourceSchema = z.object({
  url: z.string(),
  via: fetchViaSchema,
  httpStatus: z.number().nullable(),
  sizeBytes: z.number().nullable(),
  durationMs: z.number().nullable(),
  xpCacheExpiryDate: z.string().nullable(),
});
export type RunSource = z.infer<typeof runSourceSchema>;

export const runErrorSchema = z.object({
  type: runErrorTypeSchema,
  message: z.string(),
  bodySnippet: z.string().nullable(),
});
export type RunError = z.infer<typeof runErrorSchema>;

export const runResultSchema = z.object({
  version: z.literal(2),
  id: z.string(),
  state: runStateSchema,
  verdict: verdictSchema.nullable(),
  request: z.object({ platform: platformSchema, accountId: z.string(), useProxy: z.boolean() }),
  source: runSourceSchema.nullable(),
  summary: runSummarySchema.nullable(),
  checks: z.array(checkResultSchema),
  error: runErrorSchema.nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type RunResult = z.infer<typeof runResultSchema>;

export const runListItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  platform: platformSchema,
  accountId: z.string(),
  nickname: z.string().nullable(),
  masteryRank: z.number().nullable(),
  verdict: verdictSchema.nullable(),
  state: runStateSchema,
  elapsedMs: z.number().nullable(),
});
export type RunListItem = z.infer<typeof runListItemSchema>;

export const runListSchema = z.object({
  total: z.number(),
  items: z.array(runListItemSchema),
});
export type RunList = z.infer<typeof runListSchema>;

export const settingsViewSchema = z.object({
  defaultPlatform: platformSchema,
  defaultAccountId: z.string().nullable(),
  defaultUseProxy: z.boolean(),
  timeoutMs: z.number(),
  hasScraperApiKey: z.boolean(),
  scraperApiKeyMask: z.string().nullable(),
});
export type SettingsView = z.infer<typeof settingsViewSchema>;

export const settingsUpdateSchema = z.strictObject({
  defaultPlatform: platformSchema.optional(),
  defaultAccountId: accountIdSchema.nullable().optional(),
  defaultUseProxy: z.boolean().optional(),
  timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
  scraperApiKey: z.string().min(1).nullable().optional(),
});
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

// --- SSE payloads ---

export const checkProgressSchema = z.object({
  step: z.enum(['fetch', 'parse', 'validate', 'persist']),
  detail: z.string().optional(),
  passed: z.number().optional(),
  failed: z.number().optional(),
});
export type CheckProgress = z.infer<typeof checkProgressSchema>;

export const checkEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('progress'), data: checkProgressSchema }),
  z.object({ event: z.literal('done'), data: runResultSchema }),
  z.object({ event: z.literal('error'), data: runErrorSchema }),
]);
export type CheckEvent = z.infer<typeof checkEventSchema>;

export const getIdStateSchema = z.enum(['launching', 'waiting-login', 'found', 'closed', 'cancelled', 'error']);
export const getIdEventSchema = z.object({
  state: getIdStateSchema,
  accountId: z.string().optional(),
  source: z.enum(['gid', 'cookie', 'storage']).optional(),
  message: z.string().optional(),
});
export type GetIdEvent = z.infer<typeof getIdEventSchema>;
