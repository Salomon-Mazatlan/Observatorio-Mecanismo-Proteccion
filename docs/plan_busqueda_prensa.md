# Plan de búsqueda manual en prensa

## Para qué

Las organizaciones (ARTICLE 19, CEMDA, RSF, CPJ, Comité Cerezo) publican cifras anuales y casos emblemáticos, pero con retraso de meses y sin el detalle municipal ni el contexto local que necesita el observatorio. El registro propio de prensa llena ese hueco con eventos fechados y ubicados, y permite contrastar las cifras oficiales. No sustituye a esas fuentes; las complementa y se compara contra ellas.

## Alcance inicial

- Grupos: periodistas y personas defensoras (incluidas ambientales, del territorio y buscadoras), por separado en el campo `grupo`.
- Territorio: Sinaloa en primer lugar y con mayor profundidad; el resto del país para asesinatos, desapariciones y casos con cobertura nacional.
- Periodo: de enero de 2024 en adelante hacia adelante, y hacia atrás hasta 2018 conforme haya tiempo, porque 2018 es el inicio del registro público mensual del Mecanismo federal y permite comparar.

## Fuentes a revisar y con qué frecuencia

| Fuente | Qué buscar | Frecuencia |
|---|---|---|
| Ríodoce, Noroeste, Línea Directa, Revista Espejo, Luz Noticias, Altavoz, Sector Primario, Debate | Agresiones, amenazas, ataques a medios, desplazamiento de periodistas, actividad del Instituto de Protección y de la Asociación 7 de Junio | Semanal |
| Comunicados del Instituto de Protección de Sinaloa y de la Asociación 7 de Junio | Medidas otorgadas, quejas, pronunciamientos | Mensual |
| ARTICLE 19 (alertas y notas de prensa), CPJ, RSF, CEMDA, Comité Cerezo, Red TDT, Frayba | Casos nuevos y cifras | Semanal |
| Informes mensuales del Mecanismo federal | Beneficiarias por entidad, incorporaciones | Mensual, capturando el corte de diciembre como dato anual |
| Prensa nacional (Proceso, La Jornada, Animal Político, Infobae, Milenio, El Universal, Aristegui) | Asesinatos, desapariciones, acoso judicial, casos con seguimiento | Semanal |
| Boletines de fiscalías (FEADLE, fiscalías estatales) | Detenciones, vinculaciones a proceso, sentencias | Mensual |

## Cadenas de búsqueda

Se recomienda una lista fija de cadenas para que la búsqueda sea reproducible y otra persona la pueda repetir. Ejemplos, que conviene combinar con el nombre del estado o municipio y con el rango de fechas del buscador:

- periodista asesinado, periodista asesinada, comunicador asesinado, reportero atacado, ataque a periodista, amenaza a periodista, periodista desaparecido, periodista desplazado, periodista golpeado, agresión a periodista, ataque a medio, balacera contra medio, incendio de medio.
- defensor asesinado, defensora asesinada, activista asesinado, ambientalista asesinado, líder comunitario asesinado, comunero asesinado, ejidatario asesinado, madre buscadora asesinada, buscadora desaparecida, defensor de derechos humanos amenazado, defensor del territorio, defensora del agua.
- Mecanismo de Protección, medidas cautelares periodista, Instituto de Protección Sinaloa, Vicefiscalía derechos humanos Sinaloa, FEADLE.
- En inglés para CPJ y RSF: journalist killed Mexico, journalist missing Mexico, environmental defender killed Mexico.

Para cada estado se añaden los nombres de los medios locales principales, porque las agresiones a medios pequeños rara vez llegan a los buscadores generales.

## Ficha de captura (una fila por evento en `plantillas/eventos.xlsx`)

Campos ya existentes: tema (`periodistas`), grupo (`periodista`, `defensor` o `ambos`), tipo, fecha, coordenadas, lugar, título, descripción, fuente, URL, verificación, ejemplo.

Vocabulario cerrado para `tipo`, para que después se pueda contar por categoría:

- asesinato de periodista, asesinato de persona defensora, asesinato de persona defensora ambiental, asesinato de persona buscadora
- desaparición de periodista, desaparición de persona defensora
- tentativa de asesinato
- agresión física, agresión por autoridad, ataque a medio, ataque a domicilio
- amenaza, intimidación, hostigamiento digital
- acoso judicial, detención arbitraria
- desplazamiento por la labor
- medidas de protección, cifra oficial, cifra gremial, informe

En la descripción se anota siempre: qué pasó según la nota, quién dio la cifra o la versión, si la persona tenía medidas de protección, la presunta autoría (agente estatal, particular, grupo criminal, desconocida) y si hay segunda fuente. Cuando solo se conoce el municipio se usa la cabecera y se escribe "ubicación aproximada".

## Verificación

- `prensa`: una sola nota periodística.
- `organización`: documentado por ARTICLE 19, CEMDA, CPJ, RSF, Comité Cerezo, Red TDT o similar.
- `oficial`: confirmado por fiscalía, Mecanismo, Instituto estatal o CNDH.
- Un evento sube de nivel cuando aparece la segunda fuente; se actualiza la fila conservando su id y se añade la nueva URL en la descripción.

Regla de nombres: se nombra a las personas asesinadas o desaparecidas tal como lo hacen las organizaciones; a las personas agredidas que siguen en activo no se les nombra, salvo que ellas mismas hayan hecho público el caso con su nombre.

## Contraste periódico

Cada trimestre se comparan los conteos del registro propio con los de ARTICLE 19 (asesinatos y agresiones), CPJ y RSF (asesinatos), CEMDA (ambientales) y el Instituto de Sinaloa. Las diferencias se anotan en `docs/` con fecha; sirven para calibrar el sesgo de cobertura y para detectar casos que el registro no captó.

## Organización del trabajo

- Un cuaderno de búsqueda (hoja de Excel aparte o un archivo Markdown) con fecha, fuente, cadena usada y número de resultados revisados, para que la búsqueda sea auditable.
- Sesiones semanales cortas por fuente, en lugar de barridos largos mensuales, para no perder notas que los medios retiran o que dejan de estar indexadas.
- Capturar primero en el Excel, correr `actualizar_eventos.py` con `--solo-validar`, corregir y publicar. Los respaldos automáticos permiten revertir.
- Guardar copia de cada nota (PDF o captura) en una carpeta fuera del repositorio, nombrada con el id del evento, porque las URL de prensa local caducan.

## Ética y seguridad

No publicar domicilios, rutas ni datos que permitan localizar a personas en riesgo. Para personas beneficiarias del Mecanismo, registrar solo lo que la autoridad haya hecho público. Si una persona pide que su caso no aparezca, se retira del archivo público y se conserva en el registro interno con esa anotación.
