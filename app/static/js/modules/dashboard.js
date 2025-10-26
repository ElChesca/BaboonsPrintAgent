import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js'; // Asegúrate de tener esta importación

// --- Variables globales para Chart.js (para poder destruirlos) ---
let paymentChartInstance = null;

// --- Helper para formatear fechas a YYYY-MM-DD ---
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

// --- Helper para actualizar los títulos con el rango ---
function actualizarTitulosRango(fechaDesde, fechaHasta) {
    const elementosRango = document.querySelectorAll('.rango-fechas');
    let textoRango = "(Hoy)"; // Default

    if (fechaDesde && fechaHasta) {
        if (fechaDesde === fechaHasta) {
            // Si es el mismo día, mostramos solo esa fecha
            const fechaFormateada = new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR'); // Ajusta T00:00:00 para evitar problemas de zona horaria
            textoRango = `(${fechaFormateada})`;
        } else {
             // Si son distintos, mostramos el rango
            const desdeFormateado = new Date(fechaDesde + 'T00:00:00').toLocaleDateString('es-AR');
            const hastaFormateado = new Date(fechaHasta + 'T00:00:00').toLocaleDateString('es-AR');
            textoRango = `(del ${desdeFormateado} al ${hastaFormateado})`;
        }
    }
    
    elementosRango.forEach(el => {
        el.textContent = textoRango;
    });
}


// --- Funciones de carga de datos (MODIFICADAS) ---

async function cargarEstadisticasPrincipales(fechaDesde, fechaHasta) {
    if (!appState.negocioActivoId) return;

    try {
        const ventasHoyEl = document.getElementById('stat-ventas-hoy');
        const bajoStockEl = document.getElementById('stat-bajo-stock'); // Este no depende de fecha
        const totalClientesEl = document.getElementById('stat-total-clientes'); // Este no depende de fecha
        const tablaActividadReciente = document.querySelector('#tabla-actividad-reciente');
        
        if (!ventasHoyEl || !bajoStockEl || !totalClientesEl || !tablaActividadReciente) return;
        
        // Construimos la URL con los parámetros de fecha
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/stats`;
        if (fechaDesde && fechaHasta) {
            url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        }

        const stats = await fetchData(url);

        ventasHoyEl.textContent = `$${(stats.ventas_periodo || 0).toFixed(2)}`; // Cambiado de ventas_hoy
        bajoStockEl.textContent = stats.productos_bajo_stock; // Se mantiene igual
        totalClientesEl.textContent = stats.total_clientes;   // Se mantiene igual

        tablaActividadReciente.innerHTML = '';
        if (!stats.actividad_reciente || stats.actividad_reciente.length === 0) {
            tablaActividadReciente.innerHTML = '<tr><td colspan="3">No hay actividad en el período seleccionado.</td></tr>';
        } else {
            stats.actividad_reciente.forEach(venta => {
                const fecha = new Date(venta.fecha).toLocaleString('es-AR');
                const fila = `
                    <tr>
                        <td>${fecha}</td>
                        <td>${venta.cliente_nombre || 'Consumidor Final'}</td>
                        <td>$${venta.total.toFixed(2)}</td>
                    </tr>
                `;
                tablaActividadReciente.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar stats del dashboard:", error);
        mostrarNotificacion("Error al cargar estadísticas.", "error");
    }
}

async function cargarGraficoMetodosPago(fechaDesde, fechaHasta) {
    if (!appState.negocioActivoId) return;

    const ctx = document.getElementById('payment-methods-chart');
    if (!ctx) return;

    // Destruimos el gráfico anterior si existe (importante para Chart.js)
    if (paymentChartInstance) {
        paymentChartInstance.destroy();
        paymentChartInstance = null;
    }

    try {
         // Construimos la URL con los parámetros de fecha
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/payment_methods`;
        if (fechaDesde && fechaHasta) {
            url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        }
        const data = await fetchData(url);
        
        // Si no hay datos, mostramos un mensaje en lugar del gráfico
        const container = ctx.parentNode; // El div que contiene el canvas
        if (!data || data.length === 0) {
             container.innerHTML = '<p style="text-align: center; padding: 20px;">No hay datos de métodos de pago para este período.</p><canvas id="payment-methods-chart" style="display: none;"></canvas>'; // Ocultamos el canvas
             return; 
        } else {
             // Si había un mensaje, restauramos el canvas
             if (!document.getElementById('payment-methods-chart')) {
                container.innerHTML = '<canvas id="payment-methods-chart"></canvas>';
             }
        }


        const labels = data.map(item => item.metodo_pago);
        const totals = data.map(item => item.total);

        // Volvemos a obtener el contexto por si lo recreamos
        const newCtx = document.getElementById('payment-methods-chart').getContext('2d');

        paymentChartInstance = new Chart(newCtx, { // Guardamos la instancia
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Vendido',
                    data: totals,
                    backgroundColor: ['rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 99, 132, 0.7)'],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }
        });
    } catch (error) {
        console.error("Error al cargar datos de métodos de pago:", error);
         mostrarNotificacion("Error al cargar gráfico de pagos.", "error");
         // Mostramos mensaje de error en el contenedor del gráfico
         const container = ctx.parentNode;
         if(container) container.innerHTML = '<p style="text-align: center; padding: 20px; color: red;">Error al cargar datos.</p><canvas id="payment-methods-chart" style="display: none;"></canvas>';
    }
}

async function cargarRankingCategorias(fechaDesde, fechaHasta) {
    if (!appState.negocioActivoId) return;

    const tablaBody = document.getElementById('category-ranking-table');
    if (!tablaBody) return;

    try {
        // Construimos la URL con los parámetros de fecha
        let url = `/api/negocios/${appState.negocioActivoId}/dashboard/category_ranking`;
        if (fechaDesde && fechaHasta) {
            url += `?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
        }
        const data = await fetchData(url);
        
        tablaBody.innerHTML = '';
        if (!data || data.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="2">No hay datos de categorías para este período.</td></tr>';
        } else {
            data.forEach(cat => {
                const fila = `
                    <tr>
                        <td>${cat.nombre}</td>
                        <td>$${(cat.total || 0).toFixed(2)}</td>
                    </tr>
                `;
                tablaBody.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar ranking de categorías:", error);
        mostrarNotificacion("Error al cargar ranking de categorías.", "error");
        tablaBody.innerHTML = '<tr><td colspan="2" style="color: red;">Error al cargar datos.</td></tr>';
    }
}

// --- Función para cargar todos los datos con las fechas seleccionadas ---
function cargarDatosDashboard() {
    const fechaDesdeEl = document.getElementById('fecha-desde');
    const fechaHastaEl = document.getElementById('fecha-hasta');
    
    if (!fechaDesdeEl || !fechaHastaEl) return;

    const fechaDesde = fechaDesdeEl.value;
    const fechaHasta = fechaHastaEl.value;

    // Validación simple
    if (!fechaDesde || !fechaHasta) {
        mostrarNotificacion("Por favor, seleccione ambas fechas.", "warning");
        return;
    }
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
         mostrarNotificacion("La fecha 'Desde' no puede ser posterior a la fecha 'Hasta'.", "warning");
        return;
    }

    console.log(`Filtrando dashboard desde ${fechaDesde} hasta ${fechaHasta}`);
    
    // Actualizamos títulos
    actualizarTitulosRango(fechaDesde, fechaHasta);

    // Llamamos a las funciones de carga con las fechas
    cargarEstadisticasPrincipales(fechaDesde, fechaHasta);
    cargarGraficoMetodosPago(fechaDesde, fechaHasta);
    cargarRankingCategorias(fechaDesde, fechaHasta);
}


// --- Función de Inicialización del Módulo (MODIFICADA) ---
export function inicializarLogicaDashboard() {
    console.log("Inicializando Dashboard...");
    const fechaDesdeEl = document.getElementById('fecha-desde');
    const fechaHastaEl = document.getElementById('fecha-hasta');
    const btnFiltrar = document.getElementById('btn-filtrar-dashboard');

    if (!fechaDesdeEl || !fechaHastaEl || !btnFiltrar) {
        console.error("Faltan elementos de filtro en dashboard.html");
        return;
    }

    // Establecer fechas por defecto
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);

    fechaDesdeEl.value = formatDate(hace30Dias); // Default: hace 30 días
    fechaHastaEl.value = formatDate(hoy);       // Default: hoy

    // Añadir listener al botón
    btnFiltrar.addEventListener('click', cargarDatosDashboard);

    // Cargar datos iniciales con las fechas por defecto
    cargarDatosDashboard(); 
}
