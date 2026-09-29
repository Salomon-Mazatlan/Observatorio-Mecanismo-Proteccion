# Marco legal estatal de protección a periodistas y personas defensoras

## Qué hay en el archivo

`datos/marco_legal.json` describe, para cada una de las 32 entidades, qué instrumento jurídico de protección existe. La clasificación de partida es la de ISHR (Protección nacional en México, corte 12 de abril de 2024), que agrupa las entidades en cinco situaciones:

| Categoría | Entidades (2024) |
|---|---|
| Ley o mecanismo estatal propio | Aguascalientes, Baja California, Coahuila, Ciudad de México, Guanajuato, Guerrero, Hidalgo, Nayarit, Quintana Roo, San Luis Potosí, Sinaloa |
| Ley o política de coordinación con el Mecanismo federal | Durango, Estado de México, Jalisco, Michoacán, Morelos, Puebla, Tamaulipas, Tlaxcala |
| Protección solo para periodistas | Colima, Querétaro, Veracruz |
| Solo fiscalía o unidad especializada | Campeche, Chiapas, Chihuahua, Oaxaca, Sonora, Zacatecas |
| Sin instrumento específico | Baja California Sur, Nuevo León, Tabasco, Yucatán |

Cada entidad lleva una lista de instrumentos con nombre, tipo (ley, decreto, acuerdo, protocolo, unidad, reforma, iniciativa), año cuando la fuente lo documenta, URL del texto, órgano que lo opera y nota. Los años que no constan en la fuente quedan en `null` para no inventarlos.

Actualizaciones ya incorporadas después del corte de ISHR: la reforma de Sinaloa del 12 de junio de 2025 que crea la Vicefiscalía Especializada.

Pendientes de verificar en los congresos estatales: si Baja California y Zacatecas aprobaron las iniciativas de 2022, si Oaxaca y Chiapas expidieron ley después de 2024, y la situación real de operación en Michoacán (Espacio OSC señala en 2026 que el marco de 2018 no se ha implementado).

## Desglose por instrumento (campos reservados)

Cada entidad tiene un bloque `desglose` con estos campos, todos en `null` hasta que se decida qué indicadores medir:

- `define_periodista`: la norma define quién es periodista (sí/no) y con qué amplitud (solo medios, o cualquier persona que difunde información de interés público, como el estándar interamericano).
- `define_persona_defensora`: la norma define persona defensora e incluye colectivos y comunidades.
- `organo_operante`: nombre del órgano que aplica las medidas.
- `naturaleza_organo`: autónomo (Sinaloa), desconcentrado del Ejecutivo (Guerrero, Tlaxcala), comisión (Puebla, Veracruz) o solo coordinación con el Mecanismo federal.
- `reglamento_publicado`: la ley tiene reglamento vigente.
- `consejo_consultivo`: existe y está integrado.
- `fondo_o_presupuesto`: la norma crea fondo propio o asigna presupuesto identificable.
- `medidas_urgentes`: prevé medidas urgentes con plazo.
- `fiscalia_o_unidad_especializada`: existe fiscalía o unidad de investigación específica.
- `tipo_penal_especifico`: el código penal tipifica delitos contra periodistas o defensores, o agravantes.
- `informe_publico_anual`: la ley obliga a rendir informe público.

Con esos campos se pueden construir indicadores como un índice de completitud (número de elementos presentes sobre el total), la antigüedad de la ley, o cruces con los datos de agresiones y personas beneficiarias del Mecanismo por entidad. La lista es una propuesta; conviene definirla antes de llenar los campos, ya que cambiarla después obliga a recodificar las 32 entidades.

## Cómo se muestra en el mapa

En el mapa de México, el indicador "Marco legal estatal de protección" pinta cada entidad con el color de su categoría (mapa categórico, sin clases numéricas). Al hacer clic en una entidad, el panel de detalle muestra la categoría y los instrumentos con enlace al texto. El selector de círculos no aplica a este indicador.
