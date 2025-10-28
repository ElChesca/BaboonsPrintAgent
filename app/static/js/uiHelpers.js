// static/js/uiHelpers.js

/**
 * Muestra el indicador de carga global.
 */
export function showGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        console.log("Mostrando loader global...");
        loader.style.display = 'flex';
    }
}

/**
 * Oculta el indicador de carga global.
 */
export function hideGlobalLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        console.log("Ocultando loader global...");
        loader.style.display = 'none';
    }
}