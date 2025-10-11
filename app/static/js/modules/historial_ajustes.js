import { fetchData } from '../api.js';
import { appState } from '../main.js';

async function cargarHistorialAjustes() {
    if (!appState.negocioActivoId) return;

    const tablaBody = document.querySelector('#tabla-historial-ajustes tbody');
    if (!tablaBody) return;
    
    const fechaDesde = document.getElementById('fecha-desde-ajustes').value;
    const fechaHasta = document.getElementById('fecha-hasta-ajustes').value;

    let url = `/api/negocios/${appState.negocioActivoId}/caja/ajustes`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    try {
        const ajustes = await fetchData(url);
        tablaBody.innerHTML = '';
        if (ajustes.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No se encontraron ajustes.</td></tr>';
            return;
        }

        ajustes.forEach(ajuste => {
            const fecha = new Date(ajuste.fecha).toLocaleString('es-AR');
            // La lógica clave: si fecha_cierre existe, está "Rendida".
            const estado = ajuste.fecha_cierre 
                ? '<span class="status-badge status-rendida">Rendida</span>' 
                : '<span class="status-badge status-pendiente">Pendiente</span>';
            
            const tipoClase = ajuste.tipo === 'Ingreso' ? 'text-success' : 'text-danger';

            const fila = `
                <tr>
                    <td>${fecha}</td>
                    <td>${ajuste.usuario_nombre}</td>
                    <td>${ajuste.concepto}</td>
                    <td>${ajuste.tipo}</td>
                    <td class="${tipoClase}">${ajuste.monto.toFixed(2)}</td>
                    <td>${estado}</td>
                </tr>
            `;
            tablaBody.innerHTML += fila;
        });
    } catch (error) {
        console.error("Error al cargar el historial de ajustes:", error);
        tablaBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar los datos.</td></tr>';
    }
}

export function inicializarLogicaHistorialAjustes() {
    const btnFiltrar = document.getElementById('btn-filtrar-ajustes');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', cargarHistorialAjustes);
    }
    cargarHistorialAjustes(); // Carga inicial
}