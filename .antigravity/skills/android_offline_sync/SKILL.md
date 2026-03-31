---
name: Android Offline-First Sync & Crash Prevention
description: Guidelines and code snippets for implementing bullet-proof offline sync in Kotlin, bypassing WorkManager for manual UI triggers, and avoiding Retrofit wildcard crashes.
---

# Android Offline-First Synchronization

Este documento sirve como manual de referencia para implementar un sistema de creación de pedidos (o cualquier entidad) que funcione sin internet, resista cortes de red, brinde feedback en tiempo real al usuario mediante Jetpack Compose, y evite los fallos comunes en Retrofit y Android WorkManager.

## 1. El Error de los "Comodines" en Retrofit (Type Variable or Wildcard)

### ❌ El problema
Si intentas enviar una capa de datos anidada utilizando literales genéricos de Kotlin como `Map<String, List<MiEntidad>>`, Retrofit chocará en el momento exacto en que quieras llamar a la API (ni siquiera enviará el request) devolviendo el siguiente error fatal:

```text
Parameter type must not include a type variable or wildcard: java.util.Map<java.lang.String, ? extends java.util.List<? extends com...Entity>>
```

**Motivo:** Kotlin compila la covarianza de las listas `List<T>` de una manera que Java (y la reflexión en la que se basa Gson/Retrofit) interpreta usando "Wildcards" (`? extends`). Retrofit falla al intentar parsear esta advertencia tipográfica.

### ✅ La solución
Nunca envíes un `Map<...>` directo en el `@Body`. Envuelve siempre tu colección en un **Data Class (DTO)** dedicado:

```kotlin
// 1. Crea tu DTO
data class PedidosOfflineRequest(
    val pedidos: List<PedidoPendienteEntity>
)

// 2. Úsalo en el ApiClient (Retrofit)
@POST("api/negocios/{negocioId}/sync/pedidos-offline")
suspend fun syncPedidosOffline(
    @Path("negocioId") negocioId: Int, 
    @Body body: PedidosOfflineRequest
): Response<Any>

// 3. Asígnale la variable
val bodyRequest = PedidosOfflineRequest(misPedidosLocales)
api.syncPedidosOffline(id, bodyRequest)
```

## 2. WorkManager vs. Sincronización Manual (Bypass)

### 🟠 El Comportamiento Oculto de WorkManager
En ocasiones, asignamos un `OneTimeWorkRequest` pidiendo la restricción de red (`NetworkType.CONNECTED`). Sin embargo, en algunas configuraciones de Android (ahorro de batería, redes medidas o emuladores), el sistema operativo no ejecuta el Worker inmediatamente y **el usuario presiona el botón "Sincronizar" sin que suceda nada en la pantalla ni en consola**.

### 🟢 Solución: Bypass Manual + ViewModelScope
Cuando el usuario aprieta un botón específico de "Sincronización Inmediata" en la Interfaz:
**¡NO utilices WorkManager!** El WorkManager déjalo estricto solo para el Background silencioso (ej: el teléfono está bloqueado en el bolsillo del vendedor). Para el botón UI, inyéctalo directamente usando corrutinas `(viewModelScope + Dispatchers.IO)`:

```kotlin
fun sincronizarManualmente(onTerminado: (String) -> Unit) {
    viewModelScope.launch(Dispatchers.IO) {
        val pendientes = dao.getPendientes()
        if (pendientes.isEmpty()) return@launch

        try {
            // Despachamos la red inmediatamente
            val response = api.syncPedidosOffline(negocioId, PedidosOfflineRequest(pendientes))
            
            if (response.isSuccessful) {
                pendientes.forEach { dao.actualizarEstado(it.uuid, "enviado") }
                withContext(Dispatchers.Main) { onTerminado("Éxito!") }
            } else {
                withContext(Dispatchers.Main) { onTerminado("Error HTTP: ${response.code()}") }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) { onTerminado("Fallo de Red: Sin internet") }
        }
    }
}
```

## 3. Estado Reactivo "Mágico" (Compose + Room)

Para que el usuario experimente que los estados pasan instantáneamente de un `🔴 Pendiente` a un `🟢 Enviado` el mismo milisegundo en que retorna el servidor, sigue este patrón:

1. El orígen de la verdad (Source of Truth) **NUNCA** es la respuesta de la API, sino la BD Local (SQLite/Room).
2. Utiliza `StateFlow` leyendo directamente desde el Dao:

```kotlin
// Dentro de tu ViewModel
val pedidos: StateFlow<List<PedidoPendienteEntity>> = dao.getAll()
    .stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )
```

3. Cada vez que tu función `sincronizarManualmente` reciba éxito del backend, hará un `UPDATE` a `"enviado"` dentro de SQLite (`dao.actualizarEstado(uuid, "enviado")`).
4. Room despachará este cambio automáticamente al `StateFlow`.
5. Tu pantalla Jetpack Compose se repintará sin escribir una sola línea más de código, transformando la lista automáticamente.
