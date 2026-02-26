

import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { getCurrentUser } from './auth.js';

let stagedBudgetItems = [];
let productosCache = [];

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

function renderizarTablaYTotales() {
    const tbody = document.querySelector('#tabla-presupuesto-items tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    let subtotal = 0;
    stagedBudgetItems.forEach((item, index) => {
        const itemSubtotal = item.cantidad * item.precio_unitario;
        subtotal += itemSubtotal;
        tbody.innerHTML += `
            <tr data-index="${index}">
                <td>${item.descripcion_producto}</td>
                <td>${item.cantidad}</td>
                <td>${formatCurrency(item.precio_unitario)}</td>
                <td>${formatCurrency(itemSubtotal)}</td>
                <td><button type="button" class="btn-quitar">Quitar</button></td>
            </tr>
        `;
    });

    const bonificacionPct = parseFloat(document.getElementById('presupuesto-bonificacion').value) || 0;
    const interesPct = parseFloat(document.getElementById('presupuesto-interes').value) || 0;

    const montoBonificacion = subtotal * (bonificacionPct / 100);
    const montoInteres = subtotal * (interesPct / 100);
    const totalFinal = subtotal - montoBonificacion + montoInteres;

    document.getElementById('presupuesto-subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('presupuesto-total').textContent = formatCurrency(totalFinal);
}

async function cargarDatosIniciales() {
    try {
        const productos = await fetchData(`/api/negocios/${appState.negocioActivoId}/productos`);
        productosCache = productos;

        const currentUser = getCurrentUser();
        if (currentUser) {
            document.getElementById('presupuesto-vendedor').value = currentUser.nombre;
        }
    } catch (error) {
        mostrarNotificacion('Error al cargar datos iniciales: ' + error.message, 'error');
    }
}

/** Establece el cliente seleccionado en la interfaz del presupuesto */
function setClientePresupuesto(cliente) {
    const hiddenInput = document.getElementById('presupuesto-cliente');
    const displayInput = document.getElementById('presupuesto-cliente-display');
    if (!hiddenInput || !displayInput) return;
    if (cliente) {
        hiddenInput.value = cliente.id;
        displayInput.value = cliente.nombre;
    } else {
        hiddenInput.value = '';
        displayInput.value = '';
    }
}
/** Carga los datos de un presupuesto existente en el formulario */
async function cargarPresupuestoParaEditar(id) {
    try {
        const data = await fetchData(`/api/presupuestos/${id}`);
        const { cabecera, detalles } = data;
        const currentUser = getCurrentUser();
        const isAdmin = currentUser && (currentUser.rol === 'admin' || currentUser.rol === 'superadmin');

        // ✨ PROTECCIÓN EXTRA: Solo el dueño o admin edita
        if (!isAdmin && cabecera.vendedor_id !== currentUser.id) {
            mostrarNotificacion('Error: No tienes permiso para editar este presupuesto.', 'error');
            window.location.hash = '#historial_presupuestos';
            return;
        }

        document.getElementById('presupuesto-cliente-display').value = cabecera.cliente_nombre || '';
        document.getElementById('presupuesto-cliente').value = cabecera.cliente_id;
        // Mostramos el nombre del vendedor original (cabecera.vendedor_nombre no existe en cabecera de la API, pero sí en el token decoded... un momento)
        // La API /api/presupuestos/<id> devuelve el objeto presupuesto directo. 
        // Necesitamos asegurar que el vendedor_id no se pierda.

        document.getElementById('presupuesto-vendedor').value = cabecera.vendedor_nombre || currentUser.nombre;
        document.getElementById('presupuesto-tipo-comprobante').value = cabecera.tipo_comprobante;
        document.getElementById('presupuesto-forma-pago').value = cabecera.forma_pago;
        document.getElementById('presupuesto-plazo-pago').value = cabecera.plazo_pago;

        if (cabecera.fecha_entrega_estimada) {
            document.getElementById('presupuesto-fecha-entrega').value = cabecera.fecha_entrega_estimada.split('T')[0];
        }

        document.getElementById('presupuesto-observaciones').value = cabecera.observaciones;
        document.getElementById('presupuesto-bonificacion').value = cabecera.bonificacion;
        document.getElementById('presupuesto-interes').value = cabecera.interes;

        stagedBudgetItems = detalles.map(d => ({
            producto_id: d.producto_id,
            descripcion_producto: d.descripcion_producto,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario
        }));
        renderizarTablaYTotales();

        document.querySelector('h2').textContent = `📝 Editando Presupuesto Nro. ${id}`;
        document.getElementById('btn-guardar-presupuesto').textContent = 'Actualizar Presupuesto';

    } catch (error) {
        mostrarNotificacion('Error al cargar el presupuesto para editar.', 'error');
    }
}


export function inicializarLogicaPresupuestos() {
    stagedBudgetItems = [];
    const idParaEditar = sessionStorage.getItem('presupuestoIdParaEditar');
    if (idParaEditar) {
        // Si encontramos un ID, cargamos ese presupuesto en lugar de empezar de cero
        cargarPresupuestoParaEditar(idParaEditar);
        sessionStorage.removeItem('presupuestoIdParaEditar'); // Limpiamos para la próxima vez
    } else {
        // Si no, cargamos los datos para un presupuesto nuevo
        cargarDatosIniciales();
    }
    // --- Lógica del Modal de Búsqueda de Clientes ---
    const modalBuscarCliente = document.getElementById('modal-buscar-cliente-presupuesto');
    const btnBuscarCliente = document.getElementById('btn-buscar-cliente-presupuesto');
    const displayCliente = document.getElementById('presupuesto-cliente-display');
    const inputBuscar = document.getElementById('input-buscar-cliente-presupuesto');
    const resultadosContainer = document.getElementById('resultados-clientes-presupuesto');
    const closeBuscar = document.getElementById('close-buscar-cliente-presupuesto');

    let timeoutBusqueda = null;
    const abrirModalBusqueda = () => {
        if (!modalBuscarCliente) return;
        modalBuscarCliente.style.display = 'flex';
        if (inputBuscar) { inputBuscar.value = ''; inputBuscar.focus(); }
        if (resultadosContainer) resultadosContainer.innerHTML = '<div class="search-placeholder">Escribe para empezar a buscar...</div>';
    };

    if (btnBuscarCliente) btnBuscarCliente.onclick = abrirModalBusqueda;
    if (displayCliente) displayCliente.onclick = abrirModalBusqueda;
    if (closeBuscar) closeBuscar.onclick = () => modalBuscarCliente.style.display = 'none';
    window.addEventListener('click', (e) => {
        if (modalBuscarCliente && e.target === modalBuscarCliente) modalBuscarCliente.style.display = 'none';
    });

    if (inputBuscar) {
        inputBuscar.addEventListener('input', () => {
            clearTimeout(timeoutBusqueda);
            const query = inputBuscar.value.trim();
            if (query.length < 2) {
                resultadosContainer.innerHTML = '<div class="search-placeholder">Escribe para empezar a buscar...</div>';
                return;
            }
            timeoutBusqueda = setTimeout(async () => {
                try {
                    const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes?search=${encodeURIComponent(query)}&limit=10`);
                    const clientes = response.data || [];
                    if (clientes.length === 0) {
                        resultadosContainer.innerHTML = '<div class="search-placeholder">No se encontraron clientes.</div>';
                        return;
                    }
                    resultadosContainer.innerHTML = clientes.map(c => `
                        <div class="result-item-cliente" data-id="${c.id}" data-nombre="${c.nombre}">
                            <span class="name">${c.nombre}</span>
                            <span class="sub">${c.dni ? 'DNI: ' + c.dni : 'Sin DNI'} | ${c.direccion || 'Sin dirección'}</span>
                        </div>`).join('');
                    resultadosContainer.querySelectorAll('.result-item-cliente').forEach(div => {
                        div.onclick = () => {
                            setClientePresupuesto({ id: div.dataset.id, nombre: div.dataset.nombre });
                            modalBuscarCliente.style.display = 'none';
                        };
                    });
                } catch (err) { console.error(err); }
            }, 300);
        });
    }

    // --- Botón + para crear cliente rápido ---
    const btnAbrirModal = document.getElementById('btn-abrir-modal-cliente');
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => {
            window.abrirModalNuevoCliente(async (nuevoCliente) => {
                setClientePresupuesto(nuevoCliente);
            });
        });
    }

    const elementos = {
        formAddItem: document.getElementById('form-add-item-presupuesto'),
        productoInput: document.getElementById('presupuesto-producto-input'),
        searchResults: document.getElementById('search-results-presupuesto'),
        tablaBody: document.querySelector('#tabla-presupuesto-items tbody'),
        bonificacionInput: document.getElementById('presupuesto-bonificacion'),
        interesInput: document.getElementById('presupuesto-interes'),
        btnGuardar: document.getElementById('btn-guardar-presupuesto')
    };

    for (const key in elementos) {
        if (!elementos[key]) {
            console.error(`Error de inicialización: Falta el elemento HTML con el selector para '${key}'.`);
            mostrarNotificacion(`Error: Faltan componentes en la página de presupuestos. Revisa la consola.`, 'error');
            return;
        }
    }

    cargarDatosIniciales();
    renderizarTablaYTotales();

    elementos.productoInput.addEventListener('input', () => {
        const query = elementos.productoInput.value.toLowerCase();
        if (query.length < 2) {
            elementos.searchResults.style.display = 'none';
            return;
        }
        const resultados = productosCache.filter(p => p.nombre.toLowerCase().includes(query));
        elementos.searchResults.innerHTML = '';
        resultados.forEach(p => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.textContent = p.nombre;
            item.onclick = () => {
                elementos.productoInput.value = p.nombre;
                elementos.searchResults.style.display = 'none';
            };
            elementos.searchResults.appendChild(item);
        });
        elementos.searchResults.style.display = 'block';
    });

    elementos.formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const producto = productosCache.find(p => p.nombre === elementos.productoInput.value);
        const cantidad = parseFloat(document.getElementById('presupuesto-item-cantidad').value);

        if (producto && cantidad > 0) {
            stagedBudgetItems.push({
                producto_id: producto.id,
                descripcion_producto: producto.nombre,
                cantidad: cantidad,
                precio_unitario: producto.precio_venta
            });
            renderizarTablaYTotales();
            elementos.productoInput.value = '';
            document.getElementById('presupuesto-item-cantidad').value = '1';
        } else {
            mostrarNotificacion('Seleccione un producto válido y una cantidad.', 'warning');
        }
    });

    elementos.tablaBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-quitar')) {
            const index = parseInt(e.target.closest('tr').dataset.index, 10);
            stagedBudgetItems.splice(index, 1);
            renderizarTablaYTotales();
        }
    });

    elementos.bonificacionInput.addEventListener('input', renderizarTablaYTotales);
    elementos.interesInput.addEventListener('input', renderizarTablaYTotales);

    elementos.btnGuardar.addEventListener('click', async () => {
        const payload = {
            cliente_id: document.getElementById('presupuesto-cliente').value,
            tipo_comprobante: document.getElementById('presupuesto-tipo-comprobante').value,
            forma_pago: document.getElementById('presupuesto-forma-pago').value,
            plazo_pago: document.getElementById('presupuesto-plazo-pago').value,
            fecha_entrega_estimada: document.getElementById('presupuesto-fecha-entrega').value || null,
            observaciones: document.getElementById('presupuesto-observaciones').value,
            bonificacion: parseFloat(elementos.bonificacionInput.value) || 0,
            interes: parseFloat(elementos.interesInput.value) || 0,
            detalles: stagedBudgetItems
        };

        if (!payload.cliente_id || stagedBudgetItems.length === 0) {
            return mostrarNotificacion('Debe seleccionar un cliente y añadir al menos un producto.', 'warning');
        }

        try {
            const response = await fetchData(`/api/negocios/${appState.negocioActivoId}/presupuestos`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            mostrarNotificacion(response.message, 'success');
            stagedBudgetItems = [];
            document.getElementById('presupuesto-cliente').value = '';
            document.getElementById('presupuesto-cliente-display').value = '';
            document.getElementById('presupuesto-forma-pago').value = 'A convenir';
            document.getElementById('presupuesto-plazo-pago').value = '30 días';
            document.getElementById('presupuesto-fecha-entrega').value = '';
            document.getElementById('presupuesto-observaciones').value = '';
            document.getElementById('presupuesto-bonificacion').value = 0;
            document.getElementById('presupuesto-interes').value = 0;

            cargarDatosIniciales();
            renderizarTablaYTotales();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        }
    });
}