---
name: UI Premium Modal Pattern
description: Guidelines and code snippets for creating high-end, modern floating modal windows in the Baboons platform.
---

# UI Premium Modal Pattern

This skill defines the standard for "Premium" modal windows in the Multinegocio Baboons platform. These modals are characterized by high visual depth, soft large rounding, and a centered floating appearance.

## 1. Core Structure (HTML)

Always use the **standard CSS classes** now defined in `global.css` for a consistent experience:

```html
<!-- Modal Container (Overlay) -->
<div id="modal-id" class="premium-modal-overlay">
    <!-- Modal Content (The floating card) -->
    <div class="premium-modal-content" style="max-width: 850px; width: 95%;">
        
        <!-- Header (Dark/Premium) -->
        <div class="premium-modal-header">
            <h4 class="mb-0 fw-bold"><i class="fas fa-icon me-2"></i>Title</h4>
            <button class="btn-close-modal" onclick="closeFunction()">×</button>
        </div>

        <!-- Body -->
        <div class="premium-modal-body">
            <!-- Content goes here -->
        </div>

        <!-- Footer (Optional) -->
        <div class="premium-modal-footer">
            <button class="btn btn-secondary" onclick="closeFunction()">Cancel</button>
            <button class="btn btn-success px-4" onclick="saveFunction()">Confirm</button>
        </div>
    </div>
</div>
```

## 2. Design Specs (Now built into classes)
- **Overlay**: `rgba(0,0,0,0.7)` background, centered with flex, blur background.
- **Content Card**: `16px` radius, deep shadow (`0 25px 80px`), slide-up animation.
- **Header**: Dark background (`#212529`) with white text and large "×" close button.

### Recommendations for Sizing
- **Small/Info**: `max-width: 500px`
- **Standard**: `max-width: 850px`
- **Wide/Data-heavy**: `max-width: 1450px` (98% viewport width)

## 3. Implementation Workflow

1.  **Check existing modals**: Look for `baboons-modal` or older layouts.
2.  **Apply Overlay Styles**: Ensure the parent has the dark overlay and flex centering.
3.  **Update Content Styling**: Change `border-radius` to `16px` and apply the deep shadow.
4.  **Polish Headers**: Use `bg-dark text-white` or `bg-primary text-white` for a premium look.
5.  **JavaScript Control**: Use `display: flex` to show and `display: none` to hide.

## 4. Code Snippet for quick refactoring (CSS-in-HTML)

If you need to quickly patch an existing modal in a specific HTML file:

```html
<div id="my-modal" class="modal-overlay" 
     style="display:none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 2500; align-items: center; justify-content: center; overflow-y: auto;">
    <div class="modal-content" style="max-width: 800px; width: 95%; border-radius: 16px; border: none; box-shadow: 0 25px 80px rgba(0,0,0,0.5); overflow: hidden; margin: 20px auto;">
        <!-- Header, Body, Footer -->
    </div>
</div>
```

## 5. Typical JS Interaction

```javascript
function abrirModal() {
    const modal = document.getElementById('my-modal');
    modal.style.display = 'flex'; // Important: use flex for centering
    // Load data...
}

function cerrarModal() {
    document.getElementById('my-modal').style.display = 'none';
}
```
