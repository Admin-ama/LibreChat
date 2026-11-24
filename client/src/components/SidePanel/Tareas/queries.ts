import { useRecoilValue } from 'recoil';
import { request } from 'librechat-data-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import store from '~/store';

export type TareaEstado = 'activa' | 'pausada' | 'pausada_por_errores';

export type Tarea = {
  id: string;
  titulo: string;
  instruccion: string;
  horario: string;
  estado: TareaEstado;
  proxima_ejecucion: number | null;
  prueba_pendiente: boolean;
  ultima_ejecucion: number | null;
  ultimo_estado: 'ok' | 'error' | null;
  ultimo_resultado: string | null;
  fallos_seguidos: number;
  creada: number;
};

export type Ejecucion = {
  id: string;
  origen: 'programada' | 'prueba';
  estado: 'reclamada' | 'ejecutando' | 'ok' | 'error';
  reclamada: number;
  inicio: number | null;
  fin: number | null;
  resultado: string | null;
  error: string | null;
};

export type TareasResponse = {
  habilitado: boolean;
  maximo?: number;
  max_fallos?: number;
  tareas: Tarea[];
};

export type TareaDetalle = { tarea: Tarea; ejecuciones: Ejecucion[] };
export type TareaAccion = 'pausar' | 'reanudar' | 'probar' | 'borrar';

const KEY = 'tareasProgramadas';

/** Scheduled tasks of the current user (tareas-mcp, proxied by /api/tareas). */
export function useTareasQuery(options?: { refetchInterval?: number | false }) {
  const queriesEnabled = useRecoilValue<boolean>(store.queriesEnabled);
  return useQuery<TareasResponse>([KEY], () => request.get<TareasResponse>('/api/tareas'), {
    enabled: queriesEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
    refetchInterval: options?.refetchInterval,
  });
}

export function useTareaDetalleQuery(id: string, enabled: boolean) {
  return useQuery<TareaDetalle>(
    [KEY, id],
    () => request.get<TareaDetalle>(`/api/tareas/${encodeURIComponent(id)}`),
    { enabled, refetchInterval: enabled ? 20_000 : false, retry: false },
  );
}

export function useTareaAccion() {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, accion }: { id: string; accion: TareaAccion }) =>
      accion === 'borrar'
        ? request.delete(`/api/tareas/${encodeURIComponent(id)}`)
        : request.post(`/api/tareas/${encodeURIComponent(id)}/${accion}`),
    { onSettled: () => queryClient.invalidateQueries([KEY]) },
  );
}
