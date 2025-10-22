// static/js/modules/historial_inventario.js
import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// Variable global para guardar los datos actuales de la tabla
let historialActual = [];

// --- Funciones de Renderizado y Carga ---
function formatDateTime(isoString) { /* ... (igual que antes) ... */ }

function renderizarHistorial(historial) {
    const tbody = document.querySelector('#tabla-historial-inventario tbody');
    historialActual = historial || []; // Guarda los datos para exportar
    if (!tbody) return;
    tbody.innerHTML = '';
    if (historialActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay movimientos.</td></tr>`; // Ajusta colspan
        return;
    }
    historialActual.forEach(mov => {
        const cantidadClass = mov.cantidad_cambio > 0 ? 'cantidad-positiva' : (mov.cantidad_cambio < 0 ? 'cantidad-negativa' : '');
        const cantidadTexto = mov.cantidad_cambio > 0 ? `+${mov.cantidad_cambio}` : mov.cantidad_cambio;
        tbody.innerHTML += `
            <tr>
                <td>${formatDateTime(mov.fecha_movimiento)}</td>
                <td>${mov.producto_nombre} <small style="color: grey;">(ID: ${mov.producto_id})</small></td>
                <td>${mov.tipo_movimiento}</td>
                <td class="${cantidadClass}">${cantidadTexto}</td>
                <td>${mov.stock_resultante !== null ? mov.stock_resultante : '-'}</td>
                <td>${mov.usuario_nombre || '-'}</td> </tr>
        `;
    });
}

async function cargarHistorial() {
    if (!appState.negocioActivoId) { renderizarHistorial([]); return; }

    // ✨ Leemos los filtros ✨
    const fechaDesde = document.getElementById('filtro-fecha-desde').value;
    const fechaHasta = document.getElementById('filtro-fecha-hasta').value;
    const productoId = document.getElementById('filtro-producto').value;

    // Construimos la URL con parámetros de query
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (productoId) params.append('producto_id', productoId);

    const url = `/api/negocios/${appState.negocioActivoId}/historial_inventario?${params.toString()}`;

    try {
        const historial = await fetchData(url);
        renderizarHistorial(historial);
    } catch (error) {
        mostrarNotificacion(`Error al cargar historial: ${error.message}`, 'error');
        renderizarHistorial(null);
    }
}

// ✨ NUEVO: Cargar productos en el selector de filtro ✨
async function cargarProductosFiltro() {
     const selectProducto = document.getElementById('filtro-producto');
     if (!selectProducto || !appState.negocioActivoId) return;
     try {
         const productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
         productos.forEach(p => {
             selectProducto.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
         });
     } catch (error) {
         console.error("Error al cargar productos para filtro:", error);
     }
}

// --- Funciones de Exportación (Reutilizables) ---

function exportarTablaAPDF(nombreArchivo, titulo) {
    if (typeof jsPDF === 'undefined' || typeof jsPDF.autoTable === 'undefined') {
        mostrarNotificacion('Error: Librería PDF no cargada.', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text(titulo, 14, 16);
    doc.autoTable({
        html: '#tabla-historial-inventario', // Usa el ID de tu tabla
        startY: 22,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] } // Azul oscuro
    });
    doc.save(`${nombreArchivo}.pdf`);
}

function exportarTablaAExcel(nombreArchivo) {
     if (typeof XLSX === 'undefined') {
        mostrarNotificacion('Error: Librería Excel no cargada.', 'error');
        return;
    }
    // Convertimos los datos actuales a un formato que XLSX entienda
    const datosParaExportar = historialActual.map(mov => ({
        Fecha: formatDateTime(mov.fecha_movimiento),
        Producto: mov.producto_nombre,
        Movimiento: mov.tipo_movimiento,
        Cantidad: mov.cantidad_cambio,
        'Stock Resultante': mov.stock_resultante,
        Usuario: mov.usuario_nombre || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(datosParaExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");
    XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
}

// --- Inicialización ---

export async function inicializarHistorialInventario() { // La hacemos async
    const btnFiltrar = document.getElementById('btn-filtrar-historial');
    const btnPDF = document.getElementById('btn-exportar-pdf');
    const btnExcel = document.getElementById('btn-exportar-excel');

    if (btnFiltrar) btnFiltrar.addEventListener('click', cargarHistorial);
    if (btnPDF) btnPDF.addEventListener('click', () => exportarTablaAPDF('historial_inventario', 'Historial de Inventario'));
    if (btnExcel) btnExcel.addEventListener('click', () => exportarTablaAExcel('historial_inventario'));

    // ✨ Cargamos productos para el filtro y luego el historial ✨
    await cargarProductosFiltro(); 
    cargarHistorial(); 
}