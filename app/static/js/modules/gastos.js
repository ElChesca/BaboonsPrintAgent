// static/js/modules/gastos.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState, checkGlobalCashRegisterState } from '../main.js';
import { formatearMoneda } from '../uiHelpers.js';

let gastosCache = [];
const GASTOS_POR_PAGINA = 15;
let gastosPaginaActual = 0;

// Instancias de Chart.js
let chartEvolucion = null;
let chartDistribucion = null;

// Anuncios globales manejados en main.js

export async function inicializarGastos() {    // Configuración de exportación
    window.exportarGastosExcel = (datos) => {
        const datosParaExportar = datos.map(g => ({
            "Fecha": formatearFechaTabla(g.fecha),
            "Categoría": g.categoria || '-',
            "Descripción": g.descripcion || '-',
            "Monto": g.monto,
            "Método de Pago": g.metodo_pago || '-',
            "Estado": g.estado
        }));
        const ws = XLSX.utils.json_to_sheet(datosParaExportar);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Gastos");
        XLSX.writeFile(wb, "Reporte_Gastos.xlsx");
    };

    window.exportarGastosPDF = (datos) => {
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.text("Reporte de Gastos Operativos", 14, 15);
        const head = [["Fecha", "Categoría", "Descripción", "Monto", "Pago", "Estado"]];
        const body = datos.map(g => [formatearFechaTabla(g.fecha), g.categoria || '-', g.descripcion || '-', (g.monto), g.metodo_pago || '-', g.estado]);
        doc.autoTable({ startY: 20, head, body, theme: 'striped' });
        doc.save("Reporte_Gastos.pdf");
    };

    const form = document.getElementById('form-gasto');
    if (form) form.addEventListener('submit', guardarGasto);

    await cargarCategoriasParaDropdown();
    await window.cargarGastos(true);
}

// Helpers de fecha
function formatearFechaInput(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
}

function formatearFechaTabla(isoDate) {
    if (!isoDate) return '-';
    const date = new Date(isoDate);
    return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------
// 📑 CARGA Y RENDERIZADO (CON PAGINACIÓN)
// ---------------------------------------------------------

window.cargarGastos = async function (resetPaging = false) {
    if (!appState.negocioActivoId) return;

    if (resetPaging) {
        gastosPaginaActual = 0;
    }

    const desde = document.getElementById('filtro-gasto-desde').value;
    const hasta = document.getElementById('filtro-gasto-hasta').value;

    try {
        const offset = gastosPaginaActual * GASTOS_POR_PAGINA;
        let url = `/api/negocios/${appState.negocioActivoId}/gastos?limit=${GASTOS_POR_PAGINA}&offset=${offset}`;
        if (desde) url += `&desde=${desde}`;
        if (hasta) url += `&hasta=${hasta}`;

        const res = await fetchData(url);
        gastosCache = res.gastos || [];
        renderizarTablaGastos();
        actualizarPaginacionGastos(res.total || 0);
        window.cargarEstadisticasGastos?.(); // 🔄 Sincronizar gráficos
    } catch (error) {
        mostrarNotificacion('Error al cargar la lista de gastos.', 'error');
    }
}

window.limpiarFiltrosGastos = () => {
    document.getElementById('filtro-gasto-desde').value = '';
    document.getElementById('filtro-gasto-hasta').value = '';
    window.cargarGastos(true);
};

function renderizarTablaGastos() {
    const tbody = document.querySelector('#tabla-gastos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (gastosCache.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron gastos registrados.</td></tr>';
        return;
    }

    gastosCache.forEach(g => {
        const tr = document.createElement('tr');
        if (g.estado === 'Anulado') tr.classList.add('table-light', 'text-muted');

        tr.innerHTML = `
            <td class="ps-3 fw-bold small">${formatearFechaTabla(g.fecha)}</td>
            <td><span class="badge bg-light text-dark border">${g.categoria || 'Sin Cat.'}</span></td>
            <td class="small text-truncate" style="max-width: 200px;" title="${g.descripcion || ''}">${g.descripcion || '-'}</td>
            <td class="fw-bold">${formatearMoneda(g.monto)}</td>
            <td class="small text-muted italic">${g.metodo_pago || '-'}</td>
            <td>
                <span class="badge ${g.estado === 'Pagado' ? 'bg-success' : (g.estado === 'Pendiente' ? 'bg-warning text-dark' : 'bg-danger')}">
                    ${g.estado.toUpperCase()}
                </span>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm">
                    ${g.estado !== 'Anulado' ? `
                        <button class="btn btn-outline-primary" title="Editar" onclick="window.editarGasto(${g.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" title="Anular" onclick="window.anularGasto(${g.id})">
                            <i class="fas fa-ban"></i>
                        </button>
                    ` : '<span class="text-danger small fw-bold">ANULADO</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function actualizarPaginacionGastos(totalItems) {
    const container = document.getElementById('paginacion-gastos');
    if (!container) return;

    const totalPaginas = Math.ceil(totalItems / GASTOS_POR_PAGINA);

    if (totalPaginas <= 1) {
        container.style.setProperty('display', 'none', 'important');
        return;
    }

    container.style.setProperty('display', 'flex', 'important');
    document.getElementById('label-pagina-gastos').textContent = `Página ${gastosPaginaActual + 1} de ${totalPaginas}`;

    document.getElementById('btn-prev-gastos').disabled = (gastosPaginaActual === 0);
    document.getElementById('btn-next-gastos').disabled = (gastosPaginaActual >= totalPaginas - 1);
}

window.cambiarPaginaGastos = (delta) => {
    gastosPaginaActual += delta;
    if (gastosPaginaActual < 0) gastosPaginaActual = 0;
    window.cargarGastos(false);
}

// ---------------------------------------------------------
// 💎 MODAL PREMIUM Y CRUD
// ---------------------------------------------------------

window.abrirModalGasto = () => {
    resetFormularioGastos();
    document.getElementById('modal-gasto-titulo').innerHTML = '<i class="fas fa-plus-circle me-2"></i> Nuevo Gasto';
    document.getElementById('btn-save-gasto-text').textContent = 'Guardar Gasto';
    document.getElementById('modal-gasto').style.display = 'flex';
};

window.cerrarModalGasto = () => {
    document.getElementById('modal-gasto').style.display = 'none';
};

function resetFormularioGastos() {
    const form = document.getElementById('form-gasto');
    if (form) form.reset();
    document.getElementById('gasto-id').value = '';
    document.getElementById('estado-pagado').checked = true;
    document.getElementById('gasto-fecha').value = formatearFechaInput(new Date());
}

async function guardarGasto(e) {
    e.preventDefault();
    const id = document.getElementById('gasto-id').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value);
    const metodoPago = document.getElementById('gasto-metodo-pago').value;
    const estado = document.querySelector('input[name="gasto-estado"]:checked').value;

    // Validación de Caja Abierta para Efectivo Pagado
    if (estado === 'Pagado' && metodoPago === 'Efectivo') {
        if (!appState.cajaSesionIdActiva) {
            await checkGlobalCashRegisterState();
        }
        if (!appState.cajaSesionIdActiva) {
            mostrarNotificacion('🚫 No se puede registrar un gasto en EFECTIVO si la caja está cerrada.', 'error');
            return;
        }
    }

    if (isNaN(monto) || monto <= 0) {
        mostrarNotificacion('El monto debe ser un número positivo.', 'error');
        return;
    }

    const data = {
        categoria_gasto_id: document.getElementById('gasto-categoria').value,
        fecha: document.getElementById('gasto-fecha').value,
        monto: monto,
        descripcion: document.getElementById('gasto-descripcion').value,
        metodo_pago: metodoPago,
        estado: estado,
        caja_sesion_id: (metodoPago === 'Efectivo') ? appState.cajaSesionIdActiva : null
    };

    const method = id ? 'PUT' : 'POST';
    const url = id
        ? `/api/negocios/${appState.negocioActivoId}/gastos/${id}`
        : `/api/negocios/${appState.negocioActivoId}/gastos`;

    try {
        await sendData(url, data, method);
        mostrarNotificacion(`Gasto ${id ? 'actualizado' : 'registrado'} correctamente.`, 'success');
        cerrarModalGasto();
        window.cargarGastos(true);
    } catch (error) {
        mostrarNotificacion(error.message || 'Error al guardar gasto.', 'error');
    }
}

window.editarGasto = (id) => {
    const g = gastosCache.find(item => item.id === id);
    if (!g) return;

    document.getElementById('gasto-id').value = g.id;
    document.getElementById('gasto-fecha').value = formatearFechaInput(g.fecha);
    document.getElementById('gasto-categoria').value = g.categoria_gasto_id;
    document.getElementById('gasto-monto').value = g.monto;
    document.getElementById('gasto-descripcion').value = g.descripcion || '';
    document.getElementById('gasto-metodo-pago').value = g.metodo_pago;

    if (g.estado === 'Pagado') document.getElementById('estado-pagado').checked = true;
    else if (g.estado === 'Pendiente') document.getElementById('estado-pendiente').checked = true;

    document.getElementById('modal-gasto-titulo').innerHTML = '<i class="fas fa-edit me-2 text-primary"></i> Editar Gasto';
    document.getElementById('btn-save-gasto-text').textContent = 'Actualizar Gasto';
    document.getElementById('modal-gasto').style.display = 'flex';
};

window.anularGasto = async (id) => {
    if (!confirm('¿Confirma que desea anular este gasto? Esta acción es irreversible.')) return;

    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/gastos/anular/${id}`, {}, 'PUT');
        mostrarNotificacion('Gasto anulado.', 'success');
        window.cargarGastos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
};

// ---------------------------------------------------------
// 📊 GRÁFICOS Y ESTADÍSTICAS
// ---------------------------------------------------------

window.cargarEstadisticasGastos = async () => {
    if (!appState.negocioActivoId) return;
    const desde = document.getElementById('filtro-gasto-desde')?.value;
    const hasta = document.getElementById('filtro-gasto-hasta')?.value;
    try {
        let url = `/api/negocios/${appState.negocioActivoId}/gastos/stats`;
        const p = [];
        if (desde) p.push(`desde=${desde}`);
        if (hasta) p.push(`hasta=${hasta}`);
        if (p.length) url += `?${p.join('&')}`;
        const stats = await fetchData(url);

        // Sumar total mes actual para la KPI
        const porCategoria = stats.por_categoria || [];
        const totalMes = porCategoria.reduce((acc, curr) => acc + curr.value, 0);
        document.getElementById('stat-gasto-mes-actual').textContent = formatearMoneda(totalMes);

        renderizarGraficosGastos(stats);
        renderizarRankingGastos(porCategoria);
    } catch (error) {
        console.error(error);
        mostrarNotificacion('No se pudieron cargar las estadísticas.', 'warning');
    }
};

function renderizarGraficosGastos(stats) {
    // 🟣 Gráfico de Evolución Mensual (Últimos 6 meses reales)
    const ctxEvolucion = document.getElementById('chart-evolucion-gastos');
    if (!ctxEvolucion) return;

    if (chartEvolucion) chartEvolucion.destroy();

    const dataPoints = [];
    const labels = [];
    const agrupacion = stats.agrupacion || 'mes';

    if (stats.evolucion && stats.evolucion.length > 0) {
        stats.evolucion.forEach(e => {
            labels.push(agrupacion === 'dia' ? e.mes.split('-').reverse().slice(0, 2).join('/') : e.mes.split('-').reverse().join('/'));
            dataPoints.push(e.total);
        });
    }

    const ctx = ctxEvolucion.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(41, 128, 185, 0.4)');
    gradient.addColorStop(1, 'rgba(41, 128, 185, 0)');

    chartEvolucion = new Chart(ctxEvolucion, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Pesos (AR$)',
                data: dataPoints,
                borderColor: '#2980b9',
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#2980b9',
                pointBorderWidth: 3,
                borderWidth: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` Total: ${formatearMoneda(c.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f0f0' },
                    ticks: { callback: (v) => formatearMoneda(v) }
                },
                x: { grid: { display: false } }
            }
        }
    });

    // 🟠 Gráfico de Distribución por Categoría (Estilo original restaurado)
    const ctxDistribucion = document.getElementById('chart-distribucion-gastos');
    if (!ctxDistribucion) return;
    if (chartDistribucion) chartDistribucion.destroy();

    const porCategoria = stats.por_categoria || [];

    chartDistribucion = new Chart(ctxDistribucion, {
        type: 'doughnut',
        data: {
            labels: porCategoria.map(c => c.label),
            datasets: [{
                data: porCategoria.map(c => c.value),
                backgroundColor: ['#2980b9', '#f39c12', '#27ae60', '#e74c3c', '#8e44ad', '#34495e', '#d35400', '#16a085', '#2c3e50', '#7f8c8d', '#bdc3c7', '#1abc9c'],
                hoverOffset: 15,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    display: true, // Siempre visible como pediste
                    position: 'bottom',
                    labels: { boxWidth: 10, font: { size: 9 }, padding: 10 }
                }
            }
        }
    });
}

function renderizarRankingGastos(porCategoria) {
    const list = document.getElementById('lista-ranking-gastos');
    if (!list) return;

    list.innerHTML = '';
    if (!porCategoria || porCategoria.length === 0) {
        list.innerHTML = '<li class="list-group-item text-center py-4 text-muted small italic">Sin datos</li>';
        return;
    }

    // Estilo más sencillo como la versión anterior
    porCategoria.slice(0, 5).forEach(c => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center border-0 py-2';
        item.innerHTML = `
            <div>
                <span class="fw-bold">${c.label}</span>
                <div class="small text-muted">Aporte al mes actual</div>
            </div>
            <span class="badge bg-primary rounded-pill p-2 px-3">${formatearMoneda(c.value)}</span>
        `;
        list.appendChild(item);
    });
}

// ---------------------------------------------------------
// 🚀 INICIALIZACIÓN
// ---------------------------------------------------------

async function cargarCategoriasParaDropdown() {
    const select = document.getElementById('gasto-categoria');
    if (!select || !appState.negocioActivoId) return;

    try {
        const categorias = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias_gasto/activas`);
        select.innerHTML = '<option value="">Seleccione Categoría...</option>';
        categorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.descripcion}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('Error al cargar categorías.', 'error');
    }
}

