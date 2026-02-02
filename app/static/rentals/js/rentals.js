import { fetchData, sendData } from '../../js/api.js';
import { appState, loadContent } from '../../js/main.js';
import { mostrarNotificacion } from '../../js/modules/notifications.js';

export async function inicializarRentals(pageName) {
    console.log(`Inicializando Rentals: ${pageName}`);
    if (pageName === 'rentals_dashboard') {
        loadDashboard();
    } else if (pageName === 'rentals_units') {
        loadUnits();
        setupUnitsListeners();
    } else if (pageName === 'rentals_contracts') {
        loadContracts();
        setupContractsListeners();
    }
}

// --- DASHBOARD ---
async function loadDashboard() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) return;

    const listContainer = document.getElementById('expiring-contracts-list');
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
        const units = await fetchData(`/api/negocios/${negocioId}/rentals/units`);
        const tbody = document.getElementById('rentals-units-table');
        tbody.innerHTML = '';

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
        document.getElementById('form-rental-unit').reset();
        document.getElementById('unit-id').value = '';
        document.getElementById('modal-rental-unit').style.display = 'flex';
        if (id) {
             // Fetch specific unit details if needed or pass full object
             // For simplicity, we assume we reload or fetch
        }
    };

    window.cerrarModalUnidadRental = () => {
        document.getElementById('modal-rental-unit').style.display = 'none';
    };

    window.editarUnidad = async (id) => {
        // Fetch unit data to fill form
        // Simplified: reloading list contains data, but better to fetch single or find in cache
        // Let's fetch single for robustness? Or iterate cache.
        // Assuming we need to fill the form:
        // Using a hack to find row data from DOM or re-fetch.
        // Re-fetching list is cheap.
        // Or fetch single endpoint I didn't verify if I created it?
        // Ah, I created update PUT but not GET single.
        // So I rely on list.
        const negocioId = appState.negocioActivoId;
        const units = await fetchData(`/api/negocios/${negocioId}/rentals/units`);
        const unit = units.find(u => u.id === id);
        if (unit) {
            document.getElementById('unit-id').value = unit.id;
            document.getElementById('unit-nombre').value = unit.nombre;
            document.getElementById('unit-tipo').value = unit.tipo;
            document.getElementById('unit-estado').value = unit.estado;
            document.getElementById('unit-costo').value = unit.costo_adquisicion;
            document.getElementById('unit-precio').value = unit.precio_base_alquiler;
            document.getElementById('unit-ubicacion').value = unit.ubicacion_actual;
            document.getElementById('modal-rental-unit').style.display = 'flex';
        }
    };

    window.eliminarUnidad = async (id) => {
        if(!confirm('¿Seguro de eliminar?')) return;
        try {
            await sendData(`/api/rentals/units/${id}`, {}, 'DELETE');
            mostrarNotificacion('Unidad eliminada', 'success');
            loadUnits();
        } catch(e) {
            mostrarNotificacion('Error al eliminar', 'error');
        }
    };

    document.getElementById('form-rental-unit').onsubmit = async (e) => {
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
        } catch(e) {
            mostrarNotificacion('Error al guardar', 'error');
        }
    };
}

// --- CONTRACTS ---
async function loadContracts() {
    const negocioId = appState.negocioActivoId;
    if (!negocioId) return;

    try {
        const contracts = await fetchData(`/api/negocios/${negocioId}/rentals/contracts`);
        const tbody = document.getElementById('rentals-contracts-table');
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
        const negocioId = appState.negocioActivoId;
        // Load Clients
        const clientes = await fetchData(`/api/negocios/${negocioId}/clientes`);
        const selCliente = document.getElementById('contract-cliente');
        selCliente.innerHTML = '';
        clientes.forEach(c => selCliente.add(new Option(c.nombre, c.id)));

        // Load Available Units
        const units = await fetchData(`/api/negocios/${negocioId}/rentals/units`);
        const selUnidad = document.getElementById('contract-unidad');
        selUnidad.innerHTML = '';
        units.filter(u => u.estado === 'disponible').forEach(u => selUnidad.add(new Option(`${u.nombre} ($${u.precio_base_alquiler})`, u.id)));

        document.getElementById('form-rental-contract').reset();
        document.getElementById('modal-rental-contract').style.display = 'flex';

        // Init Map after Modal is visible (Leaflet requirement)
        setTimeout(() => {
            initMap();
            if (map) {
                map.invalidateSize();
            }
        }, 100);
    };

    window.cerrarModalContrato = () => {
        document.getElementById('modal-rental-contract').style.display = 'none';
    };

    function initMap() {
        if (map) return; // Already initialized
        // Default: San Luis, Argentina (approx center of activity for this client context)
        // Or generic Latam center
        const defaultLat = -33.29501;
        const defaultLng = -66.33563;

        map = L.map('map-container').setView([defaultLat, defaultLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', function(e) {
            if (marker) map.removeLayer(marker);
            marker = L.marker(e.latlng).addTo(map);
            document.getElementById('contract-lat').value = e.latlng.lat;
            document.getElementById('contract-lng').value = e.latlng.lng;
        });
    }

    document.getElementById('form-rental-contract').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(); // Use FormData for file upload

        formData.append('cliente_id', document.getElementById('contract-cliente').value);
        formData.append('unidad_id', document.getElementById('contract-unidad').value);
        formData.append('fecha_inicio', document.getElementById('contract-inicio').value);
        formData.append('fecha_fin', document.getElementById('contract-fin').value);
        formData.append('monto_mensual', document.getElementById('contract-monto').value);

        // New Fields
        formData.append('latitud', document.getElementById('contract-lat').value);
        formData.append('longitud', document.getElementById('contract-lng').value);
        formData.append('traslado_a_cargo', document.getElementById('contract-traslado-cargo').value);
        formData.append('costo_traslado', document.getElementById('contract-traslado-costo').value);

        const fileInput = document.getElementById('contract-file');
        if (fileInput.files[0]) {
            formData.append('archivo_contrato', fileInput.files[0]);
        }

        const photosInput = document.getElementById('contract-photos');
        if (photosInput.files.length > 0) {
            for (let i = 0; i < photosInput.files.length; i++) {
                formData.append('fotos_estado', photosInput.files[i]);
            }
        }

        try {
            const negocioId = appState.negocioActivoId;
            // Native fetch for FormData as api.js sendData might use JSON
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/negocios/${negocioId}/rentals/contracts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Do NOT set Content-Type, browser sets it with boundary
                },
                body: formData
            });

            if (!response.ok) throw new Error('Error saving contract');

            mostrarNotificacion('Contrato creado', 'success');
            window.cerrarModalContrato();
            loadContracts();
        } catch(e) {
             console.error(e);
            mostrarNotificacion('Error al guardar contrato', 'error');
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

    document.getElementById('form-payment').onsubmit = async (e) => {
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
        } catch(e) {
            mostrarNotificacion('Error al registrar pago', 'error');
        }
    };
}
