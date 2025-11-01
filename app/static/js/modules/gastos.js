// static/js/modules/gastos.js
import { fetchData, sendData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js'; // ✨ 1. Importamos el estado global

let gastosCache = [];
// 2. Eliminamos la función getActiveNegocioId()

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
    // ✨ 3. Usamos appState directamente
    if (!appState.negocioActivoId) return;
    
    try {
        // ✨ 4. Usamos la nueva ruta anidada
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
        // ✨ 5. Usamos la nueva ruta anidada
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
        // ✨ 6. Usamos la nueva ruta anidada
        const response = await sendData(`/api/negocios/${appState.negocioActivoId}/gastos/anular/${id}`, {}, 'PUT');
        mostrarNotificacion(response.message || 'Gasto anulado con éxito.', 'success');
        await cargarGastos();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

async function guardarGasto(e) {
    e.preventDefault();
    const id = document.getElementById('gasto-id').value;

    const data = {
        // ✨ 7. Ya no enviamos negocio_id en el body
        categoria_gasto_id: document.getElementById('gasto-categoria').value,
        fecha: document.getElementById('gasto-fecha').value,
        monto: parseFloat(document.getElementById('gasto-monto').value),
        descripcion: document.getElementById('gasto-descripcion').value,
        metodo_pago: document.getElementById('gasto-metodo-pago').value,
        estado: document.getElementById('gasto-estado').value,
        proveedor_id: null, 
        caja_sesion_id: null
    };

    const esEdicion = !!id;
    // ✨ 8. Las URLs ahora se construyen con appState.negocioActivoId
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

export function inicializarGastos() {
    const form = document.getElementById('form-gasto');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-gasto');

    if (!form) return; 

    form.addEventListener('submit', guardarGasto);
    btnCancelar.addEventListener('click', resetFormularioGastos);

    cargarCategoriasParaDropdown();
    cargarGastos();
    
    document.getElementById('gasto-fecha').value = formatearFechaInput(new Date());
}