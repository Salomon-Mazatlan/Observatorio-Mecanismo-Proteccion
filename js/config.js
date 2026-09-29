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
    solo_fiscalia: "#f2b8a6", sin_instrumento: "#fff4c7"
  },
  // National map by state, or any state by municipality (one file per state, loaded on demand)
  mapas: {
    mexico:   { nombre: "México", geo: "datos/geo/estados.geojson", nivel: "entidad", pais: "MX" },
    honduras: { nombre: "Honduras", geo: "datos/geo/hn/departamentos.geojson", nivel: "entidad", pais: "HN" },
    estado:   { geo: "datos/geo/municipios/{cve}.geojson", nivel: "municipio" },
    estadoHN: { geo: "datos/geo/hn/municipios/{cve}.geojson", nivel: "municipio" },
    colombia: { nombre: "Colombia", geo: "datos/geo/co/departamentos.geojson", nivel: "entidad", pais: "CO" },
    estadoCO: { geo: "datos/geo/co/municipios/{cve}.geojson", nivel: "municipio" }
  },
  // Countries: Honduran keys carry an "HN" prefix so they never collide with INEGI codes
  paises: {
    MX: { nombre: "México", nacional: "mexico", unidad: "estado", unidades: "Por estado", inicial: "25" },
    HN: { nombre: "Honduras", nacional: "honduras", unidad: "departamento", unidades: "Por departamento", inicial: "HN08",
          censos: "datos/poblacion/censos_hn.json", estadistica: "INE Honduras", tipoNorma: "ley", anioNorma: 2015,
          notaMarco: "Honduras no tiene leyes departamentales; la ley nacional y su Sistema Nacional de Protección rigen en todo el país." },
    CO: { nombre: "Colombia", nacional: "colombia", unidad: "departamento", unidades: "Por departamento", inicial: "CO05",
          censos: "datos/poblacion/censos_co.json", estadistica: "DANE", tipoNorma: "decreto", anioNorma: 2011,
          notaMarco: "Colombia no tiene una ley específica: el Programa de Prevención y Protección se rige por decreto (Decreto 4912 de 2011, compilado en el Decreto 1066 de 2015) y lo ejecuta la Unidad Nacional de Protección en todo el país." }
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
  // Gender of the person affected, for the journalists/defenders theme
  generos: { femenino: "Mujeres", masculino: "Hombres", lgbt: "Personas LGBT+" },
  generosColores: { femenino: "#db2777", masculino: "#2563eb", lgbt: "#8b5cf6", otro: "#94a3b8" },
  // Sub-groups inside the journalists/defenders theme; "ambos" applies to both
  grupos: {
    periodista: { nombre: "Periodistas",        color: "#b91c1c" },
    defensor:   { nombre: "Personas defensoras", color: "#8b5cf6" }   // lilac markers
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
