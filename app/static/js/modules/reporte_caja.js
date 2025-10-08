// en un archivo como modules/reportesCaja.js

let reportesCache = [];

async function fetchReportesCaja() {
    // ... Lógica para obtener los reportes con filtros de fecha ...
    reportesCache = await fetchData(`/api/negocios/${appState.negocioActivoId}/reportes/caja`);
    renderReportes();
}

function renderReportes() {
    const tbody = document.querySelector('#tabla-reportes-caja tbody');
    tbody.innerHTML = '';
    reportesCache.forEach(sesion => {
        const tr = document.createElement('tr');
        const diferenciaClass = sesion.diferencia != 0 ? 'stock-bajo' : ''; // Reutilizando una clase
        tr.innerHTML = `
            <td>${new Date(sesion.fecha_apertura).toLocaleString('es-AR')}</td>
            <td>${new Date(sesion.fecha_cierre).toLocaleString('es-AR')}</td>
            <td>${sesion.usuario_nombre}</td>
            <td>$${sesion.monto_inicial.toFixed(2)}</td>
            <td>$${sesion.monto_final_esperado.toFixed(2)}</td>
            <td>$${sesion.monto_final_contado.toFixed(2)}</td>
            <td class="${diferenciaClass}">$${sesion.diferencia.toFixed(2)}</td>
            <td><button onclick="verDetalles(${sesion.id})">Ver Detalles</button></td>
        `;
        tbody.appendChild(tr);
    });
}
// ...