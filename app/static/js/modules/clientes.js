import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
let todosLosClientes = []; // Caché para guardar todos los clientes y agilizar la búsqueda.

function renderTablaClientes(clientes) {
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    clientes.forEach(cliente => {
        const nombreLista = cliente.lista_de_precio_nombre || 'General'; // Muestra 'General' si no tiene una asignada
        tbody.innerHTML += `
            <tr data-id="${cliente.id}">
                <td>${cliente.id}</td>
                <td>${cliente.nombre}</td>
                <td>${cliente.dni || '-'}</td>                
                <td>${cliente.condicion_venta || 'Contado'}</td> 
                <td>${nombreLista}</td>  <td class="acciones">
                <td class="acciones">
                    <button class="btn-editar">Editar</button>
                    <button class="btn-borrar">Borrar</button>
                    <button class="btn-secondary btn-cta-cte">Cta. Cte.</button>
                </td>
            </tr>
        `;
    });
}

// ✨ --- NUEVA FUNCIÓN PARA CARGAR LAS LISTAS DE PRECIOS EN EL FORMULARIO --- ✨
async function poblarSelectDeListas() {    
    const select = document.getElementById('cliente-lista-precios');
    if (!select) return;

    try {
        const listas = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`);
        
        // Guardamos el valor actual por si estamos editando
        const valorActual = select.value; 
        select.innerHTML = '<option value="">-- Sin lista (Precio General) --</option>'; // Limpiamos y ponemos la opción por defecto
        
        listas.forEach(lista => {
            select.innerHTML += `<option value="${lista.id}">${lista.nombre}</option>`;
        });
        
        // Si había un valor seleccionado (editando), lo restauramos
        select.value = valorActual; 
    } catch (error) {
        console.error("No se pudieron cargar las listas de precios en el formulario.");
        // No mostramos notificación para no molestar al usuario, pero lo logueamos.
    }
}

function poblarFormulario(cliente) {
    document.getElementById('form-cliente-titulo').textContent = 'Editar Cliente';
    document.getElementById('cliente-id').value = cliente.id;
    document.getElementById('cliente-nombre').value = cliente.nombre;
    document.getElementById('cliente-tipo').value = cliente.tipo_cliente || 'Individuo';
    document.getElementById('cliente-documento').value = cliente.dni || '';
    document.getElementById('cliente-iva').value = cliente.posicion_iva || 'Consumidor Final';
    document.getElementById('cliente-condicion').value = cliente.condicion_venta || 'Contado';
    document.getElementById('cliente-telefono').value = cliente.telefono || '';
    document.getElementById('cliente-email').value = cliente.email || '';
    document.getElementById('cliente-direccion').value = cliente.direccion || '';
    document.getElementById('cliente-ciudad').value = cliente.ciudad || '';
    document.getElementById('cliente-provincia').value = cliente.provincia || '';    
    ocument.getElementById('cliente-lista-precios').value = cliente.lista_de_precio_id || '';
    document.getElementById('cliente-credito').value = cliente.credito_maximo || 0;
    document.getElementById('cliente-ref').value = cliente.ref_interna || '';
    
    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'inline-block';
    window.scrollTo(0, 0);
}

async function resetFormulario() { 
    document.getElementById('form-cliente-titulo').textContent = 'Añadir Nuevo Cliente';
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-id').value = '';
    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'none';

    // ✨ LÓGICA PARA ASIGNAR LA LISTA POR DEFECTO ✨
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`);
        if (configs.lista_precio_defecto_id) {
            document.getElementById('cliente-lista-precios').value = configs.lista_precio_defecto_id;
        }
    } catch (error) {
        console.log("No se encontró configuración de lista por defecto, se usará la general.");
    }
}

function generarPdfCtaCte(cliente, movimientos) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let saldo = 0;

    doc.setFontSize(20);
    doc.text(`Cuenta Corriente: ${cliente.nombre}`, 105, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-AR')}`, 105, 29, { align: 'center' });

    doc.autoTable({
        startY: 40,
        head: [['Fecha', 'Concepto', 'Debe', 'Haber', 'Saldo']],
        body: movimientos.map(mov => {
            saldo += (mov.debe || 0) - (mov.haber || 0);
            return [
                new Date(mov.fecha).toLocaleDateString('es-AR'),
                mov.concepto,
                mov.debe > 0 ? formatCurrency(mov.debe) : '-',
                mov.haber > 0 ? formatCurrency(mov.haber) : '-',
                formatCurrency(saldo)
            ];
        }),
        foot: [[{ content: 'Saldo Final', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: formatCurrency(saldo), styles: { fontStyle: 'bold' } }]],
        theme: 'striped',
        headStyles: { fillColor: [0, 123, 255] }
    });
    doc.save(`CtaCte_${cliente.nombre.replace(/\s/g, '_')}.pdf`);
}

async function mostrarCuentaCorriente(cliente) {
    const modal = document.getElementById('modal-cta-cte');
    const titulo = document.getElementById('modal-cta-cte-titulo');
    const tbody = document.querySelector('#tabla-cta-cte tbody');
    const saldoFinalEl = document.getElementById('cta-cte-saldo-final');
    const btnPdf = document.getElementById('btn-pdf-cta-cte');

    titulo.textContent = `Cuenta Corriente de: ${cliente.nombre}`;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>';
    modal.style.display = 'flex';

    try {
        // ✨ CORRECCIÓN: Usamos 'cliente.id' para construir la URL.
        const movimientos = await fetchData(`/api/clientes/${cliente.id}/cuenta_corriente`);
        let saldo = 0;
        tbody.innerHTML = '';
        if (movimientos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No hay movimientos registrados.</td></tr>';
        } else {
            movimientos.forEach(mov => {
                saldo += (mov.debe || 0) - (mov.haber || 0);
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(mov.fecha).toLocaleDateString('es-AR')}</td>
                        <td>${mov.concepto}</td>
                        <td style="color: red;">${mov.debe > 0 ? formatCurrency(mov.debe) : '-'}</td>
                        <td style="color: green;">${mov.haber > 0 ? formatCurrency(mov.haber) : '-'}</td>
                        <td>${formatCurrency(saldo)}</td>
                    </tr>
                `;
            });
        }
        saldoFinalEl.textContent = formatCurrency(saldo);
        saldoFinalEl.style.color = saldo > 0 ? 'red' : 'green';
        
        btnPdf.onclick = () => generarPdfCtaCte(cliente, movimientos);
    } catch (error) {
        mostrarNotificacion('Error al cargar la cuenta corriente.', 'error');
        // Opcional: cierra el modal si hay un error
        // modal.style.display = 'none';
    }
}

export function inicializarLogicaClientes() {
    const form = document.getElementById('form-cliente');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-cliente');
    const buscador = document.getElementById('buscador-clientes');
    const tablaClientes = document.getElementById('tabla-clientes');
    const modalCtaCte = document.getElementById('modal-cta-cte');
    const closeModalBtn = document.getElementById('close-cta-cte-modal');
    
    if (!form || !tablaClientes || !modalCtaCte) return;

    poblarSelectDeListas(); // Cargamos las listas de precios en el formulario al iniciar.

    async function cargarClientes() {
        try {
            todosLosClientes = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`);
            renderTablaClientes(todosLosClientes);
        } catch (error) { mostrarNotificacion('No se pudieron cargar los clientes.', 'error'); }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const clienteId = document.getElementById('cliente-id').value;
        const payload = {
            nombre: document.getElementById('cliente-nombre').value,
            tipo_cliente: document.getElementById('cliente-tipo').value,
            dni: document.getElementById('cliente-documento').value,
            posicion_iva: document.getElementById('cliente-iva').value,
            condicion_venta: document.getElementById('cliente-condicion').value,
            telefono: document.getElementById('cliente-telefono').value,
            email: document.getElementById('cliente-email').value,
            direccion: document.getElementById('cliente-direccion').value,
            ciudad: document.getElementById('cliente-ciudad').value,
            provincia: document.getElementById('cliente-provincia').value,            
            lista_de_precio_id: document.getElementById('cliente-lista-precios').value || null,
            credito_maximo: parseFloat(document.getElementById('cliente-credito').value) || 0,
            ref_interna: document.getElementById('cliente-ref').value
        };
        const esEdicion = !!clienteId;
        const url = esEdicion ? `/api/clientes/${clienteId}` : `/api/negocios/${appState.negocioActivoId}/clientes`;
        const method = esEdicion ? 'PUT' : 'POST';
        try {
            const response = await fetchData(url, { method, body: JSON.stringify(payload) });
            mostrarNotificacion(response.message || `Cliente ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
            resetFormulario();
            cargarClientes();
        } catch (error) { mostrarNotificacion(error.message, 'error'); }
    });

    buscador.addEventListener('input', () => {
        const query = buscador.value.toLowerCase();
        const clientesFiltrados = todosLosClientes.filter(c => 
            c.nombre.toLowerCase().includes(query) || (c.dni && c.dni.includes(query))
        );
        renderTablaClientes(clientesFiltrados);
    });

    btnCancelar.addEventListener('click', resetFormulario);

    tablaClientes.addEventListener('click', (e) => {
        const fila = e.target.closest('tr');
        if (!fila || !fila.dataset.id) return;
        
        const clienteId = fila.dataset.id;
        const cliente = todosLosClientes.find(c => c.id == clienteId);
        if (!cliente) return;

        if (e.target.classList.contains('btn-editar')) {
            poblarFormulario(cliente);
        } else if (e.target.classList.contains('btn-borrar')) {
            if (confirm(`¿Estás seguro de que quieres eliminar a ${cliente.nombre}?`)) {
                fetchData(`/api/clientes/${clienteId}`, { method: 'DELETE' })
                    .then(() => {
                        mostrarNotificacion('Cliente eliminado con éxito.', 'success');
                        cargarClientes();
                    })
                    .catch(error => mostrarNotificacion(error.message, 'error'));
            }
        } else if (e.target.classList.contains('btn-cta-cte')) {
            // ✨ CORRECCIÓN: Pasamos el objeto 'cliente' completo.
            mostrarCuentaCorriente(cliente);
        }
    });
    
    closeModalBtn.addEventListener('click', () => modalCtaCte.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modalCtaCte) {
            modalCtaCte.style.display = 'none';
        }
    });

    cargarClientes();
}