// static/js/uiHelpers.js

/**
 * Muestra el indicador de carga global.
 */
export function showGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'flex';
    }
}

/**
 * Oculta el indicador de carga global.
 */
export function hideGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * Formatea un número como moneda (AR$).
 */
export function formatearMoneda(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return '$ 0,00';
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2
    }).format(num);
}

/**
 * Formatea un número simple (para cantidades).
 */
export function formatearNumero(valor) {
    const num = parseFloat(valor);
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('es-AR').format(num);
}