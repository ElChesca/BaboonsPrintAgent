import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

// Variables para los elementos del DOM
let filtroFechaDesde, filtroFechaHasta, filtroUsuario, btnFiltrar, btnExportarPDF, tablaBody;
let reporteCache = []; // Guardamos los datos actuales para exportar

async function poblarFiltroUsuarios() {
    try {
        const usuarios = await fetchData('/api/usuarios');
        filtroUsuario.innerHTML = '<option value="">Todos</option>'; // Reset
        usuarios.forEach(user => {
            filtroUsuario.innerHTML += `<option value="${user.id}">${user.nombre}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los usuarios para el filtro.', 'error');
    }
}

async function cargarReporte() {
    const params = new URLSearchParams();
    if (filtroFechaDesde.value) params.append('fecha_desde', filtroFechaDesde.value);
    if (filtroFechaHasta.value) params.append('fecha_hasta', filtroFechaHasta.value);
    if (filtroUsuario.value) params.append('usuario_id', filtroUsuario.value);
    
    try {
        const url = `/api/negocios/${appState.negocioActivoId}/reportes/caja?${params.toString()}`;
        reporteCache = await fetchData(url); // Ya usa fetchData, no necesita cambio.
        renderizarTabla();
    } catch (error) {
        mostrarNotificacion('Error al cargar el reporte: ' + error.message, 'error');
    }
}

function renderizarTabla() {
    tablaBody.innerHTML = '';
    if (reporteCache.length === 0) {        
        tablaBody.innerHTML = '<tr><td colspan="8">No se encontraron registros...</td></tr>';      
        return;
    }
    reporteCache.forEach(sesion => {
        const diferenciaClass = sesion.diferencia < 0 ? 'diferencia-negativa' : (sesion.diferencia > 0 ? 'diferencia-positiva' : '');
        const fila = `
            <tr>
                <td>${new Date(sesion.fecha_apertura).toLocaleString('es-AR')}</td>
                <td>${new Date(sesion.fecha_cierre).toLocaleString('es-AR')}</td>
                <td>${sesion.usuario_nombre}</td>
                <td>$${sesion.monto_inicial.toFixed(2)}</td>
                <td>$${sesion.monto_final_esperado.toFixed(2)}</td>
                <td>$${sesion.monto_final_contado.toFixed(2)}</td>
                <td class="${diferenciaClass}">$${sesion.diferencia.toFixed(2)}</td>
                
                <td><button class="btn-secondary btn-small" onclick="mostrarDetallesCaja(${sesion.id})">Ver</button></td>
            </tr>
        `;
        tablaBody.innerHTML += fila;
    });
  
}

function exportarAPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Reporte de Cierres de Caja", 14, 16);
    doc.autoTable({
        head: [['Apertura', 'Cierre', 'Usuario', 'Inicial', 'Esperado', 'Contado', 'Diferencia']],
        body: reporteCache.map(s => [
            new Date(s.fecha_apertura).toLocaleString('es-AR'),
            new Date(s.fecha_cierre).toLocaleString('es-AR'),
            s.usuario_nombre,
            `$${s.monto_inicial.toFixed(2)}`,
            `$${s.monto_final_esperado.toFixed(2)}`,
            `$${s.monto_final_contado.toFixed(2)}`,
            `$${s.diferencia.toFixed(2)}`
        ]),
        startY: 20,
    });

    doc.save(`reporte_caja_${new Date().toISOString().slice(0,10)}.pdf`);
}

export function inicializarLogicaReporteCaja() {
    filtroFechaDesde = document.getElementById('filtro-fecha-desde-caja');
    filtroFechaHasta = document.getElementById('filtro-fecha-hasta-caja');
    filtroUsuario = document.getElementById('filtro-usuario-caja');
    btnFiltrar = document.getElementById('btn-filtrar-caja');
    btnExportarPDF = document.getElementById('btn-exportar-caja-pdf');
    tablaBody = document.querySelector('#tabla-reporte-caja tbody');

    // Verificación de existencia de elementos para evitar errores fatales.
    if (!filtroUsuario || !btnFiltrar || !btnExportarPDF || !tablaBody) {
        console.error('Faltan elementos esenciales en la página de reporte de caja.');
        mostrarNotificacion('Error al inicializar la página.', 'error');
        return; // Detiene la ejecución para prevenir el crash.
    }

    poblarFiltroUsuarios();
    cargarReporte(); // Carga inicial sin filtros

    btnFiltrar.addEventListener('click', cargarReporte);
    btnExportarPDF.addEventListener('click', exportarAPDF);
}
// ✨ NUEVA FUNCIÓN PARA MOSTRAR LOS DETALLES EN EL MODAL ✨
export async function mostrarDetallesCaja(sesionId) {
    const modal = document.getElementById('modal-detalles-caja');
    const contenido = document.getElementById('contenido-detalles-caja');
    
    contenido.innerHTML = '<p>Cargando detalles...</p>';
    modal.style.display = 'flex';

    try {
        const detalles = await fetchData(`/api/reportes/caja/${sesionId}/detalles`);
        
        let desgloseHtml = '<ul>';
        for (const metodo in detalles) {
            desgloseHtml += `<li><strong>${metodo}:</strong> $${detalles[metodo].toFixed(2)}</li>`;
        }
        desgloseHtml += '</ul>';
        
        contenido.innerHTML = desgloseHtml;
    } catch (error) {
        contenido.innerHTML = '<p style="color: red;">No se pudieron cargar los detalles.</p>';
        mostrarNotificacion(error.message, 'error');
    }
}
