# 📋 Informe de Avance y Lecciones Aprendidas (App Sellers v1.3.5)

Este documento resume las mejoras implementadas recientemente en la aplicación de preventa (vendedores) y documenta las lecciones aprendidas para agilizar el desarrollo de futuras aplicaciones (como la de Choferes).

---

## ✅ 1. Avance del Proyecto (Hitos Recientes)

### **Funcionalidades Nuevas**
- **Panel de KPIs de Ruta**: Se implementaron tres indicadores clave en el Home:
    - **Pendientes**: Clientes en la ruta sin gestión (ni pedido ni visita).
    - **Pedidos**: Total de pedidos realizados en la ruta activa.
    - **Progreso %**: Visualización del cierre de ruta (Gestión total).
- **Seguimiento de Visitas**: Botón de "Visibilidad" (Ojo) en la ficha de cliente para marcar visitas sin venta.
- **Persistencia de Gestión**: Se actualizó el esquema de la base de datos (Versión 6) para guardar el estado de "visitado" localmente.
- **Lógica de Sincronización Inteligente**: La App ahora conserva el estado de las visitas locales incluso después de sincronizar datos maestros del servidor.

### **Estabilidad y UI**
- **Corrección de Errores de Tipos**: Se resolvieron problemas críticos de inferencia de tipos en Kotlin que bloqueaban la compilación.
- **Diseño Premium**: Se implementaron bordes dinámicos (azul para pedidos, check amarillo para visitas solo) y se ajustó la paleta de colores oficial.
- **Encabezado Informativo**: Se añadió el nombre del negocio y la fecha real en la barra superior.

---

## 🚀 2. Lecciones Aprendidas (Para la App de Choferes)

Para evitar "rabiar" y perder tiempo en depuración en la próxima App, debemos seguir estas reglas de oro:

### **A. Manejo de Importaciones (Kotlin/Compose)**
- **El problema**: Kotlin arroja errores crípticos de "Cannot infer type" o "Unresolved reference" si una clase no está importada, incluso si parece que el error es de lógica.
- **La lección**: Usar importaciones con comodines (`*`) para los paquetes principales de datos (`entities`, `dao`, `theme`). Esto evita que el compilador se "pierda" al inferir tipos en listas o filtros.

### **B. Entorno de Ejecución (Java y Build)**
- **El problema**: Ejecutar comandos (`gradlew`) en terminales externas suele fallar por falta de `JAVA_HOME` o versiones de JDK incompatibles.
- **La lección**: Usar siempre el menú **`Build -> Build APKs`** de Android Studio. Es la forma más fiable, ya que usa el motor interno de la IDE y no depende de variables de entorno del sistema operativo.

### **C. Gestión de Iconos**
- **El problema**: No todos los iconos están en la librería estándar. Iconos como `Visibility`, `Check` o `ShoppingCart` requieren la librería **`extended`**.
- **La lección**: Verificar siempre que la dependencia `androidx.compose.material:material-icons-extended` esté en el `build.gradle` (en este proyecto ya lo está).

### **D. Evolución de Base de Datos (Room)**
- **El problema**: Añadir campos nuevos (como `visitado`) sin subir la versión de la base de datos causa errores de inicio.
- **La lección**: Incrementar siempre el número de versión en `AppDatabase.kt`. Durante el desarrollo, usamos `fallbackToDestructiveMigration()` para resetear la base de datos automáticamente al cambiar el esquema.

---

## 📦 3. Próximos Pasos Sugeridos

1.  **Sincronización de Visitas**: El campo `visitado` actualmente es solo **local**. Para la App de Choferes (y esta de Vendedores), será útil sincronizar esto al backend para que el administrador vea el recorrido real en tiempo real.
2.  **Manejo de Offline**: Asegurarse de que toda acción crítica (como el cambio de estado de una entrega en Choferes) se guarde primero localmente y se intente subir en segundo plano.

---
*Documento generado el 24 de marzo de 2026 para Multinegocio Baboons.*
