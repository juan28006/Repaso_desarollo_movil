import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { traducirErrorFirebase } from '../src/auth/firebase.js';

describe('traducción de errores Firebase (unitaria)', () => {
  it('identifica credenciales inválidas', () => {
    const error = traducirErrorFirebase('INVALID_LOGIN_CREDENTIALS');
    assert.equal(error.status, 401);
    assert.equal(error.code, 'auth/invalid-credential');
  });

  it('identifica API keys de Firebase inválidas sin revelar detalles', () => {
    const error = traducirErrorFirebase('API_KEY_INVALID');
    assert.equal(error.status, 503);
    assert.equal(error.code, 'auth/configuration-error');
  });

  it('indica cuando correo y contraseña no están habilitados en Firebase', () => {
    const error = traducirErrorFirebase('OPERATION_NOT_ALLOWED');
    assert.equal(error.status, 503);
    assert.equal(error.code, 'auth/provider-disabled');
  });
});
