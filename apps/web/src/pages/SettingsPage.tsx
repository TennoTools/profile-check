import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { looksLikeAccountId, type Platform, type SettingsUpdate } from '@tennotools/profile-check-core/web';
import { useEffect, useState } from 'react';
import { ApiDown } from '../components/ApiDown';
import { Card } from '../components/Card';
import { buttonGhost, buttonPrimary, inputClass, labelClass } from '../components/controls';
import { GetIdModal } from '../components/GetIdModal';
import { PlatformSelect } from '../components/PlatformSelect';
import { fetchSettings, updateSettings } from '../lib/api';

interface FormState {
  platform: Platform;
  accountId: string;
  useProxy: boolean;
  timeoutMs: number;
  key: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings || form) return;
    setForm({
      platform: settings.defaultPlatform,
      accountId: settings.defaultAccountId ?? '',
      useProxy: settings.defaultUseProxy,
      timeoutMs: settings.timeoutMs,
      key: '',
    });
  }, [settingsQuery.data, form]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['settings'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const update: SettingsUpdate = {
        defaultPlatform: form.platform,
        defaultUseProxy: form.useProxy,
        timeoutMs: form.timeoutMs,
        defaultAccountId: form.accountId.trim() ? form.accountId.trim().toLowerCase() : null,
      };
      if (form.key.trim()) update.scraperApiKey = form.key.trim();
      return updateSettings(update);
    },
    onSuccess: () => {
      invalidate();
      setForm((current) => (current ? { ...current, key: '' } : current));
      setNotice('Settings saved.');
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : String(error)),
  });

  const clearKey = useMutation({
    mutationFn: () => updateSettings({ scraperApiKey: null }),
    onSuccess: () => {
      invalidate();
      setForm((current) => (current ? { ...current, useProxy: false } : current));
      setNotice('ScraperAPI key cleared.');
    },
  });

  if (settingsQuery.isError && !form) {
    return (
      <div className="space-y-6">
        <Card title="Settings" sub="stored server-side (SQLite)">
          <ApiDown onRetry={() => settingsQuery.refetch()} />
        </Card>
      </div>
    );
  }

  if (!form || settingsQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tt-spinner" /> Loading settings…
      </div>
    );
  }

  const trimmedId = form.accountId.trim();
  const idInvalid = trimmedId.length > 0 && !looksLikeAccountId(trimmedId);
  const hasKey = settingsQuery.data?.hasScraperApiKey ?? false;

  return (
    <div className="space-y-6">
      <Card title="Settings" sub="stored server-side (SQLite) — the key is never sent to the browser">
        <div className="space-y-5">
          <div>
            <label className={labelClass} htmlFor="scraperKey">
              ScraperAPI key
            </label>
            <input
              id="scraperKey"
              type="password"
              className={inputClass}
              placeholder={hasKey ? `saved (${settingsQuery.data?.scraperApiKeyMask}) — type to replace` : 'not set'}
              value={form.key}
              onChange={(event) => {
                const key = event.target.value;
                // First key entered: pre-check "Use ScraperAPI by default" (still uncheckable below).
                const firstKey = !hasKey && form.key === '' && key.trim() !== '';
                setForm({ ...form, key, useProxy: form.useProxy || firstKey });
              }}
              autoComplete="off"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {hasKey ? (
                <button
                  type="button"
                  className={buttonGhost}
                  onClick={() => clearKey.mutate()}
                  disabled={clearKey.isPending}
                >
                  Clear saved key
                </button>
              ) : (
                <span className="text-xs text-muted">
                  Optional — only needed for proxy routing or as a network-failure fallback.
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Default platform</span>
              <PlatformSelect
                value={form.platform}
                onChange={(platform) => setForm({ ...form, platform })}
                disabled={save.isPending}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="defaultAccountId">
                Default AccountId
              </label>
              <input
                id="defaultAccountId"
                className={inputClass}
                value={form.accountId}
                onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                placeholder="24 hex characters"
                spellCheck={false}
                autoComplete="off"
              />
              {idInvalid ? <p className="mt-1 text-xs text-warn">Not a plausible AccountId.</p> : null}
            </div>
            <div>
              <label className={labelClass} htmlFor="timeoutMs">
                Fetch timeout (ms)
              </label>
              <input
                id="timeoutMs"
                type="number"
                min={1_000}
                max={120_000}
                step={1_000}
                className={inputClass}
                value={form.timeoutMs}
                onChange={(event) => setForm({ ...form, timeoutMs: Number(event.target.value) || 0 })}
              />
            </div>
            <label className="flex items-center gap-3 self-end pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.useProxy}
                onChange={(event) => setForm({ ...form, useProxy: event.target.checked })}
                className="h-4 w-4 accent-[#ffd700]"
              />
              Use ScraperAPI by default
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonPrimary}
              disabled={save.isPending || idInvalid || form.timeoutMs < 1_000 || form.timeoutMs > 120_000}
              onClick={() => save.mutate()}
            >
              {save.isPending ? 'Saving…' : 'Save settings'}
            </button>
            <button type="button" className={buttonGhost} onClick={() => setModalOpen(true)}>
              Find my Account ID
            </button>
            {notice ? <span className="text-xs text-accent">{notice}</span> : null}
          </div>
        </div>
      </Card>

      <Card title="How the check works">
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted">
          <li>
            One HTTP request per run to <code className="text-accent">{'api[-<platform>].warframe.com'}</code> — no
            loops, no spam: excessive calls can get your IP temporarily banned.
          </li>
          <li>The profile must be viewable in game (Esc → Options → Social → profile viewing).</li>
          <li>DE caches data — check XpCacheExpiryDate on the run page before retrying.</li>
          <li>Optional ScraperAPI proxy, with automatic direct→proxy fallback on network failures.</li>
          <li>The Get-ID helper opens a temporary Chromium; login is manual and nothing is kept locally.</li>
        </ul>
      </Card>

      <GetIdModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUse={(id) => {
          setForm({ ...form, accountId: id });
          setNotice('AccountId filled — remember to save.');
        }}
      />
    </div>
  );
}
