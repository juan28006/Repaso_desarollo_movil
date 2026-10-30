import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ESTADOS_CASILLERO,
  etiquetaEstadoCasillero,
  normalizarEstadoCasillero,
  tieneDatoMantenimiento,
  tieneEstadoCasillero,
} from '../constantes/estadosCasillero.js';

describe('clasificación de estados de casilleros', () => {
  it('prioriza mantenimiento sobre el indicador de disponibilidad', () => {
    assert.equal(
      normalizarEstadoCasillero({ disponible: false, mantenimiento: true }),
      ESTADOS_CASILLERO.MANTENIMIENTO
    );
    assert.equal(
      normalizarEstadoCasillero({ disponible: false, estado: 'En mantenimiento' }),
      ESTADOS_CASILLERO.MANTENIMIENTO
    );
  });

  it('reconoce estados disponibles y ocupados, incluyendo el indicador booleano', () => {
    assert.equal(normalizarEstadoCasillero({ estado: 'Libre' }), ESTADOS_CASILLERO.DISPONIBLE);
    assert.equal(normalizarEstadoCasillero({ status: 'occupied' }), ESTADOS_CASILLERO.OCUPADO);
    assert.equal(normalizarEstadoCasillero({ disponible: false }), ESTADOS_CASILLERO.OCUPADO);
  });

  it('no inventa un estado si la respuesta no trae información suficiente', () => {
    const casillero = {};
    assert.equal(normalizarEstadoCasillero(casillero), ESTADOS_CASILLERO.DESCONOCIDO);
    assert.equal(tieneEstadoCasillero(casillero), false);
    assert.equal(tieneDatoMantenimiento(casillero), false);
    assert.equal(etiquetaEstadoCasillero(ESTADOS_CASILLERO.DESCONOCIDO), 'Estado no disponible');
  });

  it('considera informativo un estado textual para reportar mantenimiento', () => {
    assert.equal(tieneDatoMantenimiento({ estado: 'Disponible' }), true);
  });
});
