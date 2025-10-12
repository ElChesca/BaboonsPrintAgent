import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
let todosLosClientes = []; // Caché para guardar todos los clientes y agilizar la búsqueda.

/**
 * Dibuja las filas de la tabla de clientes.
 * @param {Array} clientes - La lista de clientes a renderizar.
 */
function renderTablaClientes(clientes) {
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    clientes.forEach(cliente => {
        tbody.innerHTML += `
            <tr data-id="${cliente.id}">
                <td>${cliente.nombre}</td>
                <td>${cliente.dni || '-'}</td>
                <td>${cliente.condicion_venta || 'Contado'}</td>
                <td class="acciones">
                    <button class="btn-editar">Editar</button>
                    <button class="btn-borrar">Borrar</button>
                    <button class="btn-secondary btn-cta-cte">Cta. Cte.</button>
                </td>
            </tr>
        `;
    });
}

/**
 * Llena el formulario con los datos de un cliente para su edición.
 * @param {object} cliente - El objeto del cliente a editar.
 */
function poblarFormulario(cliente) {
    document.getElementById('form-cliente-titulo').textContent = 'Editar Cliente';
    document.getElementById('cliente-id').value = cliente.id;
    document.getElementById('cliente-nombre').value = cliente.nombre;
    document.getElementById('cliente-tipo').value = cliente.tipo_cliente;
    document.getElementById('cliente-documento').value = cliente.dni;
    document.getElementById('cliente-iva').value = cliente.posicion_iva;
    document.getElementById('cliente-condicion').value = cliente.condicion_venta;
    document.getElementById('cliente-telefono').value = cliente.telefono;
    document.getElementById('cliente-email').value = cliente.email;
    document.getElementById('cliente-direccion').value = cliente.direccion;
    document.getElementById('cliente-ciudad').value = cliente.ciudad;
    document.getElementById('cliente-provincia').value = cliente.provincia;
    document.getElementById('cliente-lista-precios').value = cliente.lista_precios;
    document.getElementById('cliente-credito').value = cliente.credito_maximo;
    document.getElementById('cliente-ref').value = cliente.ref_interna;
    
    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'inline-block';
    window.scrollTo(0, 0); // Sube al inicio de la página para ver el formulario.
}

/** Resetea el formulario a su estado inicial para añadir un nuevo cliente. */
function resetFormulario() {
    document.getElementById('form-cliente-titulo').textContent = 'Añadir Nuevo Cliente';
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-id').value = '';
    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'none';
}

/** Muestra el modal con el historial de la cuenta corriente de un cliente. */
async function mostrarCuentaCorriente(clienteId, clienteNombre) {
    const modal = document.getElementById('modal-cta-cte');
    const titulo = document.getElementById('modal-cta-cte-titulo');
    const tbody = document.querySelector('#tabla-cta-cte tbody');
    const saldoFinalEl = document.getElementById('cta-cte-saldo-final');

    titulo.textContent = `Cuenta Corriente de: ${clienteNombre}`;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>';
    modal.style.display = 'flex';

    try {
        const movimientos = await fetchData(`/api/clientes/${clienteId}/cuenta_corriente`);
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
    } catch (error) {
        mostrarNotificacion('Error al cargar la cuenta corriente.', 'error');
    }
}

export function inicializarLogicaClientes() {
    // --- 1. OBTENER ELEMENTOS DEL DOM ---
    const form = document.getElementById('form-cliente');
    const btnCancelar = document.getElementById('btn-cancelar-edicion-cliente');
    const buscador = document.getElementById('buscador-clientes');
    const tablaClientes = document.getElementById('tabla-clientes');
    const modalCtaCte = document.getElementById('modal-cta-cte');
    const closeModalBtn = document.getElementById('close-cta-cte-modal');
    
    if (!form || !tablaClientes || !modalCtaCte) {
        console.error("Faltan elementos HTML cruciales para el módulo de clientes.");
        return;
    }

    // --- 2. FUNCIONES DE LÓGICA PRINCIPAL ---
    async function cargarClientes() {
        try {
            todosLosClientes = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes`);
            renderTablaClientes(todosLosClientes);
        } catch (error) {
            mostrarNotificacion('No se pudieron cargar los clientes.', 'error');
        }
    }

    async function handleFormSubmit(e) {
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
            lista_precios: document.getElementById('cliente-lista-precios').value,
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
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    }

    // --- 3. CONFIGURACIÓN DE EVENT LISTENERS ---
    form.addEventListener('submit', handleFormSubmit);
    btnCancelar.addEventListener('click', resetFormulario);

    buscador.addEventListener('input', () => {
        const query = buscador.value.toLowerCase();
        const clientesFiltrados = todosLosClientes.filter(c => 
            c.nombre.toLowerCase().includes(query) || (c.dni && c.dni.includes(query))
        );
        renderTablaClientes(clientesFiltrados);
    });

    tablaClientes.addEventListener('click', (e) => {
        const fila = e.target.closest('tr');
        if (!fila || !fila.dataset.id) return;
        
        const clienteId = fila.dataset.id;
        const cliente = todosLosClientes.find(c => c.id == clienteId);

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
            mostrarCuentaCorriente(cliente.id, cliente.nombre);
        }
    });
    
    closeModalBtn.addEventListener('click', () => modalCtaCte.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modalCtaCte) {
            modalCtaCte.style.display = 'none';
        }
    });

    // --- 4. EJECUCIÓN INICIAL ---
    cargarClientes();
}