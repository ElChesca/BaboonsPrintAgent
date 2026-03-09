import { fetchData } from '../api.js';
import { appState } from '../main.js';

let offset = 0;
const LIMIT = 50;
let currentTipo = ""; // Filtro de tipo activo

async function cargarHistorialAjustes(acumular = false) {
    if (!appState.negocioActivoId) return;

    const tablaBody = document.querySelector('#tabla-historial-ajustes tbody');
    const btnCargarMas = document.getElementById('btn-cargar-mas-ajustes');
    const loadingIndicator = document.getElementById('loading-ajustes');

    if (!tablaBody) return;

    if (!acumular) {
        offset = 0;
        tablaBody.innerHTML = '';
        if (btnCargarMas) btnCargarMas.style.display = 'none';
    }

    const fechaDesde = document.getElementById('fecha-desde-ajustes').value;
    const fechaHasta = document.getElementById('fecha-hasta-ajustes').value;

    let url = `/api/negocios/${appState.negocioActivoId}/caja/ajustes`;
    const params = new URLSearchParams();
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);
    if (currentTipo) params.append('tipo', currentTipo);

    params.append('limit', LIMIT);
    params.append('offset', offset);

    url += `?${params.toString()}`;

    try {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (btnCargarMas) btnCargarMas.disabled = true;

        console.log("🔍 [Historial] Fetching data from URL:", url);
        const ajustes = await fetchData(url);
        console.log("✅ [Historial] Data received:", ajustes);

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (btnCargarMas) btnCargarMas.disabled = false;

        if (ajustes.length === 0 && !acumular) {
            tablaBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No se encontraron ajustes.</td></tr>';
            return;
        }

        ajustes.forEach(ajuste => {
            const fecha = new Date(ajuste.fecha).toLocaleString('es-AR');
            const estado = ajuste.fecha_cierre
                ? '<span class="status-badge status-rendida">Rendida</span>'
                : '<span class="status-badge status-pendiente">Pendiente</span>';

            const montoClase = ajuste.tipo === 'Ingreso' ? 'text-success' : 'text-danger';
            const montoSigno = ajuste.tipo === 'Ingreso' ? '+' : '-';

            const fila = `
                <tr>
                    <td>${fecha}</td>
                    <td>${ajuste.usuario_nombre}</td>
                    <td>${ajuste.concepto}</td>
                    <td>${ajuste.tipo}</td>
                    <td class="${montoClase}">${montoSigno} $${ajuste.monto.toFixed(2)}</td>
                    <td>${estado}</td>
                </tr>
            `;
            tablaBody.innerHTML += fila;
        });

        // Mostrar botón "Cargar más" si trajo el máximo posible
        if (ajustes.length === LIMIT) {
            if (btnCargarMas) btnCargarMas.style.display = 'inline-block';
            offset += LIMIT;
        } else {
            if (btnCargarMas) btnCargarMas.style.display = 'none';
        }

    } catch (error) {
        console.error("Error al cargar el historial de ajustes:", error);
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        tablaBody.innerHTML += '<tr><td colspan="6" style="text-align: center; color: red;">Error al cargar los datos.</td></tr>';
    }
}

export function inicializarLogicaHistorialAjustes() {
    const btnFiltrar = document.getElementById('btn-filtrar-ajustes');
    if (btnFiltrar) {
        btnFiltrar.addEventListener('click', () => cargarHistorialAjustes(false));
    }

    const btnCargarMas = document.getElementById('btn-cargar-mas-ajustes');
    if (btnCargarMas) {
        btnCargarMas.addEventListener('click', () => cargarHistorialAjustes(true));
    }

    // Reiniciar estado cada vez que se carga la página
    offset = 0;
    currentTipo = "";

    // Lógica de Pills
    document.querySelectorAll('#tipo-movimiento-ajustes .pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            document.querySelectorAll('#tipo-movimiento-ajustes .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentTipo = pill.dataset.value;
            cargarHistorialAjustes(false);
        });
    });

    cargarHistorialAjustes(); // Carga inicial
}