
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, CalendarDays, CheckCircle2, Clock3, XCircle, Eye, Ban, X, UserRound,
  MapPin, LockKeyhole, Filter, RefreshCw, AlertCircle,} from 'lucide-react';
import api from '../services/api';
import './Reservas.css';

const statusLabels = {
  reservado: 'Reservada',
  en_uso: 'En uso',
  cancelado: 'Cancelada',
  finalizado: 'Finalizada',
  vencido: 'Vencida',
  pendiente: 'Pendiente',
};

const statusClasses = {
  reservado: 'active',
  en_uso: 'active',
  cancelado: 'cancelled',
  finalizado: 'cancelled',
  vencido: 'cancelled',
  pendiente: 'active',
};

function formatDate(date) {

  if (!date) return 'Sin fecha';
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) return date;
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',}).format(parsedDate);
}

function formatDateTime(value) {

  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short',}).format(date);
}

function getStatus(reservation) {

  return reservation.estadoVisible || reservation.estado || 'pendiente';
}

function getStudent(reservation) {

  return reservation.usuarioEmail || reservation.usuarioId || 'Usuario desconocido';
}

function getLocker(reservation) {

  return reservation.casilleroNumero != null ? `C-${String(reservation.casilleroNumero).padStart(3, '0')}`
    : reservation.casilleroId || 'Sin casillero';
}

function getLocation(reservation) {

  return reservation.zonaNombre || reservation.zonaId || 'Sin zona';
}

function getReservationId(reservation) {

  return reservation.id || reservation.reservaId || '';
}

function getErrorMessage(error) {

  return ( error.response?.data?.error?.mensaje || error.response?.data?.mensaje ||
    error.response?.data?.error || error.message || 'Ocurrió un error al comunicarse con el servidor.'
  );
}

export default function Reservas() {

  const [reservations, setReservations] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const loadReservations = useCallback(async () => {

    setLoading(true);
    setError('');
    try {
      const response = await api.get('/reservas');
      const data = Array.isArray(response.data) ? response.data : response.data?.reservas;
      if (!Array.isArray(data)) {
        throw new Error( 'La API respondió, pero el formato de las reservas no es el esperado.' );
      }
      setReservations(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
      setReservations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  const stats = useMemo(() => {

    const cancelled = reservations.filter((r) => getStatus(r) === 'cancelado').length;
    const active = reservations.filter((r) => ['reservado', 'en_uso'].includes(getStatus(r))).length;
    return { total: reservations.length, active, cancelled,};
  }, [reservations]);

  const filteredReservations = useMemo(() => {

    const query = search.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const searchableValues = [ getReservationId(reservation), getStudent(reservation), reservation.usuarioId || '',
        getLocker(reservation), reservation.casilleroId || '', getLocation(reservation), reservation.zonaId || '',
        reservation.franja || '',
      ];
      const matchesSearch = searchableValues.some((value) => String(value).toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || getStatus(reservation) === statusFilter;
      const matchesDate = !dateFilter || reservation.fecha === dateFilter;
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reservations, search, statusFilter, dateFilter]);

  async function cancelReservation() {

    if (!reservationToCancel || cancelling) return;
    const reservation = reservationToCancel;
    const reservationId = getReservationId(reservation);
    if (!reservationId) {
      setError('No se encontró el identificador de esta reserva.');
      return;
    }
    setCancelling(true);
    setError('');
    setNotice('');

    try {
      await api.post( `/reservas/${encodeURIComponent(reservationId)}/cancelar`);
      setNotice(`La reserva ${reservationId} se canceló correctamente.`);
      setReservationToCancel(null);
      setSelectedReservation(null);
      await loadReservations();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setCancelling(false);
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('');
  }

  function openDetails(reservation) {

    setSelectedReservation(reservation);
  }

  function openCancellation(reservation) {

    setSelectedReservation(null);
    setReservationToCancel(reservation);
  }

  function renderStatus(reservation) {
    
    const status = getStatus(reservation);
    const label = statusLabels[status] || status;
    return (
      <span className={`reservation-status ${statusClasses[status] || ''}`}>
        <span />
        {label}
      </span>
    );
  }

  return (
    <div className="reservations-page">
      <header className="reservations-heading">
        <div>
          <span className="reservations-eyebrow">GESTIÓN</span>
          <h1>Reservas</h1>
          <p>
            Consulta las asignaciones y administra las reservas de casilleros.
          </p>
        </div>

        <button type="button" className="reservations-date" onClick={loadReservations}
          disabled={loading} title="Actualizar reservas">
          <RefreshCw size={18} />
          <span>{loading ? 'Actualizando...' : 'Actualizar reservas'}</span>
        </button>
      </header>

      {notice && (
        <div className="reservation-notice" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso">
            <X size={17} />
          </button>
        </div>
      )}

      {error && (
        <div className="reservation-notice reservation-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Cerrar error">
            <X size={17} />
          </button>
        </div>
      )}

      <section className="reservation-stats">
        <article className="reservation-stat">
          <div className="reservation-stat-icon blue">
            <CalendarDays size={21} />
          </div>
          <div>
            <span>Total de reservas</span>
            <strong>{stats.total}</strong>
            <small>Registros de la base de datos</small>
          </div>
        </article>

        <article className="reservation-stat">
          <div className="reservation-stat-icon green">
            <CheckCircle2 size={21} />
          </div>
          <div>
            <span>Reservas vigentes</span>
            <strong>{stats.active}</strong>
            <small>Reservadas o en uso</small>
          </div>
        </article>

        <article className="reservation-stat">
          <div className="reservation-stat-icon red">
            <XCircle size={21} />
          </div>
          <div>
            <span>Canceladas</span>
            <strong>{stats.cancelled}</strong>
            <small>Reservas canceladas</small>
          </div>
        </article>
      </section>

      <section className="reservations-panel">
        <div className="reservations-panel-heading">
          <div>
            <h2>Listado de reservas</h2>
            <p>
              Consulta el estudiante, el casillero, la franja horaria y el estado.
            </p>
          </div>
          <span className="reservations-count">
            {filteredReservations.length} registros
          </span>
        </div>

        <div className="reservations-toolbar">
          <label className="reservation-search">
            <Search size={18} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por correo, reserva o casillero..."/>
          </label>

          <label className="reservation-filter">
            <Filter size={17} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filtrar reservas por estado">
              <option value="all">Todos los estados</option>
              <option value="reservado">Reservadas</option>
              <option value="en_uso">En uso</option>
              <option value="cancelado">Canceladas</option>
              <option value="finalizado">Finalizadas</option>
              <option value="vencido">Vencidas</option>
              <option value="pendiente">Pendientes</option>
            </select>
          </label>

          <label className="reservation-filter reservation-date-filter">
            <CalendarDays size={17} />
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filtrar reservas por fecha"/>
          </label>
        </div>

        <div className="reservations-table-wrapper">
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Reserva</th>
                <th>Estudiante</th>
                <th>Casillero</th>
                <th>Fecha y franja</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filteredReservations.map((reservation) => {
                const id = getReservationId(reservation);
                const student = getStudent(reservation);
                const locker = getLocker(reservation);
                const location = getLocation(reservation);
                const canCancel = reservation.puedeCancelar === true;
                return (
                  <tr key={id}>
                    <td>
                      <span className="reservation-id">{id}</span>
                    </td>

                    <td>
                      <div className="reservation-student">
                        <div className="reservation-avatar">
                          {student.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="reservation-student-info">
                          <strong>{student}</strong>
                          <span>{reservation.usuarioId || 'ID no disponible'}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="reservation-locker">
                        <LockKeyhole size={16} />
                        <div>
                          <strong>{locker}</strong>
                          <span>{location}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="reservation-locker">
                        <Clock3 size={16} />
                        <div>
                          <strong>{formatDate(reservation.fecha)}</strong>
                          <span>{reservation.franja || 'Sin franja'}</span>
                        </div>
                      </div>
                    </td>

                    <td>{renderStatus(reservation)}</td>

                    <td>
                      <div className="reservation-actions">
                        <button type="button" className="reservation-action view" title="Ver detalles"
                          aria-label={`Ver reserva ${id}`} onClick={() => openDetails(reservation)}>
                          <Eye size={17} />
                        </button>

                        {canCancel && (
                          <button type="button" className="reservation-action cancel" title="Cancelar reserva"
                            aria-label={`Cancelar reserva ${id}`} onClick={() => openCancellation(reservation)}>
                            <Ban size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {loading && (
            <div className="reservations-empty">
              <RefreshCw size={28} />
              <strong>Cargando reservas...</strong>
              <p>Consultando la información del servidor.</p>
            </div>
          )}

          {!loading && !error && filteredReservations.length === 0 && (
            <div className="reservations-empty">
              <Search size={28} />
              <strong>No hay reservas que coincidan</strong>
              <p>Prueba otra búsqueda o cambia los filtros.</p>
              <button type="button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        <footer className="reservations-footer">
          <span>
            Mostrando {filteredReservations.length} de {reservations.length} reservas
          </span>
          <span>Datos del servidor</span>
        </footer>
      </section>

      {selectedReservation && (
        <div className="reservation-modal-backdrop"  onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedReservation(null);
          }}}>
          <section className="reservation-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-detail-title">
            <button type="button"  className="reservation-modal-close" onClick={() => setSelectedReservation(null)}
              aria-label="Cerrar">
              <X size={20} />
            </button>

            <div className="reservation-detail-icon">
              <CalendarDays size={25} />
            </div>

            <span className="reservation-detail-eyebrow">
              DETALLE DE RESERVA
            </span>
            <h2 id="reservation-detail-title">
              {getReservationId(selectedReservation)}
            </h2>

            {renderStatus(selectedReservation)}

            <div className="reservation-detail-row">
              <UserRound size={18} />
              <span>Correo del estudiante</span>
              <strong>{getStudent(selectedReservation)}</strong>
            </div>

            <div className="reservation-detail-row">
              <LockKeyhole size={18} />
              <span>Casillero</span>
              <strong>{getLocker(selectedReservation)}</strong>
            </div>

            <div className="reservation-detail-row">
              <MapPin size={18} />
              <span>Zona</span>
              <strong>{getLocation(selectedReservation)}</strong>
            </div>

            <div className="reservation-detail-row">
              <CalendarDays size={18} />
              <span>Fecha</span>
              <strong>{formatDate(selectedReservation.fecha)}</strong>
            </div>

            <div className="reservation-detail-row">
              <Clock3 size={18} />
              <span>Franja</span>
              <strong>{selectedReservation.franja || 'Sin franja'}</strong>
            </div>

            <div className="reservation-detail-row">
              <Clock3 size={18} />
              <span>Inicio del uso</span>
              <strong>{formatDateTime(selectedReservation.inicioUso)}</strong>
            </div>

            <div className="reservation-detail-row">
              <Clock3 size={18} />
              <span>Fin del uso</span>
              <strong>{formatDateTime(selectedReservation.finUso)}</strong>
            </div>

            {selectedReservation.puedeCancelar === true && (
              <button type="button" className="reservation-confirm-cancel"
                onClick={() => openCancellation(selectedReservation)}>
                <Ban size={17} />
                Cancelar reserva
              </button>
            )}

            <button type="button" className="reservation-close-detail" onClick={() => setSelectedReservation(null)}>
              Cerrar
            </button>
          </section>
        </div>
      )}

      {reservationToCancel && (
        <div className="reservation-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !cancelling) {
            setReservationToCancel(null);
          }}} >
          <section className="reservation-modal confirmation-modal" role="alertdialog" aria-modal="true"
            aria-labelledby="cancel-reservation-title">
            <div className="cancel-warning-icon">
              <Ban size={25} />
            </div>

            <h2 id="cancel-reservation-title">¿Cancelar esta reserva?</h2>
            <p>
              Vas a cancelar la reserva{' '}
              <strong>{getReservationId(reservationToCancel)}</strong>,
              correspondiente al casillero{' '}
              <strong>{getLocker(reservationToCancel)}</strong>.
            </p>
            <p className="confirmation-note">
              Esta acción se enviará al servidor. Solo se completará si el
              backend autoriza la cancelación.
            </p>

            <div className="confirmation-actions">
              <button type="button" className="confirmation-back" disabled={cancelling} onClick={() => setReservationToCancel(null)}>
                Volver
              </button>

              <button type="button"  className="confirmation-submit" disabled={cancelling}  onClick={cancelReservation}>
                {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
