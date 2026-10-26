import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { obtenerEstadoReserva } from '../constantes/estadosReserva.js';
import { aplicarColaAReservas, etiquetaOperacionLocal } from './estadoColaReserva.js';
import { puedeCancelarReserva, puedeIniciarUso } from './reglasReserva.js';

describe('presentación de decisiones devueltas por la API', () => {
  it('usa los indicadores de elegibilidad del servidor sin recalcular horarios', () => {
    assert.equal(
      puedeCancelarReserva({ puedeCancelar: true, cancelableHasta: '2000-01-01T00:00:00.000Z' }),
      true
    );
    assert.equal(puedeCancelarReserva({ puedeCancelar: false, cancelableHasta: '2999-01-01T00:00:00.000Z' }), false);
    assert.equal(
      puedeIniciarUso({ puedeIniciarUso: true, estado: 'cancelada' }),
      true
    );
    assert.equal(puedeIniciarUso({ puedeIniciarUso: false, estado: 'confirmada' }), false);
  });

  it('presenta el estado calculado por la API y mantiene separados los estados locales', () => {
    assert.equal(
      obtenerEstadoReserva({ estado: 'confirmada', estadoVisible: 'vencido', finUso: '2999-01-01T00:00:00.000Z' }),
      'vencido'
    );
    assert.equal(obtenerEstadoReserva({ estado: 'pendiente_validacion' }), 'pendiente_validacion');
    assert.equal(obtenerEstadoReserva({ estado: 'rechazada' }), 'rechazada');
  });

  it('superpone operaciones offline pendientes, conflictivas y rechazadas tras recargar', () => {
    const reservas = [
      { id: 'r1', estado: 'confirmada', estadoVisible: 'reservado' },
      { id: 'r2', estado: 'confirmada', estadoVisible: 'reservado' },
      { id: 'r3', estado: 'confirmada', estadoVisible: 'reservado' },
    ];
    const operaciones = [
      { tipo: 'cancelar', datos: { reservaId: 'r1' }, estado: 'pendiente' },
      { tipo: 'iniciar_uso', datos: { reservaId: 'r2' }, estado: 'conflicto', ultimoError: 'La franja ya terminó.' },
      { tipo: 'cancelar', datos: { reservaId: 'r3' }, estado: 'rechazada', ultimoError: 'Sin permiso.' },
    ];

    const resultado = aplicarColaAReservas(reservas, operaciones);
    assert.deepEqual(
      resultado.map((reserva) => obtenerEstadoReserva(reserva)),
      ['pendiente_validacion', 'conflicto_validacion', 'rechazada']
    );
    assert.equal(etiquetaOperacionLocal(resultado[0]), 'Cancelación pendiente de validación');
    assert.equal(
      etiquetaOperacionLocal(resultado[1]),
      'Inicio de uso en conflicto: La franja ya terminó.'
    );
    assert.equal(
      etiquetaOperacionLocal(resultado[2]),
      'Cancelación rechazada por el servidor: Sin permiso.'
    );
  });
});
