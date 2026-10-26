import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cargarConfig } from '../src/config.js';

describe('configuración del proveedor de persistencia', () => {
  it('requiere seleccionar explícitamente un proveedor', () => {
    assert.throws(() => cargarConfig({}), /MODO_DATOS explícitamente/);
  });

  it('rechaza proveedores desconocidos en lugar de caer a memoria', () => {
    assert.throws(
      () => cargarConfig({ MODO_DATOS: 'otro' }),
      /MODO_DATOS explícitamente/
    );
  });

  it('no permite el proveedor efímero en producción', () => {
    assert.throws(
      () => cargarConfig({ MODO_DATOS: 'memoria', NODE_ENV: 'production' }),
      /solo está permitido con NODE_ENV=development o test/
    );
  });

  it('no permite activar memoria cuando el entorno no es de desarrollo o pruebas', () => {
    assert.throws(
      () => cargarConfig({ MODO_DATOS: 'memoria' }),
      /solo está permitido con NODE_ENV=development o test/
    );
  });

  it('permite el proveedor en memoria explícitamente en pruebas', () => {
    const config = cargarConfig({ MODO_DATOS: 'memoria', NODE_ENV: 'test' });
    assert.equal(config.modoDatos, 'memoria');
  });

  it('requiere la clave web para Firebase Authentication', () => {
    assert.throws(
      () => cargarConfig({ MODO_DATOS: 'firebase' }),
      /FIREBASE_WEB_API_KEY/
    );
  });

  it('permite Firebase cuando la clave de autenticación está configurada', () => {
    const config = cargarConfig({
      MODO_DATOS: 'firebase',
      FIREBASE_WEB_API_KEY: 'test-key',
    });
    assert.equal(config.modoDatos, 'firebase');
  });
});
