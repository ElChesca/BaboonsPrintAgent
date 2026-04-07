// app/static/js/modules/resto_dolce.js
import { inicializarRestoCocina, setKDSStation } from './resto_cocina.js';

/**
 * Especialización del KDS para Dolce (Pastelería/Cafetería)
 */
export async function inicializarRestoDolce() {
    setKDSStation('dolce');
    return await inicializarRestoCocina();
}
