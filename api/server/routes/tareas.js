/**
 * Panel "Mis tareas": proxy autenticado hacia el servicio tareas-mcp (tareas programadas de AMAGPT).
 * La URL y la clave se toman de `mcpServers.tareas` del librechat.yaml, así que no hay variables nuevas;
 * el id de usuario sale de la sesión (nunca del navegador). Sin ese servidor configurado, el panel queda oculto.
 */
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');

const router = express.Router();
router.use(requireJwtAuth, configMiddleware);

const ID = /^t_[\w-]{1,40}$/;
const ACCIONES = new Set(['pausar', 'reanudar', 'probar']);

function destino(req) {
  const cfg = req.config?.mcpConfig?.tareas;
  const key = cfg?.headers?.['x-tareas-key'];
  if (!cfg?.url || !key) {
    return null;
  }
  return { base: new URL(cfg.url).origin, key };
}

async function proxy(req, res, method, path) {
  const d = destino(req);
  if (!d) {
    return method === 'GET' && path === '/app/tareas'
      ? res.json({ habilitado: false, tareas: [] })
      : res.status(404).json({ error: 'Tareas programadas no configuradas' });
  }
  try {
    const r = await fetch(d.base + path, {
      method,
      headers: { 'x-tareas-key': d.key, 'x-librechat-user-id': String(req.user.id) },
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json().catch(() => ({}));
    return res.status(r.status).json(body);
  } catch (error) {
    logger.error('[tareas] proxy error:', error);
    return res.status(502).json({ error: 'No se pudo contactar el servicio de tareas' });
  }
}

router.get('/', (req, res) => proxy(req, res, 'GET', '/app/tareas'));

router.get('/:id', (req, res) =>
  ID.test(req.params.id)
    ? proxy(req, res, 'GET', `/app/tareas/${req.params.id}`)
    : res.status(400).json({ error: 'id inválido' }),
);

router.delete('/:id', (req, res) =>
  ID.test(req.params.id)
    ? proxy(req, res, 'DELETE', `/app/tareas/${req.params.id}`)
    : res.status(400).json({ error: 'id inválido' }),
);

router.post('/:id/:accion', (req, res) =>
  ID.test(req.params.id) && ACCIONES.has(req.params.accion)
    ? proxy(req, res, 'POST', `/app/tareas/${req.params.id}/${req.params.accion}`)
    : res.status(400).json({ error: 'solicitud inválida' }),
);

module.exports = router;
