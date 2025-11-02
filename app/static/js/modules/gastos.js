// static/js/modules/gastos.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js'; // Importamos el estado global

let gastosCache = [];

// (Las funciones de formateo de fecha no cambian)
function formatearFechaInput(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toISOString().slice(0, 16);
}
function formatearFechaTabla(isoDate) {
    if (!isoDate) return '-';
    const date = new Date(isoDate);
    return date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderizarTablaGastos() {
    const tbody = document.querySelector('#tabla-gastos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    gastosCache.forEach(g => {
        tbody.innerHTML += `
            <tr class="${g.estado === 'Anulado' ? 'fila-anulada' : ''}">
                <td>${formatearFechaTabla(g.fecha)}</td>
                <td>${g.categoria || '-'}</td>
                <td>${g.descripcion || '-'}</td>
                <td>$ ${g.monto.toFixed(2)}</td>
                <td>${g.metodo_pago || '-'}</td>
                <td><span class="badge ${g.estado === 'Pagado' ? 'badge-success' : (g.estado === 'Pendiente' ? 'badge-warning' : 'badge-danger')}">${g.estado}</span></td>
                <td class="acciones">
                    ${g.estado !== 'Anulado' ? `
                        <button class="btn-secondary" onclick="window.editarGasto(${g.id})">Editar</button>
                        <button class="btn-danger" onclick="window.anularGasto(${g.id})">Anular</button>
                    ` : 'Anulado'}
                </td>
            </tr>
        `;
    });
}

async function cargarGastos() {
    if (!appState.negocioActivoId) return;
    
    try {
        gastosCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/gastos`);
        renderizarTablaGastos();
    } catch (error) {
        mostrarNotificacion('No se pudieron cargar los gastos.', 'error');
    }
}

async function cargarCategoriasParaDropdown() {
    const select = document.getElementById('gasto-categoria');
    if (!select || !appState.negocioActivoId) return;

    try {
        const categorias = await fetchData(`/api/negocios/${appState.negocioActivoId}/categorias_gasto/activas`);
        select.innerHTML = '<option value="">Seleccione una categoría...</option>';
        categorias.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.descripcion}</option>`;
        });
    } catch (error) {
        mostrarNotificacion('Error al cargar categorías para el formulario.', 'error');
    }
}

function resetFormularioGastos() {
    document.getElementById('form-gasto-titulo').textContent = 'Registrar Nuevo Gasto';
    document.getElementById('form-gasto').reset();
    document.getElementById('gasto-id').value = '';
    document.getElementById('btn-cancelar-edicion-gasto').style.display = 'none';
    document.getElementById('gasto-fecha').value = formatearFechaInput(new Date());
}

window.editarGasto = (id) => {
    const gasto = gastosCache.find(g => g.id === id);
    if (!gasto) return;

    document.getElementById('form-gasto-titulo').textContent = 'Editar Gasto';
    document.getElementById('gasto-id').value = gasto.id;
    document.getElementById('gasto-fecha').value = formatearFechaInput(gasto.fecha);
    document.getElementById('gasto-categoria').value = gasto.categoria_gasto_id;
    document.getElementById('gasto-monto').value = gasto.monto;
    document.getElementById('gasto-descripcion').value = gasto.descripcion;
    document.getElementById('gasto-metodo-pago').value = gasto.metodo_pago;
    document.getElementById('gasto-estado').value = gasto.estado;
    
    document.getElementById('btn-cancelar-edicion-gasto').style.display = 'inline-block';
    window.scrollTo(0, 0);
};

window.anularGasto = async (id) => {
    if (!confirm('¿Estás seguro de que deseas anular este gasto?')) {
        return;
    }

    try {
        const response = await sendData(`/api/negocios/${appState.negocioActivoId}/gastos/anular/${id}`, {}, 'PUT');
        mostrarNotificacion(response.message || 'Gasto anulado con éxito.', 'success');
        await cargarGastos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// ==========================================================
// ✨ MODIFICACIÓN AQUÍ ✨
// ==========================================================
async function guardarGasto(e) {
    e.preventDefault();
    const id = document.getElementById('gasto-id').value;
    const metodoPago = document.getElementById('gasto-metodo-pago').value;
    const monto = parseFloat(document.getElementById('gasto-monto').value);

    // 🚫 1. (NUEVA VALIDACIÓN)
    // Si el método es 'Efectivo' Y la caja NO está abierta (no hay ID de sesión)
    if (metodoPago.toLowerCase() === 'efectivo' && !appState.cajaSesionIdActiva) {
        mostrarNotificacion('🚫 No se puede registrar un gasto en "Efectivo" si la caja está cerrada. Por favor, abra la caja primero.', 'error');
        return; // Detener la ejecución
    }
    
    // 🚫 2. (NUEVA VALIDACIÓN) Asegurarse de que el monto sea positivo
    if (monto <= 0) {
        mostrarNotificacion('El monto del gasto debe ser mayor a cero.', 'error');
        return;
    }

    // 3. Lógica de asignación de sesión (como antes)
    let idSesionCaja = null;
    if (metodoPago.toLowerCase() === 'efectivo') {
        idSesionCaja = appState.cajaSesionIdActiva;
    }

    const data = {
        categoria_gasto_id: document.getElementById('gasto-categoria').value,
        fecha: document.getElementById('gasto-fecha').value,
        monto: monto,
        descripcion: document.getElementById('gasto-descripcion').value,
        metodo_pago: metodoPago,
        estado: document.getElementById('gasto-estado').value,
        proveedor_id: null, 
        caja_sesion_id: idSesionCaja // Se asigna el ID de la sesión (o null)
    };

    const esEdicion = !!id;
    const url = esEdicion 
        ? `/api/negocios/${appState.negocioActivoId}/gastos/${id}`
        : `/api/negocios/${appState.negocioActivoId}/gastos`;
        
    const method = esEdicion ? 'PUT' : 'POST';

    try {
        const response = await sendData(url, data, method);
        mostrarNotificacion(response.message || `Gasto ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
        resetFormularioGastos();
        await cargarGastos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

function exportarGastosExcel() {
    if (gastosCache.length === 0) {
        mostrarNotificacion('No hay datos para exportar.', 'warning');
        return;
    }
    
    // 1. Preparar los datos (aplanar)
    const datosParaExportar = gastosCache.map(g => ({
        "Fecha": formatearFechaTabla(g.fecha),
        "Categoría": g.categoria || '-',
        "Descripción": g.descripcion || '-',
        "Monto": g.monto,
        "Método de Pago": g.metodo_pago || '-',
        "Estado": g.estado
    }));

    // 2. Crear la hoja de cálculo
    const ws = XLSX.utils.json_to_sheet(datosParaExportar);
    
    // (Opcional) Ajustar anchos de columna
    ws['!cols'] = [
        { wch: 20 }, // Fecha
        { wch: 25 }, // Categoría
        { wch: 40 }, // Descripción
        { wch: 15 }, // Monto
        { wch: 20 }, // Método de Pago
        { wch: 15 }  // Estado
    ];

    // 3. Crear el libro y guardar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, "Reporte_Gastos_Operativos.xlsx");
}

function exportarGastosPDF() {
    if (gastosCache.length === 0) {
        mostrarNotificacion('No hay datos para exportar.', 'warning');
        return;
    }
    
    // (Asegurarnos de que la librería jsPDF esté cargada)
    if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
        mostrarNotificacion('Error: La librería jsPDF no se cargó correctamente.', 'error');
        return;
    }
    const { jsPDF } = jspdf; // Extraer el constructor

    // 1. Preparar los datos
    const head = [["Fecha", "Categoría", "Descripción", "Monto", "Método Pago", "Estado"]];
    const body = gastosCache.map(g => [
        formatearFechaTabla(g.fecha),
        g.categoria || '-',
        g.descripcion || '-',
        `$${g.monto.toFixed(2)}`,
        g.metodo_pago || '-',
        g.estado
    ]);

    // 2. Crear el documento PDF
    const doc = new jsPDF();
    doc.text("Reporte de Gastos Operativos", 14, 15);
    
    // 3. Usar autoTable para dibujar la tabla
    doc.autoTable({
        startY: 20,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] } // Un color azul
    });

    // 4. Guardar el archivo
    doc.save("Reporte_Gastos_Operativos.pdf");
}

export function inicializarGastos() {
    const form = document.getElementById('form-gasto');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-gasto');

    if (!form) return; 

    form.addEventListener('submit', guardarGasto);
    btnCancelar.addEventListener('click', resetFormularioGastos);
     // ✨ 1. (NUEVO) Listeners para los botones de exportación
    const btnExcel = document.getElementById('btn-exportar-gastos-excel');
    const btnPdf = document.getElementById('btn-exportar-gastos-pdf');    
    if(btnExcel) btnExcel.addEventListener('click', exportarGastosExcel);
    if(btnPdf) btnPdf.addEventListener('click', exportarGastosPDF);

    cargarCategoriasParaDropdown();
    cargarGastos();
    
    document.getElementById('gasto-fecha').value = formatearFechaInput(new Date());
}