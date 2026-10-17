import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { looksLikeAccountId, type SettingsUpdate } from '@tennotools/profile-check-core/web';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { buttonGhost, buttonPrimary, inputClass, labelClass } from '../components/controls';
import { GetIdModal } from '../components/GetIdModal';
import { fetchSettings, updateSettings } from '../lib/api';
import { clearInitSkip, SAMPLE_ACCOUNT_ID, skipInit } from '../lib/setup';

export function InitPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const [key, setKey] = useState('');
  const [accountId, setAccountId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const hasKey = settingsQuery.data?.hasScraperApiKey ?? false;
  const trimmed = accountId.trim();
  const idValid = looksLikeAccountId(trimmed);
  const showInvalid = trimmed.length > 0 && !idValid;

  const save = useMutation({
    mutationFn: async (mode: 'entered' | 'sample') => {
      const update: SettingsUpdate = {};
      if (key.trim()) update.scraperApiKey = key.trim();
      if (mode === 'sample') update.defaultAccountId = SAMPLE_ACCOUNT_ID;
      else if (idValid) update.defaultAccountId = trimmed.toLowerCase();
      if (Object.keys(update).length === 0) return null;
      return updateSettings(update);
    },
    onSuccess: () => {
      clearInitSkip();
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      navigate('/');
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : String(error)),
  });

  const skip = (): void => {
    skipInit();
    navigate('/');
  };

  return (
    <div className="space-y-6">
      <Card title="First run" sub="a quick setup before your first check">
        <p className="text-sm text-muted">
          Nothing is configured yet. Add your ScraperAPI key (optional) and your AccountId — or try the tool right away
          on the public sample profile.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <label className={labelClass} htmlFor="initKey">
              ScraperAPI key
            </label>
            <input
              id="initKey"
              type="password"
              className={inputClass}
              placeholder={
                hasKey ? `saved (${settingsQuery.data?.scraperApiKeyMask}) — type to replace` : 'not set — optional'
              }
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-muted">
              Optional — only needed for proxy routing or as a network-failure fallback.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="initAccountId">
              AccountId (24 hex)
            </label>
            <div className="flex gap-2">
              <input
                id="initAccountId"
                className={inputClass}
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                placeholder={SAMPLE_ACCOUNT_ID}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className={`${buttonGhost} shrink-0`}
                onClick={() => setModalOpen(true)}
                disabled={save.isPending}
              >
                Find my Account ID
              </button>
            </div>
            {showInvalid ? (
              <p className="mt-1 text-xs text-warn">Not a plausible AccountId — 24 hex characters.</p>
            ) : null}
            <p className="mt-1 text-xs text-muted">
              The helper opens a temporary Chromium for a manual warframe.com login (nothing is stored) and fills your
              id automatically — only needed once.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonPrimary}
              disabled={save.isPending || (!key.trim() && !idValid)}
              onClick={() => save.mutate('entered')}
            >
              {save.isPending ? 'Saving…' : 'Save and start'}
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={save.isPending}
              onClick={() => save.mutate('sample')}
            >
              Try with the sample account
            </button>
            <button
              type="button"
              className="text-xs text-muted underline decoration-dotted hover:text-ink disabled:opacity-40"
              onClick={skip}
              disabled={save.isPending}
            >
              Continue without saving
            </button>
            {notice ? <span className="text-xs text-danger">{notice}</span> : null}
          </div>

          <p className="text-xs text-muted">
            The sample is [DE]Rebecca's public profile ({SAMPLE_ACCOUNT_ID}) — a real account you can always test
            against. Switch to your own id anytime in Settings.
          </p>
        </div>
      </Card>

      <GetIdModal open={modalOpen} onClose={() => setModalOpen(false)} onUse={setAccountId} />
    </div>
  );
}
