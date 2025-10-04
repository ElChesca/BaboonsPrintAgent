// app/static/js/modules/ui.js

/**
 * Muestra un mensaje de error simple al usuario.
 * @param {string} mensaje - El mensaje de error a mostrar.
 */
export function mostrarError(mensaje) {
    console.error(mensaje); // Muestra el error en la consola para depuración
    alert(mensaje);       // Muestra una alerta simple al usuario
}