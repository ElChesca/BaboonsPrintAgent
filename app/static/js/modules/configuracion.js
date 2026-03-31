// static/modules/configuracion.js
import { fetchData, sendData } from '../api.js'; // Asegúrate de importar sendData
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';
import { showGlobalLoader, hideGlobalLoader } from '../uiHelpers.js';

async function cargarConfiguracion() {
    try {
        const configs = await fetchData(`/api/negocios/${appState.negocioActivoId}/configuraciones`);

        // Asigna los valores a cada input/select que tenga un 'data-clave'
        document.querySelectorAll('#form-configuracion [data-clave]').forEach(async input => {
            const clave = input.dataset.clave;
            if (configs && configs[clave]) {
                input.value = configs[clave];
                
                // Si es el cliente por defecto, buscamos su nombre para mostrarlo
                if (clave === 'cliente_defecto_id' && configs[clave]) {
                    try {
                        const cliente = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes/${configs[clave]}`);
                        if (cliente && cliente.nombre) {
                            document.getElementById('config-cliente-defecto-nombre').value = cliente.nombre;
                        }
                    } catch (e) {
                        console.warn("No se pudo cargar el nombre del cliente por defecto.");
                    }
                }
            }
        });
    } catch (error) {
        mostrarNotificacion('No se pudo cargar la configuración.', 'error');
    }
}

async function guardarConfiguracion(e) {
    e.preventDefault();
    const payload = {};

    // Recoge los valores de todos los inputs/selects con 'data-clave'
    document.querySelectorAll('#form-configuracion [data-clave]').forEach(input => {
        const clave = input.dataset.clave;
        payload[clave] = input.value;
    });

    try {
        // Usamos sendData para enviar los datos con el método POST
        const response = await sendData(`/api/negocios/${appState.negocioActivoId}/configuraciones`, payload, 'POST');
        mostrarNotificacion(response.message, 'success');
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

export function inicializarConfiguracion() {
    const form = document.getElementById('form-configuracion');
    if (!form) return;

    // Cargamos la configuración y las listas (pero ya no los clientes masivamente)
    cargarConfiguracion();
    cargarListasEnSelector();

    form.addEventListener('submit', guardarConfiguracion);

    const btnTestMP = document.getElementById('btn-test-mp');
    if (btnTestMP) {
        btnTestMP.onclick = async () => {
            const deviceId = document.getElementById('config-mp-device-id').value;
            const accessToken = document.getElementById('config-mp-access-token').value;

            if (!deviceId || !accessToken) {
                mostrarNotificacion("Por favor, ingrese el Access Token y el Device ID antes de probar.", "warning");
                return;
            }

            try {
                btnTestMP.disabled = true;
                btnTestMP.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Probando...';
                
                // Intentamos crear un intent de $1500 para ver si el device responde
                const res = await sendData(`/api/negocios/${appState.negocioActivoId}/mp/create-intent`, {
                    amount: 1500,
                    description: "Prueba de Conexión Baboons",
                    external_reference: "TEST_CONN"
                });

                if (res.id) {
                    await Swal.fire({
                        title: '✅ ¡Conexión Exitosa!',
                        text: `El Point con ID ${deviceId} recibió la orden de prueba. ¿Se encendió la pantalla del dispositivo?`,
                        icon: 'success',
                        confirmButtonText: 'Sí, ¡funciona!'
                    });
                } else {
                    throw new Error(res.error || "No se pudo contactar con el dispositivo de Mercado Pago.");
                }
            } catch (err) {
                Swal.fire('❌ Error de Conexión', err.message, 'error');
            } finally {
                btnTestMP.disabled = false;
                btnTestMP.innerHTML = '<i class="fas fa-plug me-1"></i> Probar Conexión';
            }
        };
    }

    const btnSearchMP = document.getElementById('btn-search-mp');
    if (btnSearchMP) {
        btnSearchMP.onclick = async () => {
            const accessToken = document.getElementById('config-mp-access-token').value;
            if (!accessToken) {
                mostrarNotificacion("Ingrese primero su Access Token de Mercado Pago", "warning");
                return;
            }

            try {
                btnSearchMP.disabled = true;
                btnSearchMP.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
                
                const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/mp/devices`, {
                    headers: { 'X-MP-Token': accessToken }
                });
                
                if (res.error) {
                    Swal.fire('Error', `No se pudo obtener la lista de dispositivos: ${res.error}`, 'error');
                    return;
                }

                const devices = res.devices || [];

                if (devices.length === 0) {
                    Swal.fire('Atención', 'No se encontraron dispositivos vinculados a esta cuenta de Mercado Pago. Asegúrese de que el Point esté encendido y vinculado a su cuenta.', 'info');
                    return;
                }

                const options = {};
                devices.forEach(d => {
                    // El ID suele venir como MODELO__SERIAL. Mostramos algo legible.
                    const label = d.id.includes('__') ? d.id.replace('__', ' (S/N: ') + ')' : d.id;
                    options[d.id] = `${label} - ${d.operating_mode || 'Point'}`;
                });

                const { value: selectedId } = await Swal.fire({
                    title: 'Seleccione su Point',
                    text: 'Se encontraron los siguientes terminales vinculados a su cuenta:',
                    input: 'select',
                    inputOptions: options,
                    inputPlaceholder: 'Seleccione un dispositivo...',
                    showCancelButton: true,
                    confirmButtonText: 'Seleccionar',
                    cancelButtonText: 'Cancelar'
                });

                if (selectedId) {
                    document.getElementById('config-mp-device-id').value = selectedId;
                    
                    // Verificar si el dispositivo seleccionado está en modo STANDALONE
                    const selectedDevice = devices.find(d => d.id === selectedId);
                    if (selectedDevice && selectedDevice.operating_mode === 'STANDALONE') {
                        const { isConfirmed } = await Swal.fire({
                            title: '⚠️ Point en Modo Independiente',
                            text: 'Tu dispositivo está en modo "STANDALONE". Para que reciba pagos automáticamente desde el sistema, debe estar en modo "PDV". ¿Deseas activarlo ahora?',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Sí, activar Modo PDV',
                            cancelButtonText: 'Luego lo hago'
                        });

                        if (isConfirmed) {
                            try {
                                showGlobalLoader();
                                const setupRes = await sendData(`/api/negocios/${appState.negocioActivoId}/mp/setup-terminal`, {
                                    device_id: selectedId,
                                    mode: 'PDV'
                                });
                                
                                hideGlobalLoader(); // Quitamos el loader ANTES del mensaje

                                if (setupRes.success) {
                                    await Swal.fire({
                                        title: '🚀 Configuración Enviada',
                                        html: 'Se ha enviado la orden de cambio a <b>Modo PDV</b>.<br><br><b>IMPORTANTE:</b> Debes <b>REINICIAR</b> tu dispositivo Point ahora para que el cambio surta efecto.',
                                        icon: 'success'
                                    });
                                }
                            } catch (setupErr) {
                                hideGlobalLoader(); // También en caso de error
                                Swal.fire('Error', 'No se pudo activar el modo PDV: ' + setupErr.message, 'error');
                            }
                        }
                    }
                    
                    mostrarNotificacion("ID de dispositivo cargado. No olvide Guardar Configuración.", "success");
                }

            } catch (err) {
                Swal.fire('Error', 'No se pudo obtener la lista de dispositivos: ' + err.message, 'error');
            } finally {
                btnSearchMP.disabled = false;
                btnSearchMP.innerHTML = '<i class="fas fa-search me-1"></i> Buscar Points';
            }
        };
    }

    const btnCancelMP = document.getElementById('btn-cancel-mp');
    if (btnCancelMP) {
        btnCancelMP.onclick = async () => {
            try {
                showGlobalLoader();
                const res = await sendData(`/api/negocios/${appState.negocioActivoId}/mp/cancel-intent`);
                hideGlobalLoader();
                Swal.fire('Listo', 'Cola de cobros limpiada. El Point debería estar libre ahora.', 'success');
            } catch (err) {
                hideGlobalLoader();
                Swal.fire('Error', 'No se pudo limpiar la cola: ' + err.message, 'error');
            }
        };
    }

    const btnClearMP = document.getElementById('btn-clear-mp');
    if (btnClearMP) {
        btnClearMP.onclick = async () => {
            const { isConfirmed } = await Swal.fire({
                title: '¿Limpiar Configuración?',
                text: 'Se borrarán el Access Token y el ID de dispositivo de la pantalla. Deberá presionar "Guardar Cambios" para confirmar el borrado en el servidor.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, limpiar',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                document.getElementById('config-mp-access-token').value = "";
                document.getElementById('config-mp-device-id').value = "";
                mostrarNotificacion("Campos limpios. Presione Guardar Cambios para persistir.", "info");
            }
        };
    }
}

async function cargarListasEnSelector() {
    const select = document.getElementById('config-lista-defecto'); // Asegúrate que el ID sea el correcto
    if (!select) return;
    try {
        const listas = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`);
        // No borramos el contenido, solo añadimos las opciones
        listas.forEach(lista => {
            select.innerHTML += `<option value="${lista.id}">${lista.nombre}</option>`;
        });
    } catch (error) {
        console.error('Error al cargar listas de precios para configuración', error);
    }
}

async function buscarClienteDefecto() {
    const { value: client } = await Swal.fire({
        title: '🔎 Buscar Cliente por Defecto',
        input: 'text',
        inputPlaceholder: 'Escriba nombre o DNI...',
        showCancelButton: true,
        confirmButtonText: 'Buscar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) return 'Ingrese un término de búsqueda';
        }
    });

    if (client) {
        try {
            showGlobalLoader();
            const res = await fetchData(`/api/negocios/${appState.negocioActivoId}/clientes?q=${encodeURIComponent(client)}&limit=20`);
            const clientes = res.data || res;
            hideGlobalLoader();

            if (clientes.length === 0) {
                Swal.fire('Sin resultados', 'No se encontraron clientes para esa búsqueda.', 'info');
                return;
            }

            const options = {};
            clientes.forEach(c => {
                options[c.id] = `${c.nombre} (DNI: ${c.dni || 'N/A'})`;
            });

            const { value: selectedId } = await Swal.fire({
                title: 'Seleccione un Cliente',
                input: 'select',
                inputOptions: options,
                inputPlaceholder: 'Elija el cliente...',
                showCancelButton: true,
                confirmButtonText: 'Confirmar'
            });

            if (selectedId) {
                const selectedClient = clientes.find(c => String(c.id) === String(selectedId));
                document.getElementById('config-cliente-defecto').value = selectedId;
                document.getElementById('config-cliente-defecto-nombre').value = selectedClient.nombre;
                mostrarNotificacion("Cliente por defecto actualizado localmente. Guarde para confirmar.", "info");
            }
        } catch (err) {
            hideGlobalLoader();
            Swal.fire('Error', 'Error al buscar clientes: ' + err.message, 'error');
        }
    }
}