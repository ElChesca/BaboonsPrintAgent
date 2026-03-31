import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

export async function inicializarMPDashboard() {
    console.log("Inicializando Dashboard de Mercado Pago...");
    
    // Referencias a elementos
    const btnRefresh = document.getElementById('btn-refresh-mp');
    const balanceTotal = document.getElementById('mp-balance-total');
    const balanceDetail = document.getElementById('mp-balance-detail');
    const recentCount = document.getElementById('mp-recent-count');
    const recentTotal = document.getElementById('mp-recent-total');
    const tbodyPayments = document.getElementById('tbody-mp-payments');

    if (btnRefresh) {
        btnRefresh.onclick = () => cargarDatosMP();
    }

    // Carga inicial
    await cargarDatosMP();

    async function cargarDatosMP() {
        try {
            // 1. Cargar Balance
            const resBalance = await fetchData(`/api/negocios/${appState.negocioActivoId}/mp/balance`);
            if (resBalance && !resBalance.error) {
                const total = resBalance.total_amount || 0;
                balanceTotal.innerText = `$ ${total.toLocaleString()}`;
                balanceDetail.innerText = `Disponible: $ ${resBalance.available_balance?.toLocaleString() || 0}`;
            } else {
                balanceTotal.innerText = "Error";
                balanceDetail.innerText = resBalance.error || "No se pudo cargar el saldo";
            }

            // 2. Cargar Pagos
            const resPayments = await fetchData(`/api/negocios/${appState.negocioActivoId}/mp/payments?limit=10`);
            if (resPayments && resPayments.results) {
                renderizarPagos(resPayments.results);
                
                // Estadísticas rápidas
                recentCount.innerText = resPayments.results.length;
                const suma = resPayments.results
                    .filter(p => p.status === 'approved')
                    .reduce((acc, p) => acc + (p.transaction_amount || 0), 0);
                recentTotal.innerText = `$ ${suma.toLocaleString()}`;
            } else {
                tbodyPayments.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${resPayments.error || 'No se pudieron cargar las transacciones'}</td></tr>`;
            }
        } catch (error) {
            console.error("Error cargando Dashboard MP:", error);
            mostrarNotificacion("Error al conectar con la API de Mercado Pago", "error");
        }
    }

    function renderizarPagos(payments) {
        if (payments.length === 0) {
            tbodyPayments.innerHTML = `<tr><td colspan="5" class="text-center py-4">No hay transacciones recientes</td></tr>`;
            return;
        }

        tbodyPayments.innerHTML = payments.map(p => {
            const date = new Date(p.date_created).toLocaleString();
            const statusClass = getStatusClass(p.status);
            return `
                <tr>
                    <td class="ps-4">
                        <div class="fw-bold text-dark">${date}</div>
                        <small class="text-muted">ID: ${p.id}</small>
                    </td>
                    <td>
                        <span class="fw-bold text-dark">$ ${p.transaction_amount?.toLocaleString()}</span>
                    </td>
                    <td>
                        <span class="badge ${statusClass}">${p.status.toUpperCase()}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-credit-card me-2 opacity-50"></i>
                            <span>${p.payment_method_id || 'N/A'}</span>
                        </div>
                    </td>
                    <td>
                        <small class="text-muted">${p.description || 'Sin descripción'}</small>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function getStatusClass(status) {
        switch(status) {
            case 'approved': return 'bg-success';
            case 'pending': return 'bg-warning text-dark';
            case 'rejected': return 'bg-danger';
            case 'cancelled': return 'bg-secondary';
            default: return 'bg-info';
        }
    }
}
