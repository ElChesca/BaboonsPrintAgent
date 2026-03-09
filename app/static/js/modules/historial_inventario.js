// static/js/modules/historial_inventario.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// Variables de paginación
let currentOffset = 0;
const PAGE_SIZE = 50;
let historialActual = [];

// --- Funciones de Renderizado y Carga ---

/**
 * ✨ FIX: Formateo de fecha real (D/M/AAAA HH:mm)
 */
function formatDateTime(isoString) {
    if (!isoString) return '-';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // Fallback si no es fecha válida

        return date.toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
}

function getMovimientoInfo(tipo) {
    const map = {
        'Venta': { class: 'bg-venta', icon: 'fa-shopping-cart' },
        'Ingreso': { class: 'bg-ingreso', icon: 'fa-plus-circle' },
        'Ajuste': { class: 'bg-ajuste', icon: 'fa-sliders-h' },
        'Reserva Pedido': { class: 'bg-reserva', icon: 'fa-box' }
    };
    return map[tipo] || { class: 'bg-secondary text-white', icon: 'fa-info-circle' };
}

function renderizarHistorial(historial, append = false) {
    const tbody = document.querySelector('#tabla-historial-inventario tbody');
    if (!tbody) return;

    if (!append) {
        tbody.innerHTML = '';
        historialActual = historial || [];
    } else {
        if (historial) historialActual = [...historialActual, ...historial];
    }

    if (historialActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
            <i class="fas fa-search fa-2x mb-3" style="display:block; opacity:0.3;"></i>
            No se encontraron movimientos de inventario.
        </td></tr>`;
        return;
    }

    const dataRows = append ? historial : historialActual;
    dataRows.forEach(mov => {
        const info = getMovimientoInfo(mov.tipo_movimiento);
        const cantidadVal = parseFloat(mov.cantidad_cambio) || 0;
        const cantidadClass = cantidadVal > 0 ? 'pos' : (cantidadVal < 0 ? 'neg' : '');
        const cantidadTexto = cantidadVal > 0 ? `+${cantidadVal}` : cantidadVal;

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold">${formatDateTime(mov.fecha_movimiento)}</td>
                <td>
                    <div style="font-weight:600;">${mov.producto_nombre}</div>
                    <div style="font-size:0.75rem; color:#94a3b8;">ID: ${mov.producto_id}</div>
                </td>
                <td>
                    <span class="badge-mov ${info.class}">
                        <i class="fas ${info.icon}"></i> ${mov.tipo_movimiento}
                    </span>
                    <div style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">${mov.motivo || '-'}</div>
                </td>
                <td style="text-align:center;">
                    ${mov.hoja_ruta_id ? `<span class="id-badge bg-light">#${mov.hoja_ruta_id}</span>` : '<span style="color:#cbd5e1;">-</span>'}
                </td>
                <td style="text-align:center;">
                    ${mov.pedido_id ? `<span class="id-badge bg-light">#${mov.pedido_id}</span>` : '<span style="color:#cbd5e1;">-</span>'}
                </td>
                <td style="text-align:right;">
                    <span class="cantidad-badge ${cantidadClass}">${cantidadTexto}</span>
                </td>
                <td style="text-align:right; font-weight:600;">
                    ${mov.stock_resultante !== null ? mov.stock_resultante : '<span style="color:#cbd5e1;">-</span>'}
                </td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i class="fas fa-user-circle" style="color:#cbd5e1;"></i>
                        <span>${mov.usuario_nombre || 'Sistema'}</span>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function cargarHistorial(append = false) {
    if (!appState.negocioActivoId) return;

    const loadingIndicator = document.getElementById('loading-indicator');
    const btnCargarMas = document.getElementById('btn-cargar-mas');

    if (!append) {
        currentOffset = 0;
    }

    const fechaDesde = document.getElementById('filtro-fecha-desde').value;
    const fechaHasta = document.getElementById('filtro-fecha-hasta').value;
    const productoId = document.getElementById('filtro-producto').value;
    const tipoMov = document.getElementById('filtro-tipo') ? document.getElementById('filtro-tipo').value : '';

    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (productoId) params.append('producto_id', productoId);
    if (tipoMov) params.append('tipo', tipoMov);
    params.append('limit', PAGE_SIZE);
    params.append('offset', currentOffset);

    const url = `/api/negocios/${appState.negocioActivoId}/historial_inventario?${params.toString()}`;

    console.log("🔍 [InvHistorial] Fetching from:", url);
    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (btnCargarMas) btnCargarMas.disabled = true;

        const historial = await fetchData(url);
        console.log("✅ [InvHistorial] Data received:", historial);

        renderizarHistorial(historial, append);

        if (historial && historial.length === PAGE_SIZE) {
            if (btnCargarMas) btnCargarMas.style.display = 'block';
        } else {
            if (btnCargarMas) btnCargarMas.style.display = 'none';
        }

        currentOffset += (historial ? historial.length : 0);

    } catch (error) {
        console.error("Error cargando historial:", error);
        mostrarNotificacion(`Error: ${error.message}`, 'error');
        if (!append) renderizarHistorial(null);
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (btnCargarMas) btnCargarMas.disabled = false;
    }
}

async function cargarProductosFiltro() {
    const selectProducto = document.getElementById('filtro-producto');
    if (!selectProducto || !appState.negocioActivoId) return;
    try {
        const productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        // Limpiar pero mantener el primero
        selectProducto.innerHTML = '<option value="">-- Todos los Productos --</option>';
        productos.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            selectProducto.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
    } catch (error) {
        console.error("Error al cargar productos para filtro:", error);
    }
}

function exportarTablaAPDF(nombreArchivo, titulo) {
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        mostrarNotificacion('Error: La librería jsPDF no está cargada.', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    if (typeof doc.autoTable !== 'function') {
        mostrarNotificacion('Error: La extensión jsPDF AutoTable no está cargada.', 'error');
        return;
    }

    doc.setFontSize(18);
    doc.text(titulo, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

    try {
        doc.autoTable({
            html: '#tabla-historial-inventario',
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], fontSize: 9 }, // Azul Pro
            styles: { fontSize: 8 }
        });
        doc.save(`${nombreArchivo}.pdf`);
    } catch (error) {
        mostrarNotificacion('Error al generar el PDF: ' + error.message, 'error');
    }
}

function exportarTablaAExcel(nombreArchivo) {
    if (typeof window.XLSX === 'undefined') {
        mostrarNotificacion('Error: La librería XLSX no está cargada.', 'error');
        return;
    }

    if (historialActual.length === 0) {
        mostrarNotificacion('No hay datos para exportar.', 'warning');
        return;
    }

    try {
        const datosParaExportar = historialActual.map(mov => ({
            'Fecha y Hora': formatDateTime(mov.fecha_movimiento),
            Producto: mov.producto_nombre,
            Movimiento: mov.tipo_movimiento,
            'Hoja Ruta': mov.hoja_ruta_id || '-',
            Pedido: mov.pedido_id || '-',
            Motivo: mov.motivo || '-',
            'Cantidad Cambio': mov.cantidad_cambio,
            'Stock Resultante': mov.stock_resultante,
            'Usuario Responsable': mov.usuario_nombre || 'Sistema'
        }));

        const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Historial Inv");
        XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
    } catch (error) {
        mostrarNotificacion('Error al generar Excel: ' + error.message, 'error');
    }
}

export async function inicializarHistorialInventario() {
    const btnFiltrar = document.getElementById('btn-filtrar-historial');
    const btnPDF = document.getElementById('btn-exportar-pdf');
    const btnExcel = document.getElementById('btn-exportar-excel');
    const btnCargarMas = document.getElementById('btn-cargar-mas');

    if (btnFiltrar) btnFiltrar.addEventListener('click', () => cargarHistorial(false));
    if (btnPDF) btnPDF.addEventListener('click', () => exportarTablaAPDF('historial_inventario', 'Historial de Inventario'));
    if (btnExcel) btnExcel.addEventListener('click', () => exportarTablaAExcel('historial_inventario'));
    if (btnCargarMas) btnCargarMas.addEventListener('click', () => cargarHistorial(true));

    await cargarProductosFiltro();
    await cargarHistorial(false);
}