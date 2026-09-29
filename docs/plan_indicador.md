# Plan del indicador de situación de periodistas y personas defensoras

## Qué se quiere medir

El objetivo es un indicador (o un conjunto pequeño de indicadores) que permita ver, por entidad y en el tiempo, dos cosas que suelen confundirse. Una es la situación que viven periodistas y personas defensoras, es decir, cuánta violencia reciben y de quién. La otra es el alcance real de la protección que el Estado les ofrece, es decir, qué instrumentos existen, cuántas personas cubren y si esa cobertura se corresponde con el riesgo. Medir las dos por separado permite después cruzarlas, que es donde aparece lo interesante, por ejemplo entidades con mucha violencia y poca protección, o con protección formal (una ley) que no se traduce en personas atendidas.

## Estructura propuesta

Se propone un índice compuesto de tres dimensiones, cada una con subindicadores medibles con las fuentes que ya están en el sitio o que se pueden capturar con el protocolo de prensa. Cada subindicador se calcula por entidad y por año; los conteos se convierten en tasas por 100 mil habitantes con la población CONAPO del año correspondiente, ya cargada en el observatorio.

### Dimensión 1. Violencia (situación vivida)

| Subindicador | Grupo | Fuente | Cálculo |
|---|---|---|---|
| Periodistas asesinados | periodistas | ARTICLE 19, RSF, CPJ, registro propio | Conteo anual por entidad y tasa por millón de habitantes |
| Personas defensoras asesinadas | defensoras | CEMDA (ambientales), Comité Cerezo y Red TDT (todas), registro propio | Conteo anual y tasa |
| Desapariciones | ambos | ARTICLE 19 (periodistas), Red TDT, registro propio | Conteo anual |
| Agresiones documentadas | ambos | ARTICLE 19 (prensa), CEMDA (ambientales), Instituto de Sinaloa y homólogos estatales, registro propio de prensa | Conteo anual y tasa; se registra el tipo (amenaza, física, judicial, digital, desplazamiento) |
| Agresiones atribuidas a agentes del Estado | ambos | ARTICLE 19, CEMDA, registro propio | Porcentaje del total de agresiones |
| Desplazamiento por la labor | ambos | Registro propio, Instituto de Sinaloa (12 periodistas fuera del estado), Mecanismo (reubicaciones) | Conteo |

### Dimensión 2. Protección formal (lo que existe en papel)

Sale del archivo de marco legal y de su desglose, una vez codificado. Se propone un puntaje de 0 a 10 por entidad sumando elementos presentes, con la ley federal como referencia de comparación (ver `plan_comparativo_marco_legal.md`).

| Elemento | Puntos |
|---|---|
| Ley estatal específica (no solo acuerdo o protocolo) | 2 |
| Órgano operante con presupuesto identificable | 2 |
| Define persona defensora incluyendo colectivos y comunidades | 1 |
| Define periodista con criterio funcional (quien informa, no solo quien tiene credencial) | 1 |
| Medidas urgentes con plazo y medidas preventivas | 1 |
| Consejo consultivo con sociedad civil en funciones | 1 |
| Fiscalía o unidad especializada | 1 |
| Informe público periódico | 1 |

### Dimensión 3. Protección efectiva (lo que llega a las personas)

| Subindicador | Fuente | Cálculo |
|---|---|---|
| Personas beneficiarias del Mecanismo federal por entidad | Informes mensuales del Mecanismo | Conteo al corte y tasa por millón; serie histórica capturando un corte por año (diciembre) o por semestre |
| Personas atendidas por el organismo estatal | Institutos y mecanismos estatales, solicitudes de transparencia | Conteo anual |
| Solicitudes rechazadas por el Mecanismo | Espacio OSC, transparencia | Porcentaje |
| Personas asesinadas que tenían medidas de protección | Mecanismo, ARTICLE 19 | Conteo; es el indicador más duro de fallo de la protección |
| Sentencias por delitos contra periodistas y defensores | FEADLE, fiscalías estatales | Conteo y razón sentencias/casos |

### Cruces que dan sentido al índice

- Razón cobertura/riesgo. Beneficiarias del Mecanismo por entidad divididas entre agresiones documentadas en la misma entidad. Una razón baja señala entidades donde la violencia supera a la protección.
- Brecha formal/efectiva. Puntaje de protección formal frente a personas atendidas por 100 mil habitantes. Muestra leyes que no operan.
- Letalidad bajo protección. Asesinatos de personas con medidas entre el total de beneficiarias.
- Tendencia. Variación anual de agresiones y de beneficiarias por entidad, que es lo que permite decir si la situación mejora o empeora.

## Denominadores: cuántas personas periodistas hay

No existe un censo de periodistas. La aproximación oficial es la Encuesta Nacional de Ocupación y Empleo (ENOE) de INEGI, que clasifica a la población ocupada con el Sistema Nacional de Clasificación de Ocupaciones (SINCO); la ocupación 2711 "Periodistas y redactores" y el grupo 271 "Autores, periodistas y traductores" se publican por trimestre y por entidad en Data México (Secretaría de Economía), con unas 30 mil a 47 mil personas a nivel nacional según el nivel de agregación. Con eso se puede calcular una tasa de agresiones o asesinatos por cada mil periodistas ocupados por entidad, que dice más que la tasa por 100 mil habitantes. Dos precauciones: la muestra estatal de la ENOE es pequeña para una ocupación tan específica, así que las cifras de entidades chicas oscilan mucho entre trimestres (conviene promediar cuatro trimestres o usar la ocupación agregada), y la ENOE solo capta a quien declara el periodismo como ocupación, no a colaboradores ocasionales ni a comunicadores comunitarios. El Censo de Población 2020 permite la misma estimación con su cuestionario ampliado (microdatos con SINCO a cuatro dígitos), incluso a nivel municipal, aunque con el mismo problema de muestra. Para personas defensoras no hay ocupación en el SINCO; el proxy disponible es el Registro Federal de Organizaciones de la Sociedad Civil (Cluni), que permite contar organizaciones con objeto de derechos humanos por entidad.

## Cómo llevarlo al sitio

Cada subindicador es un archivo en `datos/indicadores/` con valores por entidad y periodo anual, capturado con la plantilla de Excel correspondiente. Los cruces y el índice se calculan en un indicador derivado (pendiente en el código; el cálculo de tasas ya tiene la población lista). La serie nacional del Mecanismo, ya cargada en la pestaña "Series nacionales", sirve de referencia para comparar cada entidad con el país.

## Orden de trabajo sugerido

1. Cerrar la lista de subindicadores y el puntaje de protección formal (este documento es la propuesta).
2. Capturar la serie histórica de beneficiarias por entidad a partir de los informes mensuales del Mecanismo, un corte por año (diciembre) de 2019 a 2025 más el corte más reciente. Son siete PDF.
3. Codificar el desglose del marco legal de las 32 entidades (ver el plan comparativo).
4. Completar las cifras estatales de ARTICLE 19 (gráfica 4 del informe 2025 y de los anteriores) y de CEMDA (gráfica 9), pidiéndolas a las organizaciones si no están en texto.
5. Arrancar el registro propio de prensa con el protocolo de `plan_busqueda_prensa.md`, empezando por Sinaloa y por 2024 en adelante.
6. Programar el indicador derivado con tasas y cruces.

## Precauciones

Las cifras de ARTICLE 19, CEMDA, RSF y CPJ no son comparables entre sí porque cada organización define de otro modo qué cuenta como agresión y qué vínculo con la labor exige; el índice debe usar una sola fuente por subindicador y decirlo. Los registros propios de prensa sufren el sesgo de cobertura (más notas donde hay más medios), que se compensa parcialmente con tasas y con la comparación contra fuentes oficiales. Y en entidades con autocensura, como señala ARTICLE 19 para Sinaloa, pocas agresiones documentadas no significan pocas agresiones.
