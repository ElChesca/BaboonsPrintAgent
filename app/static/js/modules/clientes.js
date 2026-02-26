import { fetchData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

const formatCurrency = (n) => (n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
let todosLosClientes = []; // Caché para guardar todos los clientes y agilizar la búsqueda.
let map, marker; // Referencias para el mapa de georeferencia

// Variables de paginación
let currentPage = 1;
let itemsPerPage = 50;
let totalItems = 0;
let currentSearch = '';
let currentRevisionFilter = 'all';
let currentZonaFilter = '';
let selectedClienteIds = new Set(); // ✨ Selección masiva



async function cargarLeafletJS() {
    if (window.L) return;
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function inicializarMapaSeleccion() {
    await cargarLeafletJS();

    if (map) {
        // ✨ LÓGICA DEFENSIVA: Si el mapa existe pero el contenedor ya no está en el DOM (porque cambiamos de vista), reiniciamos.
        const container = map.getContainer();
        const currentContainer = document.getElementById('map-selector');

        if (container !== currentContainer || !document.body.contains(container)) {
            map.remove();
            map = null;
            marker = null;
        } else {
            map.invalidateSize();
            return;
        }
    }

    // Ubicación por defecto: San Luis, Argentina
    const latDefault = -33.3017;
    const lngDefault = -66.3378;

    map = L.map('map-selector').setView([latDefault, lngDefault], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setMarker(lat, lng);
    });

    setTimeout(() => map.invalidateSize(), 150);
}

function setMarker(lat, lng) {
    if (!map) return;

    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            document.getElementById('cliente-lat').value = pos.lat.toFixed(6);
            document.getElementById('cliente-lng').value = pos.lng.toFixed(6);
        });
    }
    document.getElementById('cliente-lat').value = lat.toFixed(6);
    document.getElementById('cliente-lng').value = lng.toFixed(6);
}

function renderTablaClientes(clientes) {
    const tbody = document.querySelector('#tabla-clientes tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!clientes || clientes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No se encontraron clientes.</td></tr>';
        return;
    }

    clientes.forEach(cliente => {
        const nombreLista = cliente.lista_de_precio_nombre || 'General';

        let iconoRevision = '<i class="far fa-check-circle" style="color: #ccc;"></i>'; // Pendiente (gris, outline)
        let tituloRevision = 'Pendiente de revisión';

        if (cliente.revisado) {
            iconoRevision = '<i class="fas fa-check-circle" style="color: #28a745;"></i>'; // Revisado (verde, solid)
            const fecha = new Date(cliente.fecha_revision).toLocaleDateString('es-AR');
            tituloRevision = `Revisado por ${cliente.usuario_revision_nombre || 'Usuario'} el ${fecha}`;
        }

        const zonaLabel = cliente.zona_nombre || cliente.ref_interna || '-';
        const isChecked = selectedClienteIds.has(cliente.id) ? 'checked' : '';
        tbody.innerHTML += `
            <tr data-id="${cliente.id}">
                <td style="padding: 4px 8px; text-align:center;"><input type="checkbox" class="cliente-check" data-id="${cliente.id}" ${isChecked}></td>
                <td style="padding: 4px 8px; font-size: 0.9em;">${cliente.id}</td>
                <td style="padding: 4px 8px; text-align: center; cursor: pointer;" class="celda-revisado" title="${tituloRevision}">
                    ${iconoRevision}
                </td>
                <td style="padding: 4px 8px; font-weight: 500; font-size: 0.9em;">
                    <div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${cliente.nombre}">
                        ${cliente.nombre}
                    </div>
                </td>
                <td style="padding: 4px 8px; font-size: 0.9em;">${cliente.dni || '-'}</td>
                <td style="padding: 4px 8px; font-size: 0.9em;">
                    <span style="background: #e9f0fb; color: #3366cc; border-radius: 4px; padding: 2px 7px; font-size: 0.85em; white-space: nowrap;">${zonaLabel}</span>
                </td>
                <td style="padding: 4px 8px; font-size: 0.9em;">${cliente.condicion_venta || 'Contado'}</td>
                <td class="acciones" style="padding: 4px 8px;">
                    <button class="btn btn-sm btn-secondary btn-editar" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger btn-borrar" title="Borrar"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-sm btn-info btn-cta-cte" title="Cuenta Corriente"><i class="fas fa-file-invoice-dollar"></i></button>
                </td>
            </tr>
        `;
    });

    vincularCheckboxesClientes();
}

// ✨ TABS LOGIC
window.openTab = function (evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }
    const tabBtns = document.getElementsByClassName("tab-btn");
    for (let i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");

    // Si cambiamos a tab logistica y hay mapa, invalidar size
    if (tabName === 'tab-logistica' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
};

// ✨ CARGAR VENDEDORES
async function poblarSelectDeVendedores() {
    const select = document.getElementById('cliente-vendedor');
    if (!select) return;
    try {
        const vendedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);

        // Guardar selección actual si existe
        const valorActual = select.value;

        select.innerHTML = '<option value="">-- Sin Vendedor --</option>';
        vendedores.forEach(v => {
            select.innerHTML += `<option value="${v.id}">${v.nombre}</option>`;
        });

        // Restaurar selección
        if (valorActual) select.value = valorActual;

    } catch (error) {
        console.error("Error al cargar vendedores:", error);
    }
}

async function inicializarSelectores() {
    await Promise.all([poblarSelectDeListas(), poblarSelectDeVendedores()]);
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
    document.getElementById('cliente-lista-precios').value = cliente.lista_de_precio_id || '';
    document.getElementById('cliente-credito').value = cliente.credito_maximo || 0;
    document.getElementById('cliente-ref').value = cliente.ref_interna || '';
    document.getElementById('cliente-actividad').value = cliente.actividad || '';

    // ✨ Nuevos Campos
    document.getElementById('cliente-vendedor').value = cliente.vendedor_id || '';
    document.getElementById('visita-lunes').checked = cliente.visita_lunes || false;
    document.getElementById('visita-martes').checked = cliente.visita_martes || false;
    document.getElementById('visita-miercoles').checked = cliente.visita_miercoles || false;
    document.getElementById('visita-jueves').checked = cliente.visita_jueves || false;
    document.getElementById('visita-viernes').checked = cliente.visita_viernes || false;
    document.getElementById('visita-sabado').checked = cliente.visita_sabado || false;
    document.getElementById('visita-domingo').checked = cliente.visita_domingo || false;

    // ✨ Geolocalización
    const lat = cliente.latitud;
    const lng = cliente.longitud;
    document.getElementById('cliente-lat').value = lat || '';
    // ✨ Reset Tabs
    document.querySelector('.tab-btn[onclick*="tab-general"]').click();

    if (lat && lng && map) {
        setMarker(lat, lng);
        map.setView([lat, lng], 15);
    } else if (marker) {
        map.removeLayer(marker);
        marker = null;
    }

    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'inline-block';

    // ✨ Actualizar UI según tipo
    toggleCamposPotencial();

    // ✨ ABRIR MODAL
    document.getElementById('modal-cliente').style.display = 'flex';
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 100);

    window.scrollTo(0, 0);
}

async function resetFormulario() {
    document.getElementById('form-cliente-titulo').textContent = 'Añadir Nuevo Cliente';
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-lat').value = '';
    document.getElementById('cliente-lng').value = '';

    if (marker && map) {
        map.removeLayer(marker);
        marker = null;
    }

    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'none';

    // ✨ Reset New Fields
    document.getElementById('cliente-vendedor').value = '';
    ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(dia => {
        document.getElementById(`visita-${dia}`).checked = false;
    });

    // ✨ Reset Tabs
    if (document.querySelector('.tab-btn[onclick*="tab-general"]'))
        document.querySelector('.tab-btn[onclick*="tab-general"]').click();

    // ✨ LÓGICA PARA ASIGNAR LA LISTA POR DEFECTO ✨
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`);
        if (configs.lista_precio_defecto_id) {
            document.getElementById('cliente-lista-precios').value = configs.lista_precio_defecto_id;
        }
    } catch (error) {
        console.log("No se encontró configuración de lista por defecto, se usará la general.");
    }


    // ✨ Restaurar UI
    toggleCamposPotencial();

    // ✨ Restaurar UI
    toggleCamposPotencial();

    // ❌ ELIMINADO: No cerramos el modal aquí para evitar condiciones de carrera
}

async function abrirModalNuevoCliente() {
    await resetFormulario(); // Limpia campos (esperamos a que termine)
    document.getElementById('form-cliente-titulo').textContent = 'Añadir Nuevo Cliente';
    document.getElementById('btn-cancelar-edicion-cliente').style.display = 'inline-block'; // Cancelar cierra modal
    document.getElementById('modal-cliente').style.display = 'flex';

    // Asignar lista por defecto si existe (poblarSelect ya corrió, solo seteamos value)
    // ... logic inside resetFormulario handles defaults, we just open

    // Iniciar Mapa
    setTimeout(() => {
        if (!map) {
            inicializarMapaSeleccion();
        } else {
            map.invalidateSize();
        }
    }, 100);
}

function toggleCamposPotencial() {
    const tipo = document.getElementById('cliente-tipo').value;
    const esPotencial = tipo === 'Potencial';

    // Campos a ocultar/mostrar simplificado
    const camposOpcionales = [
        'cliente-documento',
        'cliente-iva',
        'cliente-condicion',
        'cliente-credito',
        'cliente-ref'
    ];

    camposOpcionales.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            const formGroup = input.closest('.form-group');
            if (formGroup) {
                // Podríamos ocultarlos o solo quitarles el required visualmente
                // Para Potencial, ocultamos IVA y Condición para simplificar la carga rápida
                if (['cliente-iva', 'cliente-condicion'].includes(id)) {
                    formGroup.style.display = esPotencial ? 'none' : 'block';
                }
            }
        }
    });

    // Cambiar placeholder o label si es necesario
    const labelDni = document.querySelector('label[for="cliente-documento"]');
    if (labelDni) {
        labelDni.textContent = esPotencial ? 'Documento (Opcional):' : 'Documento (CUIT/DNI):';
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

    // ✨ ELEMENTOS DEL NUEVO MODAL
    const modalCliente = document.getElementById('modal-cliente');
    const btnNuevoCliente = document.getElementById('btn-nuevo-cliente');
    const closeClienteModalBtn = document.getElementById('close-cliente-modal');

    if (!form || !tablaClientes || !modalCtaCte) return;

    inicializarSelectores(); // Cargar listas y vendedores
    inicializarMapaSeleccion(); // ✨ Iniciamos el mapa para georeferencia

    // ✨ Listener para cambio de tipo
    document.getElementById('cliente-tipo').addEventListener('change', toggleCamposPotencial);

    // ✨ LISTENERS DEL MODAL
    if (btnNuevoCliente) {
        btnNuevoCliente.addEventListener('click', abrirModalNuevoCliente);
    }
    if (closeClienteModalBtn) {
        closeClienteModalBtn.addEventListener('click', () => modalCliente.style.display = 'none');
    }
    window.addEventListener('click', (e) => {
        if (e.target === modalCliente) {
            modalCliente.style.display = 'none';
        }
    });

    // cargarClientes movido a scope global para soporte de paginación

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
            ref_interna: document.getElementById('cliente-ref').value,
            actividad: document.getElementById('cliente-actividad').value,
            latitud: document.getElementById('cliente-lat').value ? parseFloat(document.getElementById('cliente-lat').value) : null,
            longitud: document.getElementById('cliente-lng').value ? parseFloat(document.getElementById('cliente-lng').value) : null,
            // Nuevos Campos
            vendedor_id: document.getElementById('cliente-vendedor').value || null,
            visita_lunes: document.getElementById('visita-lunes').checked,
            visita_martes: document.getElementById('visita-martes').checked,
            visita_miercoles: document.getElementById('visita-miercoles').checked,
            visita_jueves: document.getElementById('visita-jueves').checked,
            visita_viernes: document.getElementById('visita-viernes').checked,
            visita_sabado: document.getElementById('visita-sabado').checked,
            visita_domingo: document.getElementById('visita-domingo').checked
        };
        const esEdicion = !!clienteId;
        const url = esEdicion ? `/api/clientes/${clienteId}` : `/api/negocios/${appState.negocioActivoId}/clientes`;
        const method = esEdicion ? 'PUT' : 'POST';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';

        try {
            const response = await fetchData(url, { method, body: JSON.stringify(payload) });
            mostrarNotificacion(response.message || `Cliente ${esEdicion ? 'actualizado' : 'creado'} con éxito.`, 'success');
            await resetFormulario();
            document.getElementById('modal-cliente').style.display = 'none'; // ✨ Cerramos explícitamente tras éxito
            cargarClientes();
        } catch (error) {
            mostrarNotificacion(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar';
        }
    });

    let timeoutId;
    buscador.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            currentSearch = buscador.value;
            currentPage = 1;
            cargarClientes();
        }, 300);
    });

    const filtroRevisado = document.getElementById('filtro-revisado');
    if (filtroRevisado) {
        filtroRevisado.addEventListener('change', () => {
            currentRevisionFilter = filtroRevisado.value;
            currentPage = 1;
            cargarClientes();
        });
    }

    // ✨ Filtro por Zona
    const filtroZona = document.getElementById('filtro-zona');
    if (filtroZona) {
        // Poblar el select con las zonas disponibles
        fetchData(`/api/negocios/${appState.negocioActivoId}/clientes/zonas`)
            .then(zonas => {
                filtroZona.innerHTML = '<option value="">Todas las zonas</option>';
                zonas.forEach(z => {
                    filtroZona.innerHTML += `<option value="${z}">${z}</option>`;
                });
            })
            .catch(() => { });

        filtroZona.addEventListener('change', () => {
            currentZonaFilter = filtroZona.value;
            currentPage = 1;
            cargarClientes();
        });
    }

    btnCancelar.addEventListener('click', () => {
        resetFormulario();
        document.getElementById('modal-cliente').style.display = 'none'; // ✨ Cerramos explícitamente al cancelar
    });

    tablaClientes.addEventListener('click', (e) => {
        const fila = e.target.closest('tr');
        if (!fila || !fila.dataset.id) return;

        const clienteId = fila.dataset.id;
        const cliente = todosLosClientes.find(c => c.id == clienteId);
        if (!cliente) return;

        if (e.target.classList.contains('btn-editar') || e.target.closest('.btn-editar')) {
            poblarFormulario(cliente);
        } else if (e.target.classList.contains('btn-borrar') || e.target.closest('.btn-borrar')) {
            if (confirm(`¿Estás seguro de que quieres eliminar a ${cliente.nombre}?`)) {
                fetchData(`/api/clientes/${clienteId}`, { method: 'DELETE' })
                    .then(() => {
                        mostrarNotificacion('Cliente eliminado con éxito.', 'success');
                        cargarClientes();
                    })
                    .catch(error => mostrarNotificacion(error.message, 'error'));
            }
        } else if (e.target.classList.contains('btn-cta-cte') || e.target.closest('.btn-cta-cte')) {
            // ✨ CORRECCIÓN: Pasamos el objeto 'cliente' completo.
            mostrarCuentaCorriente(cliente);
        } else if (e.target.closest('.celda-revisado')) {
            // ✨ TOGGLE REVISADO
            toggleRevisionCliente(clienteId);
        }
    });

    closeModalBtn.addEventListener('click', () => modalCtaCte.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === modalCtaCte) {
            modalCtaCte.style.display = 'none';
        }
    });

    cargarClientes();
    setupBulkActionsClientes();

    // ✨ LÓGICA IMPORTACIÓN CSV ✨
    const btnImportar = document.getElementById('btn-importar-csv');
    const modalImportar = document.getElementById('modal-importar-csv');
    const closeImportModal = document.getElementById('close-import-modal');
    const formImportar = document.getElementById('form-importar-csv');

    if (btnImportar && modalImportar) {
        btnImportar.addEventListener('click', () => {
            modalImportar.style.display = 'flex';
            document.getElementById('import-result').innerHTML = '';
            formImportar.reset();
        });

        // ✨ NUEVO: Descargar Plantilla
        const btnTemplate = document.getElementById('btn-descargar-plantilla');
        if (btnTemplate) {
            btnTemplate.addEventListener('click', async () => {
                const token = localStorage.getItem('jwt_token');
                try {
                    const response = await fetch(`/api/negocios/${appState.negocioActivoId}/importar/plantilla`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = "plantilla_clientes.xlsx";
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                    } else {
                        mostrarNotificacion("Error al descargar plantilla", "error");
                    }
                } catch (e) {
                    console.error(e);
                    mostrarNotificacion("Error de red al descargar", "error");
                }
            });
        }

        closeImportModal.addEventListener('click', () => modalImportar.style.display = 'none');

        window.addEventListener('click', (e) => {
            if (e.target === modalImportar) modalImportar.style.display = 'none';
        });

        formImportar.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('file-csv');
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            const submitBtn = formImportar.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Procesando...';
            document.getElementById('import-result').innerHTML = '<p>Subiendo archivo...</p>';

            try {
                // Not using fetchData because it sets Content-Type to application/json by default
                // We need browser to set multipart/form-data boundary
                const token = localStorage.getItem('jwt_token');
                const response = await fetch(`/api/negocios/${appState.negocioActivoId}/importar/clientes`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    let html = `<p style="color: green;">✅ ${data.message}</p>`;
                    if (data.errores && data.errores.length > 0) {
                        html += `<p style="color: orange;">⚠️ Se importaron con advertencias:</p><ul>`;
                        // Mostrar solo los primeros 10 errores en UI para no saturar
                        data.errores.slice(0, 10).forEach(err => html += `<li>${err}</li>`);
                        if (data.errores.length > 10) html += `<li>... y ${data.errores.length - 10} más.</li>`;
                        html += `</ul>`;
                    }
                    document.getElementById('import-result').innerHTML = html;
                    mostrarNotificacion('Importación completada', 'success');
                    cargarClientes(); // Recargar tabla
                } else {
                    document.getElementById('import-result').innerHTML = `<p style="color: red;">❌ Error: ${data.error}</p>`;
                    mostrarNotificacion(data.error, 'error');
                }
            } catch (error) {
                document.getElementById('import-result').innerHTML = `<p style="color: red;">❌ Error de red: ${error.message}</p>`;
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Subir e Importar';
            }
        });
    }
}


// ✨ FUNCIÓN GLOBAL PARA PAGINACIÓN ✨
async function cargarClientes() {
    try {
        const tbody = document.querySelector('#tabla-clientes tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

        const url = `/api/negocios/${appState.negocioActivoId}/clientes?page=${currentPage}&limit=${itemsPerPage}&search=${encodeURIComponent(currentSearch)}&revisado=${currentRevisionFilter}&zona=${encodeURIComponent(currentZonaFilter)}`;
        const response = await fetchData(url);

        const clientes = response.data || [];
        const pagination = response.pagination || {};

        todosLosClientes = clientes; // Actualizar cache

        renderTablaClientes(clientes);
        renderPaginacion(pagination);

    } catch (error) {
        console.error("Error al cargar clientes:", error);
    }
}

async function toggleRevisionCliente(clienteId) {
    try {
        const response = await fetchData(`/api/clientes/${clienteId}/toggle_revision`, { method: 'PUT' });

        if (response.revisado) {
            mostrarNotificacion('Cliente marcado como revisado', 'success');
        } else {
            mostrarNotificacion('Cliente marcado como pendiente', 'info');
        }
        cargarClientes();
    } catch (error) {
        mostrarNotificacion('Error al cambiar estado de revisión: ' + error.message, 'error');
    }
}

function renderPaginacion(pagination) {
    const container = document.getElementById('paginacion-clientes');
    // Si no existe, crearlo dinámicamente después de la tabla
    if (!container) {
        const tableContainer = document.querySelector('.tabla-contenedor');
        if (tableContainer) {
            const div = document.createElement('div');
            div.id = 'paginacion-clientes';
            tableContainer.parentNode.insertBefore(div, tableContainer.nextSibling);
        } else return;
    }

    const totalPages = pagination.total_pages;
    const current = pagination.current_page;
    const totalItems = pagination.total_items;

    if (!totalItems) {
        document.getElementById('paginacion-clientes').innerHTML = '';
        return;
    }

    let html = `
        <div class="pagination-controls" style="display: flex; gap: 10px; align-items: center; justify-content: flex-end; padding: 10px; font-size: 0.9em; background: #f8f9fa; border-top: 1px solid #ddd;">
            <span style="margin-right: 15px; color: #666;">Total: ${totalItems}</span>
            <button class="btn btn-sm btn-secondary" onclick="window.cambiarPagina(${current - 1})" ${current === 1 ? 'disabled' : ''}>&laquo; Anterior</button>
            <span style="font-weight: bold;">${current} / ${totalPages}</span>
            <button class="btn btn-sm btn-secondary" onclick="window.cambiarPagina(${current + 1})" ${current >= totalPages ? 'disabled' : ''}>Siguiente &raquo;</button>
        </div>
    `;
    document.getElementById('paginacion-clientes').innerHTML = html;
}

window.cambiarPagina = (page) => {
    if (page < 1) return;
    currentPage = page;
    cargarClientes();
};

// ---- CHECKBOXES Y ACCIONES MASIVAS ----

function vincularCheckboxesClientes() {
    const checkAll = document.getElementById('check-all-clientes');
    const rowChecks = document.querySelectorAll('.cliente-check');

    if (checkAll) {
        checkAll.onchange = (e) => {
            rowChecks.forEach(cb => {
                const id = parseInt(cb.getAttribute('data-id'));
                cb.checked = e.target.checked;
                if (e.target.checked) selectedClienteIds.add(id);
                else selectedClienteIds.delete(id);
            });
            updateBulkBarClientes();
        };
    }

    rowChecks.forEach(cb => {
        cb.onchange = (e) => {
            const id = parseInt(cb.getAttribute('data-id'));
            if (e.target.checked) selectedClienteIds.add(id);
            else { selectedClienteIds.delete(id); if (checkAll) checkAll.checked = false; }
            updateBulkBarClientes();
        };
    });
}

function updateBulkBarClientes() {
    const bar = document.getElementById('bulk-actions-bar-clientes');
    const countEl = document.getElementById('bulk-count-clientes');
    if (!bar || !countEl) return;
    const count = selectedClienteIds.size;
    countEl.textContent = count;
    bar.style.display = count > 0 ? 'block' : 'none';
}

function setupBulkActionsClientes() {
    const modalZona = document.getElementById('modal-bulk-zona');
    const modalVendedor = document.getElementById('modal-bulk-vendedor');

    // Zona modal
    const btnBulkZona = document.getElementById('btn-bulk-zona');
    if (btnBulkZona) btnBulkZona.onclick = async () => {
        document.getElementById('bulk-zona-count').textContent = selectedClienteIds.size;
        // Poblar zonas
        const selectZona = document.getElementById('bulk-zona-select');
        selectZona.innerHTML = '<option value="">-- Sin zona (desasignar) --</option>';
        try {
            const zonas = await fetchData(`/api/negocios/${appState.negocioActivoId}/zonas`);
            zonas.forEach(z => selectZona.innerHTML += `<option value="${z.id}">${z.nombre}</option>`);
        } catch (e) { console.error(e); }
        modalZona.style.display = 'flex';
    };
    document.getElementById('close-bulk-zona')?.addEventListener('click', () => modalZona.style.display = 'none');
    document.getElementById('cancel-bulk-zona')?.addEventListener('click', () => modalZona.style.display = 'none');
    document.getElementById('confirm-bulk-zona')?.addEventListener('click', async () => {
        const zonaId = document.getElementById('bulk-zona-select').value || null;
        const btn = document.getElementById('confirm-bulk-zona');
        btn.disabled = true; btn.textContent = 'Asignando...';
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes/bulk/zona`, {
                method: 'PUT',
                body: JSON.stringify({ cliente_ids: Array.from(selectedClienteIds), zona_id: zonaId })
            });
            mostrarNotificacion(`${selectedClienteIds.size} clientes actualizados`, 'success');
            selectedClienteIds.clear();
            updateBulkBarClientes();
            modalZona.style.display = 'none';
            cargarClientes();
        } catch (e) { mostrarNotificacion('Error al asignar zona', 'error'); }
        finally { btn.disabled = false; btn.textContent = '✔️ Asignar'; }
    });

    // Vendedor modal
    const btnBulkVendedor = document.getElementById('btn-bulk-vendedor-clientes');
    if (btnBulkVendedor) btnBulkVendedor.onclick = async () => {
        document.getElementById('bulk-vendedor-count').textContent = selectedClienteIds.size;
        const selectVend = document.getElementById('bulk-vendedor-select');
        selectVend.innerHTML = '<option value="">-- Sin vendedor (desasignar) --</option>';
        try {
            const vendedores = await fetchData(`/api/negocios/${appState.negocioActivoId}/vendedores`);
            vendedores.forEach(v => selectVend.innerHTML += `<option value="${v.id}">${v.nombre}</option>`);
        } catch (e) { console.error(e); }
        modalVendedor.style.display = 'flex';
    };
    document.getElementById('close-bulk-vendedor')?.addEventListener('click', () => modalVendedor.style.display = 'none');
    document.getElementById('cancel-bulk-vendedor')?.addEventListener('click', () => modalVendedor.style.display = 'none');
    document.getElementById('confirm-bulk-vendedor')?.addEventListener('click', async () => {
        const vendedorId = document.getElementById('bulk-vendedor-select').value || null;
        const btn = document.getElementById('confirm-bulk-vendedor');
        btn.disabled = true; btn.textContent = 'Asignando...';
        try {
            await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes/bulk/vendedor`, {
                method: 'PUT',
                body: JSON.stringify({ cliente_ids: Array.from(selectedClienteIds), vendedor_id: vendedorId })
            });
            mostrarNotificacion(`${selectedClienteIds.size} clientes actualizados`, 'success');
            selectedClienteIds.clear();
            updateBulkBarClientes();
            modalVendedor.style.display = 'none';
            cargarClientes();
        } catch (e) { mostrarNotificacion('Error al asignar vendedor', 'error'); }
        finally { btn.disabled = false; btn.textContent = '✔️ Asignar'; }
    });

    // Cancelar selección
    document.getElementById('btn-bulk-cancelar-clientes')?.addEventListener('click', () => {
        selectedClienteIds.clear();
        document.querySelectorAll('.cliente-check').forEach(cb => cb.checked = false);
        const checkAll = document.getElementById('check-all-clientes');
        if (checkAll) checkAll.checked = false;
        updateBulkBarClientes();
    });
}