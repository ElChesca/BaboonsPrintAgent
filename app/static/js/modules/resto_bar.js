// app/static/js/modules/resto_bar.js
import { inicializarRestoCocina, setKDSStation } from './resto_cocina.js';

/**
 * Especialización del KDS para la Barra
 */
export async function inicializarRestoBar() {
    setKDSStation('bar');
    return await inicializarRestoCocina();
}
