import { appState } from '../main.js';

export const whatsapp = {
    /**
     * Envía un recibo de pago simplificado
     */
    enviarRecibo: (clienteNombre, total, nroVenta, metodoPago) => {
        const mensaje = `*RECIBO DE PAGO* 📄\n\n` +
            `Hola *${clienteNombre}*! 👋\n` +
            `Confirmamos el cobro de tu pedido.\n\n` +
            `🔹 *Venta:* #${nroVenta}\n` +
            `🔹 *Método:* ${metodoPago}\n` +
            `🔹 *Total:* $${total.toLocaleString()}\n\n` +
            `Gracias por tu compra! 😊\n` +
            `*${appState.negociosCache.find(n => n.id == appState.negocioActivoId)?.nombre || 'Baboons'}*`;

        const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    },

    /**
     * Notifica que un pedido está preparado
     */
    notificarPreparado: (clienteNombre, pedidoId) => {
        const mensaje = `*AVISO DE PEDIDO LISTO* 📦\n\n` +
            `Hola *${clienteNombre}*! 👋\n` +
            `Tu pedido *#${pedidoId}* ya está preparado y listo para ser entregado.\n\n` +
            `Te avisaremos cuando el repartidor esté en camino. Gracias!\n` +
            `*${appState.negociosCache.find(n => n.id == appState.negocioActivoId)?.nombre || 'Baboons'}*`;

        const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
    }
};
