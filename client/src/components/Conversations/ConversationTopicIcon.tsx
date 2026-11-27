import { memo } from 'react';
import {
  Mail,
  FileText,
  BarChart3,
  AlarmClock,
  CalendarDays,
  MessageSquare,
  SquareCheckBig,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '~/utils';

/**
 * AMA: sidebar icon chosen from the conversation title instead of the agent avatar,
 * so the list is scannable when every chat goes through the same agent.
 * Rules are checked in order; the first match wins.
 */
type TopicRule = {
  key: string;
  Icon: LucideIcon;
  color: string;
  pattern: RegExp;
};

const TOPIC_RULES: TopicRule[] = [
  {
    key: 'routine',
    Icon: AlarmClock,
    color: 'text-amber-600 dark:text-amber-400',
    pattern:
      /\b(rutina|programa|recordatorio|diari|cada (dia|semana|lunes|manana)|semanal|mensual|tareas programadas)/,
  },
  {
    key: 'huly',
    Icon: SquareCheckBig,
    color: 'text-violet-600 dark:text-violet-400',
    pattern: /\b(huly|tarea|issue|tracker|backlog)/,
  },
  {
    key: 'data',
    Icon: BarChart3,
    color: 'text-sky-600 dark:text-sky-400',
    pattern:
      /\b(metabase|dashboard|grafic|chart|volumen|despacho|venta|kpi|indicador|reporte|informe|estadistic|metrica|analisis|datos)/,
  },
  {
    key: 'calendar',
    Icon: CalendarDays,
    color: 'text-emerald-600 dark:text-emerald-400',
    pattern:
      /\b(reunion|agenda|sala|horario|calendario|cita|evento|booking|room|meeting|disponibilidad)/,
  },
  {
    key: 'file',
    Icon: FileText,
    color: 'text-orange-600 dark:text-orange-400',
    pattern:
      /\b(archivo|pdf|documento|excel|word|planilla|presentacion|ppt|plan |adjunto|contrato)/,
  },
  {
    key: 'mail',
    Icon: Mail,
    color: 'text-rose-600 dark:text-rose-400',
    pattern: /\b(correo|mail|envi[oa]|enviar|mensaje|bandeja|responder|outlook)/,
  },
];

const normalize = (text: string) =>
  ` ${text} `
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function getTopicRule(title?: string | null): TopicRule | undefined {
  if (!title) {
    return undefined;
  }
  const text = normalize(title);
  return TOPIC_RULES.find((rule) => rule.pattern.test(text));
}

function ConversationTopicIcon({ title, size = 18 }: { title?: string | null; size?: number }) {
  const rule = getTopicRule(title);
  const Icon = rule?.Icon ?? MessageSquare;
  return (
    <Icon
      size={size}
      aria-hidden="true"
      data-topic={rule?.key ?? 'chat'}
      className={cn('shrink-0', rule?.color ?? 'text-text-secondary')}
    />
  );
}

export default memo(ConversationTopicIcon);
