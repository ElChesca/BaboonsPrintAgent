import { fetchData } from '../api.js';

export const Bancos = (() => {
    // ── Estado interno ────────────────────────────────────────────────────────
    let negocioId = null;
    let chequeActivoId = null;  // ID del cheque sobre el que se está operando

    // ── Init ──────────────────────────────────────────────────────────────────
    function init(nid) {
        if (!nid) {
            console.error("[Bancos] Error: No hay negocioId activo.");
            return;
        }
        negocioId = nid;

        _initTabs();
        _initBotones();
        _initFiltros();

        cargarKPIs();
        cargarCartera();
        _cargarListasApoyo();
    }



    // ── Tabs ──────────────────────────────────────────────────────────────────
    function _initTabs() {
        document.querySelectorAll('.bancos-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.bancos-tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.bancos-tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');

                // Carga lazy según tab
                if (btn.dataset.tab === 'tab-propios') cargarPropios();
            });
        });
    }

    // ── Botones principales ───────────────────────────────────────────────────
    function _initBotones() {
        document.getElementById('btn-nuevo-cheque-recibido')?.addEventListener('click', abrirModalRecibido);
        document.getElementById('btn-nuevo-cheque-emitido')?.addEventListener('click', abrirModalEmitido);

        // Guardar cheque recibido
        document.getElementById('btn-guardar-cheque-recibido')?.addEventListener('click', guardarChequeRecibido);
        document.getElementById('btn-guardar-cheque-emitido')?.addEventListener('click', guardarChequeEmitido);

        // Acciones de transición
        document.getElementById('btn-confirmar-deposito')?.addEventListener('click', confirmarDeposito);
        document.getElementById('btn-confirmar-endoso')?.addEventListener('click', confirmarEndoso);
        document.getElementById('btn-confirmar-rechazo')?.addEventListener('click', confirmarRechazo);

        // Echeq toggle en modal recibido
        document.getElementById('cr-modalidad')?.addEventListener('change', e => {
            document.getElementById('cr-echeq-fields').style.display = e.target.value === 'echeq' ? 'block' : 'none';
        });

        // Toggle factura en endoso
        document.getElementById('endosar-tiene-factura')?.addEventListener('change', e => {
            document.getElementById('endosar-nro-factura-wrap').style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // ── Filtros ───────────────────────────────────────────────────────────────
    function _initFiltros() {
        document.getElementById('btn-filtrar-cartera')?.addEventListener('click', cargarCartera);
        document.getElementById('btn-filtrar-propios')?.addEventListener('click', cargarPropios);
        document.getElementById('btn-filtrar-hist')?.addEventListener('click', cargarHistorial);
    }

    // ── KPIs ──────────────────────────────────────────────────────────────────
    async function cargarKPIs() {
        try {
            const data = await fetchData(`/api/negocios/${negocioId}/cheques/resumen`);
            const fmt = n => '$' + formatNum(n);
            document.getElementById('kpi-cartera').textContent = fmt(data.total_cartera);
            document.getElementById('kpi-prox-valor').textContent = fmt(data.proximos_vencer.monto);
            document.getElementById('kpi-prox-cant').textContent = `${data.proximos_vencer.cantidad} cheques`;
            document.getElementById('kpi-rechazados-valor').textContent = fmt(data.rechazados.monto);
            document.getElementById('kpi-rechazados-cant').textContent = `${data.rechazados.cantidad} cheques`;
            document.getElementById('kpi-propios').textContent = fmt(data.total_propios_pendientes);
        } catch (e) {
            console.error('[Bancos] cargarKPIs:', e);
        }
    }

    // ── Cartera de terceros ───────────────────────────────────────────────────
    async function cargarCartera() {
        const tbody = document.getElementById('tbody-cartera');
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>`;

        const params = new URLSearchParams({ tipo: 'tercero' });
        const v = {
            estado: document.getElementById('filtro-estado-cartera')?.value,
            modalidad: document.getElementById('filtro-modalidad-cartera')?.value,
            desde: document.getElementById('filtro-desde-cartera')?.value,
            hasta: document.getElementById('filtro-hasta-cartera')?.value,
        };
        if (v.estado) params.set('estado', v.estado);
        if (v.modalidad) params.set('modalidad', v.modalidad);
        if (v.desde) params.set('fecha_desde', v.desde);
        if (v.hasta) params.set('fecha_hasta', v.hasta);

        try {
            const cheques = await fetchData(`/api/negocios/${negocioId}/cheques?${params}`);
            if (!cheques.length) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No hay cheques con esos filtros.</td></tr>`;
                return;
            }
            tbody.innerHTML = cheques.map(c => `
                <tr>
                    <td><small class="text-muted">#${c.id}</small></td>
                    <td><span class="badge badge-${c.modalidad === 'echeq' ? 'info' : 'secondary'}" style="background:${c.modalidad === 'echeq' ? '#17a2b8' : '#6c757d'};color:#fff;padding:2px 7px;border-radius:10px;font-size:.7rem;">${c.modalidad.toUpperCase()}</span></td>
                    <td>${c.banco}</td>
                    <td><strong>${c.numero_cheque}</strong></td>
                    <td>${c.nombre_librador || '<span class="text-muted">—</span>'}</td>
                    <td><strong>$${formatNum(c.monto)}</strong></td>
                    <td class="${esProximoVencer(c.fecha_vencimiento) ? 'text-warning fw-bold' : ''}">${formatFecha(c.fecha_vencimiento)}</td>
                    <td><span class="badge-estado badge-${c.estado}">${estadoLabel(c.estado)}</span></td>
                    <td>${c.nombre_cliente || '<span class="text-muted">—</span>'}</td>
                    <td>${accionesCartera(c)}</td>
                </tr>
            `).join('');

            // Listeners de acciones
            tbody.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => manejarAccion(btn.dataset.action, btn.dataset.id, cheques.find(c => c.id == btn.dataset.id)));
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error: ${e.message}</td></tr>`;
        }
    }

    function accionesCartera(c) {
        if (c.estado === 'en_cartera') return `
            <button class="btn-accion btn-depositar" data-action="depositar" data-id="${c.id}" title="Depositar">🏦 Dep.</button>
            <button class="btn-accion btn-endosar"   data-action="endosar"   data-id="${c.id}" title="Endosar">🔄 Endosar</button>
            <button class="btn-accion btn-historial"  data-action="historial"  data-id="${c.id}" title="Ver historial">📋</button>
        `;
        if (c.estado === 'depositado') return `
            <button class="btn-accion btn-rechazar"  data-action="rechazar"  data-id="${c.id}" title="Rechazado">❌ Rechazo</button>
            <button class="btn-accion btn-historial" data-action="historial" data-id="${c.id}" title="Ver historial">📋</button>
        `;
        return `<button class="btn-accion btn-historial" data-action="historial" data-id="${c.id}" title="Ver historial">📋 Historial</button>`;
    }

    // ── Cheques Propios ───────────────────────────────────────────────────────
    async function cargarPropios() {
        const tbody = document.getElementById('tbody-propios');
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>`;

        const params = new URLSearchParams({ tipo: 'propio' });
        const v = {
            estado: document.getElementById('filtro-estado-propios')?.value,
            desde: document.getElementById('filtro-desde-propios')?.value,
            hasta: document.getElementById('filtro-hasta-propios')?.value,
        };
        if (v.estado) params.set('estado', v.estado);
        if (v.desde) params.set('fecha_desde', v.desde);
        if (v.hasta) params.set('fecha_hasta', v.hasta);

        try {
            const cheques = await fetchData(`/api/negocios/${negocioId}/cheques?${params}`);
            if (!cheques.length) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No hay cheques propios con esos filtros.</td></tr>`;
                return;
            }
            tbody.innerHTML = cheques.map(c => `
                <tr>
                    <td><small class="text-muted">#${c.id}</small></td>
                    <td><span style="background:${c.modalidad === 'echeq' ? '#17a2b8' : '#6c757d'};color:#fff;padding:2px 7px;border-radius:10px;font-size:.7rem;">${c.modalidad.toUpperCase()}</span></td>
                    <td>${c.banco}</td>
                    <td><strong>${c.numero_cheque}</strong></td>
                    <td><strong>$${formatNum(c.monto)}</strong></td>
                    <td>${formatFecha(c.fecha_vencimiento)}</td>
                    <td><span class="badge-estado badge-${c.estado}">${estadoLabel(c.estado)}</span></td>
                    <td>${c.nombre_proveedor || '<span class="text-muted">—</span>'}</td>
                    <td><button class="btn-accion btn-historial" data-action="historial" data-id="${c.id}">📋 Historial</button></td>
                </tr>
            `).join('');

            tbody.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => manejarAccion(btn.dataset.action, btn.dataset.id, null));
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">Error: ${e.message}</td></tr>`;
        }
    }

    // ── Historial completo ────────────────────────────────────────────────────
    async function cargarHistorial() {
        const tbody = document.getElementById('tbody-historial');
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>`;

        const params = new URLSearchParams();
        const v = {
            tipo: document.getElementById('filtro-tipo-hist')?.value,
            estado: document.getElementById('filtro-estado-hist')?.value,
            desde: document.getElementById('filtro-desde-hist')?.value,
            hasta: document.getElementById('filtro-hasta-hist')?.value,
        };
        if (v.tipo) params.set('tipo', v.tipo);
        if (v.estado) params.set('estado', v.estado);
        if (v.desde) params.set('fecha_desde', v.desde);
        if (v.hasta) params.set('fecha_hasta', v.hasta);

        try {
            const cheques = await fetchData(`/api/negocios/${negocioId}/cheques?${params}`);
            if (!cheques.length) {
                tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">No se encontraron cheques.</td></tr>`;
                return;
            }
            tbody.innerHTML = cheques.map(c => `
                <tr>
                    <td>#${c.id}</td>
                    <td>${c.tipo === 'tercero' ? '📥 Tercero' : '📤 Propio'}</td>
                    <td>${c.modalidad.toUpperCase()}</td>
                    <td>${c.banco}</td>
                    <td>${c.numero_cheque}</td>
                    <td>$${formatNum(c.monto)}</td>
                    <td>${formatFecha(c.fecha_vencimiento)}</td>
                    <td><span class="badge-estado badge-${c.estado}">${estadoLabel(c.estado)}</span></td>
                    <td>${c.nombre_cliente || c.nombre_proveedor || '—'}</td>
                    <td><button class="btn-accion btn-historial" data-action="historial" data-id="${c.id}">📋 Ver</button></td>
                </tr>
            `).join('');

            tbody.querySelectorAll('[data-action]').forEach(btn => {
                btn.addEventListener('click', () => manejarAccion(btn.dataset.action, btn.dataset.id, null));
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Error: ${e.message}</td></tr>`;
        }
    }

    // ── Dispatcher de acciones ────────────────────────────────────────────────
    function manejarAccion(action, id, cheque) {
        chequeActivoId = parseInt(id);
        if (action === 'depositar') abrirModalDepositar(cheque);
        else if (action === 'endosar') abrirModalEndosar(cheque);
        else if (action === 'rechazar') abrirModalRechazar(cheque);
        else if (action === 'historial') abrirModalHistorial(id);
    }

    // ── Listas de apoyo (clientes / proveedores) ──────────────────────────────
    async function _cargarListasApoyo() {
        try {
            const [clientes, proveedores] = await Promise.all([
                fetchData(`/api/negocios/${negocioId}/clientes/lista`),
                fetchData(`/api/negocios/${negocioId}/proveedores/lista`),
            ]);
            _poblarSelect('cr-cliente', clientes, '— Sin cliente —');
            _poblarSelect('ce-proveedor', proveedores, '— Seleccionar proveedor —');
            _poblarSelect('endosar-proveedor', proveedores, '— Seleccionar proveedor —');
        } catch (e) {
            console.warn('[Bancos] No se pudieron cargar listas de apoyo:', e.message);
        }
    }

    function _poblarSelect(id, items, placeholder) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">${placeholder}</option>` +
            items.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('');
    }

    // ── Modales: abrir / cerrar ───────────────────────────────────────────────
    function abrirModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'flex';
    }

    function cerrarModal(id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    }

    function abrirModalRecibido() {
        document.getElementById('form-cheque-recibido')?.reset();
        document.getElementById('cr-echeq-fields').style.display = 'none';
        abrirModal('modal-cheque-recibido');
    }

    function abrirModalEmitido() {
        document.getElementById('form-cheque-emitido')?.reset();
        abrirModal('modal-cheque-emitido');
    }

    function abrirModalDepositar(c) {
        document.getElementById('depositar-info').textContent =
            c ? `Cheque ${c.numero_cheque} — ${c.banco} — $${formatNum(c.monto)} — Vto: ${formatFecha(c.fecha_vencimiento)}` : '';
        document.getElementById('depositar-observaciones').value = '';
        abrirModal('modal-depositar');
    }

    function abrirModalEndosar(c) {
        document.getElementById('endosar-info').textContent =
            c ? `Cheque ${c.numero_cheque} — ${c.banco} — $${formatNum(c.monto)}` : '';
        document.getElementById('endosar-proveedor').value = '';
        document.getElementById('endosar-tiene-factura').checked = false;
        document.getElementById('endosar-nro-factura-wrap').style.display = 'none';
        document.getElementById('endosar-observaciones').value = '';
        abrirModal('modal-endosar');
    }

    function abrirModalRechazar(c) {
        document.getElementById('rechazar-info').textContent =
            c ? `Cheque ${c.numero_cheque} — ${c.banco} — $${formatNum(c.monto)}` : '';
        document.getElementById('rechazar-observaciones').value = '';
        abrirModal('modal-rechazar');
    }

    async function abrirModalHistorial(chequeId) {
        abrirModal('modal-historial-cheque');
        document.getElementById('hist-cheque-grid').innerHTML = `<div class="text-muted text-center" style="grid-column:span 3;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>`;
        document.getElementById('hist-timeline').innerHTML = '';

        try {
            const data = await fetchData(`/api/negocios/${negocioId}/cheques/${chequeId}`);
            const c = data.cheque;

            document.getElementById('hist-cheque-grid').innerHTML = `
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Banco</div><strong>${c.banco}</strong></div>
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Nº Cheque</div><strong>${c.numero_cheque}</strong></div>
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Monto</div><strong style="color:#007bff;">$${formatNum(c.monto)}</strong></div>
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Librador</div>${c.nombre_librador || '—'}</div>
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Vencimiento</div>${formatFecha(c.fecha_vencimiento)}</div>
                <div><div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;">Estado</div><span class="badge-estado badge-${c.estado}">${estadoLabel(c.estado)}</span></div>
            `;

            const timeline = document.getElementById('hist-timeline');
            if (!data.movimientos.length) {
                timeline.innerHTML = `<p class="text-muted">Sin movimientos registrados.</p>`;
            } else {
                timeline.innerHTML = data.movimientos.map(m => `
                    <div class="timeline-item">
                        <div class="timeline-dot ${m.tipo_movimiento}"></div>
                        <div class="timeline-card">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span class="timeline-tipo">${tipoMovLabel(m.tipo_movimiento)}</span>
                                <span class="timeline-fecha">${formatFechaHora(m.fecha)}</span>
                            </div>
                            <div class="timeline-detalle">
                                ${m.estado_anterior ? `${estadoLabel(m.estado_anterior)} → ` : ''}
                                <strong>${estadoLabel(m.estado_nuevo)}</strong>
                                ${m.nombre_proveedor ? ` | Proveedor: <strong>${m.nombre_proveedor}</strong>` : ''}
                                ${m.nombre_cliente ? ` | Cliente: <strong>${m.nombre_cliente}</strong>` : ''}
                                ${m.tiene_factura ? ` | Factura: <strong>${m.nro_factura || 'Sí'}</strong>` : ''}
                                ${m.observaciones ? `<br><em style="color:#777;">${m.observaciones}</em>` : ''}
                                ${m.nombre_usuario ? `<br><small style="color:#aaa;">👤 ${m.nombre_usuario}</small>` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            document.getElementById('hist-cheque-grid').innerHTML = `<div class="text-danger" style="grid-column:span 3;">Error: ${e.message}</div>`;
        }
    }

    // ── Guardar nuevo cheque recibido ─────────────────────────────────────────
    async function guardarChequeRecibido() {
        const payload = {
            tipo: 'tercero',
            modalidad: document.getElementById('cr-modalidad').value,
            origen: document.getElementById('cr-origen').value,
            banco: document.getElementById('cr-banco').value.trim(),
            numero_cheque: document.getElementById('cr-numero').value.trim(),
            nombre_librador: document.getElementById('cr-librador').value.trim(),
            cuit_librador: document.getElementById('cr-cuit').value.trim(),
            monto: parseFloat(document.getElementById('cr-monto').value),
            fecha_emision: document.getElementById('cr-fecha-emision').value || null,
            fecha_vencimiento: document.getElementById('cr-fecha-vto').value,
            cliente_id: document.getElementById('cr-cliente').value || null,
            echeq_id: document.getElementById('cr-echeq-id')?.value.trim() || null,
            echeq_cbu: document.getElementById('cr-echeq-cbu')?.value.trim() || null,
            observaciones: document.getElementById('cr-observaciones').value.trim(),
        };

        if (!payload.banco || !payload.numero_cheque || !payload.monto || !payload.fecha_vencimiento) {
            return showToast('Completá todos los campos obligatorios.', 'warning');
        }

        const btn = document.getElementById('btn-guardar-cheque-recibido');
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
            await fetchData(`/api/negocios/${negocioId}/cheques`, { method: 'POST', body: JSON.stringify(payload) });
            showToast('Cheque registrado con éxito.', 'success');
            cerrarModal('modal-cheque-recibido');
            cargarKPIs();
            cargarCartera();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Registrar Cheque';
        }
    }

    // ── Guardar nuevo cheque emitido ──────────────────────────────────────────
    async function guardarChequeEmitido() {
        const payload = {
            tipo: 'propio',
            modalidad: document.getElementById('ce-modalidad').value,
            banco: document.getElementById('ce-banco').value.trim(),
            numero_cheque: document.getElementById('ce-numero').value.trim(),
            monto: parseFloat(document.getElementById('ce-monto').value),
            fecha_emision: document.getElementById('ce-fecha-emision').value || null,
            fecha_vencimiento: document.getElementById('ce-fecha-vto').value,
            proveedor_id: document.getElementById('ce-proveedor').value || null,
            observaciones: document.getElementById('ce-observaciones').value.trim(),
        };

        if (!payload.banco || !payload.numero_cheque || !payload.monto || !payload.fecha_vencimiento) {
            return showToast('Completá todos los campos obligatorios.', 'warning');
        }
        if (!payload.proveedor_id) {
            return showToast('Seleccioná un proveedor.', 'warning');
        }

        const btn = document.getElementById('btn-guardar-cheque-emitido');
        btn.disabled = true; btn.textContent = 'Guardando...';
        try {
            await fetchData(`/api/negocios/${negocioId}/cheques`, { method: 'POST', body: JSON.stringify(payload) });
            showToast('Cheque emitido registrado con éxito.', 'success');
            cerrarModal('modal-cheque-emitido');
            cargarKPIs();
            cargarPropios();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Registrar Cheque';
        }
    }

    // ── Transiciones de estado ────────────────────────────────────────────────
    async function confirmarDeposito() {
        if (!chequeActivoId) return;
        const obs = document.getElementById('depositar-observaciones').value.trim();
        try {
            await fetchData(`/api/negocios/${negocioId}/cheques/${chequeActivoId}/depositar`, {
                method: 'PUT', body: JSON.stringify({ observaciones: obs })
            });
            showToast('Cheque marcado como depositado.', 'success');
            cerrarModal('modal-depositar');
            cargarKPIs(); cargarCartera();
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    }

    async function confirmarEndoso() {
        if (!chequeActivoId) return;
        const provId = document.getElementById('endosar-proveedor').value;
        if (!provId) return showToast('Seleccioná un proveedor.', 'warning');

        const payload = {
            proveedor_id: parseInt(provId),
            tiene_factura: document.getElementById('endosar-tiene-factura').checked,
            nro_factura: document.getElementById('endosar-nro-factura').value.trim() || null,
            observaciones: document.getElementById('endosar-observaciones').value.trim(),
        };
        try {
            await fetchData(`/api/negocios/${negocioId}/cheques/${chequeActivoId}/endosar`, {
                method: 'PUT', body: JSON.stringify(payload)
            });
            showToast('Cheque endosado con éxito.', 'success');
            cerrarModal('modal-endosar');
            cargarKPIs(); cargarCartera();
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    }

    async function confirmarRechazo() {
        if (!chequeActivoId) return;
        const obs = document.getElementById('rechazar-observaciones').value.trim();
        if (!obs) return showToast('Ingresá el motivo del rechazo.', 'warning');

        try {
            await fetchData(`/api/negocios/${negocioId}/cheques/${chequeActivoId}/rechazar`, {
                method: 'PUT', body: JSON.stringify({ observaciones: obs })
            });
            showToast('Rechazo registrado.', 'warning');
            cerrarModal('modal-rechazar');
            cargarKPIs(); cargarCartera();
        } catch (e) { showToast('Error: ' + e.message, 'error'); }
    }

    // ── Helpers de formato ────────────────────────────────────────────────────
    function formatNum(n) {
        return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatFecha(f) {
        if (!f) return '—';
        const d = new Date(f + 'T00:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function formatFechaHora(f) {
        if (!f) return '—';
        const d = new Date(f);
        return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function esProximoVencer(fechaStr) {
        if (!fechaStr) return false;
        const vto = new Date(fechaStr + 'T00:00:00');
        const hoy = new Date();
        const diff = (vto - hoy) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
    }

    function estadoLabel(e) {
        const map = { en_cartera: 'En Cartera', depositado: 'Depositado', endosado: 'Endosado', aplicado: 'Aplicado', rechazado: 'Rechazado', anulado: 'Anulado' };
        return map[e] || e;
    }

    function tipoMovLabel(t) {
        const map = { ingreso: '📥 Ingreso', deposito: '🏦 Depósito', endoso_salida: '🔄 Endoso', rechazo: '❌ Rechazo', anulacion: '🗑 Anulación', pago_proveedor: '📤 Pago Proveedor' };
        return map[t] || t;
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    function showToast(msg, type = 'success') {
        if (typeof window.showToast === 'function') return window.showToast(msg, type);
        if (typeof Swal !== 'undefined') {
            Swal.fire({ toast: true, position: 'top-end', icon: type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success', title: msg, showConfirmButton: false, timer: 3000 });
        } else {
            alert(msg);
        }
    }

    // ── API pública ───────────────────────────────────────────────────────────
    return { init, cerrarModal, cargarKPIs };
})();

// Exponer globalmente para que los onclick en el HTML funcionen
window.Bancos = Bancos;

