
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid2X2, LockKeyhole, CheckCircle2, Wrench, ArrowUpRight, Search, Plus, CalendarDays,} from 'lucide-react';
import api from '../services/api';
import './Dashboard.css';

const statusLabels = {
  available: 'Disponible',
  reserved: 'No disponible',
  maintenance: 'Mantenimiento',
};

const statsConfig = [
  { label: 'Total casilleros', key: 'total', icon: Grid2X2, color: 'blue' },
  { label: 'Disponibles', key: 'available', icon: CheckCircle2, color: 'green' },
  { label: 'No disponibles', key: 'reserved', icon: LockKeyhole, color: 'red' },
  { label: 'Mantenimiento', key: 'maintenance', icon: Wrench, color: 'orange' },
];

function normalizarEstado(casillero) {
  const estado = String( casillero.estado ?? casillero.status ?? '').trim().toLowerCase();

  if ( casillero.mantenimiento === true || estado.includes('mantenimiento') || estado.includes('maintenance')) {
    return 'maintenance';
  }
  if ([ 'reservado', 'reservada', 'ocupado', 'ocupada', 'reserved', 'occupied',].includes(estado)) {
    return 'reserved';
  }
  if (['disponible', 'available', 'libre'].includes(estado)) {
    return 'available';
  }
  if (typeof casillero.disponible === 'boolean') {
    return casillero.disponible ? 'available' : 'reserved';
  }
  return 'available';
}

function normalizarCasillero(casillero, zona) {

  return {
    id: String(casillero.numero ?? casillero.codigo ?? casillero.id),
    documentId: String(casillero.id),
    zoneId: String(zona.id),
    location: zona.nombre || `Zona ${zona.id}`,
    status: normalizarEstado(casillero),
    size: casillero.tamano ?? casillero.tamaño ?? null,
  };
}

export default function Dashboard() {

  const navigate = useNavigate();
  const [reservationDate, setReservationDate] = useState('');
  const [reservationSlot, setReservationSlot] = useState('');
  const [savingReservation, setSavingReservation] = useState(false);
  const [lockers, setLockers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedLocker, setSelectedLocker] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {

    let activo = true;
    async function cargarCasilleros() {
      setLoading(true);
      setError('');
      try {
        const respuestaZonas = await api.get('/zonas');
        const zonas = Array.isArray(respuestaZonas.data) ? respuestaZonas.data : [];
        const resultados = await Promise.all(
          zonas.map(async (zona) => {
            const respuesta = await api.get( `/zonas/${encodeURIComponent(zona.id)}/casilleros`);
            const casillerosZona = Array.isArray(respuesta.data) ? respuesta.data : [];
            return casillerosZona.map((casillero) =>
              normalizarCasillero(casillero, zona)
            );
          })
        );
        if (activo) {
          setLockers(resultados.flat());
        }
      } catch (err) {
        if (activo) {
          setError( err.response?.data?.error?.mensaje || 'No se pudo cargar el inventario. Comprueba tu conexión y tu sesión.');
        }
      } finally {
        if (activo) {
          setLoading(false);
        }
      }
    }
    cargarCasilleros();
    return () => {
      activo = false;
    };
  }, []);

  const stats = useMemo(() => ({
      total: lockers.length,
      available: lockers.filter( (locker) => locker.status === 'available').length,
      reserved: lockers.filter( (locker) => locker.status === 'reserved').length,
      maintenance: lockers.filter((locker) => locker.status === 'maintenance').length,
    }),
    [lockers]
  );

  const filteredLockers = useMemo(() => {
    const termino = search.trim().toLowerCase();
    return lockers.filter((locker) => {
      const matchesFilter = filter === 'all' || locker.status === filter;
      const matchesSearch = locker.id.toLowerCase().includes(termino) || locker.location.toLowerCase().includes(termino);
      return matchesFilter && matchesSearch;
    });
  }, [lockers, filter, search]);

  function seleccionarCasillero(locker) {

    setSelectedLocker(locker);
    setReservationDate('');
    setReservationSlot('');
    setMessage('');
    setError('');
  }

  function cerrarModal() {

    if (savingReservation) return;
    setSelectedLocker(null);
    setReservationDate('');
    setReservationSlot('');
  }

  async function solicitarReserva(event) {

    event.preventDefault();
    if (!selectedLocker || savingReservation) return;
    if (!reservationDate || !reservationSlot.trim()) {
      setError('Selecciona la fecha y la franja horaria.');
      return;
    }
    setSavingReservation(true);
    setMessage('');
    setError('');
    try {
      await api.post('/reservas', {
        zonaId: selectedLocker.zoneId,
        casilleroId: selectedLocker.documentId,
        fecha: reservationDate,
        franja: reservationSlot.trim(),
      });
      setSelectedLocker(null);
      setReservationDate('');
      setReservationSlot('');
      navigate('/reservas');
    } catch (err) {
      setError(
        err.response?.data?.error?.mensaje || err.response?.data?.mensaje || err.response?.data?.error ||
          'No se pudo crear la reserva. Comprueba la fecha, la franja y la disponibilidad.'
      );
    } finally {
      setSavingReservation(false);
    }
  }

  return (
    <div className="dashboard">
      <section className="dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            SISTEMA DE GESTIÓN
          </div>

          <h1>Panel principal</h1>
          <p>Administra y consulta el estado de los casilleros.</p>
        </div>

        <div className="dashboard-date">
          <CalendarDays size={17} />
          <span>Resumen general</span>
        </div>
      </section>

      {message && (
        <div className="dashboard-message" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} aria-label="Cerrar aviso">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="dashboard-message" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar error">
            ×
          </button>
        </div>
      )}

      <section className="stats-grid">
        {statsConfig.map(({ label, key, icon: Icon, color }) => {
          const porcentaje = stats.total > 0 ? Math.round((stats[key] / stats.total) * 100) : 0;
          return (
            <article className="stat-card" key={key}>
              <div className="stat-top">
                <div className={`stat-icon ${color}`}>
                  <Icon size={21} />
                </div>
                <span className="stat-indicator">
                  <ArrowUpRight size={15} />
                </span>
              </div>
              <p>{label}</p>
              <div className="stat-value">
                {loading ? '—' : stats[key]}
              </div>
              <span className="stat-caption">
                {key === 'total' ? 'Casilleros registrados' : loading ? 'Calculando...' : `${porcentaje}% del total`}
              </span>
            </article>
          );
        })}
      </section>

      <section className="locker-section">
        <div className="section-heading">
          <div>
            <h2>Disponibilidad de casilleros</h2>
            <p>Selecciona un casillero para ver sus detalles.</p>
          </div>

          <div className="locker-total">
            <span className="locker-total-dot" />
            {loading ? 'Cargando...' : `${stats.available} disponibles`}
          </div>
        </div>

        <div className="locker-toolbar">
          <div className="locker-filters">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'available', label: 'Disponibles' },
              { value: 'reserved', label: 'No disponibles' },
              { value: 'maintenance', label: 'Mantenimiento' },
            ].map((option) => (
              <button type="button" key={option.value}
                className={`filter-button ${ filter === option.value ? 'filter-active' : ''}`}
                onClick={() => setFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>

          <label className="locker-search">
            <Search size={17} />
            <input type="search" placeholder="Buscar código o zona..." value={search} 
              onChange={(event) => setSearch(event.target.value)}/>
          </label>
        </div>

        {loading ? (
          <div className="locker-empty">
            Cargando casilleros desde el servidor...
          </div>
        ) : (
          <>
            <div className="locker-grid">
              {filteredLockers.map((locker) => (
                <button type="button" key={`${locker.zoneId}-${locker.documentId}`}
                  className={`locker-card locker-${locker.status} ${
                    selectedLocker?.zoneId === locker.zoneId && selectedLocker?.documentId === locker.documentId ? 'locker-selected' : ''
                  }`}
                  onClick={() => seleccionarCasillero(locker)}
                  aria-pressed={ selectedLocker?.zoneId === locker.zoneId && selectedLocker?.documentId === locker.documentId}>
                  <div className="locker-card-top">
                    <span className="locker-code">{locker.id}</span>
                    {locker.status === 'available' ? (
                      <CheckCircle2 size={17} />
                    ) : locker.status === 'reserved' ? (
                      <LockKeyhole size={17} />
                    ) : (
                      <Wrench size={17} />
                    )}
                  </div>

                  <div className="locker-illustration">
                    <div className="locker-door">
                      <span className="locker-handle" />
                    </div>
                  </div>

                  <span className="locker-status">
                    {statusLabels[locker.status]}
                  </span>
                </button>
              ))}
            </div>

            {filteredLockers.length === 0 && (
              <div className="locker-empty">
                {lockers.length === 0 ? 'No hay casilleros registrados en las zonas de Firebase.'
                  : 'No hay casilleros que coincidan con tu búsqueda.'}
              </div>
            )}
          </>
        )}

        <div className="locker-footer">
          <span>
            Mostrando {filteredLockers.length} de {lockers.length} casilleros
          </span>
          <span>Inventario conectado al servidor</span>
        </div>
      </section>

      {selectedLocker && (
        <div className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cerrarModal();
            }
          }}
        >
          <section className="locker-modal" role="dialog" aria-modal="true" aria-labelledby="locker-modal-title">
            <button type="button" className="modal-close" onClick={cerrarModal} aria-label="Cerrar"
              disabled={savingReservation} >
              ×
            </button>

            <div className={`modal-icon ${selectedLocker.status}`}>
              {selectedLocker.status === 'available' ? (
                <LockKeyhole size={26} />
              ) : selectedLocker.status === 'reserved' ? (
                <LockKeyhole size={26} />
              ) : (
                <Wrench size={26} />
              )}
            </div>
            <h2 id="locker-modal-title">
              Casillero {selectedLocker.id}
            </h2>
            <p className="modal-description">
              Zona: <strong>{selectedLocker.location}</strong>
            </p>
            <p className="modal-description">
              Estado actual:{' '}
              <strong>{statusLabels[selectedLocker.status]}</strong>
            </p>
            {selectedLocker.size && (
              <p className="modal-description">
                Tamaño: <strong>{selectedLocker.size}</strong>
              </p>
            )}
            {selectedLocker.status === 'available' ? (
              <form className="reservation-form" onSubmit={solicitarReserva}>
                <p className="modal-description">
                  Selecciona la fecha y la franja horaria para reservar este casillero.
                </p>
                <label className="reservation-form-label">
                  Fecha de reserva
                  <input type="date" value={reservationDate} min={new Date().toLocaleDateString('en-CA')}
                    onChange={(event) =>
                      setReservationDate(event.target.value)
                    } required/>
                </label>
                <label className="reservation-form-label">
                  Franja horaria
                  <input type="text" value={reservationSlot}
                    onChange={(event) =>
                      setReservationSlot(event.target.value)
                    }
                    placeholder="Ej. mañana" required/>
                </label>
                <button type="submit" className="reserve-button" disabled={savingReservation}>
                  <Plus size={18} />
                  {savingReservation ? 'Guardando...' : 'Confirmar reserva'}
                </button>
              </form>
            ) : (
              <p className="modal-description">
                {selectedLocker.status === 'reserved' ? 'Este casillero no está disponible para reservar.'
                  : 'Este casillero está marcado para mantenimiento.'}
              </p>
            )}
            <button type="button" className="cancel-modal-button" onClick={cerrarModal} disabled={savingReservation}>
              Cerrar
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
