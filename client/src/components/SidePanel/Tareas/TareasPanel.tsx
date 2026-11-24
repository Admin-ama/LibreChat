import { useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, Pause, Play, Trash2, Zap } from 'lucide-react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import type { Ejecucion, Tarea, TareaAccion, TareaEstado } from './queries';
import { useTareasQuery, useTareaDetalleQuery, useTareaAccion } from './queries';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const fmt = new Intl.DateTimeFormat(undefined, {
  timeZone: 'America/Santiago',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const fecha = (ms?: number | null) => (ms ? fmt.format(new Date(ms)) : '');

const ESTADO_KEY = {
  activa: 'com_ui_task_status_activa',
  pausada: 'com_ui_task_status_pausada',
  pausada_por_errores: 'com_ui_task_status_pausada_por_errores',
} as const;

const ESTADO_CLASS: Record<TareaEstado, string> = {
  activa: 'border-green-600/40 text-green-700 dark:text-green-400',
  pausada: 'border-border-medium text-text-secondary',
  pausada_por_errores: 'border-red-500/50 text-red-600 dark:text-red-400',
};

function EstadoBadge({ estado }: { estado: TareaEstado }) {
  const localize = useLocalize();
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        ESTADO_CLASS[estado] ?? ESTADO_CLASS.pausada,
      )}
    >
      {localize(ESTADO_KEY[estado] ?? 'com_ui_task_status_pausada')}
    </span>
  );
}

function EjecucionItem({ e }: { e: Ejecucion }) {
  const localize = useLocalize();
  const enCurso = e.estado === 'reclamada' || e.estado === 'ejecutando';
  const texto = e.estado === 'error' ? e.error : e.resultado;
  const COLOR: Record<Ejecucion['estado'], string> = {
    ok: 'text-green-700 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    reclamada: 'text-text-secondary',
    ejecutando: 'text-text-secondary',
  };
  const color = COLOR[e.estado] ?? 'text-text-secondary';
  const label = enCurso
    ? localize('com_ui_task_run_running')
    : localize(e.estado === 'ok' ? 'com_ui_task_run_ok' : 'com_ui_task_run_error');
  return (
    <li className="rounded-md border border-border-light">
      <details>
        <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs">
          <span className={cn('font-medium', color)}>{label}</span>
          <span className="text-text-secondary">{fecha(e.inicio ?? e.reclamada)}</span>
          <span className="ml-auto text-text-tertiary">
            {localize(
              e.origen === 'prueba' ? 'com_ui_task_origin_prueba' : 'com_ui_task_origin_programada',
            )}
          </span>
        </summary>
        {texto && (
          <p className="whitespace-pre-wrap break-words border-t border-border-light px-2 py-1.5 text-xs text-text-primary">
            {texto}
          </p>
        )}
      </details>
    </li>
  );
}

function Detalle({ tarea }: { tarea: Tarea }) {
  const localize = useLocalize();
  const { data, isLoading } = useTareaDetalleQuery(tarea.id, true);
  return (
    <div className="mt-2 space-y-2 border-t border-border-light pt-2">
      <div>
        <h4 className="text-xs font-medium text-text-secondary">
          {localize('com_ui_task_instruction')}
        </h4>
        <p className="whitespace-pre-wrap break-words text-xs text-text-primary">
          {tarea.instruccion}
        </p>
      </div>
      <div>
        <h4 className="mb-1 text-xs font-medium text-text-secondary">
          {localize('com_ui_task_runs')}
        </h4>
        {isLoading && <Spinner className="size-4" />}
        {!isLoading && data?.ejecuciones.length ? (
          <ul className="space-y-1">
            {data.ejecuciones.map((e) => (
              <EjecucionItem key={e.id} e={e} />
            ))}
          </ul>
        ) : null}
        {!isLoading && !data?.ejecuciones.length && (
          <p className="text-xs text-text-secondary">{localize('com_ui_task_no_runs')}</p>
        )}
      </div>
    </div>
  );
}

function TareaCard({ tarea, maxFallos }: { tarea: Tarea; maxFallos: number }) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const accion = useTareaAccion();
  const [abierta, setAbierta] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  const ejecutar = (a: TareaAccion) =>
    accion.mutate(
      { id: tarea.id, accion: a },
      {
        onSuccess: () => {
          const msg = {
            probar: 'com_ui_task_test_queued',
            pausar: 'com_ui_task_paused',
            reanudar: 'com_ui_task_resumed',
            borrar: 'com_ui_task_deleted',
          } as const;
          showToast({ message: localize(msg[a]), status: 'success' });
        },
        onError: () =>
          showToast({ message: localize('com_ui_task_action_error'), status: 'error' }),
      },
    );

  const ocupado = accion.isLoading;

  return (
    <li className="rounded-lg border border-border-light px-3 py-2.5 hover:bg-surface-secondary">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-1 text-left"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          {abierta ? (
            <ChevronDown
              className="mt-0.5 size-4 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
          ) : (
            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-text-secondary"
              aria-hidden="true"
            />
          )}
          <span className="min-w-0">
            <span className="block break-words text-sm font-semibold text-text-primary">
              {tarea.titulo}
            </span>
            <span className="block text-xs text-text-secondary">{tarea.horario}</span>
          </span>
        </button>
        <EstadoBadge estado={tarea.estado} />
      </div>

      <div className="mt-1.5 space-y-0.5 pl-5 text-xs text-text-secondary">
        {tarea.proxima_ejecucion != null && (
          <p>{localize('com_ui_task_next_run', { 0: fecha(tarea.proxima_ejecucion) })}</p>
        )}
        {tarea.prueba_pendiente && (
          <p className="text-amber-600 dark:text-amber-400">
            {localize('com_ui_task_test_pending')}
          </p>
        )}
        {tarea.ultima_ejecucion ? (
          <p>
            {localize('com_ui_task_last_run', { 0: fecha(tarea.ultima_ejecucion) })}{' '}
            <span
              className={
                tarea.ultimo_estado === 'ok'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              ·{' '}
              {localize(
                tarea.ultimo_estado === 'ok' ? 'com_ui_task_run_ok' : 'com_ui_task_run_error',
              )}
            </span>
          </p>
        ) : (
          <p>{localize('com_ui_task_never_run')}</p>
        )}
        {tarea.estado === 'pausada_por_errores' && (
          <p className="text-red-600 dark:text-red-400">
            {localize('com_ui_task_errors_hint', { 0: String(maxFallos) })}
          </p>
        )}
      </div>

      {abierta && <Detalle tarea={tarea} />}

      <div className="mt-2 flex flex-wrap items-center gap-1 pl-4">
        {confirmarBorrar ? (
          <>
            <span className="w-full text-xs text-text-primary">
              {localize('com_ui_task_delete_confirm', { 0: tarea.titulo })}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmarBorrar(false)}
            >
              {localize('com_ui_cancel')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              disabled={ocupado}
              onClick={() => ejecutar('borrar')}
            >
              {localize('com_ui_task_delete')}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              disabled={ocupado || tarea.prueba_pendiente}
              onClick={() => ejecutar('probar')}
            >
              <Zap className="size-3.5" aria-hidden="true" />
              {localize('com_ui_task_run_now')}
            </Button>
            {tarea.estado === 'activa' ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                disabled={ocupado}
                onClick={() => ejecutar('pausar')}
              >
                <Pause className="size-3.5" aria-hidden="true" />
                {localize('com_ui_task_pause')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                disabled={ocupado}
                onClick={() => ejecutar('reanudar')}
              >
                <Play className="size-3.5" aria-hidden="true" />
                {localize('com_ui_task_resume')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 gap-1 px-2 text-xs text-red-600 dark:text-red-400"
              disabled={ocupado}
              onClick={() => setConfirmarBorrar(true)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {localize('com_ui_task_delete')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** Side panel: the user's scheduled AMAGPT routines (view, test, pause/resume, delete). */
export default function TareasPanel() {
  const localize = useLocalize();
  const { data, isLoading, isError } = useTareasQuery({ refetchInterval: 30_000 });
  const tareas = data?.tareas ?? [];

  return (
    <div className="h-auto max-w-full space-y-3 overflow-x-visible pt-2">
      <p className="text-xs text-text-secondary">{localize('com_ui_tasks_intro')}</p>
      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {localize('com_ui_task_load_error')}
        </p>
      )}
      {!isLoading && !isError && tareas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-light p-6 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-surface-tertiary">
            <CalendarClock className="size-5 text-text-secondary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-text-primary">
            {localize('com_ui_tasks_empty_title')}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {localize('com_ui_tasks_empty_hint')}
          </p>
        </div>
      )}
      {tareas.length > 0 && (
        <>
          <ul className="space-y-2">
            {tareas.map((t) => (
              <TareaCard key={t.id} tarea={t} maxFallos={data?.max_fallos ?? 3} />
            ))}
          </ul>
          {data?.maximo != null && (
            <p className="text-right text-[11px] text-text-tertiary">
              {localize('com_ui_task_count', { 0: String(tareas.length), 1: String(data.maximo) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
