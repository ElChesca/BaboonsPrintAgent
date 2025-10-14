import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
let ventaActual = null; // Guardará los datos de la venta cargada

function recalcularTotales() {
    const subtotal = ventaActual.detalles.reduce((sum, item) => sum + item.subtotal, 0);
    const descuentoPct = parseFloat(document.getElementById('factura-descuento').value) || 0;
    const montoDescuento = subtotal * (descuentoPct / 100);
    const totalFinal = subtotal - montoDescuento;

    document.getElementById('factura-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('factura-total').textContent = formatCurrency(totalFinal);
}

async function cargarDatosVenta(ventaId) {
    try {
        const data = await fetchData(`/api/ventas/${ventaId}`);
        ventaActual = data;

        document.getElementById('factura-titulo').textContent = `Facturar Venta Nro. ${ventaActual.cabecera.id}`;
        document.getElementById('factura-fecha').textContent = new Date(ventaActual.cabecera.fecha).toLocaleDateString('es-AR');
        
        if (ventaActual.cliente) {
            document.getElementById('factura-cliente-nombre').textContent = ventaActual.cliente.nombre;
            document.getElementById('factura-cliente-doc').textContent = `CUIT/DNI: ${ventaActual.cliente.dni || 'N/A'}`;
        } else {
            document.getElementById('factura-cliente-nombre').textContent = 'Consumidor Final';
        }

        const tbody = document.querySelector('#tabla-factura-items tbody');
        tbody.innerHTML = '';
        ventaActual.detalles.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td>${item.producto_id}</td>
                    <td>${item.producto_nombre}</td>
                    <td>${item.cantidad}</td>
                    <td>${formatCurrency(item.precio_unitario)}</td>
                    <td>${formatCurrency(item.subtotal)}</td>
                </tr>
            `;
        });
        
        document.getElementById('factura-medio-pago').value = ventaActual.cabecera.metodo_pago;
        recalcularTotales();

    } catch (error) {
        mostrarNotificacion('Error al cargar los datos de la venta.', 'error');
    }
}

async function confirmarFacturacion(tipo) {
    const ventaId = ventaActual.cabecera.id;
    try {
        const response = await fetchData(`/api/ventas/${ventaId}/facturar`, {
            method: 'POST', body: JSON.stringify({ tipo: tipo })
        });
        mostrarNotificacion(response.message, 'success');
        
        // Volvemos al historial de ventas
        window.loadContent(null, 'static/historial_ventas.html', document.querySelector('a[onclick*="historial_ventas.html"]'));
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarLogicaFactura() {
    const ventaId = sessionStorage.getItem('ventaParaFacturar');
    if (!ventaId) {
        mostrarNotificacion('No se seleccionó ninguna venta para facturar.', 'error');
        return;
    }

    cargarDatosVenta(ventaId);

    document.getElementById('factura-descuento').addEventListener('input', recalcularTotales);
    document.getElementById('btn-confirmar-factura-oficial').addEventListener('click', () => confirmarFacturacion('oficial'));
    document.getElementById('btn-confirmar-factura-negro').addEventListener('click', () => confirmarFacturacion('negro'));
}