import { useQuery, useQueryClient } from '@tanstack/react-query';
import { looksLikeAccountId, type Platform } from '@tennotools/profile-check-core/web';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { buttonAccent, buttonGhost, buttonPrimary, inputClass, labelClass } from '../components/controls';
import { GetIdModal } from '../components/GetIdModal';
import { PlatformSelect } from '../components/PlatformSelect';
import { fetchSettings, startRun, updateSettings } from '../lib/api';
import { SAMPLE_ACCOUNT_ID } from '../lib/setup';

/** First plausible AccountId (24 hex ObjectId) found in a free-form text. */
const findCandidate = (text: string): string | null => {
  const match = text.match(/[0-9a-f]{24}/i);
  if (!match) return null;
  return looksLikeAccountId(match[0]) ? match[0].toLowerCase() : null;
};

export function CheckPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const [platform, setPlatform] = useState<Platform>('pc');
  const [accountId, setAccountId] = useState('');
  const [useProxy, setUseProxy] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings || prefilled) return;
    setPlatform(settings.defaultPlatform);
    setAccountId(settings.defaultAccountId ?? '');
    setUseProxy(settings.defaultUseProxy);
    setPrefilled(true);
  }, [settingsQuery.data, prefilled]);

  const trimmed = accountId.trim();
  const valid = looksLikeAccountId(trimmed);
  const showInvalid = trimmed.length > 0 && !valid;
  const savedId = settingsQuery.data?.defaultAccountId ?? null;
  const usableSavedId = savedId !== null && looksLikeAccountId(savedId) ? savedId : null;

  const launchRun = async (id: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const { id: runId } = await startRun({ platform, accountId: id, useProxy });
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
      navigate(`/runs/${runId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
      setBusy(false);
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (!valid || busy) return;
    void launchRun(trimmed);
  };

  const useFoundId = (id: string): void => {
    setAccountId(id);
    setPasteMessage(null);
    void updateSettings({ defaultAccountId: id })
      .then(() => queryClient.invalidateQueries({ queryKey: ['settings'] }))
      .catch(() => {});
    void launchRun(id);
  };

  const openFinder = (): void => {
    setModalOpen(true);
  };

  const pasteFromClipboard = async (): Promise<void> => {
    setPasteMessage(null);
    try {
      const text = await navigator.clipboard.readText();
      const candidate = findCandidate(text);
      if (!candidate) {
        setPasteMessage('No plausible AccountId found in the clipboard.');
        return;
      }
      setAccountId(candidate);
    } catch {
      setPasteMessage('Clipboard read was blocked — paste manually with Ctrl+V.');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="New check" sub="live profile fetch + 13 checks">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className={labelClass}>Platform</span>
              <PlatformSelect value={platform} onChange={setPlatform} disabled={busy} />
            </div>
            <div>
              <label className={labelClass} htmlFor="accountId">
                AccountId (24 hex)
              </label>
              <div className="flex gap-2">
                <input
                  id="accountId"
                  className={inputClass}
                  value={accountId}
                  onChange={(event) => {
                    setAccountId(event.target.value);
                    setPasteMessage(null);
                  }}
                  placeholder={SAMPLE_ACCOUNT_ID}
                  disabled={busy}
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={`${buttonGhost} shrink-0`}
                  onClick={() => void pasteFromClipboard()}
                  disabled={busy}
                >
                  Paste
                </button>
              </div>
              <div className="mt-1.5 space-y-1">
                {showInvalid ? (
                  <p className="text-xs text-warn">
                    Not a plausible AccountId — 24 hex characters, or find it with Find &amp; run below.
                  </p>
                ) : null}
                {pasteMessage ? <p className="text-xs text-warn">{pasteMessage}</p> : null}
                {trimmed.length === 0 && !pasteMessage ? (
                  <p className="text-xs text-muted">
                    No AccountId at hand? <span className="text-accent">Find &amp; run</span> detects it from a quick
                    warframe.com login (nothing is stored) and launches the check as soon as it is found — the finder
                    alone lives in{' '}
                    <Link to="/settings" className="text-accent underline decoration-dotted">
                      Settings
                    </Link>
                    .
                  </p>
                ) : null}
                {usableSavedId && usableSavedId !== trimmed ? (
                  <button
                    type="button"
                    className="text-xs text-accent underline decoration-dotted hover:text-ink disabled:opacity-40"
                    onClick={() => {
                      setAccountId(usableSavedId);
                      setPasteMessage(null);
                    }}
                    disabled={busy}
                  >
                    Use saved AccountId · {usableSavedId.slice(0, 8)}…{usableSavedId.slice(-4)}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <label className="flex flex-wrap items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(event) => setUseProxy(event.target.checked)}
              disabled={busy}
              className="h-4 w-4 accent-[#ffd700]"
            />
            Route the request through ScraperAPI (proxy)
            {useProxy && settingsQuery.data && !settingsQuery.data.hasScraperApiKey ? (
              <span className="text-xs text-warn">⚠ no key saved — add it in Settings</span>
            ) : null}
          </label>

          {error ? (
            <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonPrimary} disabled={!valid || busy}>
              {busy ? 'Starting…' : 'Run check'}
            </button>
            <button type="button" className={buttonAccent} onClick={openFinder} disabled={busy}>
              Find &amp; run
            </button>
          </div>
        </form>
        <p className="mt-5 text-xs text-muted">
          Profile not viewable? In game: Esc → Options → Social → enable profile viewing. A nickname alone can no longer
          fetch a profile. One request per run — no spam.
        </p>
      </Card>
      <GetIdModal open={modalOpen} onClose={() => setModalOpen(false)} onUse={useFoundId} useLabel="Use & run check" />
    </div>
  );
}
