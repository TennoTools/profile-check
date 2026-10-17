/** Supported Warframe platforms and their DE API hosts. */

export const PLATFORMS = ['pc', 'ps4', 'xb1', 'swi', 'mob', 'and'] as const;

export type Platform = (typeof PLATFORMS)[number];

export const DEFAULT_PLATFORM: Platform = 'pc';

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** DE API host for a platform: pc → api.warframe.com, consoles → api-<platform>.warframe.com */
export function apiHost(platform: Platform): string {
  return `api${platform === 'pc' ? '' : `-${platform}`}.warframe.com`;
}

/** Full profile-viewing endpoint URL for an AccountId. */
export function profileUrl(platform: Platform, accountId: string): string {
  return `https://${apiHost(platform)}/cdn/getProfileViewingData.php?playerId=${encodeURIComponent(accountId)}`;
}
