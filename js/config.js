// Central configuration; edit here before touching app.js
const CONFIG = {
  // Free key from https://carto.com/basemaps/apikey; leave empty to use OpenStreetMap tiles
  cartoKey: "",
  // Used in the citation of exported images; empty url means the page's own address
  sitio: { nombre: "Observatorio de Protección a Periodistas y Personas Defensoras", autor: "", url: "" },
  rutas: {
    eventos: "datos/eventos.json",
    indicadores: "datos/indicadores/indice.json",
    fuentes: "datos/fuentes.json",
    marcoLegal: "datos/marco_legal.json"
  },
  // Colors of the legal-framework categories, from strongest to weakest protection
  marcoLegalColores: {
    ley_propia: "#7f1d1d", vinculo_federal: "#b91c1c", solo_periodistas: "#e07a5f",
    solo_fiscalia: "#f2b8a6", sin_instrumento: "#e2e5e9"
  },
  // National map by state, or any state by municipality (one file per state, loaded on demand)
  mapas: {
    mexico: { nombre: "México", geo: "datos/geo/estados.geojson", nivel: "entidad" },
    estado: { geo: "datos/geo/municipios/{cve}.geojson", nivel: "municipio" }
  },
  estadoInicial: "25",
  // Municipal names show at any zoom for small states; large ones need zooming in (levels past the fitted view)
  maxEtiquetasSinZoom: 80,
  zoomEtiquetas: 2,
  // Only the journalists/defenders theme is shown; population stays loaded for calculations
  temas: {
    periodistas:    { nombre: "Periodistas y defensores",  color: "#b91c1c", activo: true },
    contexto:       { nombre: "Población y contexto",      color: "#1d4ed8", activo: false }
  },
  // Sub-topics (type of aggression) inside the journalists/defenders theme
  subtemas: {
    asesinato:      "Asesinatos",
    desaparicion:   "Desapariciones",
    agresion:       "Agresiones físicas",
    amenaza:        "Amenazas e intimidación",
    acoso_judicial: "Acoso judicial",
    ataque_medio:   "Ataques a medios y domicilios",
    proteccion:     "Medidas y cifras de protección",
    informe:        "Informes"
  },
  // Field of work of the defender (events of the defenders group)
  labores: {
    busqueda:     "Búsqueda de personas desaparecidas",
    ambiental:    "Ambiente, tierra y territorio",
    indigena:     "Pueblos indígenas",
    mujeres:      "Derechos de las mujeres y feministas",
    lgbt:         "Personas LGBT+",
    migracion:    "Personas migrantes",
    civil:        "Derechos civiles y comunitarios",
    animales:     "Derechos de los animales",
    organizacion: "Organizaciones de derechos humanos"
  },
  // Sex of the person affected, for the journalists/defenders theme
  sexos: { femenino: "Mujeres", masculino: "Hombres" },
  // Sub-groups inside the journalists/defenders theme; "ambos" applies to both
  grupos: {
    periodista: { nombre: "Periodistas",        color: "#b91c1c" },
    defensor:   { nombre: "Personas defensoras", color: "#c2410c" }
  },
  // Order matters: from strongest to weakest evidence
  verificacion: ["oficial", "organización", "campo", "prensa", "sin verificar"],
  tiposFuente: {
    oficial: "Fuente oficial",
    organizacion: "Organización civil",
    campo: "Trabajo de campo",
    prensa: "Prensa"
  },
  // Color ramps for thematic maps; "tema" uses the active theme color, others are light-to-dark stops
  gamas: {
    tema:    { nombre: "Color del tema", paradas: null },
    rojos:   { nombre: "Rojos",   paradas: ["#fff5f0", "#fcbba1", "#fb6a4a", "#cb181d", "#67000d"] },
    azules:  { nombre: "Azules",  paradas: ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"] },
    verdes:  { nombre: "Verdes",  paradas: ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"] },
    morados: { nombre: "Morados", paradas: ["#fcfbfd", "#dadaeb", "#9e9ac8", "#6a51a3", "#3f007d"] },
    calidos: { nombre: "Amarillo a rojo", paradas: ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"] },
    viridis: { nombre: "Viridis", paradas: ["#fde725", "#5ec962", "#21918c", "#3b528b", "#440154"] },
    grises:  { nombre: "Grises",  paradas: ["#f7f7f7", "#cccccc", "#969696", "#525252", "#000000"] }
  },
  // Classification methods for numeric choropleths
  metodos: {
    cuantiles: { nombre: "Cuantiles", descripcion: "cada clase agrupa aproximadamente la misma cantidad de unidades; resiste la asimetría de los datos" },
    iguales:   { nombre: "Intervalos iguales", descripcion: "el rango entre el mínimo y el máximo se divide en tramos del mismo ancho; fácil de leer, pero con datos asimétricos casi todo cae en la clase baja" },
    naturales: { nombre: "Cortes naturales (Jenks)", descripcion: "los cortes se colocan donde hay saltos en los datos, minimizando la varianza dentro de cada clase" },
    logaritmico: { nombre: "Intervalos logarítmicos", descripcion: "tramos de ancho creciente (cada corte multiplica al anterior); útil cuando los valores abarcan varios órdenes de magnitud" }
  },
  // Choropleth: default number of classes and the light end of each theme ramp
  clases: 5,
  clasesOpciones: [3, 4, 5, 6, 7],
  colorClaro: "#f4f4f1",
  colorSinDato: "#e2e5e9"
};
