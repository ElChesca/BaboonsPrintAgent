/* app/static/js/modules/crm_contactos.js */
import { fetchData } from '../api.js';
import { mostrarNotificacion } from './notifications.js';
import { appState } from '../main.js';

const API = '/api/crm';
let negocioId = null;
let allLeads = [];
let filteredLeads = [];
let currentLeadId = null;
let currentPage = 1;
const PAGE_SIZE = 25;

// ── Auth-aware fetch ─────────────────────────────────────────────────────────
async function apiFetch(url, opts) {
    opts = opts || {};
    const token = localStorage.getItem('jwt_token');
    const headers = Object.assign({}, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.json(); msg = j.error || j.message || msg; } catch(e) {}
        throw new Error(msg);
    }
    return res.json();
}

// ── Modal helpers (sin Bootstrap.Modal) ─────────────────────────────────────
function showModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    el.style.background = 'rgba(0,0,0,.45)';
}
function hideModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

// ── Punto de entrada exportado ───────────────────────────────────────────────
export async function inicializarCRMContactos() {
    negocioId = appState.negocioActivoId || localStorage.getItem('negocioActivoId');

    if (!negocioId) {
        showEmpty('No se pudo detectar el negocio activo. Recargá la página.');
        return;
    }

    bindEvents();
    await loadLeads();
}

function bindEvents() {
    const safe = (id, evt, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(evt, fn); };

    safe('crm-refresh-btn', 'click', loadLeads);
    safe('crm-btn-nuevo', 'click', openNewModal);
    safe('crm-btn-importar', 'click', () => showModal('modal-importar-crm'));

    // Cerrar modales
    document.querySelectorAll('[data-crm-close]').forEach(btn => {
        btn.addEventListener('click', () => hideModal(btn.getAttribute('data-crm-close')));
    });
    ['modal-importar-crm', 'modal-nuevo-contacto'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', e => { if (e.target === el) hideModal(id); });
    });

    // Filtros
    let st;
    safe('crm-search', 'input', () => { clearTimeout(st); st = setTimeout(applyFilters, 280); });
    safe('crm-filter-estado', 'change', applyFilters);
    safe('crm-filter-origen', 'change', applyFilters);

    // Drawer
    safe('crm-overlay', 'click', closeDrawer);
    safe('crm-drawer-close', 'click', closeDrawer);
    safe('drawer-nota-btn', 'click', addNota);
    safe('drawer-btn-editar', 'click', () => openEditModal(currentLeadId));
    safe('drawer-btn-eliminar', 'click', eliminarLead);
    safe('edit-guardar-btn', 'click', guardarLead);

    // Importador
    const fileInput = document.getElementById('crm-file-input');
    const dropzone  = document.getElementById('crm-dropzone');
    if (fileInput) fileInput.addEventListener('change', onFileSelected);
    if (dropzone) {
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault(); dropzone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; onFileSelected(); }
        });
    }
    safe('crm-btn-upload', 'click', importarArchivo);
    safe('crm-btn-plantilla', 'click', descargarPlantilla);
    // Boton dentro del dropzone - stopPropagation para evitar doble dialogo
    const chooserBtn = document.querySelector('#crm-dropzone button');
    if (chooserBtn) chooserBtn.addEventListener('click', e => { e.stopPropagation(); fileInput && fileInput.click(); });

    // Exponer apertura de drawer globalmente (para onclick en filas)
    window.__crmOpenDrawer = openDrawer;
    window.__crmChangePage = p => { currentPage = p; loadLeads(); };
}

// ── Carga leads ──────────────────────────────────────────────────────────────
async function loadLeads() {
    showLoading();
    try {
        const q = (val('crm-search') || '').trim();
        const est = val('crm-filter-estado') || '';
        const ori = val('crm-filter-origen') || '';
        const p = currentPage || 1;
        
        let url = `${API}/leads?negocio_id=${negocioId}&page=${p}&limit=${PAGE_SIZE}&search=${encodeURIComponent(q)}&estado=${encodeURIComponent(est)}&origen=${encodeURIComponent(ori)}`;
        
        const payload = await apiFetch(url);
        
        // Handle new paginated format or fallback to flat array if cache hits old structure
        if (payload && payload.data) {
            allLeads = payload.data;
            updateKPIs(payload.kpis);
            renderTable(payload.total);
        } else {
            allLeads = Array.isArray(payload) ? payload : [];
            updateKPIs();
            renderTable(allLeads.length);
        }
    } catch(e) {
        console.error('[CRM] loadLeads error:', e);
        showEmpty(`Error al cargar contactos: ${e.message}`);
    }
}

function updateKPIs(kpis) {
    if (kpis) {
        setText('kpi-total', kpis.total || 0);
        setText('kpi-reservas', kpis.reservas || 0);
        setText('kpi-excel', kpis.excel || 0);
        setText('kpi-nuevos', kpis.nuevos || 0);
    } else {
        // Fallback porsia (cache viejo)
        setText('kpi-total', allLeads.length);
        setText('kpi-reservas', allLeads.filter(l => l.origen === 'reserva').length);
        setText('kpi-excel', allLeads.filter(l => (l.origen || '').startsWith('excel')).length);
        const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30);
        setText('kpi-nuevos', allLeads.filter(l => {
            const f = l.ultima_actividad || l.fecha_creacion;
            return f && new Date(f) >= hace30;
        }).length);
    }
}

function applyFilters() {
    // Al filtrar, siempre volvemos a la página 1
    currentPage = 1;
    loadLeads();
}

// ── Tabla ────────────────────────────────────────────────────────────────────
function renderTable(totalBackend) {
    const tbody = document.getElementById('crm-tbody');
    if (!tbody) return;
    const total = totalBackend || 0;
    setText('crm-result-count', total + ' contacto' + (total !== 1 ? 's' : ''));
    if (!allLeads || !allLeads.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><i class="fas fa-user-slash fa-2x mb-3 d-block opacity-30"></i>No se encontraron contactos</td></tr>';
        renderPagination(0);
        return;
    }
    
    // El backend ya lo manda paginado, no necesitamos hacer slice() si sabemos que viene de paginacion.
    // Para simplificar asuminos que allLeads es exacto lo que hay que renderizar.
    tbody.innerHTML = allLeads.map(l => {
        const initials = (l.nombre || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
        const ts  = l.ultima_actividad || l.fecha_creacion;
        const act = ts ? new Date(ts).toLocaleDateString('es-AR', {day:'2-digit', month:'short'}) : '—';
        return `<tr onclick="window.__crmOpenDrawer(${l.id})" style="cursor:pointer;">
            <td><div class="d-flex align-items-center gap-2">
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#818cf8);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;color:white;flex-shrink:0;">${initials}</div>
                <span class="fw-semibold" style="font-size:.88rem;">${esc(l.nombre||'—')}</span>
            </div></td>
            <td class="text-muted" style="font-size:.83rem;">${esc(l.email||'—')}</td>
            <td class="text-muted" style="font-size:.83rem;">${esc(l.telefono||'—')}</td>
            <td><span class="badge-origen ${origenClass(l.origen)}">${origenLabel(l.origen)}</span></td>
            <td><span class="badge-estado ${estadoClass(l.estado)}">${cap(l.estado||'nuevo')}</span></td>
            <td class="text-muted" style="font-size:.8rem;">${act}</td>
            <td><i class="fas fa-chevron-right text-muted opacity-50" style="font-size:.8rem;"></i></td>
        </tr>`;
    }).join('');
    renderPagination(total);
}

function renderPagination(total) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const start = Math.min((currentPage-1)*PAGE_SIZE+1, total);
    const end   = Math.min(currentPage*PAGE_SIZE, total);
    setText('crm-pag-info', total ? `Mostrando ${start}–${end} de ${total}` : '');
    const container = document.getElementById('crm-pag-buttons');
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    let html = `<button class="crm-pag-btn" ${currentPage===1?'disabled':''} onclick="window.__crmChangePage(${currentPage-1})"><i class="fas fa-chevron-left"></i></button>`;
    for (let i=1; i<=totalPages; i++) {
        if (totalPages<=7 || i===1 || i===totalPages || Math.abs(i-currentPage)<=1) {
            html += `<button class="crm-pag-btn${i===currentPage?' active':''}" onclick="window.__crmChangePage(${i})">${i}</button>`;
        } else if (Math.abs(i-currentPage)===2) { html += '<span class="text-muted px-1">…</span>'; }
    }
    html += `<button class="crm-pag-btn" ${currentPage===totalPages?'disabled':''} onclick="window.__crmChangePage(${currentPage+1})"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
}

// ── Drawer ───────────────────────────────────────────────────────────────────
async function openDrawer(id) {
    currentLeadId = id;
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;
    const initials = (lead.nombre||'?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
    setText('drawer-avatar', initials);
    setText('drawer-nombre', lead.nombre || '—');
    setText('drawer-email',  lead.email  || '—');
    setText('drawer-telefono', lead.telefono || '—');
    setText('drawer-origen', origenLabel(lead.origen));
    const estadoBadge = document.getElementById('drawer-estado-badge');
    if (estadoBadge) { estadoBadge.textContent = cap(lead.estado || 'nuevo'); estadoBadge.className = 'badge-estado mt-1 d-inline-block ' + estadoClass(lead.estado); }
    document.getElementById('crm-overlay')?.classList.add('open');
    document.getElementById('crm-drawer')?.classList.add('open');
    const ni = document.getElementById('drawer-nota-input');
    if (ni) ni.value = '';
    loadTimeline(id);
}

async function loadTimeline(id) {
    const tl = document.getElementById('drawer-timeline');
    if (!tl) return;
    tl.innerHTML = '<div class="text-center py-3 text-muted"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const items = await apiFetch(`${API}/leads/${id}/historial`);
        if (!Array.isArray(items) || !items.length) {
            tl.innerHTML = '<p class="text-muted small text-center py-3">Sin actividad registrada aún.</p>';
            return;
        }
        tl.innerHTML = items.map(it => `
            <div class="timeline-item">
                <div class="timeline-dot ${it.tipo_accion||''}"></div>
                <div><div class="timeline-text">${esc(it.descripcion||it.tipo_accion)}</div><div class="timeline-date">${it.fecha||''}</div></div>
            </div>`).join('');
    } catch(e) {
        tl.innerHTML = '<p class="text-muted small">No se pudo cargar el historial.</p>';
    }
}

function closeDrawer() {
    document.getElementById('crm-overlay')?.classList.remove('open');
    document.getElementById('crm-drawer')?.classList.remove('open');
    currentLeadId = null;
}

async function addNota() {
    const nota = val('drawer-nota-input').trim();
    if (!nota || !currentLeadId) return;
    try {
        await apiFetch(`${API}/leads/${currentLeadId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notas: nota }) });
        const ni = document.getElementById('drawer-nota-input');
        if (ni) ni.value = '';
        loadTimeline(currentLeadId);
    } catch(e) { mostrarNotificacion('Error al guardar la nota: ' + e.message, 'error'); }
}

// ── Modales nuevo/editar ─────────────────────────────────────────────────────
function openNewModal() {
    setVal('edit-lead-id', '');
    setVal('edit-nombre', '');
    setVal('edit-email', '');
    setVal('edit-telefono', '');
    setVal('edit-estado', 'nuevo');
    setVal('edit-origen', 'manual');
    setVal('edit-notas', '');
    const t = document.getElementById('modal-contacto-titulo');
    if (t) t.innerHTML = '<i class="fas fa-user-plus me-2" style="color:var(--crm-accent);"></i>Nuevo Contacto';
    showModal('modal-nuevo-contacto');
}

function openEditModal(id) {
    const lead = allLeads.find(l => l.id === id);
    if (!lead) return;
    setVal('edit-lead-id', lead.id);
    setVal('edit-nombre', lead.nombre || '');
    setVal('edit-email', lead.email || '');
    setVal('edit-telefono', lead.telefono || '');
    setVal('edit-estado', lead.estado || 'nuevo');
    setVal('edit-origen', lead.origen || 'manual');
    setVal('edit-notas', lead.notas || '');
    const t = document.getElementById('modal-contacto-titulo');
    if (t) t.innerHTML = '<i class="fas fa-edit me-2" style="color:var(--crm-accent);"></i>Editar Contacto';
    showModal('modal-nuevo-contacto');
}

async function guardarLead() {
    const id     = val('edit-lead-id');
    const nombre = val('edit-nombre').trim();
    if (!nombre) { mostrarNotificacion('El nombre es obligatorio', 'warning'); return; }
    const payload = {
        negocio_id: parseInt(negocioId),
        nombre, email: val('edit-email').trim(), telefono: val('edit-telefono').trim(),
        estado: val('edit-estado'), origen: val('edit-origen'), notas: val('edit-notas').trim()
    };
    try {
        await apiFetch(id ? `${API}/leads/${id}` : `${API}/leads`, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        });
        hideModal('modal-nuevo-contacto');
        mostrarNotificacion('Contacto guardado correctamente', 'success');
        loadLeads();
    } catch(e) { mostrarNotificacion('Error al guardar: ' + e.message, 'error'); }
}

async function eliminarLead() {
    if (!currentLeadId) return;
    const lead = allLeads.find(l => l.id === currentLeadId);
    const nombre = lead && lead.nombre ? lead.nombre : 'este contacto';
    if (!confirm(`¿Dar de baja a ${nombre}?`)) return;
    try {
        await apiFetch(`${API}/leads/${currentLeadId}`, { method: 'DELETE' });
        closeDrawer();
        mostrarNotificacion('Contacto dado de baja', 'success');
        loadLeads();
    } catch(e) { mostrarNotificacion('Error al eliminar: ' + e.message, 'error'); }
}

// ── Importador ───────────────────────────────────────────────────────────────
function onFileSelected() {
    const f   = document.getElementById('crm-file-input')?.files[0];
    const sel = document.getElementById('crm-file-selected');
    const btn = document.getElementById('crm-btn-upload');
    if (f && sel) {
        sel.className = 'alert alert-info py-2 px-3 small mb-3';
        sel.innerHTML = `<i class="fas fa-file-excel me-2"></i><strong>${f.name}</strong> (${(f.size/1024).toFixed(1)} KB)`;
        if (btn) btn.disabled = false;
    } else if (sel) {
        sel.className = 'alert d-none';
        if (btn) btn.disabled = true;
    }
    const res = document.getElementById('crm-import-resultado');
    if (res) res.className = 'd-none';
}

async function importarArchivo() {
    const f = document.getElementById('crm-file-input')?.files[0];
    if (!f) return;
    const btn = document.getElementById('crm-btn-upload');
    const res = document.getElementById('crm-import-resultado');

    // Barra de progreso
    const progressWrap = document.getElementById('crm-import-progress');
    const progressBar  = document.getElementById('crm-import-progress-bar');
    if (progressWrap) progressWrap.style.display = 'block';
    if (progressBar)  { progressBar.style.width = '0%'; progressBar.textContent = '0%'; progressBar.style.animation = ''; }
    if (res) res.className = 'd-none';

    // Contador de tiempo transcurrido en el boton
    let elapsed = 0;
    const tick = setInterval(() => {
        elapsed++;
        if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Procesando... ${elapsed}s`;
    }, 1000);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Subiendo...'; }

    const fd = new FormData();
    fd.append('file', f);
    const token = localStorage.getItem('jwt_token');

    const cleanup = () => {
        clearInterval(tick);
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload me-1"></i> Importar'; }
        setTimeout(() => { if (progressWrap) progressWrap.style.display = 'none'; }, 1500);
    };

    return new Promise(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/negocios/${negocioId}/crm/contactos/importar`);
        if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);

        // Progreso de subida del archivo (0-85%)
        xhr.upload.addEventListener('progress', e => {
            if (!e.lengthComputable) return;
            const pct = Math.round((e.loaded / e.total) * 85);
            if (progressBar) { progressBar.style.width = pct + '%'; progressBar.textContent = pct + '%'; }
            if (btn) btn.innerHTML = `<i class="fas fa-upload me-1"></i> Subiendo ${pct}%`;
        });

        // Upload terminado - servidor procesando
        xhr.upload.addEventListener('load', () => {
            if (progressBar) {
                progressBar.style.width = '92%';
                progressBar.textContent = 'Procesando...';
                progressBar.style.animation = 'shimmer 1.5s infinite';
            }
            if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Procesando... 0s`;
        });

        xhr.addEventListener('load', () => {
            if (progressBar) {
                progressBar.style.animation = '';
                progressBar.style.width = '100%';
                progressBar.textContent = 'Listo!';
            }
            cleanup();

            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    let html = `<i class="fas fa-check-circle me-2"></i><strong>${data.creados}</strong> nuevos · <strong>${data.actualizados}</strong> actualizados · <strong>${data.omitidos}</strong> omitidos.`;
                    if (data.errores && data.errores.length) {
                        html += `<br><small class="text-muted">Errores en filas: ${data.errores.map(e => e.fila).join(', ')}</small>`;
                    }
                    if (res) { res.className = 'alert alert-success py-2 px-3 small mb-3'; res.innerHTML = html; }
                    loadLeads();
                } else {
                    if (res) { res.className = 'alert alert-danger py-2 px-3 small mb-3'; res.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i>${data.error || 'Error al importar.'}`; }
                }
            } catch(ex) {
                if (res) { res.className = 'alert alert-danger py-2 px-3 small mb-3'; res.textContent = 'Error al procesar la respuesta del servidor.'; }
            }
            resolve();
        });

        xhr.addEventListener('error', () => {
            cleanup();
            if (res) { res.className = 'alert alert-danger py-2 px-3 small mb-3'; res.textContent = 'Error de conexion.'; }
            resolve();
        });

        xhr.send(fd);
    });
}


function descargarPlantilla() {
    const token = localStorage.getItem('jwt_token');
    fetch(`${API}/negocios/${negocioId}/crm/contactos/plantilla`, { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
        .then(r => r.blob())
        .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'plantilla_contactos_crm.xlsx'; a.click(); })
        .catch(e => mostrarNotificacion('Error al descargar: ' + e.message, 'error'));
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function origenClass(o) {
    o = (o||'').toLowerCase();
    if (o === 'reserva')       return 'bg-reserva';
    if (o.startsWith('excel')) return 'bg-excel';
    if (o === 'erp')           return 'bg-erp';
    return 'bg-manual';
}
function origenLabel(o) {
    const m = { reserva:'Reserva', excel_vita:'Excel Vita', excel:'Excel', erp:'ERP', manual:'Manual', instagram:'Instagram', web:'Web' };
    return m[(o||'').toLowerCase()] || cap(o) || 'Desconocido';
}
function estadoClass(e) {
    const m = { nuevo:'bg-nuevo', contactado:'bg-contactado', interesado:'bg-interesado', ganado:'bg-ganado' };
    return m[e] || 'bg-nuevo';
}
function cap(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function esc(s)  { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function val(id) { return document.getElementById(id)?.value || ''; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function setText(id, t) { const el = document.getElementById(id); if (el) el.textContent = t; }
function showLoading() {
    const el = document.getElementById('crm-tbody');
    if (el) el.innerHTML = '<tr><td colspan="7" class="text-center py-5 text-muted"><i class="fas fa-spinner fa-spin me-2"></i>Cargando...</td></tr>';
}
function showEmpty(msg) {
    const el = document.getElementById('crm-tbody');
    if (el) el.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">${msg}</td></tr>`;
}
