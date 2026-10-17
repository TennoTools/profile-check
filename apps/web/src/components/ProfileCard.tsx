import { dateFormat, formatDuration, numberFormat, type RunResult } from '@tennotools/profile-check-core/web';
import { Card } from './Card';
import { LoadoutChips } from './LoadoutChips';

const Field = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{label}</span>
    <span className={`text-base font-extrabold break-words ${accent ? 'text-accent' : 'text-ink'}`}>{value}</span>
  </div>
);

export function ProfileCard({ run }: { run: RunResult }) {
  const summary = run.summary;
  if (!summary) return null;

  const created = summary.created ? new Date(summary.created) : null;
  const clanParts: string[] = [];
  if (summary.clan?.tier != null) clanParts.push(`tier ${summary.clan.tier}`);
  if (summary.clan?.class != null) clanParts.push(`class ${summary.clan.class}`);
  const clan = summary.clan
    ? `${summary.clan.name}${clanParts.length > 0 ? ` (${clanParts.join(', ')})` : ''}`
    : 'none';

  return (
    <Card title="Profile Summary" sub={run.request.platform}>
      <div className="grid grid-cols-1 gap-x-7 gap-y-4 sm:grid-cols-2">
        <Field label="Nickname" value={summary.nickname ?? '—'} accent />
        <Field label="Account ID" value={summary.accountId ?? '—'} />
        <Field label="Mastery Rank" value={summary.masteryRank != null ? `MR ${summary.masteryRank}` : '—'} accent />
        <Field label="Account Created" value={created ? dateFormat.format(created) : '—'} />
        <Field label="Time Played" value={formatDuration(summary.timePlayedSec)} />
        <Field
          label="Missions"
          value={`${numberFormat.format(summary.missions.completed)} done / ${numberFormat.format(summary.missions.failed)} failed`}
        />
        <Field label="Clan" value={clan} />
        <Field label="Operator Unlocked" value={summary.operatorUnlocked ? 'Yes' : 'No'} />
      </div>
      <div className="mt-6">
        <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
          Equipped Loadout
        </span>
        <LoadoutChips loadout={summary.loadout} />
      </div>
    </Card>
  );
}
