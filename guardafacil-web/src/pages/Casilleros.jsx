
import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Grid2X2, List, LockKeyhole, CheckCircle2, Wrench, X, MapPin, UserRound, CalendarDays,} from 'lucide-react';
import api from '../services/api';
import './Casilleros.css';

const statusInfo = {
  available: {
    label: 'Disponible',
    icon: CheckCircle2,
  },
  reserved: {
    label: 'No disponible',
    icon: LockKeyhole,
  },
  maintenance: {
    label: 'Mantenimiento',
    icon: Wrench,
  },
};

function normalizarEstado(casillero) {

  const estado = String( casillero.estado ?? casillero.status ?? '' ).trim().toLowerCase();
  if ( casillero.mantenimiento === true || estado.includes('mantenimiento') || estado.includes('maintenance')) {
    return 'maintenance';
  }
  if (['reservado', 'reservada', 'ocupado', 'ocupada', 'reserved', 'occupied'] .includes(estado)) {
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
    id: String(casillero.id),
    code: String( casillero.numero ?? casillero.codigo ?? casillero.id),
    zoneId: String(zona.id),
    location: zona.nombre || `Zona ${zona.id}`,
    status: normalizarEstado(casillero),
    user: casillero.usuarioNombre ?? casillero.usuarioEmail ?? null,
    size: casillero.tamano ?? casillero.tamaño ?? null,
    raw: casillero,
  };
}

export default function Casilleros() {

  const [lockers, setLockers] = useState([]);
  const [zones, setZones] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedLocker, setSelectedLocker] = useState(null);
  const [view, setView] = useState('grid');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    async function cargarInventario() {
      setLoading(true);
      setError('');
      try {
        const respuestaZonas = await api.get('/zonas');
        const zonasRecibidas = Array.isArray(respuestaZonas.data) ? respuestaZonas.data : [];
        const resultados = await Promise.all( zonasRecibidas.map(async (zona) => {
            const respuesta = await api.get( `/zonas/${encodeURIComponent(zona.id)}/casilleros`);
            const casillerosZona = Array.isArray(respuesta.data) ? respuesta.data : [];
            return casillerosZona.map((casillero) =>
              normalizarCasillero(casillero, zona)
            );
          })
        );
        if (!activo) return;
        setZones(zonasRecibidas);
        setLockers(resultados.flat());
      } catch (err) {
        if (!activo) return;
        setError( err.response?.data?.error?.mensaje ||
          'No fue posible cargar los casilleros. Comprueba tu sesión y la conexión con el servidor.');
      } finally {
        if (activo) setLoading(false);
      }
    }
    cargarInventario();
    return () => {
      activo = false;
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: lockers.length,
      available: lockers.filter( (locker) => locker.status === 'available').length,
      reserved: lockers.filter( (locker) => locker.status === 'reserved').length,
      maintenance: lockers.filter( (locker) => locker.status === 'maintenance').length,
    }),
    [lockers]
  );

  const locations = useMemo( () => [...new Set(lockers.map((locker) => locker.location))], [lockers]);

  const filteredLockers = useMemo( () =>
      lockers.filter((locker) => {
        const term = search.trim().toLowerCase();
        const matchesSearch = locker.code.toLowerCase().includes(term) || locker.id.toLowerCase().includes(term) ||
          locker.location.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all' || locker.status === statusFilter;
        const matchesLocation = locationFilter === 'all' || locker.location === locationFilter;
        return matchesSearch && matchesStatus && matchesLocation;
      }),
    [lockers, search, statusFilter, locationFilter]
  );

  function mostrarIndicacionReserva() {
    setNotice( 'Para reservar este casillero, utiliza la sección Reservas y selecciona la fecha y la franja horaria.');
  }

  return (
    <div className="lockers-page">
      <header className="lockers-heading">
        <div>
          <div className="lockers-eyebrow">INVENTARIO</div>
          <h1>Casilleros</h1>
          <p>
            Consulta la disponibilidad y los detalles de cada casillero.
          </p>
        </div>

        <div className="inventory-badge">
          <Grid2X2 size={18} />
          {stats.total} casilleros registrados
        </div>
      </header>

      {notice && (
        <div className="locker-notice" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button  onClick={() => setNotice('')} aria-label="Cerrar aviso">
            <X size={17} />
          </button>
        </div>
      )}

      {error && (
        <div className="locker-notice" role="alert">
          <span>{error}</span>
          <button onClick={() => window.location.reload()} aria-label="Volver a cargar">
            Reintentar
          </button>
        </div>
      )}

      <section className="locker-summary">
        {[ { key: 'total', label: 'Total', icon: Grid2X2, color: 'blue' },
          { key: 'available', label: 'Disponibles', icon: CheckCircle2, color: 'green',
          },
          { key: 'reserved', label: 'No disponibles', icon: LockKeyhole, color: 'red',
          },
          { key: 'maintenance', label: 'Mantenimiento', icon: Wrench, color: 'orange',
          },
        ].map(({ key, label, icon: Icon, color }) => (
          <article className="locker-summary-card" key={key}>
            <div className={`locker-summary-icon ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <span>{label}</span>
              <strong>{stats[key]}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="locker-inventory">
        <div className="inventory-heading">
          <div>
            <h2>Inventario general</h2>
            <p>
              Selecciona un casillero para consultar su información.
            </p>
          </div>

          <div className="view-toggle">
            <button className={view === 'grid' ? 'view-active' : ''} onClick={() => setView('grid')}
              aria-label="Vista de cuadrícula" title="Vista de cuadrícula">
              <Grid2X2 size={18} />
            </button>
            <button className={view === 'list' ? 'view-active' : ''} onClick={() => setView('list')}
              aria-label="Vista de lista" title="Vista de lista">
              <List size={18} />
            </button>
          </div>
        </div>

        <div className="inventory-filters">
          <label className="inventory-search">
            <Search size={18} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código..."/>
          </label>

          <label className="inventory-select">
            <SlidersHorizontal size={17} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por estado">
              <option value="all">Todos los estados</option>
              <option value="available">Disponibles</option>
              <option value="reserved">No disponibles</option>
              <option value="maintenance">Mantenimiento</option>
            </select>
          </label>

          <label className="inventory-select">
            <MapPin size={17} />
            <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filtrar por zona">
              <option value="all">Todas las zonas</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="inventory-legend">
          {Object.entries(statusInfo).map(([key, value]) => {
            const Icon = value.icon;
            return (
              <button key={key} className={`legend-item ${ statusFilter === key ? 'legend-selected' : ''}`}
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}>
                <Icon size={16} />
                {value.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="inventory-empty">
            <Grid2X2 size={28} />
            <strong>Cargando casilleros...</strong>
            <p>Consultando el inventario del servidor.</p>
          </div>
        ) : (
          <>
            <div className={`inventory-grid ${ view === 'list' ? 'inventory-list' : '' }`}>
              {filteredLockers.map((locker) => {
                const Icon = statusInfo[locker.status].icon;
                return (
                  <button key={`${locker.zoneId}-${locker.id}`} className={`inventory-locker locker-state-${locker.status} ${
                    selectedLocker?.zoneId === locker.zoneId && selectedLocker?.id === locker.id ? 'inventory-locker-selected'
                      : ''}`} onClick={() => setSelectedLocker(locker)}>
                    <div className="inventory-locker-top">
                      <span>{locker.code}</span>
                      <Icon size={18} />
                    </div>
                    <div className="inventory-locker-body">
                      <div className="inventory-locker-door">
                        <span />
                      </div>
                    </div>
                    <div className="inventory-locker-bottom">
                      <span>{locker.location}</span>
                      <span className="inventory-status-label">
                        {statusInfo[locker.status].label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredLockers.length === 0 && (
              <div className="inventory-empty">
                <Search size={28} />
                <strong>
                  {lockers.length === 0 ? 'No hay casilleros registrados' : 'No encontramos casilleros'}
                </strong>
                <p>
                  {lockers.length === 0 ? 'Comprueba que existan casilleros dentro de tus zonas en Firebase.'  : 'Prueba con otro código o cambia los filtros.'}
                </p>
                <button onClick={() => { setSearch(''); setStatusFilter('all'); setLocationFilter('all');}}>
                  Limpiar filtros
                </button>
              </div>
            )}
          </>
        )}

        <footer className="inventory-footer">
          <span>
            Mostrando <strong>{filteredLockers.length}</strong> de{' '}
            {lockers.length} casilleros
          </span>
          <span>Inventario conectado al servidor</span>
        </footer>
      </section>

      {selectedLocker && (
        <div className="inventory-modal-backdrop" onClick={() => setSelectedLocker(null)}>
          <section className="inventory-modal" role="dialog" aria-modal="true"
            aria-labelledby="inventory-modal-title" onClick={(event) => event.stopPropagation()}>
            <button className="inventory-modal-close" onClick={() => setSelectedLocker(null)} aria-label="Cerrar detalles">
              <X size={20} />
            </button>

            <div className={`inventory-modal-icon ${selectedLocker.status}`}>
              {(() => {
                const Icon = statusInfo[selectedLocker.status].icon;
                return <Icon size={27} />;
              })()}
            </div>
            <span className="inventory-modal-overline">
              DETALLE DEL CASILLERO
            </span>
            <h2 id="inventory-modal-title">{selectedLocker.code}</h2>
            <span className={`inventory-modal-status ${selectedLocker.status}`}>
              {statusInfo[selectedLocker.status].label}
            </span>

            <div className="inventory-detail-row">
              <MapPin size={18} />
              <span>Zona</span>
              <strong>{selectedLocker.location}</strong>
            </div>

            <div className="inventory-detail-row">
              <UserRound size={18} />
              <span>Usuario</span>
              <strong>{selectedLocker.user || 'Sin asignar'}</strong>
            </div>

            <div className="inventory-detail-row">
              <CalendarDays size={18} />
              <span>Tamaño</span>
              <strong>{selectedLocker.size || 'No especificado'}</strong>
            </div>

            {selectedLocker.status === 'available' && (
              <button className="inventory-reserve-button" onClick={mostrarIndicacionReserva}>
                Consultar cómo reservar
              </button>
            )}

            <button className="inventory-close-button" onClick={() => setSelectedLocker(null)}>
              Cerrar detalles
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
