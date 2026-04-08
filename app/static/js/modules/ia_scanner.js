// app/static/js/modules/ia_scanner.js
import { getAuthHeaders } from './auth.js';

/**
 * Baboon AI Scanner Core
 * Módulo independiente para procesamiento de imágenes con Gemini
 */

export const BaboonAIScanner = {
    isProcessing: false,
    currentAbortController: null,
    /**
     * Sube un archivo al backend y devuelve el JSON extraído
     * @param {File} file 
     * @param {number} retries - Intentos restantes
     * @param {number} delay - Tiempo de espera inicial en ms
     * @param {AbortSignal} signal - Señal para cancelar el proceso
     * @param {string} endpoint - Endpoint a disparar (Gemini o Document AI)
     * @param {Object} extraData - Datos adicionales para el FormData
     * @returns {Promise<Object>}
     */
    async extractData(file, retries = 3, delay = 20000, signal = null, endpoint = '/api/ia/extract-invoice', extraData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        if (extraData) {
            Object.entries(extraData).forEach(([key, val]) => formData.append(key, val));
        }

        const authHeaders = getAuthHeaders();
        delete authHeaders['Content-Type'];

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: formData,
                headers: { ...authHeaders },
                signal: signal
            });

            if (response.status === 429 && retries > 0) {
                console.warn(`Límite alcanzado en ${endpoint}. Reintentando en ${delay / 1000}s...`);
                
                const loaderSubtext = document.querySelector('.scanner-loader p');
                if (loaderSubtext) {
                    loaderSubtext.innerText = `Límite alcanzado. Reintentando en ${delay / 1000}s...`;
                }

                // Espera cancelable
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(resolve, delay);
                    if (signal) {
                        signal.addEventListener('abort', () => {
                            clearTimeout(timeout);
                            reject(new DOMException('Aborted', 'AbortError'));
                        }, { once: true });
                    }
                });

                return this.extractData(file, retries - 1, delay * 1.5, signal, endpoint, extraData);
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || err.error || `Error del servidor: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.error("Error en extractData:", error);
            throw error;
        }
    },

    /**
     * Muestra el modal de Scanner estilo Baboon Premium
     */
    async openModal({ onComplete, endpoint = '/api/ia/extract-invoice', loadingText = 'Analizando comprobante...', extraData = {} }) {
        const modalId = 'modal-baboon-ai-scanner';
        let modalEl = document.getElementById(modalId);

        if (!modalEl) {
            this._createModalMarkup(modalId);
            modalEl = document.getElementById(modalId);
        }

        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        // Limpiar estados previos y controladores de aborto
        if (this.currentAbortController) this.currentAbortController.abort();
        this.currentAbortController = new AbortController();

        const container = modalEl.querySelector('.scanner-ui-container');
        const loader = modalEl.querySelector('.scanner-loader');
        const loaderSubtext = loader.querySelector('p');
        
        if (loaderSubtext) {
            loaderSubtext.innerText = loadingText;
        }
        
        container.classList.remove('hidden');
        loader.classList.add('hidden');
        this.isProcessing = false;

        // Limpieza de emergencia si se cierra el modal manualmente
        modalEl.addEventListener('hidden.bs.modal', () => {
            this.isProcessing = false;
            if (this.currentAbortController) this.currentAbortController.abort();
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        }, { once: true });

        // Logic para el input file
        const fileInput = document.getElementById('ia-scanner-file-input');
        const btnCapture = document.getElementById('btn-ia-scanner-capture');

        btnCapture.onclick = () => fileInput.click();

        fileInput.onchange = async (e) => {
            if (this.isProcessing) return; 
            
            if (e.target.files && e.target.files[0]) {
                try {
                    this.isProcessing = true;
                    container.classList.add('hidden');
                    loader.classList.remove('hidden');

                    console.log(`🚀 Iniciando extracción en ${endpoint}...`);
                    const response = await this.extractData(e.target.files[0], 3, 20000, this.currentAbortController.signal, endpoint, extraData);
                    
                    if (this.currentAbortController.signal.aborted) return;
                    
                    onComplete(response);
                    modal.hide();

                } catch (error) {
                    if (error.name === 'AbortError') return;
                    alert(error.message);
                    container.classList.remove('hidden');
                    loader.classList.add('hidden');
                } finally {
                    fileInput.value = ''; // Reset
                    this.isProcessing = false;
                }
            }
        };
    },

    _createModalMarkup(id) {
        const html = `
        <div class="modal fade" id="${id}" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header bg-dark text-white border-0 py-3">
                        <h6 class="modal-title fw-bold d-flex align-items-center">
                            <i class="fas fa-robot me-2 text-primary"></i> BABOON AI SCANNER
                        </h6>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-5 text-center">
                        <!-- UI de Captura -->
                        <div class="scanner-ui-container">
                            <div class="mb-4">
                                <div class="scanner-icon-circle bg-primary-subtle text-primary mx-auto mb-3">
                                    <i class="fas fa-camera fa-2x"></i>
                                </div>
                                <h5 class="fw-bold">Escanea tu Comprobante</h5>
                                <p class="text-muted small">Toma una foto clara de la factura o remito para que la IA complete el formulario por vos.</p>
                            </div>
                            <input type="file" id="ia-scanner-file-input" accept="image/*,application/pdf" capture="environment" class="hidden">
                            <button id="btn-ia-scanner-capture" class="btn btn-primary rounded-pill px-5 fw-bold shadow">
                                <i class="fas fa-camera me-2"></i> CAPTURAR AHORA
                            </button>
                        </div>

                        <!-- UI de Cargando -->
                        <div class="scanner-loader hidden animate__animated animate__fadeIn">
                            <div class="baboon-spinner mx-auto mb-4"></div>
                            <h5 class="fw-bold mb-1">Analizando Comprobante...</h5>
                            <p class="text-muted small">Gemini está desglosando impuestos e ítems.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <style>
            .scanner-icon-circle {
                width: 80px;
                height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
            }
            .baboon-spinner {
                width: 60px;
                height: 60px;
                border: 5px solid #f3f3f3;
                border-top: 5px solid #0d6efd;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            .hidden { display: none !important; }
        </style>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    }
};
