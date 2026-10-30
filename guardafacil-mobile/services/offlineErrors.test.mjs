import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estadoErrorOperacion, esErrorDeRed } from './offlineErrors.js';

describe('clasificación de respuestas al sincronizar operaciones offline', () => {
  it('mantiene los errores de red pendientes para reintento', () => {
    const error = { code: 'network-request-failed' };
    assert.equal(esErrorDeRed(error), true);
    assert.equal(estadoErrorOperacion(error), 'pendiente');
  });

  it('distingue conflictos del servidor de rechazos definitivos', () => {
    assert.equal(
      estadoErrorOperacion({ status: 409, code: 'reservation-conflict' }),
      'conflicto'
    );
    assert.equal(estadoErrorOperacion({ status: 403, code: 'permission-denied' }), 'rechazada');
    assert.equal(estadoErrorOperacion({ status: 400, code: 'invalid-argument' }), 'rechazada');
    assert.equal(esErrorDeRed({ status: 400, message: 'API unavailable' }), false);
  });

  it('deja pendiente la operación cuando la sesión debe autenticarse otra vez', () => {
    assert.equal(
      estadoErrorOperacion({ status: 401, code: 'unauthenticated' }),
      'pendiente'
    );
    assert.equal(estadoErrorOperacion({ status: 403, code: 'permission-denied' }), 'rechazada');
  });
});
