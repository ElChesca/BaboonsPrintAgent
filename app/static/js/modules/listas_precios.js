import { fetchData, sendData } from '../api.js';
import { appState } from '../main.js';
import { mostrarNotificacion } from './notifications.js';

let listaActivaId = null; // Guardará el ID de la lista que estamos viendo

// --- FUNCIONES PRINCIPALES DE RENDERIZADO ---

async function cargarListasDePrecios() {
    if (!appState.negocioActivoId) return;
    const contenedor = document.getElementById('contenedor-listas');
    try {
        const listas = await fetchData(`/api/negocios/${appState.negocioActivoId}/listas_precios`);
        contenedor.innerHTML = '';
        if (listas.length === 0) {
            contenedor.innerHTML = '<p>No hay listas de precios creadas.</p>';
            return;
        }
        listas.forEach(lista => {
            const item = document.createElement('div');
            item.className = 'lista-item';
            item.textContent = lista.nombre;
            item.dataset.id = lista.id;
            item.addEventListener('click', () => mostrarDetalleLista(lista.id));
            contenedor.appendChild(item);
        });
    } catch (error) {
        mostrarNotificacion('Error al cargar las listas de precios', 'error');
    }
}

async function mostrarDetalleLista(listaId) {
    listaActivaId = listaId;

    // Resaltar la lista activa en el panel izquierdo
    document.querySelectorAll('.lista-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id == listaId);
    });
    
    // Mostrar el panel de detalle y ocultar el placeholder
    document.getElementById('panel-detalle-lista').classList.remove('hidden');
    document.getElementById('panel-placeholder').classList.add('hidden');

    try {
        const data = await fetchData(`/api/listas_precios/${listaId}`);
        document.getElementById('detalle-nombre-lista').textContent = data.lista.nombre;
        document.getElementById('detalle-descripcion-lista').textContent = data.lista.descripcion || '';
        renderizarReglas(data.reglas);
    } catch (error) {
        mostrarNotificacion('Error al cargar los detalles de la lista', 'error');
    }
}

function renderizarReglas(reglas) {
    const tbody = document.getElementById('tbody-reglas');
    tbody.innerHTML = '';
    if (reglas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Esta lista aún no tiene reglas.</td></tr>';
        return;
    }

    reglas.forEach(regla => {
        const tr = document.createElement('tr');
        
        // Condición (Producto o Categoría)
        let condicion = regla.producto_nombre 
            ? `Producto: <strong>${regla.producto_nombre}</strong>`
            : `Categoría: <strong>${regla.categoria_nombre}</strong>`;

        // Acción (Precio Fijo o Descuento)
        let accion = regla.precio_fijo
            ? `Precio Fijo: <strong>$${regla.precio_fijo}</strong>`
            : `Descuento: <strong>${regla.porcentaje_descuento}%</strong>`;

        tr.innerHTML = `
            <td>${condicion}</td>
            <td>${accion}</td>
            <td>
                <button class="btn-delete-regla" data-id="${regla.id}" title="Eliminar regla">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- FUNCIONES PARA POBLAR SELECTS ---

async function poblarSelects() {
    const negocioId = appState.negocioActivoId;
    const selectProductos = document.getElementById('regla-producto');
    const selectCategorias = document.getElementById('regla-categoria');

    try {
        const [productos, categorias] = await Promise.all([
            fetchData(`/api/negocios/${negocioId}/productos`),
            fetchData(`/api/negocios/${negocioId}/categorias`)
        ]);

        productos.forEach(p => {
            selectProductos.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });
        categorias.forEach(c => {
            selectCategorias.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
        });

    } catch (error) {
        mostrarNotificacion('Error al cargar productos y categorías', 'error');
    }
}

// --- MANEJADORES DE EVENTOS ---

async function handleCrearLista(e) {
    e.preventDefault();
    const nombre = document.getElementById('nombre-lista').value;
    const descripcion = document.getElementById('descripcion-lista').value;

    const data = { nombre, descripcion };
    try {
        await sendData(`/api/negocios/${appState.negocioActivoId}/listas_precios`, data, 'POST');
        mostrarNotificacion('Lista creada con éxito', 'success');
        document.getElementById('modal-nueva-lista').style.display = 'none';
        e.target.reset();
        await cargarListasDePrecios();
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

async function handleAgregarRegla(e) {
    e.preventDefault();
    if (!listaActivaId) return;

    const producto_id = document.getElementById('regla-producto').value || null;
    const categoria_id = document.getElementById('regla-categoria').value || null;
    const precio_fijo = document.getElementById('regla-precio-fijo').value || null;
    const porcentaje_descuento = document.getElementById('regla-descuento').value || null;

    if (!producto_id && !categoria_id) {
        mostrarNotificacion('Debes seleccionar un producto o una categoría.', 'error');
        return;
    }
     if (!precio_fijo && !porcentaje_descuento) {
        mostrarNotificacion('Debes especificar un precio fijo o un descuento.', 'error');
        return;
    }

    const data = { producto_id, categoria_id, precio_fijo, porcentaje_descuento };
    // ✨ --- LÓGICA PARA DECIDIR QUÉ TIPO DE REGLA ENVIAR --- ✨
    if (aplicarATodas) {
        data = {
            precio_fijo,
            porcentaje_descuento,
            aplicar_a_todas_categorias: true,
            producto_id: null,
            categoria_id: null
        };
    } else {
        const producto_id = document.getElementById('regla-producto').value || null;
        const categoria_id = document.getElementById('regla-categoria').value || null;
        if (!producto_id && !categoria_id) {
            mostrarNotificacion('Debes seleccionar un producto o una categoría.', 'error');
            return;
        }
        data = { producto_id, categoria_id, precio_fijo, porcentaje_descuento };
    }
    try {
        await sendData(`/api/listas_precios/${listaActivaId}/reglas`, data, 'POST');
        mostrarNotificacion('Regla agregada con éxito', 'success');
        e.target.reset();
        await mostrarDetalleLista(listaActivaId); // Recargamos el detalle
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

async function handleEliminarRegla(e) {
    if (!e.target.matches('.btn-delete-regla')) return;
    
    const reglaId = e.target.dataset.id;
    if (!confirm('¿Estás seguro de que quieres eliminar esta regla?')) return;

    try {
        await sendData(`/api/reglas/${reglaId}`, {}, 'DELETE');
        mostrarNotificacion('Regla eliminada', 'success');
        await mostrarDetalleLista(listaActivaId); // Recargamos
    } catch (error) {
        mostrarNotificacion(error.message, 'error');
    }
}

// --- FUNCIÓN DE INICIALIZACIÓN ---

export function inicializarGestionListasPrecios() {
    // Carga inicial
    cargarListasDePrecios();
    poblarSelects();

    // Listeners para el modal
    const modal = document.getElementById('modal-nueva-lista');
    document.getElementById('btn-nueva-lista').addEventListener('click', () => modal.style.display = 'flex');
    document.getElementById('close-nueva-lista-modal').addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('btn-agregar-regla-especifica').addEventListener('click', (e) => handleAgregarRegla(e, false));
    document.getElementById('btn-aplicar-todas-categorias').addEventListener('click', (e) => handleAgregarRegla(e, true));
    
    window.addEventListener('click', (e) => {
        if (e.target == modal) modal.style.display = 'none';
    });

    // Listeners para los formularios y la tabla
    document.getElementById('form-nueva-lista').addEventListener('submit', handleCrearLista);
    document.getElementById('form-agregar-regla').addEventListener('submit', handleAgregarRegla);
    document.getElementById('tbody-reglas').addEventListener('click', handleEliminarRegla);
}