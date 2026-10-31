import type { TUsageWindow } from 'librechat-data-provider';
import { usageWindowLabelKeys, usagePercent, formatResetAt } from '~/utils/usage';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function WindowBar({ window }: { window: TUsageWindow }) {
  const localize = useLocalize();
  const percent = usagePercent(window.spent, window.limit);
  if (percent == null || window.limit == null) {
    return null;
  }
  const label = localize(usageWindowLabelKeys[window.key]);
  const blocked = window.spent >= window.limit;
  const barColor = blocked ? 'bg-red-500' : 'bg-green-600';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-primary">{label}</span>
        <span className={cn('tabular-nums', blocked ? 'text-red-500' : 'text-text-secondary')}>
          {Math.round(percent)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-valuetext={`${Math.round(percent)}%`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            !blocked && percent >= 80 ? 'bg-amber-500' : barColor,
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {blocked && window.resetAt != null && (
        <p className="text-[11px] text-text-secondary">
          {localize('com_nav_usage_resets', { 0: formatResetAt(window.resetAt) })}
        </p>
      )}
    </div>
  );
}

/** Rolling 5h/weekly/monthly spend bars; renders nothing when limits are off. */
export default function UsageMeter({ windows }: { windows: TUsageWindow[] }) {
  const localize = useLocalize();
  return (
    <section className="ml-3 mr-2 space-y-2 py-2" aria-label={localize('com_nav_usage')}>
      <h3 className="text-xs font-medium text-text-secondary">{localize('com_nav_usage')}</h3>
      {windows.map((window) => (
        <WindowBar key={window.key} window={window} />
      ))}
    </section>
  );
}
