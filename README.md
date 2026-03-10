# MultinegocioBaboons

Plataforma de gestión multi-negocio para Retail, Consorcios, Distribución y Eventos.

---

> [!CAUTION]
> ### 🚩 IMPORTANTE: LÉAME PRIMERO
> Antes de realizar cualquier despliegue, modificación en el flujo de base de datos o cambios en Fly.io, es **OBLIGATORIO** leer el archivo:
> ## 📄 [ARQUITECTURA_ENTORNOS.md](./ARQUITECTURA_ENTORNOS.md)
> Este archivo contiene las reglas críticas para no romper la persistencia de datos en el entorno de Desarrollo (SQLite) y Producción (Postgres).

---

## Módulos Principales
- **Retail**: Punto de venta, inventario y gestión de facturación.
- **Distribución**: Gestión de vendedores y Hojas de Ruta (reparto).
- **Consorcio**: Gestión de unidades, expensas y noticias.
- **Eventos**: Sistema de inscripciones y gestión de ferias.

## Stack Técnico
- **Backend**: Python (Flask)
- **Frontend**: HTML5, Vanilla JS, CSS3
- **Infraestructura**: Fly.io
- **Base de Datos**: PostgreSQL (Producción) / SQLite (Desarrollo)