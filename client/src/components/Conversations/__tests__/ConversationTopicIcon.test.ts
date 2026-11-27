import { getTopicRule } from '../ConversationTopicIcon';

describe('getTopicRule', () => {
  it.each([
    ['Reunión de Cierres de Producción', 'calendar'],
    ['Reunión para Subir Proyecto', 'calendar'],
    ['Salas Libres Mañana 12:00-13:00', 'calendar'],
    ['Tarea de Reunión en Huly', 'huly'],
    ['Crear Dashboard en Metabase', 'data'],
    ['Volumen y Despachos por Cliente', 'data'],
    ['Programar Envío Diario de Ciberseguridad', 'routine'],
    ['Mis Tareas Programadas', 'routine'],
    ['Enviar Archivo Plan Bulk S44', 'file'],
    ['Responder correo de proveedor', 'mail'],
  ])('%s → %s', (title, key) => {
    expect(getTopicRule(title)?.key).toBe(key);
  });

  it('returns undefined for unmatched or empty titles', () => {
    expect(getTopicRule('Hola')).toBeUndefined();
    expect(getTopicRule('')).toBeUndefined();
    expect(getTopicRule(null)).toBeUndefined();
  });
});
