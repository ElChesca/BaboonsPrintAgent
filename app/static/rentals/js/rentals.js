import { fetchData, sendData } from '../../js/api.js';
import { appState } from '../../js/main.js';
import { mostrarNotificacion } from '../../js/modules/notifications.js';

// --- INICIALIZACIÓN CENTRAL ---
export async function inicializarRentals(pageName) {
    console.log(`Inicializando Rentals: ${pageName}`);

    // Pequeño delay para asegurar renderizado del DOM si requestAnimationFrame no fue suficiente
    // A veces en móviles o redes lentas el renderizado del innerHTML puede tener micro-retrasos
    await new Promise(r => setTimeout(r, 50));

    if (pageName === 'rentals_dashboard') {
        loadDashboard();
    } else if (pageName === 'rentals_units') {
        waitForElement('rentals-units-table', () => {
            loadUnits();
            setupUnitsListeners();
        });
    } else if (pageName === 'rentals_contracts') {
        waitForElement('rentals-contracts-table', () => {
            loadContracts();
            setupContractsListeners();
        });
    }
}

// Helper para esperar elementos
function waitForElement(id, callback, attempts = 10) {
    const el = document.getElementById(id);
    if (el) {
        callback();
    } else if (attempts > 0) {
        // console.warn(`Esperando elemento ${id}... (${attempts})`);
        setTimeout(() => waitForElement(id, callback, attempts - 1), 100);
    } else {
        console.error(`Error crítico: Elemento ${id} no apareció en el DOM.`);
        mostrarNotificacion(`Error de interfaz: ${id} no encontrado.`, 'error');
    }
}

// --- METADATA DE APPS (Iconos y Nombres) ---
const APP_METADATA = {
    // RENTALS
    'rentals_units': { name: 'Unidades', icon: '/static/img/icons/inventario.png', path: 'static/rentals/rentals_units.html' },
    'rentals_contracts': { name: 'Contratos', icon: '/static/img/icons/presupuesto.png', path: 'static/rentals/rentals_contracts.html' },
    // COMUNES
    'configuracion': { name: 'Configuración', icon: '/static/img/icons/configuracion.png', path: 'static/configuracion.html' },
    'usuarios': { name: 'Usuarios', icon: '/static/img/icons/usuarios.png', path: 'static/usuarios.html' },
    'negocios': { name: 'Negocios', icon: '/static/img/icons/negocios.png', path: 'static/negocios.html' },
    // RETAIL
    'ventas': { name: 'Ventas', icon: '/static/img/icons/ventas.png', path: 'static/ventas.html' },
    'clientes': { name: 'Clientes', icon: '/static/img/icons/clientes.png', path: 'static/clientes.html' },
    'caja': { name: 'Caja', icon: '/static/img/icons/caja.png', path: 'static/caja.html' },
    'presupuestos': { name: 'Presupuestos', icon: '/static/img/icons/presupuesto.png', path: 'static/presupuestos.html' },
    'inventario': { name: 'Inventario', icon: '/static/img/icons/inventario.png', path: 'static/inventario.html' },
    'proveedores': { name: 'Proveedores', icon: '/static/img/icons/proveedor.png', path: 'static/proveedores.html' },
    'payments': { name: 'Pago Proveed.', icon: '/static/img/icons/payments.png', path: 'static/payments.html' },
    'gastos': { name: 'Gastos Operativos', icon: '/static/img/icons/gastos.png', path: 'static/gastos.html' },
    'ingresos': { name: 'Ingresos Stock', icon: '/static/img/icons/ingresos.png', path: 'static/ingresos.html' },
    'inventario_movil': { name: 'Inv. Móvil', icon: '/static/img/icons/inventariomovil.png', path: 'static/inventario_movil.html' },
    'verificador': { name: 'Verificador', icon: '/static/img/icons/verificador.png', path: 'static/verificador.html' },
    'crm_social': { name: 'CRM & Redes', icon: '/static/img/icons/clientes.png', path: 'static/crm_social/crm_social.html' },
    // ADMIN / REPORTES
    'categorias': { name: 'Categorias Prod.', icon: '/static/img/icons/categorias.png', path: 'static/categorias.html' },
    'historial_inventario': { name: 'Hist. Inventario', icon: '/static/img/icons/historial_inventario.png', path: 'static/historial_inventario.html' },
    'listas_precios': { name: 'Listas Precios', icon: '/static/img/icons/price_list.png', path: 'static/listas_precios.html' },
    'precios_especificos': { name: 'Precios Esp.', icon: '/static/img/icons/precios_especificos.png', path: 'static/precios_especificos.html' },
    'unidades_medida': { name: 'Unid. Medida', icon: '/static/img/icons/unidadesdemedida.png', path: 'static/unidades_medida.html' },
    'gastos_categorias': { name: 'Cat. Gastos', icon: '/static/img/icons/gastos_categorias.png', path: 'static/gastos_categorias.html' },
    'admin_apps': { name: 'Admin Apps', icon: '/static/img/icons/configuracion.png', path: 'static/admin_apps.html' },
    'reporte_caja': { name: 'Reporte Caja', icon: '/static/img/icons/caja.png', path: 'static/reporte_caja.html' },
    'reporte_ganancias': { name: 'Reporte Ganancias', icon: '/static/img/icons/ventas.png', path: 'static/reporte_ganancias.html' },
    'reportes': { name: 'Reportes Gral.', icon: '/static/img/icons/ventas.png', path: 'static/reportes.html' },
    'historial_ventas': { name: 'Hist. Ventas', icon: '/static/img/icons/ventas.png', path: 'static/historial_ventas.html' },
    'historial_ingresos': { name: 'Hist. Ingresos', icon: '/static/img/icons/ingresos.png', path: 'static/historial_ingresos.html' },
    'historial_pagos_proveedores': { name: 'Hist. Pagos', icon: '/static/img/icons/payments.png', path: 'static/historial_pagos_proveedores.html' },
    'historial_presupuestos': { name: 'Hist. Presup.', icon: '/static/img/icons/presupuesto.png', path: 'static/historial_presupuestos.html' },
    'historial_ajustes': { name: 'Hist. Ajustes', icon: '/static/img/icons/inventario.png', path: 'static/historial_ajustes.html' },
    'factura': { name: 'Facturación', icon: '/static/img/icons/caja.png', path: 'static/factura.html' },
    'ajuste_caja': { name: 'Ajuste Caja', icon: '/static/img/icons/caja.png', path: 'static/ajuste_caja.html' }
};

// --- DASHBOARD ---
async function loadDashboard() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) return;

    // 1. Renderizar APPS Dinámicas
    const grid = document.getElementById('rentals-app-grid');
    if (grid) {
        grid.innerHTML = '';
        const permisos = appState.permissions['rentals'] || [];
        const comunes = appState.permissions['comun'] || ['configuracion', 'usuarios', 'negocios'];

        // Unimos y deduplicamos permisos
        const todosPermisos = [...new Set([...permisos, ...comunes])];

        todosPermisos.forEach(modulo => {
            if (modulo === 'rentals_dashboard') return; // Skip self

            const meta = APP_METADATA[modulo] || { name: modulo, icon: '/static/img/logo.png', path: `static/${modulo}.html` };

            const card = document.createElement('a');
            card.href = `#${modulo}`;
            card.className = 'app-card';
            card.onclick = (e) => loadContent(e, meta.path || `static/${modulo}.html`, card);
            card.innerHTML = `
                <img src="${meta.icon}" class="app-icon" alt="${meta.name}">
                <div class="app-name">${meta.name}</div>
            `;
            grid.appendChild(card);
        });
    }

    // 2. Cargar Alertas
    const listContainer = document.getElementById('expiring-contracts-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p>Cargando...</p>';

    try {
        const contracts = await fetchData(`/api/rentals/contracts/expiring?negocio_id=${negocioId}&days=30`);
        listContainer.innerHTML = '';

        if (contracts.length === 0) {
            listContainer.innerHTML = '<p>No hay contratos próximos a vencer.</p>';
            return;
        }

        const ul = document.createElement('ul');
        contracts.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${c.cliente_nombre}</strong> - ${c.unidad_nombre} (Vence: ${c.fecha_fin})`;
            ul.appendChild(li);
        });
        listContainer.appendChild(ul);
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<p class="text-danger">Error al cargar alertas.</p>';
    }
}

// --- UNITS ---
async function loadUnits() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) return;

    try {
        // Doble check por si acaso
        const tbody = document.getElementById('rentals-units-table');
        if (!tbody) return;

        const units = await fetchData(`/api/negocios/${negocioId}/rentals/units`);
        tbody.innerHTML = '';

        if (units.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay unidades registradas.</td></tr>';
            return;
        }

        units.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.nombre}</td>
                <td>${u.tipo}</td>
                <td><span class="badge ${getStatusClass(u.estado)}">${u.estado}</span></td>
                <td>${u.ubicacion_actual || '-'}</td>
                <td>$${u.precio_base_alquiler || 0}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="editarUnidad(${u.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarUnidad(${u.id})">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        mostrarNotificacion('Error cargando unidades', 'error');
    }
}

function getStatusClass(status) {
    if (status === 'disponible') return 'bg-success';
    if (status === 'alquilado') return 'bg-primary';
    return 'bg-warning text-dark';
}

function setupUnitsListeners() {
    window.abrirModalUnidadRental = (id = null) => {
        const modal = document.getElementById('modal-rental-unit');
        if (!modal) return;
        document.getElementById('form-rental-unit').reset();
        document.getElementById('unit-id').value = '';

        if (id) {
            // Cargar datos para editar (esto requeriría tener los datos o un fetch individual)
            // Por simplicidad en este parche, asumimos que no implementamos "Editar" full aquí
            // o que la lógica de editar ya estaba y la mantenemos simple.
            // TODO: Implementar fetch unit details if needed
        }

        modal.style.display = 'block';
    };

    window.cerrarModalUnidadRental = () => {
        const modal = document.getElementById('modal-rental-unit');
        if (modal) modal.style.display = 'none';
    };

    window.editarUnidad = async (id) => {
        // Implementación rápida de fetch para editar
        try {
            const units = await fetchData(`/api/negocios/${appState.negocioActivoId}/rentals/units`);
            const u = units.find(unit => unit.id === id);
            if (u) {
                document.getElementById('unit-id').value = u.id;
                document.getElementById('unit-nombre').value = u.nombre;
                document.getElementById('unit-tipo').value = u.tipo;
                document.getElementById('unit-estado').value = u.estado;
                document.getElementById('unit-costo').value = u.costo_adquisicion;
                document.getElementById('unit-precio').value = u.precio_base_alquiler;
                document.getElementById('unit-ubicacion').value = u.ubicacion_actual;
                const modal = document.getElementById('modal-rental-unit');
                if (modal) modal.style.display = 'block';
            }
        } catch (e) { console.error(e); }
    };

    window.eliminarUnidad = async (id) => {
        if (!confirm('¿Seguro que deseas eliminar esta unidad?')) return;
        try {
            await sendData(`/api/rentals/units/${id}`, {}, 'DELETE');
            mostrarNotificacion('Unidad eliminada', 'success');
            loadUnits();
        } catch (e) {
            mostrarNotificacion('Error al eliminar', 'error');
        }
    };

    const form = document.getElementById('form-rental-unit');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('unit-id').value;
            const data = {
                nombre: document.getElementById('unit-nombre').value,
                tipo: document.getElementById('unit-tipo').value,
                estado: document.getElementById('unit-estado').value,
                costo_adquisicion: document.getElementById('unit-costo').value,
                precio_base_alquiler: document.getElementById('unit-precio').value,
                ubicacion_actual: document.getElementById('unit-ubicacion').value
            };

            try {
                const negocioId = appState.negocioActivoId;
                if (id) {
                    await sendData(`/api/rentals/units/${id}`, data, 'PUT');
                } else {
                    await sendData(`/api/negocios/${negocioId}/rentals/units`, data, 'POST');
                }
                mostrarNotificacion('Guardado con éxito', 'success');
                window.cerrarModalUnidadRental();
                loadUnits();
            } catch (e) {
                mostrarNotificacion('Error al guardar', 'error');
            }
        };
    }
}

// --- CONTRACTS ---
async function loadContracts() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) return;

    try {
        const tbody = document.getElementById('rentals-contracts-table');
        if (!tbody) return;

        const contracts = await fetchData(`/api/negocios/${negocioId}/rentals/contracts`);
        tbody.innerHTML = '';

        contracts.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.cliente_nombre}</td>
                <td>${c.unidad_nombre}</td>
                <td>${c.fecha_inicio}</td>
                <td>${c.fecha_fin}</td>
                <td>${c.estado}</td>
                <td>$${c.monto_mensual}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="verPagos(${c.id})">💰 Pagos</button>
                    <button class="btn btn-sm btn-secondary" onclick="editarContrato(${c.id})">✏️</button>
                    ${c.estado === 'activo' ? `<button class="btn btn-sm btn-warning" onclick="finalizarContrato(${c.id})">🏁 Fin</button>` : ''}
                    ${c.archivo_contrato ? `<a href="/static/rentals/uploads/${c.archivo_contrato}" target="_blank" class="btn btn-sm btn-secondary">📄</a>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        mostrarNotificacion('Error cargando contratos', 'error');
    }
}

let map = null;
let marker = null;

function setupContractsListeners() {
    window.abrirModalContrato = async () => {
        const modal = document.getElementById('modal-rental-contract');
        if (!modal) return;

        const negocioId = appState.negocioActivoId;
        // Load Clients
        const clientes = await fetchData(`/api/negocios/${negocioId}/clientes`);
        const selCliente = document.getElementById('contract-cliente');
        selCliente.innerHTML = '';
        clientes.forEach(c => {
            selCliente.appendChild(new Option(c.nombre, c.id));
        });

        // Load Available Units
        const units = await fetchData(`/api/negocios/${negocioId}/rentals/units`);
        const selUnidad = document.getElementById('contract-unidad');
        selUnidad.innerHTML = '';
        units.filter(u => u.estado === 'disponible').forEach(u => {
            selUnidad.appendChild(new Option(`${u.nombre} ($${u.precio_base_alquiler})`, u.id));
        });

        document.getElementById('form-rental-contract').reset();
        document.getElementById('contract-id').value = ''; // Clear ID for new contract
        modal.style.display = 'block';

        // Init Map after Modal is visible (Leaflet requirement)
        setTimeout(() => {
            initMap();
            if (map) {
                map.invalidateSize();
            }
        }, 100);
    };

    window.cerrarModalContrato = () => {
        const modal = document.getElementById('modal-rental-contract');
        if (modal) modal.style.display = 'none';
    };

    function initMap() {
        if (map) return; // Already initialized
        const defaultLat = -33.29501;
        const defaultLng = -66.33563;

        map = L.map('map-container').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', function (e) {
            if (marker) map.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(map);
            document.getElementById('contract-lat').value = e.latlng.lat;
            document.getElementById('contract-lng').value = e.latlng.lng;
        });
    }

    const form = document.getElementById('form-rental-contract');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();

            // Build FormData manually
            const dataFields = {
                cliente_id: document.getElementById('contract-cliente').value,
                unidad_id: document.getElementById('contract-unidad').value,
                fecha_inicio: document.getElementById('contract-inicio').value,
                fecha_fin: document.getElementById('contract-fin').value,
                monto_mensual: document.getElementById('contract-monto').value,
                dia_vencimiento_pago: document.getElementById('contract-dia-pago').value,
                notas: document.getElementById('contract-notas').value,
                latitud: document.getElementById('contract-lat').value,
                longitud: document.getElementById('contract-lng').value,
                costo_traslado: document.getElementById('contract-costo-traslado').value,
                traslado_a_cargo: document.getElementById('contract-traslado-cargo').value
            };

            if (!dataFields.cliente_id || !dataFields.unidad_id || !dataFields.fecha_inicio || !dataFields.fecha_fin) {
                mostrarNotificacion("Complete los campos obligatorios", "warning");
                return;
            }

            for (const key in dataFields) {
                formData.append(key, dataFields[key]);
            }

            const fileInput = document.getElementById('contract-archivo');
            if (fileInput.files[0]) {
                formData.append('archivo_contrato', fileInput.files[0]);
            }

            const photosInput = document.getElementById('contract-fotos');
            if (photosInput.files.length > 0) {
                for (let i = 0; i < photosInput.files.length; i++) {
                    formData.append('fotos_estado', photosInput.files[i]);
                }
            }

            const contractId = document.getElementById('contract-id').value;

            try {
                const negocioId = appState.negocioActivoId;
                const token = localStorage.getItem('jwt_token');
                let url = `/api/negocios/${negocioId}/rentals/contracts`;
                let method = 'POST';

                if (contractId) {
                    url = `/api/rentals/contracts/${contractId}`;
                    method = 'PUT';
                    // Para PUT convertimos a JSON porque requests.form es tricky con files en updates s/n soporte explicito
                    const data = {};
                    formData.forEach((value, key) => { data[key] = value });
                    delete data.archivo_contrato;
                    delete data.fotos_estado;
                    await sendData(url, data, 'PUT');
                } else {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || 'Error saving contract');
                    }
                }

                mostrarNotificacion('Operación exitosa', 'success');
                window.cerrarModalContrato();
                loadContracts();
            } catch (e) {
                console.error(e);
                mostrarNotificacion(e.message || 'Error al guardar', 'error');
            }
        };
    }
}


window.editarContrato = async (id) => {
    const contracts = await fetchData(`/api/negocios/${appState.negocioActivoId}/rentals/contracts`);
    const c = contracts.find(x => x.id === id);
    if (!c) return;

    // Open modal
    await window.abrirModalContrato();

    // Fill data
    document.getElementById('contract-id').value = c.id;
    document.getElementById('contract-cliente').value = c.cliente_id;
    // Unidad might not be in the list if it's already rented!
    // We need to add it temporarily if missing
    const selUnidad = document.getElementById('contract-unidad');
    if (![...selUnidad.options].some(o => o.value == c.unidad_id)) {
        selUnidad.add(new Option(`${c.unidad_nombre} (Actual)`, c.unidad_id));
    }
    document.getElementById('contract-unidad').value = c.unidad_id;

    document.getElementById('contract-inicio').value = c.fecha_inicio;
    document.getElementById('contract-fin').value = c.fecha_fin;
    document.getElementById('contract-monto').value = c.monto_mensual;

    document.getElementById('contract-lat').value = c.latitud || '';
    document.getElementById('contract-lng').value = c.longitud || '';
    document.getElementById('contract-traslado-cargo').value = c.traslado_a_cargo || 'cliente';
    document.getElementById('contract-traslado-costo').value = c.costo_traslado || 0;

    if (map && c.latitud && c.longitud) {
        if (marker) map.removeLayer(marker);
        marker = L.marker([c.latitud, c.longitud]).addTo(map);
        map.setView([c.latitud, c.longitud], 13);
    }
};

window.finalizarContrato = async (id) => {
    if (!confirm('¿Finalizar este contrato? La unidad pasará a estar disponible.')) return;
    try {
        await sendData(`/api/rentals/contracts/${id}/status`, { estado: 'finalizado' }, 'PATCH');
        mostrarNotificacion('Contrato finalizado', 'success');
        loadContracts();
        loadUnits(); // Refrescar unidades también
    } catch (e) {
        mostrarNotificacion('Error al finalizar', 'error');
    }
};

// Payments Logic
window.cerrarModalPagos = () => {
    document.getElementById('modal-rental-payments').style.display = 'none';
};

window.verPagos = async (contractId) => {
    document.getElementById('payment-contract-id').value = contractId;
    const payments = await fetchData(`/api/rentals/contracts/${contractId}/payments`);
    const tbody = document.getElementById('payments-list-body');
    tbody.innerHTML = '';
    payments.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.periodo}</td><td>$${p.monto_pagado}</td><td>${p.fecha_pago}</td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('modal-rental-payments').style.display = 'flex';
};

const formPayment = document.getElementById('form-payment');
if (formPayment) formPayment.onsubmit = async (e) => {
    e.preventDefault();
    const contractId = document.getElementById('payment-contract-id').value;
    const data = {
        periodo: document.getElementById('payment-period').value,
        monto_pagado: document.getElementById('payment-amount').value
    };

    try {
        await sendData(`/api/rentals/contracts/${contractId}/payments`, data, 'POST');
        mostrarNotificacion('Pago registrado', 'success');
        window.verPagos(contractId); // Reload list
        document.getElementById('form-payment').reset();
        document.getElementById('payment-contract-id').value = contractId; // Restore ID
    } catch (e) {
        mostrarNotificacion('Error al registrar pago', 'error');
    }
};
