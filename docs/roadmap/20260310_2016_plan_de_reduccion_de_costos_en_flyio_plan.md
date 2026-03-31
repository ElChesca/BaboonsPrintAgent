# Plan de Reducción de Costos en Fly.io

He revisado tu configuración actual y he identificado por qué estás gastando ~$8 en lo que va de marzo. Aquí está el desglose y el plan para bajarlo.

## Resumen de Gastos Actuales

1.  **Costo Fijo (Hobby Plan): ~$5.00/mes**. Fly.io cobra un mínimo de $5 por mes para cuentas que no están en el plan gratuito básico. Este costo se aplica incluso si las máquinas están apagadas.
2.  **Volúmenes (Almacenamiento): $0.60/mes**. Tienes 4 volúmenes de 1GB cada uno repartidos en 3 aplicaciones. Los volúmenes se cobran **siempre**, aunque la máquina esté apagada, porque están reservando espacio en disco.
3.  **Uso de Máquinas (RAM): ~$2.50+**.
    *   La máquina de producción (`multinegociobaboons-fly`) está configurada con **1024MB (1GB) de RAM**. La de desarrollo usa 256MB.
    *   La aplicación `munidigitalsanluis` tiene **2 máquinas de 1GB cada una**.
    *   Aunque tienen `auto_stop_machines = true`, si reciben algún tipo de tráfico (o ping de bots), se encienden y consumen. La máquina de producción está **encendida** ahora mismo.

## Cambios Propuestos

### [Componente] Configuración de Fly.io

#### [MODIFY] [fly.toml](file:///C:/Users/usuario/Documents/MultinegocioBaboons/fly.toml)
Reducir la memoria de la máquina de producción de 1GB a 256MB para igualarla a la de desarrollo y minimizar el costo por hora.

```diff
 [[vm]]
-  memory = '1gb'
+  memory = '256mb'
   cpu_kind = 'shared'
   cpus = 1
```

### [Acciones Manuales Recomendadas]

1.  **Eliminar máquinas redundantes**: La app `munidigitalsanluis` tiene 2 máquinas de 1GB cada una. Si no la estás usando, deberías eliminar esas máquinas o la app entera para ahorrar en volúmenes y evitar encendidos accidentales.
2.  **Revisar Tráfico**: La app `multinegociobaboons-fly` está encendida en este momento. Si no hay nadie usándola, puede que haya bots o servicios de monitoreo manteniéndola despierta.

## Plan de Verificación

### Pasos de Verificación
1.  Ejecutar `fly deploy` (o `fly machine update`) con la nueva configuración de 256MB.
2.  Verificar que la aplicación siga funcionando correctamente con menos RAM (la versión de desarrollo ya funciona bien con 256MB).
3.  Confirmar con `fly scale show` que el cambio se aplicó.
