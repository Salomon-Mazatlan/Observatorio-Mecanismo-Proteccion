# Plan del comparativo entre el marco federal y los marcos estatales

## Punto de partida

La referencia es la Ley para la Protección de Personas Defensoras de Derechos Humanos y Periodistas (federal, 2012), que crea el Mecanismo de Protección de Segob, y los estándares interamericanos y de Naciones Unidas que la rodean (Declaración sobre defensores de 1998, Relatorías de libertad de expresión). Contra esa referencia se leen los instrumentos de las 32 entidades que ya están en `datos/marco_legal.json`, clasificados en cinco situaciones (ley o mecanismo propio, coordinación con el federal, solo periodistas, solo fiscalía, sin instrumento).

El comparativo se hace como mapeo legal, es decir, codificando cada instrumento con las mismas preguntas cerradas, de modo que el resultado sea una matriz de 33 renglones (federal más 32 entidades) por N columnas, y no un ensayo por estado. Esa matriz es la que alimenta el puntaje de protección formal del índice.

## Qué considerar (dimensiones y preguntas de codificación)

### A. Naturaleza del instrumento

- Tipo: ley, decreto, acuerdo del Ejecutivo, protocolo de fiscalía, unidad administrativa, iniciativa no aprobada.
- Jerarquía: una ley del Congreso obliga a asignar presupuesto y sobrevive al cambio de gobierno; un acuerdo del Ejecutivo puede derogarse por otro acuerdo.
- Año de expedición y reformas relevantes (última reforma, qué cambió).
- Reglamento publicado y fecha.

### B. Sujetos protegidos y definiciones

- Define persona defensora. Incluye colectivos, comunidades, pueblos indígenas, personas buscadoras.
- Define periodista. Criterio funcional (quien recaba y difunde información de interés público, con o sin credencial, con o sin medio) o restringido a personas empleadas por medios.
- Cubre a familiares y personas relacionadas.
- Protege el ejercicio en entornos digitales.

### C. Órgano y gobernanza

- Órgano que opera: autónomo (Sinaloa), desconcentrado de la Secretaría de Gobierno (Guerrero, Tlaxcala), comisión (Puebla, Veracruz), unidad dentro de la fiscalía, o solo enlace con el Mecanismo federal.
- Junta o consejo de gobierno: integración, si sociedad civil tiene voto.
- Consejo consultivo con personas periodistas y defensoras electas.
- Titular: forma de nombramiento y requisitos.

### D. Procedimiento y medidas

- Solicitud: quién puede pedir, plazos de respuesta, procedimiento extraordinario.
- Análisis de riesgo: metodología, enfoque de género y diferencial (indígena, ambiental, buscadoras).
- Catálogo de medidas: preventivas, de protección, urgentes; reubicación; medidas colectivas para comunidades.
- Plazos máximos para medidas urgentes.
- Retiro o modificación de medidas: procedimiento y derecho de audiencia.
- Coordinación con el Mecanismo federal y con municipios (convenios, traslado de casos).

### E. Recursos

- Fondo específico o partida presupuestal identificable.
- Presupuesto ejercido por año (dato que se pide por transparencia).
- Personal adscrito.

### F. Investigación y sanción

- Fiscalía o unidad especializada en delitos contra la libertad de expresión y defensores.
- Tipo penal específico o agravante en el código penal estatal.
- Protocolo de investigación con perspectiva de la labor de la víctima.

### G. Transparencia y evaluación

- Obligación de informe público periódico y si se cumple.
- Registro estadístico público de personas beneficiarias.
- Mecanismo de evaluación externa o participación de organismos internacionales.

## Cómo codificar

Cada pregunta se responde con "sí", "no", "parcial" o "sin dato", más una cita al artículo que lo sustenta. La hoja `entidades` de `plantillas/marco_legal.xlsx` tiene once columnas de desglose preparadas para esto; se pueden ampliar a las de esta lista antes de empezar, porque cambiar la lista después obliga a recodificar. Un renglón adicional "00 Federal" con la ley de 2012 sirve como patrón de comparación.

Fuentes para codificar: el texto vigente de cada instrumento (los enlaces están en el archivo), la Ley Modelo de Espacio OSC y ONU-DH (usada por ISHR para su comparación), el diagnóstico de ONU-DH sobre el Mecanismo (2019) y los informes de Espacio OSC sobre marcos estatales.

## Productos

1. Matriz federal-estatal (Excel y JSON) con las respuestas y las citas.
2. Puntaje de protección formal por entidad (0 a 10 o normalizado a 100) y mapa categórico ampliado, que sustituya o complemente las cinco categorías actuales.
3. Tabla comparativa de definiciones (periodista, persona defensora) con el texto literal de cada norma, útil también para el análisis jurídico de las definiciones.
4. Lista de brechas por entidad respecto al federal, que es lo que se puede presentar a congresos locales u organizaciones.

## Precauciones

Tener ley no equivale a tener protección; por eso el índice separa la dimensión formal de la efectiva. Varias leyes estatales copian la federal casi literalmente, así que la codificación debe distinguir lo que agregan o quitan respecto de ella, no solo lo que contienen. Y los instrumentos cambian: conviene registrar la fecha de consulta de cada texto y revisar los congresos una vez al año.
