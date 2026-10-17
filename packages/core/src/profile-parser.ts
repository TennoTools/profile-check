/** Thin typed wrapper around the WFCD parser (locale `en`, item pipeline off by default). */

import ProfileParser from '@wfcd/profile-parser/Parser';
import type { Locale } from 'warframe-worldstate-data';

export { ProfileParser };

export type ProfileData = ConstructorParameters<typeof ProfileParser>[0];

export function parseProfile(
  data: ConstructorParameters<typeof ProfileParser>[0],
  locale: Locale = 'en',
  withItems = false,
): ProfileParser {
  return new ProfileParser(data, locale, withItems);
}
