// app/static/js/modules/ia_scanner.js
/**
 * Baboon AI Scanner Core
 * Módulo independiente para procesamiento de imágenes con Gemini
 */

export const BaboonAIScanner = {
    /**
     * Sube un archivo al backend y devuelve el JSON extraído
     * @param {File} file 
     * @returns {Promise<Object>}
     */
    async extractData(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/ia/extract-invoice', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error al procesar la imagen.');
        }

        return await response.json();
    },

    /**
     * Muestra el modal de Scanner estilo Baboon Premium
     * @param {Object} options - { onComplete: (data) => {}, targetElement: HTMLElement }
     */
    async openModal({ onComplete }) {
        const modalId = 'modal-baboon-ai-scanner';
        let modalEl = document.getElementById(modalId);

        if (!modalEl) {
            this._createModalMarkup(modalId);
            modalEl = document.getElementById(modalId);
        }

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Limpiar estados previos
        const container = modalEl.querySelector('.scanner-ui-container');
        const loader = modalEl.querySelector('.scanner-loader');
        container.classList.remove('hidden');
        loader.classList.add('hidden');

        // Logic para el input file
        const fileInput = document.getElementById('ia-scanner-file-input');
        const btnCapture = document.getElementById('btn-ia-scanner-capture');

        btnCapture.onclick = () => fileInput.click();

        fileInput.onchange = async (e) => {
            if (e.target.files && e.target.files[0]) {
                try {
                    // Mostrar Loader
                    container.classList.add('hidden');
                    loader.classList.remove('hidden');

                    const data = await this.extractData(e.target.files[0]);
                    
                    onComplete(data);
                    modal.hide();
                } catch (error) {
                    alert(error.message);
                    container.classList.remove('hidden');
                    loader.classList.add('hidden');
                } finally {
                    fileInput.value = ''; // Reset
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
                            <input type="file" id="ia-scanner-file-input" accept="image/*" capture="environment" class="hidden">
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
