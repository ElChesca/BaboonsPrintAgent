import { fetchData } from '../../api.js';
import { appState } from '../../main.js';

/**
 * Genera un PDF de Remito para una Venta.
 * Basado en la lógica de pedidos.js pero adaptado para ventas.
 */
export async function imprimirVentaPDF(ventaId) {
    try {
        const data = await fetchData(`/api/ventas/${ventaId}`);
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('Librería PDF no cargada');
            return;
        }

        const doc = new jsPDF();
        const cabecera = data.cabecera;
        const detalles = data.detalles;
        const cliente = data.cliente;

        const negocio = appState.negociosCache.find(n => n.id == appState.negocioActivoId) || { nombre: 'Baboons', direccion: '' };
        const APP_VERSION = window.APP_VERSION || '1.0';

        // Helper para moneda y números
        const fmtMoneda = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
        const fmtNum = (n) => (n || 0).toLocaleString('es-AR');

        // Cabecera: Negocio
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(negocio.nombre, 105, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(negocio.direccion || '', 105, 26, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.line(14, 32, 196, 32);

        // Sub-cabecera: Tipo de Documento y Número
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("REMITO DE VENTA", 14, 45);
        doc.setFontSize(14);
        doc.text(`#${cabecera.id}`, 196, 45, { align: 'right' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const fechaVenta = new Date(cabecera.fecha).toLocaleDateString('es-AR');
        doc.text(`Fecha: ${fechaVenta}`, 14, 52);
        doc.text(`Caja: #${cabecera.caja_sesion_id || 'N/A'}`, 196, 52, { align: 'right' });

        // Datos del Cliente / Destinatario
        doc.setFillColor(245, 245, 245);
        doc.rect(14, 61, 182, 26, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, 61, 182, 26, 'D');

        doc.setFont("helvetica", "bold");
        doc.text("DESTINATARIO:", 18, 68);
        doc.setFont("helvetica", "normal");
        doc.text(cliente ? String(cliente.nombre) : 'Consumidor Final', 52, 68);

        doc.setFont("helvetica", "bold");
        doc.text("DIRECCIÓN:", 18, 75);
        doc.setFont("helvetica", "normal");
        doc.text(cliente ? String(cliente.direccion || 'Sin dirección') : '-', 52, 75);

        doc.setFont("helvetica", "bold");
        doc.text("MET. PAGO:", 18, 82);
        doc.setFont("helvetica", "normal");
        doc.text(String(cabecera.metodo_pago || 'Efectivo'), 52, 82);

        // Tabla de Items
        const headers = [["Cant.", "Producto", "Precio Unit.", "Bonif.", "Subtotal"]];
        const rows = detalles.map(d => {
            const bonif = parseFloat(d.bonificacion || 0);
            return [
                fmtNum(d.cantidad),
                d.producto_nombre || d.nombre,
                fmtMoneda(d.precio_unitario),
                bonif > 0 ? fmtNum(bonif) : '-',
                fmtMoneda(d.subtotal)
            ];
        });

        doc.autoTable({
            startY: 94,
            head: headers,
            body: rows,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255 },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 35, halign: 'right' }
            }
        });

        // Totales Finales
        let currentY = doc.lastAutoTable.finalY + 10;

        // Bloque de Total con diseño mejorado
        doc.setFillColor(44, 62, 80); // Color primario oscuro
        doc.rect(130, currentY - 6, 66, 10, 'F');

        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL PAGADO", 133, currentY);

        doc.setFontSize(12);
        doc.text(fmtMoneda(cabecera.total), 193, currentY, { align: 'right' });

        // Restablecer color de texto
        doc.setTextColor(0, 0, 0);

        // Sección de Firma
        const startSignatureY = 250;
        doc.setLineWidth(0.3);
        doc.line(70, startSignatureY, 140, startSignatureY);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Firma y Aclaración del Cliente", 105, startSignatureY + 5, { align: 'center' });
        doc.text("Recibí conforme mercadería y valor", 105, startSignatureY + 10, { align: 'center' });

        // Pie de página
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Generado por Baboons - v${APP_VERSION} el ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

        doc.save(`Remito_Venta_${cabecera.id}_${(cliente?.nombre || 'CF').replace(/\s+/g, '_')}.pdf`);

    } catch (error) {
        console.error("Error generating Remito PDF:", error);
        alert('Error al generar el Remito: ' + error.message);
    }
}
