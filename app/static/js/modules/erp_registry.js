/**
 * ✨ REGISTRO CENTRAL DE MÓDULOS ERP (Version 1.2)
 * Sincronizado con backend (admin_routes.py) y archivos reales (static/*.html)
 * Este archivo es la ÚNICA fuente de verdad para la UI del Dashboard.
 */

export const ERP_REGISTRY = {
    // --- 🍽️ GESTIÓN RESTÓ ---
    'resto_mozo': {
        label: 'Salón y Mesas',
        icon: 'static/img/icons/camarero.png',
        path: 'static/resto_mozo.html',
        category: 'operaciones',
        color: 'rgba(255, 107, 107, 0.1)'
    },
    'salon_digital': { path: 'static/resto_mozo.html' }, // ALIAS LEGACY
    'gestion_mesas': {
        label: 'Adm. de Mesas',
        icon: 'static/img/icons/mesa.png',
        path: 'static/mesas.html',
        category: 'operaciones',
        color: 'rgba(255, 107, 107, 0.1)'
    },
    'resto_menu': {
        label: 'Gestión de Carta',
        icon: 'static/img/icons/menu.png',
        path: 'static/resto_menu.html',
        category: 'operaciones',
        color: 'rgba(162, 155, 254, 0.1)'
    },
    'resto_cocina': {
        label: 'KDS Cocina (Monitor)',
        icon: 'static/img/icons/cocina.png',
        path: 'static/resto_cocina.html',
        category: 'operaciones',
        color: 'rgba(78, 205, 196, 0.1)'
    },
    'comandas_cocina': { 
        path: 'static/resto_cocina.html' 
    }, // ALIAS SILENCIOSO PARA COMPATIBILIDAD

    'resto_bar': {
        label: 'KDS Bar',
        icon: 'static/img/icons/camarero.png',
        path: 'static/resto_bar.html',
        category: 'operaciones',
        color: 'rgba(99, 102, 241, 0.12)'
    },
    'resto_dolce': {
        label: 'KDS Dolce',
        icon: 'static/img/icons/cocina.png',
        path: 'static/resto_dolce.html',
        category: 'operaciones',
        color: 'rgba(255, 159, 67, 0.1)'
    },
    'reservas': {
        label: 'Gestión de Reservas',
        icon: 'static/img/icons/reservas.png',
        path: 'static/reservas.html',
        category: 'operaciones',
        color: 'rgba(99, 102, 241, 0.12)'
    },
    'mozos': {
        label: 'Gestión de Mozos',
        icon: 'static/img/icons/empleados.png',
        path: 'static/mozos.html',
        category: 'operaciones',
        color: 'rgba(255, 107, 107, 0.1)'
    },
    'resto_roles': {
        label: 'Roles y Estaciones',
        icon: 'static/img/icons/configuracion.png',
        path: 'static/resto_roles.html',
        category: 'operaciones',
        color: 'rgba(99, 102, 241, 0.12)'
    },
    'resto_stats': {
        label: 'Estadísticas Restó',
        icon: 'static/img/icons/reportes.png',
        path: 'static/resto_stats.html',
        category: 'reportes',
        color: 'rgba(255, 159, 67, 0.1)'
    },
    'resto_impresoras': {
        label: 'Adm. de Impresoras',
        icon: 'static/img/icons/configuracion.png',
        path: 'static/resto_impresoras.html',
        category: 'operaciones',
        color: 'rgba(127, 140, 141, 0.12)'
    },
    'gestion_destinos_kds': {
        label: 'Gestión de Destinos KDS',
        icon: 'static/img/icons/configuracion.png',
        path: 'static/resto_impresoras.html',
        category: 'operaciones',
        color: 'rgba(127, 140, 141, 0.12)'
    },

    // --- 🚚 LOGÍSTICA ---
    'hoja_ruta': {
        label: 'Hojas de Ruta',
        icon: 'static/img/icons/logistica.png',
        path: 'static/hoja_ruta.html',
        category: 'operaciones'
    },
    'repartidores': {
        label: 'Gestión Repartidores',
        icon: 'static/img/icons/empleados.png',
        path: 'static/vendedores.html',
        category: 'operaciones'
    },
    'mapa_clientes': {
        label: 'Mapa de Clientes',
        icon: 'static/img/icons/reportes.png',
        path: 'static/mapa_clientes.html',
        category: 'operaciones'
    },
    'logistica': {
        label: 'Gestión de Flota',
        icon: 'static/img/icons/camiones.png',
        path: 'static/logistica.html',
        category: 'operaciones'
    },

    // --- 🏪 VENTAS ---
    'ventas_nueva': {
        label: 'Nueva Venta',
        icon: 'static/img/icons/ventas.png',
        path: 'static/ventas.html',
        category: 'operaciones'
    },
    'pos': {
        label: 'Caja Rápida (POS)',
        icon: 'static/img/icons/ventas.png',
        path: 'static/pos.html',
        category: 'operaciones'
    },
    'presupuestos': {
        label: 'Generar Presupuesto',
        icon: 'static/img/icons/presupuesto.png',
        path: 'static/presupuestos.html',
        category: 'operaciones'
    },
    'pedidos': {
        label: 'Gestión de Pedidos',
        icon: 'static/img/icons/ventas.png',
        path: 'static/pedidos.html',
        category: 'operaciones',
        color: 'rgba(52, 152, 219, 0.12)'
    },
    'seller': {
        label: 'App Vendedores (Mobile)',
        icon: 'static/img/icons/ventas.png',
        path: 'static/seller.html',
        category: 'operaciones',
        color: 'rgba(52, 152, 219, 0.12)'
    },
    'home_chofer': {
        label: 'App Repartidores (Mobile)',
        icon: 'static/img/icons/camiones.png',
        path: 'static/home_chofer.html',
        category: 'operaciones',
        color: 'rgba(46, 204, 113, 0.12)'
    },

    // --- 📦 COMPRAS & ABASTECIMIENTO ---
    'ingresos': {
        label: 'Ingreso Mercadería',
        icon: 'static/img/icons/ingresos.png',
        path: 'static/ingresos.html',
        category: 'administrativo'
    },
    'proveedores': {
        label: 'Gestión Proveedores',
        icon: 'static/img/icons/proveedor.png',
        path: 'static/proveedores.html',
        category: 'administrativo'
    },
    'orden_compra': {
        label: 'Órdenes de Compra',
        icon: 'static/img/icons/ventas.png',
        path: 'static/orden_compra.html',
        category: 'administrativo'
    },
    'cuentas_corrientes_proveedores': {
        label: 'Cta. Cte. Proveedores',
        icon: 'static/img/icons/ctacte.png',
        path: 'static/cobro_ctacte.html'
    },

    // --- 🏗️ INVENTARIO ---
    'productos': {
        label: 'Catálogo Productos',
        icon: 'static/img/icons/inventario.png',
        path: 'static/inventario.html',
        category: 'administrativo'
    },
    'stock_actual': {
        label: 'Control de Stock',
        icon: 'static/img/icons/inventario.png',
        path: 'static/inventario.html',
        category: 'administrativo'
    },
    'ajustes_stock': {
        label: 'Ajustes Manuales',
        icon: 'static/img/icons/inventariomovil.png',
        path: 'static/historial_ajustes.html',
        category: 'administrativo'
    },

    // --- 💰 TESORERÍA ---
    'caja_control': {
        label: 'Control de Caja',
        icon: 'static/img/icons/caja.png',
        path: 'static/caja.html',
        category: 'administrativo'
    },
    'caja_movimientos': {
        label: 'Movimientos Caja',
        icon: 'static/img/icons/caja.png',
        path: 'static/reporte_caja.html',
        category: 'administrativo'
    },
    'cuentas_corrientes_clientes': {
        label: 'Cta. Cte. Clientes',
        icon: 'static/img/icons/ctacte.png',
        path: 'static/cobro_ctacte.html'
    },
    'clientes_gestion': {
        label: 'Gestión de Clientes',
        icon: 'static/img/icons/clientes.png',
        path: 'static/clientes.html',
        category: 'administrativo'
    },
    'empleados': {
        label: 'Gestión de Empleados',
        icon: 'static/img/icons/empleados.png',
        path: 'static/empleados.html',
        category: 'administrativo',
        color: 'rgba(46, 204, 113, 0.12)'
    },

    // --- 📈 REPORTES E HISTORIALES ---
    'tablero_control': {
        label: 'Tablero de Control',
        icon: 'static/img/icons/dashboard.png',
        path: 'static/dashboard.html',
        category: 'reportes'
    },
    'ventas_historial': {
        label: 'Historial Ventas',
        icon: 'static/img/icons/historial_ventas.png',
        path: 'static/historial_ventas.html',
        category: 'reportes'
    },
    'historial_inventario': {
        label: 'Kardex Inventario',
        icon: 'static/img/icons/historial_inventario.png',
        path: 'static/historial_inventario.html',
        category: 'reportes'
    },
    'historial_presupuestos': {
        label: 'Historial Presupuestos',
        icon: 'static/img/icons/presupuesto.png',
        path: 'static/historial_presupuestos.html',
        category: 'reportes'
    },
    'historial_ajustes': {
        label: 'Historial Ajustes',
        icon: 'static/img/icons/caja.png',
        path: 'static/historial_ajustes.html',
        category: 'reportes'
    },
    'historial_pagos_proveedores': {
        label: 'Historial Pagos Prov.',
        icon: 'static/img/icons/payments.png',
        path: 'static/historial_pagos_proveedores.html',
        category: 'reportes'
    },
    'historial_ingresos': {
        label: 'Historial Ingresos',
        icon: 'static/img/icons/ingresos.png',
        path: 'static/historial_ingresos.html',
        category: 'reportes'
    },
    'agente_facturacion': {
        label: 'Agente de Facturación (ARCA)',
        icon: 'static/img/icons/ventas.png',
        path: 'static/agente_facturacion.html',
        category: 'administrativo',
        color: 'rgba(79, 70, 229, 0.12)'
    },

    // --- ⚙️ CONFIGURACIÓN Y REGLAS ---
    'configuracion_general': {
        label: 'Configuración Gral.',
        icon: 'static/img/icons/configuracion.png',
        path: 'static/configuracion.html',
        category: 'reglas'
    },
    'productos_categorias': {
        label: 'Categorías Productos',
        icon: 'static/img/icons/categorias.png',
        path: 'static/categorias.html',
        category: 'reglas'
    },
    'gastos_categorias': {
        label: 'Categorías Gastos',
        icon: 'static/img/icons/gastos_categorias.png',
        path: 'static/gastos_categorias.html',
        category: 'reglas'
    },
    'unidades_medida': {
        label: 'Unidades de Medida',
        icon: 'static/img/icons/medicion.png',
        path: 'static/unidades_medida.html',
        category: 'reglas'
    },
    'usuarios': {
        label: 'Gestión Usuarios',
        icon: 'static/img/icons/usuarios.png',
        path: 'static/usuarios.html',
        category: 'reglas'
    },
    'negocios_gestion': {
        label: 'Locales / Negocios',
        icon: 'static/img/icons/negocios.png',
        path: 'static/negocios.html',
        category: 'reglas'
    },
    'eventos': {
        label: 'Gestión de Eventos',
        icon: 'static/img/icons/club.png',
        path: 'static/eventos.html',
        category: 'reglas'
    },
    'crm_social': {
        label: 'CRM & Marketing',
        icon: 'static/img/icons/clientes.png',
        path: 'static/crm_social/crm_social.html',
        category: 'operaciones',
        color: 'rgba(235, 77, 75, 0.12)'
    },
    'crm_contactos': {
        label: 'CRM Contactos',
        icon: 'static/img/icons/leads.png',
        path: 'static/crm_social/crm_contactos.html',
        category: 'operaciones',
        color: 'rgba(79, 70, 229, 0.12)'
    },
    'gastos': {
        label: 'Gestión de Gastos',
        icon: 'static/img/icons/gastos.png',
        path: 'static/gastos.html',
        category: 'administrativo'
    },
    'cobro_ctacte': {
        label: 'Cuentas Corrientes',
        icon: 'static/img/icons/ctacte.png',
        path: 'static/cobro_ctacte.html',
        category: 'administrativo'
    },
    'negocio_roles': {
        label: 'Roles y Permisos',
        icon: 'static/img/icons/configuracion.png',
        path: 'static/negocio_roles.html',
        category: 'reglas',
        color: 'rgba(79, 70, 229, 0.12)'
    }
};
