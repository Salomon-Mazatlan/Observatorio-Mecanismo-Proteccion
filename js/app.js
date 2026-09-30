(async function () {
  const estado = {
    eventos: [], indicadores: { definiciones: [], valores: [] }, fuentes: [], marcoLegal: null,
    poblacion: {},            // raw population files by path
    seriesNacionales: null,
    geos: {},                 // loaded polygon files by map id
    mapaId: "mexico",         // "mexico" | "honduras" | a state code ("25") | a department code ("HN08")
    pais: "MX",               // country on screen
    estadoCve: CONFIG.estadoInicial,
    eventosVisibles: true,    // "Eventos" switch
    forma: "coropleta",       // "coropleta" | "circulos"
    indicador: "",            // "" none, "_eventos" counts visible events per polygon, or an indicator id
    gama: "tema",
    metodo: "cuantiles",
    clases: CONFIG.clases,
    tema: "todos",            // one theme at a time, or "todos"
    grupo: "todos",           // "todos" | "periodista" | "defensor"
    subtema: "todos",         // "todos" or a key of CONFIG.subtemas
    genero: "todos",          // "todos" | "femenino" | "masculino" | "lgbt"
    labor: "todos",           // "todos" or a key of CONFIG.labores (defenders only)
    verifActivas: new Set(CONFIG.verificacion),
    texto: "", desde: null, hasta: null,  // "YYYY-MM" or null
    leyendaExport: []                     // legend items of the current thematic drawing
  };

  const pila = [];          // window navigation stack (see navegar)
  let clicEnCapa = false;
  let resumenPlegado = false;
  try { resumenPlegado = localStorage.getItem("observatorio_resumen_plegado") === "1"; } catch (e) { /* storage unavailable */ }   // set by layer clicks so the map click handler does not close the window
  const mapa = L.map("mapa", { zoomControl: false });
  L.control.zoom({ position: "bottomright" }).addTo(mapa);
  // CARTO tiles need a key since Aug 2026; fall back to plain OSM without one.
  // With a key there is also a no-labels style, used automatically under thematic maps.
  const capasBase = {};
  if (CONFIG.cartoKey) {
    const opts = { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>', subdomains: "abcd", maxZoom: 18, crossOrigin: true };
    capasBase.normal = L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CONFIG.cartoKey}`, opts);
    capasBase.sinRotulos = L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png?key=${CONFIG.cartoKey}`, opts);
  } else {
    capasBase.normal = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18, crossOrigin: true
    });
  }
  capasBase.normal.addTo(mapa);

  function actualizarMapaBase() {
    const mostrar = document.getElementById("mapa-base").checked;
    const tematico = estado.indicador !== "" && !!capasBase.sinRotulos;
    Object.values(capasBase).forEach(c => mapa.removeLayer(c));
    if (mostrar) (tematico ? capasBase.sinRotulos : capasBase.normal).addTo(mapa);
  }

  // Labels sit above fills and markers but never catch the mouse
  mapa.createPane("etiquetas").style.zIndex = 650;
  mapa.getPane("etiquetas").style.pointerEvents = "none";
  // Polygons live in their own pane so bringing one to the front never covers the markers
  mapa.createPane("poligonos").style.zIndex = 380;
  mapa.createPane("calor").style.zIndex = 390;
  const capaPoligonos = L.geoJSON(null, { style: estiloNeutro, onEachFeature: alPoligono, pane: "poligonos" }).addTo(mapa);
  let capaCalor = null;
  const capaBaseCalor = L.layerGroup().addTo(mapa);   // cold fill under the heat map
  const capaEtiquetas = L.layerGroup().addTo(mapa);
  const capaCirculos = L.layerGroup().addTo(mapa);
  const capaEventos = L.layerGroup().addTo(mapa);

  // Data files are fetched with a timestamp so the browser never serves a stale copy
  const fresco = r => fetch(`${r}?t=${Date.now()}`).then(x => x.json());
  const [eventos, indice, fuentes, marcoLegal] = await Promise.all(Object.values(CONFIG.rutas).map(fresco));
  estado.eventos = eventos;
  estado.indicadores = await cargarIndicadores(indice);
  estado.fuentes = fuentes;
  estado.marcoLegal = marcoLegal;
  incorporarMarcoLegal();

  estado.geos.mexico = await fresco(CONFIG.mapas.mexico.geo);
  construirBarra();
  construirTemas();
  construirVerificacion();
  construirIndicadores();
  construirFuentes();
  iniciarFiltros();
  await cambiarMapa("mexico");
  try {
    if (!localStorage.getItem("observatorio_guia_vista")) { navegar(mostrarGuia, true); localStorage.setItem("observatorio_guia_vista", "1"); }
  } catch (e) { /* storage unavailable */ }
  // Population files load after the first render; the detail window uses them when ready
  ["datos/poblacion/censos.json", "datos/poblacion/conapo.json", "datos/poblacion/censos_hn.json", "datos/poblacion/censos_co.json"].forEach(r =>
    fresco(r).then(d => { estado.poblacion[r] = d; }).catch(() => {}));
  fresco("datos/series_nacionales.json").then(d => { estado.seriesNacionales = d; }).catch(() => {});
  fresco("datos/comparativo_marco_legal.json").then(d => { estado.comparativo = d; }).catch(() => {});

  // Population files are loaded once and expanded into the shared values list on first use
  const externosCargados = new Set();
  async function cargarExterno(def) {
    const ex = def.externo;
    if (!ex || externosCargados.has(def.id)) return;
    externosCargados.add(def.id);
    if (!estado.poblacion[ex.archivo]) estado.poblacion[ex.archivo] = await fresco(ex.archivo);
    const d = estado.poblacion[ex.archivo];
    const col = d.columnas ? d.columnas.indexOf(ex.campo) : -1;
    const periodosE = d.periodos || d.periodos_entidad, periodosM = d.periodos || d.periodos_municipio;
    const valor = fila => (col >= 0 ? (fila ? fila[col] : null) : fila);
    Object.entries(d.entidades).forEach(([cve, filas]) => filas.forEach((f, i) => {
      const v = valor(f); if (v !== null && v !== undefined) estado.indicadores.valores.push({ indicador: def.id, cve_ent: cve, periodo: periodosE[i], valor: v, ejemplo: false });
    }));
    Object.entries(d.municipios).forEach(([cvegeo, filas]) => filas.forEach((f, i) => {
      const v = valor(f); if (v !== null && v !== undefined) estado.indicadores.valores.push({ indicador: def.id, cve_ent: cvegeo.slice(0, 2), cve_mun: cvegeo.slice(2), periodo: periodosM[i], valor: v, ejemplo: false });
    }));
  }

  // Population of a unit for a given year: CONAPO estimate if loaded, else the nearest census
  function poblacionDe(cve_ent, cve_mun, anio) {
    const con = estado.poblacion["datos/poblacion/conapo.json"], cen = estado.poblacion["datos/poblacion/censos.json"];
    const clave = cve_mun ? cve_ent + cve_mun : cve_ent;
    if (con) {
      const per = cve_mun ? con.periodos_municipio : con.periodos_entidad, filas = (cve_mun ? con.municipios : con.entidades)[clave];
      const i = per.indexOf(String(anio));
      if (filas && i >= 0) return { valor: filas[i], periodo: String(anio), fuente: "CONAPO" };
    }
    if (cen) {
      const filas = (cve_mun ? cen.municipios : cen.entidades)[clave];
      if (filas) {
        let mejor = -1;
        cen.periodos.forEach((p, i) => { if (filas[i] && (mejor < 0 || Math.abs(+p - anio) < Math.abs(+cen.periodos[mejor] - anio))) mejor = i; });
        if (mejor >= 0) return { valor: filas[mejor][0], periodo: cen.periodos[mejor], fuente: "Censo INEGI" };
      }
    }
    return null;
  }

  // ---------- countries ----------
  // Non-Mexican keys start with their two-letter country code (HN08, CO05)
  function paisDeCve(cve) { const p = String(cve || "").slice(0, 2); return CONFIG.paises[p] && p !== "MX" ? p : "MX"; }
  function nacionalId() { return CONFIG.paises[estado.pais].nacional; }
  function esNacional(id) { return Object.values(CONFIG.paises).some(p => p.nacional === id); }
  function geoNacional() { return estado.geos[nacionalId()]; }

  // Current map: a national map by state or department, or one of them by municipality
  function mapaActual() {
    if (esNacional(estado.mapaId)) return CONFIG.mapas[estado.mapaId];
    const pais = paisDeCve(estado.mapaId);
    const nat = estado.geos[CONFIG.paises[pais].nacional];
    const f = nat && nat.features.find(x => x.properties.cve_ent === estado.mapaId);
    const plantilla = (CONFIG.mapas["estado" + pais] || CONFIG.mapas.estado).geo;
    return { nombre: f ? f.properties.nombre : estado.mapaId, nivel: "municipio", geo: plantilla.replace("{cve}", estado.mapaId), pais };
  }

  // Each indicator lives in its own file listed in indice.json; merge them into one structure
  async function cargarIndicadores(indice) {
    const base = CONFIG.rutas.indicadores.replace(/[^/]+$/, "");
    const docs = await Promise.all(indice.archivos.map(f => fresco(base + f)));
    const definiciones = [], valores = [];
    docs.forEach(d => {
      definiciones.push(d.definicion);
      (d.valores || []).forEach(v => valores.push({ indicador: d.definicion.id, ...v }));
    });
    return { definiciones, valores };
  }

  // Adds the legal framework as a categorical indicator at state level
  function incorporarMarcoLegal() {
    const ml = estado.marcoLegal;
    if (!ml) return;
    estado.indicadores.definiciones.push({
      id: "per_marco_legal", tema: "periodistas", tipo: "categoria",
      nombre: "Marco legal estatal de protección", unidad: "categoría", fuente: ml.fuente_principal.id,
      categorias: ml.categorias, colores: CONFIG.marcoLegalColores,
      nota: `Clasificación de ISHR con corte ${ml.fecha_corte}, más actualizaciones puntuales. Clic en una entidad para ver sus instrumentos.`
    });
    ml.entidades.forEach(e => estado.indicadores.valores.push({
      indicador: "per_marco_legal", cve_ent: e.cve_ent, periodo: e.fecha_corte, valor: e.categoria, ejemplo: false
    }));
  }

  // Unitary states (Honduras, Colombia): every department is governed by the national norm
  function marcoDe(cve_ent) {
    const pais = paisDeCve(cve_ent);
    if (pais !== "MX") {
      const cfg = CONFIG.paises[pais];
      const inst = estado.comparativo && estado.comparativo.instrumentos.find(i => i.pais === pais);
      return { categoria: "norma_nacional", categoriaNombre: `${cfg.tipoNorma === "ley" ? "Ley" : "Decreto"} nacional (Estado unitario)`, color: "#1d4ed8",
        instrumentos: inst ? [{ nombre: inst.nombre, tipo: cfg.tipoNorma, anio: cfg.anioNorma, url: inst.url, organo: inst.organo, nota: inst.publicacion }] : [],
        nota: cfg.notaMarco };
    }
    return estado.marcoLegal ? estado.marcoLegal.entidades.find(e => e.cve_ent === cve_ent) : null;
  }

  // ---------- top bar ----------

  function construirBarra() {
    document.querySelectorAll("#sel-pais button").forEach(b => b.addEventListener("click", () => cambiarPais(b.dataset.pais)));
    document.querySelectorAll("#sel-mapa button").forEach(b =>
      b.addEventListener("click", () => cambiarMapa(b.dataset.mapa === "nacional" ? nacionalId() : estado.estadoCve)));
    const selEstado = document.getElementById("sel-estado");
    llenarSelectorEstado();
    selEstado.addEventListener("change", () => { estado.estadoCve = selEstado.value; cambiarMapa(selEstado.value); });
    document.querySelectorAll("#sel-forma button").forEach(b =>
      b.addEventListener("click", () => { estado.forma = b.dataset.forma; marcar("#sel-forma", "forma", estado.forma); dibujar(); }));
    document.getElementById("mostrar-eventos").addEventListener("change", e => { estado.eventosVisibles = e.target.checked; dibujar(); });
    const gama = document.getElementById("gama");
    Object.entries(CONFIG.gamas).forEach(([id, g]) => {
      const o = document.createElement("option"); o.value = id; o.textContent = g.nombre; gama.appendChild(o);
    });
    gama.addEventListener("change", () => { estado.gama = gama.value; dibujar(); });
    const metodo = document.getElementById("metodo");
    Object.entries(CONFIG.metodos).forEach(([id, m]) => {
      const o = document.createElement("option"); o.value = id; o.textContent = m.nombre; metodo.appendChild(o);
    });
    metodo.addEventListener("change", () => { estado.metodo = metodo.value; dibujar(); });
    const clases = document.getElementById("clases");
    CONFIG.clasesOpciones.forEach(n => {
      const o = document.createElement("option"); o.value = n; o.textContent = n; clases.appendChild(o);
    });
    clases.value = String(estado.clases);
    clases.addEventListener("change", () => { estado.clases = +clases.value; dibujar(); });
    document.getElementById("nombres").addEventListener("change", dibujar);
    document.getElementById("calor").addEventListener("change", dibujar);
    const btnEstilo = document.getElementById("abrir-estilo"), panelEstilo = document.getElementById("panel-estilo");
    btnEstilo.addEventListener("click", () => {
      const abierto = !panelEstilo.hidden;
      panelEstilo.hidden = abierto; btnEstilo.setAttribute("aria-expanded", String(!abierto));
    });
    document.addEventListener("click", e => {
      if (!panelEstilo.hidden && !panelEstilo.contains(e.target) && e.target !== btnEstilo) { panelEstilo.hidden = true; btnEstilo.setAttribute("aria-expanded", "false"); }
    });
    document.getElementById("ayuda").addEventListener("click", () => navegar(mostrarGuia, true));
    document.getElementById("restablecer").addEventListener("click", restablecerFiltros);
    document.getElementById("volver-mexico").addEventListener("click", () => cambiarMapa(nacionalId()));
    document.getElementById("centrar").addEventListener("click", centrarMapa);
    document.getElementById("resumen").addEventListener("click", alternarResumen);
    mapa.on("click", () => { if (clicEnCapa) { clicEnCapa = false; return; } cerrarVentana(); });
    mapa.on("zoomend", () => { dibujarEtiquetas(); if (hayEventosDibujados()) { capaEventos.clearLayers(); dibujarEventos(); } });
    document.getElementById("mapa-base").addEventListener("change", actualizarMapaBase);
    document.getElementById("graficas").addEventListener("click", () => navegar(() => Graficas.abrir(contextoGraficas()), true));
    document.getElementById("ventana-cerrar").addEventListener("click", cerrarVentana);
    document.getElementById("ventana-volver").addEventListener("click", volverVentana);
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarVentana(); });
    document.getElementById("abrir-comparativo").addEventListener("click", () => navegar(() => mostrarComparativo(), true));
    document.querySelectorAll("button.enlace[data-doc]").forEach(b =>
      b.addEventListener("click", () => navegar(() => mostrarDocumento(b.dataset.doc, b.dataset.titulo), true)));
    const desde = document.getElementById("desde"), hasta = document.getElementById("hasta");
    [desde, hasta].forEach(i => i.addEventListener("change", () => {
      estado.desde = mesValido(desde.value) ? desde.value : null;
      estado.hasta = mesValido(hasta.value) ? hasta.value : null;
      // An inverted range would hide everything; move the other end instead
      if (estado.desde && estado.hasta && estado.desde > estado.hasta) {
        if (i === desde) { estado.hasta = estado.desde; hasta.value = estado.desde; }
        else { estado.desde = estado.hasta; desde.value = estado.hasta; }
      }
      dibujar();
    }));
    document.getElementById("periodo-todo").addEventListener("click", () => {
      desde.value = ""; hasta.value = ""; estado.desde = estado.hasta = null; dibujar();
    });
    document.getElementById("exportar").addEventListener("click", exportarPNG);
  }

  async function exportarPNG() {
    const btn = document.getElementById("exportar");
    btn.disabled = true; btn.textContent = "Generando...";
    try {
      const blob = await Exportar.png(mapa, [capaBaseCalor, capaPoligonos, capaCirculos, capaEventos, capaEtiquetas], infoExportacion());
      Exportar.descargar(blob, `observatorio_${estado.mapaId}_${estado.indicador || "eventos"}_${new Date().toISOString().slice(0, 10)}.png`);
    } catch (e) {
      alert("No se pudo exportar la imagen. Si el mapa base no permite copiar sus mosaicos, prueba con otro proveedor de mapa base.\n" + e.message);
    } finally {
      btn.disabled = false; btn.textContent = "Exportar PNG";
    }
  }

  // Title, subtitle, legend and credits for the exported image
  function infoExportacion() {
    const m = mapaActual();
    const tematico = estado.indicador !== "";
    const def = !tematico ? null : estado.indicador === "_eventos"
      ? { nombre: "Eventos registrados", unidad: "eventos", fuente: null }
      : estado.indicadores.definiciones.find(d => d.id === estado.indicador);
    const titulo = tematico ? def.nombre : "Eventos registrados";
    const nivel = m.nivel === "municipio" ? "por municipio" : "por entidad";
    const subtitulo = `${m.nombre}, ${tematico ? nivel : "eventos georreferenciados"}${tematico && hayEventosDibujados() ? " y eventos" : ""}. Periodo ${textoPeriodo()}.`;
    let leyenda, leyendaTitulo;
    const recorte = recorteExportacion();
    if (tematico && !hayEventosDibujados()) {
      leyenda = estado.leyendaExport; leyendaTitulo = def.unidad || "";
    } else {
      leyendaTitulo = tematico ? `${def.unidad || ""} y eventos` : "Eventos";
      leyenda = [...(tematico ? estado.leyendaExport : [])];
      const vis = estado.eventos.filter(eventoVisible);
      if (vis.some(e => e.tema === "periodistas" && e.grupo !== "defensor")) leyenda.push({ forma: "circulo", color: CONFIG.temas.periodistas.color, texto: "Periodistas" });
      if (vis.some(e => e.grupo === "defensor")) leyenda.push({ forma: "circulo", color: CONFIG.grupos.defensor.color, texto: "Personas defensoras" });
      Object.entries(CONFIG.temas).filter(([id]) => id !== "periodistas" && temaActivo(id) && vis.some(e => e.tema === id))
        .forEach(([, t]) => leyenda.push({ forma: "circulo", color: t.color, texto: t.nombre }));
      if (estado.eventos.some(e => e.ejemplo && eventoVisible(e)))
        leyenda.push({ forma: "circulo", color: "#ffffff", borde: "#5b6673", punteado: true, texto: "Registro de ejemplo" });
    }
    // Every source behind what is drawn: indicator source plus the sources of visible events
    const fuentesIds = new Set();
    if (def && def.fuente) fuentesIds.add(def.fuente);
    const hayEventos = hayEventosDibujados() || estado.indicador === "_eventos";
    if (hayEventos) estado.eventos.filter(eventoVisible).forEach(e => fuentesIds.add(e.fuente));
    const fuentesTxt = [...fuentesIds].map(id => {
      const f = estado.fuentes.find(x => x.id === id);
      return f ? f.nombre + (f.url ? ` (${f.url})` : "") : id;
    });
    const hoy = new Date();
    const fechaLarga = hoy.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
    const urlSitio = CONFIG.sitio.url || (location.origin + location.pathname);
    // The author heads the citation; the observatory is the publishing venue
    const autor = CONFIG.sitio.autor || CONFIG.sitio.nombre;
    const sede = CONFIG.sitio.autor ? ` En ${CONFIG.sitio.nombre}.` : "";
    const limites = CONFIG.paises[estado.pais].limites || "Marco Geoestadístico INEGI 2022";
    const pie = [
      fuentesTxt.length ? "Fuentes: " + fuentesTxt.join("; ") + "." : "Fuentes: sin registros en la vista actual.",
      `Límites: ${limites}. Mapa base: © OpenStreetMap contributors${CONFIG.cartoKey ? ", © CARTO" : ""}. Los datos marcados como ejemplo no describen hechos reales.`,
      "",
      `Cómo citar: ${autor} (${hoy.getFullYear()}). ${titulo}, ${m.nombre} [Mapa].${sede} Generado el ${fechaLarga} en ${urlSitio}`
    ];
    leyendaTitulo = leyendaTitulo.charAt(0).toUpperCase() + leyendaTitulo.slice(1);
    if (estado.grupo !== "todos" && temaActivo("periodistas")) leyendaTitulo += ` (${CONFIG.grupos[estado.grupo].nombre})`;
    if (estado.subtema !== "todos" && temaActivo("periodistas")) leyendaTitulo += ` · ${CONFIG.subtemas[estado.subtema]}`;
    if (estado.genero !== "todos" && temaActivo("periodistas")) leyendaTitulo += ` · ${CONFIG.generos[estado.genero]}`;
    if (estado.labor !== "todos" && temaActivo("periodistas")) leyendaTitulo += ` · ${CONFIG.labores[estado.labor]}`;
    return { titulo, subtitulo, leyenda, leyendaTitulo, pie, recorte };
  }

  function mesValido(v) { return /^\d{4}-\d{2}$/.test(v); }

  // Short usage guide; shown once on first visit and from the ? button
  function mostrarGuia() {
    abrirVentana("Cómo usar el mapa", `
      <div class="guia">
        <ol>
          <li><strong>Elige qué ver.</strong> Con el selector "Indicador" el mapa se colorea por entidad o municipio; con "Ninguno" solo se ven los eventos. Los interruptores "Eventos", "Heatmap" (mapa de calor con la densidad de eventos), "Nombres" y "Mapa base" encienden o apagan cada capa, y "Colores y clases" cambia la forma (colores o círculos), la gama y el cálculo de clases.</li>
          <li><strong>Filtra.</strong> En el panel izquierdo eliges grupo (periodistas o personas defensoras), tipo de agresión, labor y género; "Más filtros" guarda la búsqueda por texto y el nivel de verificación. "Restablecer filtros" vuelve al inicio.</li>
          <li><strong>Acota el periodo.</strong> Los dos campos de mes filtran eventos e indicadores; "Todo" vuelve a mostrar todo lo disponible.</li>
          <li><strong>Elige el país.</strong> El selector "País" cambia entre México (por estado), Honduras y Colombia (por departamento). En Honduras y Colombia la norma es nacional, así que el marco legal de cada departamento lleva al comparativo de esa norma con la ley federal mexicana.</li>
          <li><strong>Haz clic en el mapa.</strong> Una entidad, un municipio o un marcador abre una ventana con su detalle: indicadores, población, la lista de eventos (cada uno se despliega con el signo +), los indicadores y la población en una pestaña, y el marco legal con el comparativo de su ley con la federal en otra. La flecha "←" regresa a la vista anterior y un clic en el mapa cierra la ventana. Desde la ventana de una entidad puedes bajar a sus municipios y volver con "← México".</li>
          <li><strong>Lleva contigo lo que veas.</strong> "Exportar PNG" descarga la vista con leyenda y créditos; "Gráficas y datos" abre la línea de tiempo, las gráficas del indicador, las series nacionales y la descarga en CSV o JSON.</li>
        </ol>
        <p class="nota">Puedes volver a esta guía con el botón "?" de la barra superior.</p>
      </div>`);
  }

  function restablecerFiltros() {
    document.getElementById("buscar").value = ""; estado.texto = "";
    document.querySelectorAll("#verif input").forEach(i => { i.checked = true; estado.verifActivas.add(i.value); });
    document.getElementById("desde").value = ""; document.getElementById("hasta").value = ""; estado.desde = estado.hasta = null;
    estado.grupo = "todos"; estado.subtema = "todos"; estado.genero = "todos"; estado.labor = "todos"; pintarGrupos(); construirLabores(); construirSubtemas(); pintarGeneros();
    construirIndicadores(); dibujar();
  }

  // ---------- floating panel over the map ----------

  // Views opened from inside the window stack up, so the back arrow returns to the previous one
  function navegar(render, raiz) {
    if (raiz) pila.length = 0;
    pila.push(render);
    render();
    document.getElementById("ventana-volver").hidden = pila.length < 2;
  }
  function volverVentana() {
    if (pila.length < 2) return;
    pila.pop();
    pila[pila.length - 1]();
    document.getElementById("ventana-volver").hidden = pila.length < 2;
  }
  function abrirVentana(titulo, html, clase) {
    const v = document.getElementById("ventana");
    v.className = "ventana" + (clase ? " " + clase : "");
    document.getElementById("ventana-titulo").textContent = titulo;
    document.getElementById("ventana-cuerpo").innerHTML = html;
    v.hidden = false;
    document.getElementById("ventana-cuerpo").scrollTop = 0;
  }
  function cerrarVentana() { document.getElementById("ventana").hidden = true; pila.length = 0; if (window.Graficas) Graficas.destruir(); }

  // Renders a Markdown file from the repository inside the panel (marked is loaded on demand)
  async function mostrarDocumento(ruta, titulo) {
    abrirVentana(titulo, "<p class='nota'>Cargando...</p>", "ventana--documento");
    try {
      if (!window.marked) await cargarScript("https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js");
      const md = await fetch(`${ruta}?t=${Date.now()}`).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
      document.getElementById("ventana-cuerpo").innerHTML = `<div class="markdown">${marked.parse(md)}</div>`;
      document.querySelectorAll("#ventana-cuerpo a[href^='http']").forEach(l => { l.target = "_blank"; l.rel = "noopener"; });
    } catch (e) {
      document.getElementById("ventana-cuerpo").innerHTML = `<p class="nota">No se pudo cargar ${ruta} (${e.message}).</p>`;
    }
  }
  // ---------- legal comparison matrix ----------

  // ids: optional list of instrument ids; default shows every coded instrument
  async function mostrarComparativo(ids) {
    const global = !ids;
    if (!estado.comparativo) estado.comparativo = await fresco("datos/comparativo_marco_legal.json");
    const todos = estado.comparativo;
    const instrumentos = global ? todos.instrumentos : todos.instrumentos.filter(i => ids.includes(i.id));
    const cmp = { ...todos, instrumentos };  // instrumentos may be narrowed by the picker below
    // In the global view the person picks which state instruments to compare with the federal law
    if (global && estado.comparativoSel) {
      const sel = todos.instrumentos.filter(i => i.id === "federal" || estado.comparativoSel.includes(i.id));
      if (sel.length) { cmp.instrumentos = sel; }
    }
    const otros = instrumentos.filter(i => i.id !== "federal").map(i => i.corto).join(", ");
    const titulo = global ? "Comparativo de instrumentos de protección"
      : instrumentos.some(i => i.pais && i.pais !== "MX") ? `Comparativo con la ley federal mexicana: ${otros}` : `Comparativo con la ley federal: ${otros}`;
    abrirVentana(titulo, "<p class='nota'>Cargando...</p>", "ventana--documento ventana--ancha");
    const cabecera = cmp.instrumentos.map(i => `<th title="${i.nombre}">${i.corto}</th>`).join("");
    const celda = (inst, id) => {
      const c = (cmp.codificacion[inst.id] || {})[id];
      if (!c) return "<td></td>";
      const tip = [c.articulos, c.nota].filter(Boolean).join(". ");
      return `<td class="cmp cmp--${c.valor}" title="${tip.replace(/"/g, "&quot;")}"><span class="cmp__valor">${cmp.valores[c.valor]}</span><span class="cmp__art">${c.articulos || ""}</span></td>`;
    };
    const filas = cmp.indicadores.map(ind => {
      const principal = `<tr class="cmp__fila"><td class="cmp__nombre"><strong>${ind.numero}.</strong> ${ind.nombre}${ind.subindicadores.length ? ` <button type="button" class="cmp__mas" data-ind="${ind.id}" aria-expanded="false" title="Ver subindicadores">+</button>` : ""}<br><button type="button" class="enlace cmp__pasajes" data-ind="${ind.id}">Ver detalles</button></td>${cmp.instrumentos.map(i => celda(i, ind.id)).join("")}</tr>`;
      const subs = ind.subindicadores.map(s => `<tr class="cmp__sub" data-de="${ind.id}" hidden><td class="cmp__nombre cmp__nombre--sub">${s.nombre}</td>${cmp.instrumentos.map(i => celda(i, s.id)).join("")}</tr>`).join("");
      return principal + subs;
    }).join("");
    const fichas = cmp.instrumentos.map(i => `<li><strong>${i.corto}.</strong> ${i.nombre}. ${i.publicacion}; última reforma ${i.ultima_reforma}. ${i.organo}.${i.url ? ` <a href="${i.url}" target="_blank" rel="noopener">Texto</a>` : ""}</li>`).join("");
    const selector = global ? `<div class="cmp__selector"><span class="grupo__etiqueta">Comparar con la ley federal:</span>${todos.instrumentos.filter(i => i.id !== "federal").map(i => `<label class="grupo__casilla"><input type="checkbox" data-inst="${i.id}" ${cmp.instrumentos.some(x => x.id === i.id) ? "checked" : ""}> ${i.corto}</label>`).join("")}</div>` : "";
    document.getElementById("ventana-cuerpo").innerHTML = selector + `
      <p class="nota">${cmp.descripcion} Codificación del ${cmp.fecha_codificacion}. Pase el cursor sobre una celda para ver la nota; el signo + despliega los subindicadores y "Ver detalles" abre los artículos citados y la reflexión.</p>
      <div class="cmp__tabla-envoltura"><table class="cmp__tabla">
        <thead><tr><th>Indicador</th>${cabecera}</tr></thead>
        <tbody>${filas}</tbody>
      </table></div>
      <h3 class="detalle__sub">Instrumentos comparados</h3><ul class="lista lista--marco">${fichas}</ul>
      <p class="acciones"><button type="button" class="boton" id="cmp-csv">Descargar matriz (CSV)</button> <button type="button" class="boton" id="cmp-defs">Ver análisis de definiciones</button>${global ? "" : ` <button type="button" class="boton" id="cmp-global">Ver comparativo global</button>`}</p>`;
    if (!global) document.getElementById("cmp-global").addEventListener("click", () => navegar(() => mostrarComparativo()));
    document.querySelectorAll(".cmp__selector input").forEach(ch => ch.addEventListener("change", () => {
      estado.comparativoSel = [...document.querySelectorAll(".cmp__selector input:checked")].map(x => x.dataset.inst);
      mostrarComparativo();
    }));
    document.querySelectorAll(".cmp__mas").forEach(b => b.addEventListener("click", () => {
      const abierto = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!abierto)); b.textContent = abierto ? "+" : "–";
      document.querySelectorAll(`.cmp__sub[data-de="${b.dataset.ind}"]`).forEach(r => r.hidden = abierto);
    }));
    document.getElementById("cmp-defs").addEventListener("click", () => navegar(() => mostrarDocumento("docs/comparativo_definiciones.md", "Definiciones de periodista y persona defensora")));
    const visibles = cmp.instrumentos.map(i => i.id);  // what the picker left in the matrix
    document.querySelectorAll(".cmp__pasajes").forEach(b => b.addEventListener("click", () => navegar(() => mostrarPasajes(b.dataset.ind, visibles))));
    agregarBarraSuperior(document.querySelector("#ventana-cuerpo .cmp__tabla-envoltura"));
    document.getElementById("cmp-csv").addEventListener("click", () => {
      const filas = [["indicador", "subindicador", ...cmp.instrumentos.flatMap(i => [`${i.corto} valor`, `${i.corto} artículos`, `${i.corto} nota`])]];
      cmp.indicadores.forEach(ind => {
        const fila = id => cmp.instrumentos.flatMap(i => { const c = (cmp.codificacion[i.id] || {})[id] || {}; return [cmp.valores[c.valor] || "", c.articulos || "", c.nota || ""]; });
        filas.push([`${ind.numero}. ${ind.nombre}`, "", ...fila(ind.id)]);
        ind.subindicadores.forEach(s => filas.push([`${ind.numero}. ${ind.nombre}`, s.nombre, ...fila(s.id)]));
      });
      const esc = v => /[",\n\r]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
      const csv = "\ufeff" + filas.map(f => f.map(esc).join(",")).join("\r\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `comparativo_marco_legal_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  // A second horizontal scrollbar above a wide table, kept in sync with the one below
  function agregarBarraSuperior(envoltura) {
    if (!envoltura) return;
    const barra = document.createElement("div");
    barra.className = "cmp__barra-arriba";
    const relleno = document.createElement("div");
    barra.appendChild(relleno);
    envoltura.parentNode.insertBefore(barra, envoltura);
    const ajustar = () => {
      relleno.style.width = envoltura.scrollWidth + "px";
      barra.hidden = envoltura.scrollWidth <= envoltura.clientWidth + 1;
    };
    let sincronizando = false;
    barra.addEventListener("scroll", () => { if (sincronizando) return; sincronizando = true; envoltura.scrollLeft = barra.scrollLeft; sincronizando = false; });
    envoltura.addEventListener("scroll", () => { if (sincronizando) return; sincronizando = true; barra.scrollLeft = envoltura.scrollLeft; sincronizando = false; });
    ajustar();
    new ResizeObserver(ajustar).observe(envoltura);
  }

  // Passages quoted from each instrument for one indicator, plus the comparative reflection
  function mostrarPasajes(indId, ids) {
    const todos = estado.comparativo;
    const instrumentos = ids ? todos.instrumentos.filter(i => ids.includes(i.id)) : todos.instrumentos;
    const ind = todos.indicadores.find(i => i.id === indId);
    const cols = instrumentos.map(inst => {
      const c = (todos.codificacion[inst.id] || {})[indId] || {};
      const pas = ((todos.pasajes || {})[inst.id] || {})[indId] || [];
      const citas = pas.map(p => `<p class="pasaje__art">${p.articulo}</p><blockquote class="pasaje">${p.texto}</blockquote>`).join("") || "<p class='nota'>Sin pasaje registrado.</p>";
      return `<section class="pasajes__col">
        <h4 class="detalle__sub">${inst.corto} <span class="cmp cmp--${c.valor || "no"} pasajes__valor">${todos.valores[c.valor] || "Sin codificar"}</span></h4>
        <p class="nota">${inst.nombre}. ${c.articulos ? "Ubicación: " + c.articulos + "." : ""}</p>
        ${c.nota ? `<p class="pasajes__nota">${c.nota}</p>` : ""}
        ${citas}
      </section>`;
    }).join("");
    const subs = ind.subindicadores.length ? `<h4 class="detalle__sub">Subindicadores</h4><div class="cmp__tabla-envoltura"><table class="cmp__tabla"><thead><tr><th>Subindicador</th>${instrumentos.map(i => `<th>${i.corto}</th>`).join("")}</tr></thead><tbody>${ind.subindicadores.map(s => `<tr><td class="cmp__nombre--sub">${s.nombre}</td>${instrumentos.map(i => { const c = (todos.codificacion[i.id] || {})[s.id]; return c ? `<td class="cmp cmp--${c.valor}" title="${(c.nota || "").replace(/"/g, "&quot;")}"><span class="cmp__valor">${todos.valores[c.valor]}</span><span class="cmp__art">${c.articulos || ""}</span></td>` : "<td></td>"; }).join("")}</tr>`).join("")}</tbody></table></div>` : "";
    abrirVentana(`${ind.numero}. ${ind.nombre}`, `
      <h4 class="detalle__sub">Reflexión comparativa</h4>
      <p class="pasajes__reflexion">${(todos.reflexiones || {})[indId] || "Pendiente."}</p>
      <div class="pasajes__cols">${cols}</div>
      ${subs}
      <p class="nota">Los pasajes reproducen el texto vigente de los artículos citados; los muy extensos se cortan y se indica con [...].</p>`, "ventana--documento ventana--ancha");
  }

  function cargarScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("script")); document.head.appendChild(s);
    });
  }

  function marcar(sel, attr, valor) {
    document.querySelectorAll(`${sel} button`).forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset[attr] === valor)));
  }

  // State or department options of the current country
  function llenarSelectorEstado() {
    const sel = document.getElementById("sel-estado");
    sel.innerHTML = "";
    geoNacional().features.forEach(f => {
      const o = document.createElement("option");
      o.value = f.properties.cve_ent; o.textContent = f.properties.nombre; sel.appendChild(o);
    });
    sel.value = estado.estadoCve;
    sel.setAttribute("aria-label", CONFIG.paises[estado.pais].unidad);
    document.getElementById("btn-unidades").textContent = CONFIG.paises[estado.pais].unidades;
  }

  async function cambiarPais(p) {
    if (p === estado.pais) return;
    estado.pais = p;
    marcar("#sel-pais", "pais", p);
    const nat = nacionalId();
    if (!estado.geos[nat]) estado.geos[nat] = await fresco(CONFIG.mapas[nat].geo);
    estado.estadoCve = CONFIG.paises[p].inicial;
    llenarSelectorEstado();
    construirLabores(); construirSubtemas();
    await cambiarMapa(nat);
  }

  async function cambiarMapa(id) {
    estado.mapaId = id;
    if (!esNacional(id)) estado.estadoCve = id;
    marcar("#sel-mapa", "mapa", esNacional(id) ? "nacional" : "estado");
    document.getElementById("sel-estado").disabled = esNacional(id);
    const m = mapaActual();
    document.getElementById("cargando").hidden = false;
    try {
      if (!estado.geos[id]) estado.geos[id] = await fresco(m.geo);
    } finally {
      document.getElementById("cargando").hidden = true;
    }
    document.getElementById("volver-mexico").hidden = esNacional(id);
    document.getElementById("volver-mexico").textContent = `← ${CONFIG.paises[estado.pais].nombre}`;
    document.getElementById("sel-estado").value = estado.estadoCve;
    capaPoligonos.clearLayers();
    capaPoligonos.addData(estado.geos[id]);
    mapa.fitBounds(capaPoligonos.getBounds(), { padding: [10, 10] });
    estado.zoomBase = mapa.getZoom();
    cerrarVentana();
    construirIndicadores();
    // Thematic view never stays empty after a map change
    construirSubtemas();
    dibujar();
  }

  // ---------- sidebar builders ----------

  // One theme at a time (or all); clicking the active one returns to "todos"
  function construirTemas() {
    const cont = document.getElementById("temas");
    const activos = Object.entries(CONFIG.temas).filter(([, t]) => t.activo !== false);
    // With a single active theme the chooser is pointless: hide it and select that theme
    if (activos.length === 1) { estado.tema = activos[0][0]; document.getElementById("bloque-temas").hidden = true; }
    const opciones = [["todos", { nombre: "Todos", color: "#5b6673" }], ...activos];
    opciones.forEach(([id, t]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tema"; b.dataset.tema = id;
      b.style.setProperty("--tema", t.color);
      b.innerHTML = `<span class="tema__punto"></span>${t.nombre}`;
      b.addEventListener("click", () => { estado.tema = (estado.tema === id && id !== "todos") ? "todos" : id; pintarTemas(); pintarGrupos(); construirSubtemas(); construirIndicadores(); construirFuentes(); cerrarVentana(); dibujar(); });
      cont.appendChild(b);
    });
    pintarTemas();
    const cg = document.getElementById("grupos");
    [["todos", { nombre: "Ambos", color: "#5b6673" }], ...Object.entries(CONFIG.grupos)].forEach(([id, g]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tema"; b.dataset.grupo = id;
      b.style.setProperty("--tema", g.color);
      b.innerHTML = `<span class="tema__punto"></span>${g.nombre}`;
      b.addEventListener("click", () => { estado.grupo = id; pintarGrupos(); construirLabores(); construirSubtemas(); construirIndicadores(); cerrarVentana(); dibujar(); });
      cg.appendChild(b);
    });
    pintarGrupos();
    construirLabores();
    construirSubtemas();
    const cs = document.getElementById("generos");
    [["todos", "Todos"], ...Object.entries(CONFIG.generos)].forEach(([id, nombre]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tema"; b.dataset.genero = id;
      b.style.setProperty("--tema", "#0f172a");
      b.innerHTML = `<span class="tema__punto"></span>${nombre}`;
      b.addEventListener("click", () => { estado.genero = id; pintarGeneros(); cerrarVentana(); dibujar(); });
      cs.appendChild(b);
    });
    pintarGeneros();
  }
  function pintarGeneros() {
    document.querySelectorAll("#generos .tema").forEach(b => {
      const on = b.dataset.genero === estado.genero;
      b.classList.toggle("tema--activo", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.getElementById("bloque-generos").hidden = !temaActivo("periodistas");
  }
  // Field-of-work chips, only for the defenders group and only for fields with events
  function construirLabores() {
    const cont = document.getElementById("labores");
    cont.innerHTML = "";
    const bloque = document.getElementById("bloque-labores");
    if (!temaActivo("periodistas") || estado.grupo === "periodista") { bloque.hidden = true; estado.labor = "todos"; return; }
    const presentes = new Set(estado.eventos.filter(e => e.tema === "periodistas" && e.grupo === "defensor" && (e.pais || "MX") === estado.pais).map(e => e.labor).filter(Boolean));
    if (!presentes.has(estado.labor)) estado.labor = "todos";
    bloque.hidden = presentes.size === 0;
    [["todos", "Todas"], ...Object.entries(CONFIG.labores).filter(([k]) => presentes.has(k))].forEach(([id, nombre]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tema"; b.dataset.labor = id;
      b.style.setProperty("--tema", "#c2410c");
      b.innerHTML = `<span class="tema__punto"></span>${nombre}`;
      b.addEventListener("click", () => { estado.labor = id; pintarLabores(); construirSubtemas(); cerrarVentana(); dibujar(); });
      cont.appendChild(b);
    });
    pintarLabores();
  }
  function pintarLabores() {
    document.querySelectorAll("#labores .tema").forEach(b => {
      const on = b.dataset.labor === estado.labor;
      b.classList.toggle("tema--activo", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  // Chips only for sub-topics that have events under the current theme and group
  function construirSubtemas() {
    const cont = document.getElementById("subtemas");
    cont.innerHTML = "";
    const presentes = new Set(estado.eventos.filter(e => (e.pais || "MX") === estado.pais && temaActivo(e.tema) && (e.tema !== "periodistas" || (grupoActivo(e.grupo) && laborActiva(e)))).map(e => e.subtema).filter(Boolean));
    if (!presentes.has(estado.subtema)) estado.subtema = "todos";
    [["todos", "Todos"], ...Object.entries(CONFIG.subtemas).filter(([k]) => presentes.has(k))].forEach(([id, nombre]) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tema"; b.dataset.subtema = id;
      b.style.setProperty("--tema", "#0f172a");
      b.innerHTML = `<span class="tema__punto"></span>${nombre}`;
      b.addEventListener("click", () => { estado.subtema = id; pintarSubtemas(); construirIndicadores(); cerrarVentana(); dibujar(); });
      cont.appendChild(b);
    });
    pintarSubtemas();
  }
  function pintarSubtemas() {
    document.querySelectorAll("#subtemas .tema").forEach(b => {
      const on = b.dataset.subtema === estado.subtema;
      b.classList.toggle("tema--activo", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.getElementById("bloque-subtemas").hidden = !temaActivo("periodistas");
    if (document.getElementById("generos").children.length) pintarGeneros();
  }
  function pintarGrupos() {
    document.querySelectorAll("#grupos .tema").forEach(b => {
      const on = b.dataset.grupo === estado.grupo;
      b.classList.toggle("tema--activo", on);
      b.setAttribute("aria-pressed", String(on));
    });
    document.getElementById("bloque-grupos").hidden = !temaActivo("periodistas");
  }
  function pintarTemas() {
    document.querySelectorAll("#temas .tema").forEach(b => {
      const on = b.dataset.tema === estado.tema;
      b.classList.toggle("tema--activo", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  function temaActivo(id) {
    const t = CONFIG.temas[id];
    if (t && t.activo === false) return false;
    return estado.tema === "todos" || estado.tema === id;
  }
  // Group filter (journalists / defenders) applies to the journalists theme only
  function grupoActivo(g) {
    return estado.grupo === "todos" || !g || g === "ambos" || g === estado.grupo;
  }
  // Field-of-work filter: only defender events carry it; journalists are unaffected
  function laborActiva(e) {
    if (estado.labor === "todos") return true;
    if (e.grupo !== "defensor") return false;
    return e.labor === estado.labor;
  }
  // Sub-topic filter; items without a sub-topic (indicators, untyped events) stay visible
  function subtemaActivo(s, esEvento) {
    if (estado.subtema === "todos") return true;
    if (!s) return !esEvento;
    return s === estado.subtema;
  }

  function construirVerificacion() {
    const cont = document.getElementById("verif");
    CONFIG.verificacion.forEach(v => {
      const l = document.createElement("label");
      l.className = "verif__item";
      l.innerHTML = `<input type="checkbox" checked value="${v}"> <span class="badge badge--${clase(v)}">${v}</span>`;
      l.querySelector("input").addEventListener("change", e => {
        e.target.checked ? estado.verifActivas.add(v) : estado.verifActivas.delete(v);
        dibujar();
      });
      cont.appendChild(l);
    });
  }

  // Only indicators with values at the current map level are offered
  function construirIndicadores() {
    const sel = document.getElementById("indicador");
    const nivel = mapaActual().nivel;
    sel.innerHTML = "";
    const oN = document.createElement("option");
    oN.value = ""; oN.textContent = "Ninguno";
    sel.appendChild(oN);
    const o0 = document.createElement("option");
    o0.value = "_eventos"; o0.textContent = "Eventos registrados (conteo)";
    sel.appendChild(o0);
    estado.indicadores.definiciones.forEach(d => {
      if (d.oculto) return;
      if (!d.externo && !valoresDe(d.id, nivel).length) return;
      if (!temaActivo(d.tema)) return;
      if (d.tema === "periodistas" && !grupoActivo(d.grupo)) return;
      if (d.tema === "periodistas" && !subtemaActivo(d.subtema, false)) return;
      const o = document.createElement("option");
      o.value = d.id; o.textContent = `${d.nombre} (${CONFIG.temas[d.tema].nombre})`;
      sel.appendChild(o);
    });
    if (![...sel.options].some(o => o.value === estado.indicador)) estado.indicador = "";
    sel.value = estado.indicador;
    sel.onchange = async () => {
      estado.indicador = sel.value;
      const d = estado.indicadores.definiciones.find(x => x.id === sel.value);
      if (d && d.externo) { sel.disabled = true; await cargarExterno(d); sel.disabled = false; }
      dibujar();
    };
  }

  // Source list follows the active theme (context sources, such as press, always show)
  function construirFuentes() {
    const ul = document.getElementById("fuentes");
    ul.innerHTML = "";
    estado.fuentes.filter(f => temaActivo(f.tema) || f.tema === "contexto").forEach(f => {
      const li = document.createElement("li");
      const nombre = f.url ? `<a href="${f.url}" target="_blank" rel="noopener">${f.nombre}</a>` : f.nombre;
      li.innerHTML = `${nombre}<br><small>${CONFIG.tiposFuente[f.tipo] || f.tipo} · ${f.periodicidad} · ${f.nivel}</small>`;
      ul.appendChild(li);
    });
  }

  function iniciarFiltros() {
    document.getElementById("buscar").addEventListener("input", e => {
      estado.texto = normalizar(e.target.value);
      dibujar();
    });
  }

  // ---------- drawing ----------

  function dibujar() {
    capaEventos.clearLayers();
    capaCirculos.clearLayers();
    const conIndicador = estado.indicador !== "";
    const conEventos = hayEventosDibujados();
    // Filters only matter when events are drawn or counted
    document.getElementById("bloque-filtros").hidden = !conEventos && estado.indicador !== "_eventos";
    document.getElementById("bloque-tematico").hidden = !conIndicador;
    const tp = textoPeriodo();
    document.getElementById("periodo-info").textContent =
      (estado.desde || estado.hasta || tp === "sin datos") ? "" : `· ${tp}`;
    if (conIndicador) dibujarTematico(); else capaPoligonos.setStyle(estiloNeutro);
    if (conEventos) dibujarEventos();
    dibujarCalor();
    dibujarEtiquetas();
    const ml = document.getElementById("mapa-leyenda");
    const vis = conEventos ? estado.eventos.filter(eventoVisible) : [];
    const filasEv = [];
    if (vis.some(e => e.tema === "periodistas" && e.grupo !== "defensor")) filasEv.push(`<div class="leyenda__fila"><span class="leyenda__punto" style="background:${CONFIG.temas.periodistas.color}"></span>Periodistas</div>`);
    if (vis.some(e => e.grupo === "defensor")) filasEv.push(`<div class="leyenda__fila"><span class="leyenda__punto" style="background:${CONFIG.grupos.defensor.color}"></span>Personas defensoras</div>`);
    if (conIndicador || filasEv.length) {
      ml.hidden = false;
      ml.innerHTML = (conIndicador ? `<h4>${document.getElementById("tematico-titulo").textContent}</h4>` + document.getElementById("leyenda").innerHTML : "")
        + (filasEv.length ? `<h4 class="${conIndicador ? "leyenda__sep" : ""}">Eventos</h4>${filasEv.join("")}` : "");
    } else ml.hidden = true;
    actualizarControles();
    actualizarMapaBase();
    dibujarResumen();
  }

  // Breakdown strip under the map: shares of the visible events by group, aggression type, field and gender
  function dibujarResumen() {
    const cont = document.getElementById("resumen");
    const vis = hayEventosDibujados() ? estado.eventos.filter(eventoVisible) : [];
    if (!vis.length) { cont.hidden = true; return; }
    cont.hidden = false;
    const barra = (titulo, partes) => {
      partes = partes.filter(p => p.n > 0);
      const total = partes.reduce((s, p) => s + p.n, 0) || 1;
      return `<div class="resumen__fila"><div class="resumen__titulo">${titulo}</div>
        <div class="resumen__barra">${partes.map(p => `<span class="resumen__seg" style="width:${(100 * p.n / total).toFixed(1)}%;background:${p.color}" title="${p.nombre}: ${p.n} (${Math.round(100 * p.n / total)}%)"></span>`).join("")}</div>
        <div class="resumen__texto">${partes.map(p => `<span><i style="background:${p.color}"></i>${p.nombre} ${Math.round(100 * p.n / total)}%</span>`).join("")}</div></div>`;
    };
    const cuenta = (lista, fn) => lista.map(([clave, nombre, color]) => ({ clave, nombre, color, n: vis.filter(e => fn(e) === clave).length }));
    const gr = cuenta([["periodista", "Periodistas", CONFIG.temas.periodistas.color], ["defensor", "Personas defensoras", CONFIG.grupos.defensor.color], ["ambos", "Ambos", "#94a3b8"]], e => e.grupo || "ambos");
    const paleta = ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#b91c1c", "#c2410c", "#a16207"];
    const st = cuenta(Object.entries(CONFIG.subtemas).map(([k, n], i) => [k, n, paleta[i % paleta.length]]), e => e.subtema);
    const lb = cuenta(Object.entries(CONFIG.labores).map(([k, n], i) => [k, n, paleta[(i + 3) % paleta.length]]), e => e.labor);
    const ge = partesGenero(vis).map(p => ({ ...p }));
    cont.innerHTML = `<button type="button" class="resumen__cab" aria-expanded="${!resumenPlegado}" title="${resumenPlegado ? "Mostrar" : "Ocultar"} el resumen">
        <span>Lo que está en el mapa: ${vis.length} eventos</span><span class="resumen__signo" aria-hidden="true">${resumenPlegado ? "+" : "–"}</span></button>`
      + `<div class="resumen__cuerpo"${resumenPlegado ? " hidden" : ""}>`
      + barra("Grupo", gr) + barra("Tipo de agresión", st)
      + (vis.some(e => e.labor) ? barra("Labor de la persona defensora", lb) : "")
      + barra("Género", ge) + `</div>`;
    cont.classList.toggle("resumen--plegado", resumenPlegado);
  }

  // A click anywhere on the strip folds or unfolds it; the choice is remembered in this browser
  function alternarResumen() {
    resumenPlegado = !resumenPlegado;
    try { localStorage.setItem("observatorio_resumen_plegado", resumenPlegado ? "1" : "0"); } catch (e) { /* storage unavailable */ }
    dibujarResumen();
    mapa.invalidateSize();
  }

  // Fits the view to the polygons of the current map (country or state)
  function centrarMapa() {
    if (!capaPoligonos.getLayers().length) return;
    mapa.fitBounds(capaPoligonos.getBounds(), { padding: [10, 10] });
  }

  // Pixel rectangle around the drawn polygons, with a margin, for the PNG export
  function recorteExportacion() {
    const cont = mapa.getContainer(), cw = cont.clientWidth, ch = cont.clientHeight;
    if (!capaPoligonos.getLayers().length) return { x: 0, y: 0, w: cw, h: ch };
    const b = capaPoligonos.getBounds();
    const p1 = mapa.latLngToContainerPoint(b.getNorthWest()), p2 = mapa.latLngToContainerPoint(b.getSouthEast());
    const m = 28;
    const x = Math.max(0, Math.min(p1.x, p2.x) - m), y = Math.max(0, Math.min(p1.y, p2.y) - m);
    const x2 = Math.min(cw, Math.max(p1.x, p2.x) + m), y2 = Math.min(ch, Math.max(p1.y, p2.y) + m);
    // Leave room for the legend and the scale bar under the polygons
    return { x, y, w: Math.max(320, x2 - x), h: Math.max(260, y2 - y + 40) };
  }

  // Everything the charts window needs, already filtered like the map
  function contextoGraficas() {
    const nivel = mapaActual().nivel;
    const def = estado.indicador === "_eventos"
      ? { id: "_eventos", nombre: "Eventos registrados (conteo)", unidad: "eventos", tema: null, fuente: null }
      : estado.indicadores.definiciones.find(d => d.id === estado.indicador) || null;
    const nombres = Object.fromEntries(estado.geos[estado.mapaId].features.map(f => [claveDe(f.properties), f.properties.nombre]));
    const datos = def ? datosTematicos() : {};
    const valores = Object.entries(datos).filter(([, d]) => d.valor !== 0 || typeof d.valor === "string")
      .map(([clave, d]) => ({ clave, nombre: nombres[clave] || clave, valor: d.valor, periodo: d.periodo, ejemplo: d.ejemplo }));
    // Full series by period (unfiltered by range) for the line chart
    let series = { periodos: [], unidades: [] };
    if (def && def.id !== "_eventos" && def.tipo !== "categoria") {
      const vals = valoresDe(def.id, nivel);
      const periodos = [...new Set(vals.map(v => String(v.periodo)))].sort();
      const porUnidad = {};
      vals.forEach(v => { const k = nivel === "municipio" ? v.cve_ent + v.cve_mun : v.cve_ent; (porUnidad[k] = porUnidad[k] || {})[String(v.periodo)] = v.valor; });
      const ultimo = periodos[periodos.length - 1];
      const unidades = Object.entries(porUnidad).sort((x, y) => (y[1][ultimo] || 0) - (x[1][ultimo] || 0)).slice(0, 8)
        .map(([k, p]) => ({ nombre: nombres[k] || k, valores: periodos.map(pp => p[pp] ?? null) }));
      series = { periodos, unidades };
    }
    return {
      eventos: estado.eventos.filter(eventoVisible), temas: CONFIG.temas, indicador: def, valores, series,
      color: def && def.tema ? CONFIG.temas[def.tema].color : "#1f2a37", coloresCategoria: estado.coloresCategoria,
      mapaNombre: mapaActual().nombre, periodoTexto: textoPeriodo(), nombreFuente,
      abrirVentana, cargarScript,
      seriesNacionales: estado.seriesNacionales ? { ...estado.seriesNacionales, series: estado.seriesNacionales.series.filter(s => (s.pais || "MX") === estado.pais) } : null,
      aplicarPeriodo: (d, h) => {
        estado.desde = d; estado.hasta = h;
        document.getElementById("desde").value = d; document.getElementById("hasta").value = h;
        dibujar();
        // Re-render after the chart finishes handling its own click event
        setTimeout(() => Graficas.abrir(contextoGraficas()), 0);
      }
    };
  }

  // Grey out the styling controls that do not apply to what is drawn
  function actualizarControles() {
    const def = estado.indicador && estado.indicador !== "_eventos"
      ? estado.indicadores.definiciones.find(d => d.id === estado.indicador) : null;
    const hay = estado.indicador !== "";
    const categorico = !!(def && def.tipo === "categoria");
    const clasesAplican = hay && !categorico && estado.forma === "coropleta";
    document.querySelectorAll("#sel-forma button").forEach(b => b.disabled = !hay || categorico);
    document.getElementById("gama").disabled = !hay;
    document.getElementById("metodo").disabled = !clasesAplican;
    document.getElementById("clases").disabled = !clasesAplican;
  }

  // One label per polygon, at the centroid of its bounds; hidden when "Nombres" is off
  // Label anchor: the biggest polygon of the feature, so offshore islands (Colima's
  // Revillagigedo, Baja California's Guadalupe) do not drag the name into the sea
  function centroDe(f) {
    if (!f._centro) {
      const g = f.geometry;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const mayor = polys.reduce((a, b) => areaAnillo(b[0]) > areaAnillo(a[0]) ? b : a);
      f._centro = L.geoJSON({ type: "Polygon", coordinates: mayor }).getBounds().getCenter();
    }
    return f._centro;
  }
  function areaAnillo(anillo) {
    let s = 0;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) s += (anillo[j][0] + anillo[i][0]) * (anillo[j][1] - anillo[i][1]);
    return Math.abs(s / 2);
  }

  function dibujarEtiquetas() {
    capaEtiquetas.clearLayers();
    if (!document.getElementById("nombres").checked) return;
    const feats = estado.geos[estado.mapaId].features;
    // Many municipalities: names only once the user zooms in two levels past the fitted view
    if (feats.length > CONFIG.maxEtiquetasSinZoom && mapa.getZoom() < (estado.zoomBase || 0) + CONFIG.zoomEtiquetas) return;
    feats.forEach(f => {
      const c = centroDe(f);
      capaEtiquetas.addLayer(L.marker(c, {
        pane: "etiquetas", interactive: false, etiqueta: f.properties.nombre,
        icon: L.divIcon({ className: "etiqueta-poligono", html: `<span>${f.properties.nombre}</span>`, iconSize: [0, 0] })
      }));
    });
  }

  // Density of the filtered events, clipped to the country or the current state;
  // a cold blue fill under it marks the areas without events
  function dibujarCalor() {
    if (capaCalor) { mapa.removeLayer(capaCalor); capaCalor = null; }
    capaBaseCalor.clearLayers();
    if (!document.getElementById("calor").checked || !L.heatLayer) return;
    const limite = esNacional(estado.mapaId) ? geoNacional() : { type: "FeatureCollection", features: geoNacional().features.filter(f => f.properties.cve_ent === estado.mapaId) };
    capaBaseCalor.addLayer(L.geoJSON(limite, { pane: "calor", interactive: false, style: { stroke: false, fillColor: "#2563eb", fillOpacity: 0.42 } }));
    const puntos = estado.eventos.filter(eventoVisible).map(e => [e.lat, e.lon, 1]);
    capaCalor = L.heatLayer(puntos.length ? puntos : [[0, 0, 0]], { pane: "calor", radius: 30, blur: 24, minOpacity: 0.55, maxZoom: 9,
      gradient: { 0.1: "#60a5fa", 0.3: "#86efac", 0.5: "#fde047", 0.7: "#f97316", 0.9: "#dc2626", 1: "#7f1d1d" } });
    const original = capaCalor._redraw.bind(capaCalor);
    capaCalor._redraw = function () { original(); recortarCalor(this, limite); };
    capaCalor.addTo(mapa);
  }

  // Keeps only the heat inside the boundary rings (destination-in mask on the plugin's canvas)
  function recortarCalor(capa, limite) {
    const cv = capa._canvas; if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.beginPath();
    limite.features.forEach(f => {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      polys.forEach(rings => rings.forEach(r => {
        r.forEach((c, i) => { const p = mapa.latLngToContainerPoint([c[1], c[0]]); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath();
      }));
    });
    ctx.fillStyle = "#000"; ctx.fill("evenodd");
    ctx.restore();
  }

  // Shares of women, men, LGBT+ people and other records among a set of events
  function partesGenero(eventos) {
    const total = eventos.length || 1;
    const cuenta = k => eventos.filter(e => (k === "otro" ? !CONFIG.generos[e.genero] : e.genero === k)).length;
    return [...Object.entries(CONFIG.generos).map(([k, nombre]) => ({ clave: k, nombre, color: CONFIG.generosColores[k], n: cuenta(k) })),
      { clave: "otro", nombre: "Sin dato o no aplica", color: CONFIG.generosColores.otro, n: cuenta("otro") }]
      .filter(p => p.n > 0).map(p => ({ ...p, frac: p.n / total }));
  }

  // Pie marker drawn as an inline SVG; options.pastel lets the exporter redraw it on canvas
  function marcadorPastel(latlng, r, partes) {
    const s = r * 2 + 2, cx = r + 1, cy = r + 1;
    let ang = -Math.PI / 2, paths = "";
    partes.forEach(p => {
      const a2 = ang + p.frac * 2 * Math.PI;
      if (p.frac >= 0.999) paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.color}" fill-opacity=".85"/>`;
      else {
        const x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang), x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
        paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${p.frac > 0.5 ? 1 : 0},1 ${x2},${y2} Z" fill="${p.color}" fill-opacity=".85"/>`;
      }
      ang = a2;
    });
    const icono = L.divIcon({ className: "pastel", iconSize: [s, s], iconAnchor: [cx, cy],
      html: `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${paths}<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="1.2"/></svg>` });
    return L.marker(latlng, { icon: icono, pastel: { r, partes }, interactive: true });
  }

  // Defenders are drawn in lilac, journalists (and shared records) in the theme red
  function colorEvento(e) {
    return e.grupo === "defensor" && CONFIG.grupos.defensor ? CONFIG.grupos.defensor.color : CONFIG.temas[e.tema].color;
  }

  function hayEventosDibujados() {
    return estado.eventosVisibles;
  }

  function eventoVisible(e) {
    if (!temaActivo(e.tema)) return false;
    if (e.tema === "periodistas" && !grupoActivo(e.grupo)) return false;
    if (e.tema === "periodistas" && !subtemaActivo(e.subtema, true)) return false;
    if (e.tema === "periodistas" && estado.genero !== "todos" && e.genero !== estado.genero) return false;
    if (e.tema === "periodistas" && !laborActiva(e)) return false;
    if ((e.pais || "MX") !== estado.pais) return false;
    // On a state map only the events inside that state are shown
    if (!esNacional(estado.mapaId) && !dentroDeEstado(e)) return false;
    if (!estado.verifActivas.has(e.verificacion)) return false;
    const mes = e.fecha.slice(0, 7);
    if (estado.desde && mes < estado.desde) return false;
    if (estado.hasta && mes > estado.hasta) return false;
    if (estado.texto) {
      const blob = normalizar(`${e.persona || ""} ${e.lugar} ${e.titulo} ${e.tipo} ${e.descripcion}`);
      if (!blob.includes(estado.texto)) return false;
    }
    return true;
  }

  function dibujarEventos() {
    let n = 0;
    const visibles = estado.eventos.filter(eventoVisible);
    // Events stacked on one point (records that only give the state) are spread on a sunflower
    // spiral around it, skipping any slot that falls outside the state polygon, so no marker
    // ends up in the sea or in a neighbouring state whatever the zoom
    const grupos = {};
    visibles.forEach(e => { const k = `${e.lat},${e.lon}`; (grupos[k] = grupos[k] || []).push(e); });
    const poligonoDe = {};
    const estadoDe = ll => (geoNacional() ? geoNacional().features.find(f => dentro([ll[1], ll[0]], f.geometry)) : null);
    const posicion = e => {
      const k = `${e.lat},${e.lon}`, g = grupos[k];
      if (g.length === 1) return [e.lat, e.lon];
      if (!(k in poligonoDe)) poligonoDe[k] = estadoDe([e.lat, e.lon]);
      const pol = poligonoDe[k];
      const i = g.indexOf(e);
      const base = mapa.latLngToContainerPoint([e.lat, e.lon]);
      const paso = 9, dorado = Math.PI * (3 - Math.sqrt(5));
      let intento = i;
      for (let vueltas = 0; vueltas < 400; vueltas++, intento += g.length) {
        const r = paso * Math.sqrt(intento + 1), ang = intento * dorado;
        const ll = mapa.containerPointToLatLng([base.x + r * Math.cos(ang), base.y + r * Math.sin(ang)]);
        if (!pol || dentro([ll.lng, ll.lat], pol.geometry)) return [ll.lat, ll.lng];
      }
      return [e.lat, e.lon];
    };
    visibles.forEach(e => {
      n++;
      const color = colorEvento(e);
      const m = L.circleMarker(posicion(e), {
        radius: 7, color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 0.9,
        dashArray: e.ejemplo ? "2 2" : null
      });
      m.bindTooltip(e.titulo, { direction: "top", offset: [0, -6] });
      m.on("click", () => { clicEnCapa = true; navegar(() => mostrarDetalleEvento(e), true); });
      capaEventos.addLayer(m);
    });
    document.getElementById("conteo").textContent =
      (n === 1 ? "1 evento en el mapa" : `${n} eventos en el mapa`) + `, periodo ${textoPeriodo()}`;
  }

  // Values of an indicator at the level of the current map
  // Municipal values are restricted to the state currently shown
  function valoresDe(id, nivel) {
    return estado.indicadores.valores.filter(v =>
      v.indicador === id && (nivel === "municipio" ? !!v.cve_mun && v.cve_ent === estado.mapaId : !v.cve_mun && paisDeCve(v.cve_ent) === estado.pais));
  }

  function claveDe(props) {
    return mapaActual().nivel === "municipio" ? props.cve_ent + props.cve_mun : props.cve_ent;
  }

  // Returns {clave: {valor, periodo, ejemplo}} for the chosen indicator
  function datosTematicos() {
    const nivel = mapaActual().nivel;
    const datos = {};
    if (estado.indicador === "_eventos") {
      const visibles = estado.eventos.filter(eventoVisible);
      estado.geos[estado.mapaId].features.forEach(f => {
        const n = visibles.filter(e => dentro([e.lon, e.lat], f.geometry)).length;
        datos[claveDe(f.properties)] = { valor: n, periodo: "filtro actual", ejemplo: false };
      });
    } else {
      // Keep, per unit, the most recent value whose period falls inside the selected range
      const def = estado.indicadores.definiciones.find(d => d.id === estado.indicador);
      const suma = def && def.agregacion === "suma";
      valoresDe(estado.indicador, nivel).forEach(v => {
        if (!valorEnRango(v, def)) return;
        const [, fin] = mesesDePeriodo(v.periodo);
        const k = nivel === "municipio" ? v.cve_ent + v.cve_mun : v.cve_ent;
        if (suma) {
          // Annual flows add up across the selected range instead of showing the last year only
          if (!datos[k]) datos[k] = { valor: 0, periodo: String(v.periodo), ejemplo: !!v.ejemplo, desde: String(v.periodo) };
          datos[k].valor += v.valor;
          if (String(v.periodo) > datos[k].periodo) datos[k].periodo = String(v.periodo);
          if (String(v.periodo) < datos[k].desde) datos[k].desde = String(v.periodo);
        } else if (!datos[k] || fin > mesesDePeriodo(datos[k].periodo)[1]) datos[k] = { valor: v.valor, periodo: v.periodo, ejemplo: !!v.ejemplo };
      });
      if (suma) Object.values(datos).forEach(x => { if (x.desde !== x.periodo) x.periodo = `${x.desde} a ${x.periodo}`; });
    }
    return datos;
  }

  // A value counts if its period overlaps the selected range; stock indicators
  // (accumulated counts, legal frameworks) stay valid after their cut date
  function valorEnRango(v, def) {
    const acumulado = !!(def && (def.acumulado || def.tipo === "categoria"));
    const [ini, fin] = mesesDePeriodo(v.periodo);
    if (estado.desde && fin < estado.desde && !acumulado) return false;
    // Projections beyond today (CONAPO) only show when the range explicitly reaches them;
    // a stock value dated a few days ahead (a cut date) is not a projection
    const tope = estado.hasta || (acumulado ? "9999-12" : mesActual());
    if (ini > tope) return false;
    return true;
  }
  function mesActual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

  // Period covered by a value, as [first month, last month]: "2025" -> whole year, "2025-06-30" -> that month
  function mesesDePeriodo(p) {
    const s = String(p);
    return s.length === 4 ? [s + "-01", s + "-12"] : [s.slice(0, 7), s.slice(0, 7)];
  }

  // Active range, or the years actually covered by the drawn data when no range is set
  function textoPeriodo() {
    if (estado.desde || estado.hasta) return `${estado.desde || "inicio"} a ${estado.hasta || "hoy"}`;
    const anios = aniosCubiertos();
    if (!anios.length) return "sin datos";
    const [a, b] = [Math.min(...anios), Math.max(...anios)];
    return a === b ? String(a) : `${a} a ${b}`;
  }

  function aniosCubiertos() {
    const conEventos = hayEventosDibujados() || estado.indicador === "_eventos";
    const anios = [];
    if (conEventos) estado.eventos.filter(eventoVisible).forEach(e => anios.push(+e.fecha.slice(0, 4)));
    if (estado.indicador && estado.indicador !== "_eventos") {
      const def = estado.indicadores.definiciones.find(d => d.id === estado.indicador);
      valoresDe(estado.indicador, mapaActual().nivel).filter(v => valorEnRango(v, def)).forEach(v => anios.push(+String(v.periodo).slice(0, 4)));
    }
    return anios.filter(Boolean);
  }

  function dibujarTematico() {
    const def = estado.indicador === "_eventos"
      ? { nombre: "Eventos registrados", unidad: "eventos", tema: null, nota: "Conteo de los eventos visibles con los filtros actuales, ubicados dentro de cada polígono." }
      : estado.indicadores.definiciones.find(d => d.id === estado.indicador);
    const color = def.tema ? CONFIG.temas[def.tema].color : "#1f2a37";
    const datos = datosTematicos();
    document.getElementById("tematico-titulo").textContent = def.nombre;
    if (def.tipo === "categoria") { dibujarCategorico(def, datos); return; }
    const valores = Object.values(datos).map(d => d.valor).filter(v => v > 0);
    const cortes = calcularCortes(valores, estado.clases, estado.metodo);
    const rampa = crearRampa(color, Math.max(cortes.length, 1));

    document.getElementById("tematico-titulo").textContent = def.nombre;
    document.getElementById("tematico-nota").textContent = `Periodo ${textoPeriodo()}. ${def.nota || ""}`;

    if (estado.forma === "coropleta") {
      capaPoligonos.setStyle(f => {
        const d = datos[claveDe(f.properties)];
        if (!d || d.valor === 0) return { ...estiloNeutro(), color: "#3f4a5a", weight: 1, fillColor: CONFIG.colorSinDato, fillOpacity: 0.55 };
        return { color: "#3f4a5a", weight: 1, fillColor: rampa[claseDe(d.valor, cortes)], fillOpacity: 0.8 };
      });
      dibujarLeyendaColores(cortes, rampa, def.unidad, valores.length);
      let prev = 0;
      estado.leyendaExport = cortes.map((c, i) => {
        const txt = prev === c ? fmt(c) : prev === 0 ? `hasta ${fmt(c)}` : `${fmt(prev)} a ${fmt(c)}`;
        prev = c; return { forma: "caja", color: rampa[i], texto: txt };
      }).concat([{ forma: "caja", color: CONFIG.colorSinDato, texto: "Sin dato o cero" }]);
    } else {
      capaPoligonos.setStyle(estiloNeutro);
      const max = Math.max(...valores, 1);
      const esConteo = estado.indicador === "_eventos";
      const visibles = esConteo ? estado.eventos.filter(eventoVisible) : [];
      estado.geos[estado.mapaId].features.forEach(f => {
        const d = datos[claveDe(f.properties)];
        if (!d || d.valor === 0) return;
        const c = centroDe(f);
        const r = 5 + 30 * Math.sqrt(d.valor / max);
        let m;
        if (esConteo) {
          // Event counts become pies split by gender of the people affected
          const partes = partesGenero(visibles.filter(e => dentro([e.lon, e.lat], f.geometry)));
          m = marcadorPastel(c, r, partes);
          m.bindTooltip(`<strong>${f.properties.nombre}</strong><br>${d.valor} eventos<br>${partes.map(p => `${p.nombre}: ${Math.round(p.frac * 100)}%`).join("<br>")}`);
        } else {
          m = L.circleMarker(c, { radius: r, color, weight: 1, fillColor: color, fillOpacity: 0.35, dashArray: d.ejemplo ? "3 3" : null });
          m.bindTooltip(etiquetaValor(f.properties.nombre, d, def.unidad));
        }
        m.on("click", () => { clicEnCapa = true; navegar(() => mostrarDetallePoligono(f.properties), true); });
        capaCirculos.addLayer(m);
      });
      if (esConteo) {
        const filas = Object.entries(CONFIG.generos).map(([k, n]) => `<div class="leyenda__fila"><span class="leyenda__caja" style="background:${CONFIG.generosColores[k]}"></span>${n}</div>`).join("")
          + `<div class="leyenda__fila"><span class="leyenda__caja" style="background:${CONFIG.generosColores.otro}"></span>Sin dato o no aplica</div>`;
        document.getElementById("leyenda").innerHTML = `<div class="leyenda__fila">Área proporcional a eventos; máximo ${max.toLocaleString("es-MX")}. Sectores por género:</div>${filas}`;
        estado.leyendaExport = [{ forma: "circulo", color, alpha: 0.35, borde: color, texto: `Área proporcional a eventos (máximo ${fmt(max)})` },
          ...Object.entries(CONFIG.generos).map(([k, n]) => ({ forma: "caja", color: CONFIG.generosColores[k], texto: n })),
          { forma: "caja", color: CONFIG.generosColores.otro, texto: "Sin dato o no aplica" }];
      } else {
        document.getElementById("leyenda").innerHTML =
          `<div class="leyenda__fila"><span class="leyenda__circulo" style="--tema:${color}"></span>Área proporcional a ${def.unidad}. Máximo: ${max.toLocaleString("es-MX")}.</div>`;
        estado.leyendaExport = [{ forma: "circulo", color, alpha: 0.35, borde: color, texto: `Área proporcional a ${def.unidad} (máximo ${fmt(max)})` }];
      }
    }
    const fuente = def.fuente ? `Fuente: ${nombreFuente(def.fuente)}. ` : "";
    document.getElementById("tematico-metodo").textContent =
      fuente + (estado.forma === "coropleta"
        ? `${CONFIG.metodos[estado.metodo].nombre} (${cortes.length} clases); ${CONFIG.metodos[estado.metodo].descripcion}. Sin dato o cero en gris.`
        : "Los círculos con borde punteado muestran datos de ejemplo.");
  }

  // Categorical choropleth (e.g. legal framework): one color per category, no classes
  function dibujarCategorico(def, datos) {
    document.getElementById("tematico-nota").textContent = `Periodo ${textoPeriodo()}. ${def.nota || ""}`;
    // Category colors: the indicator's own, or the chosen palette from dark (first) to light (last)
    const claves = Object.keys(def.categorias);
    let colores = def.colores;
    if (estado.gama !== "tema") {
      const rampa = crearRampa("#1f2a37", claves.length).reverse();
      colores = Object.fromEntries(claves.map((k, i) => [k, rampa[i]]));
    }
    capaPoligonos.setStyle(f => {
      const d = datos[claveDe(f.properties)];
      if (!d) return { ...estiloNeutro(), color: "#3f4a5a", weight: 1, fillColor: CONFIG.colorSinDato, fillOpacity: 0.55 };
      return { color: "#3f4a5a", weight: 1, fillColor: colores[d.valor] || CONFIG.colorSinDato, fillOpacity: 0.8 };
    });
    const conteo = {};
    Object.values(datos).forEach(d => { conteo[d.valor] = (conteo[d.valor] || 0) + 1; });
    const filas = claves.map(k =>
      `<div class="leyenda__fila"><span class="leyenda__caja" style="background:${colores[k]}"></span>${def.categorias[k]} (${conteo[k] || 0})</div>`);
    document.getElementById("leyenda").innerHTML = filas.join("");
    estado.leyendaExport = claves.map(k => ({ forma: "caja", color: colores[k], texto: `${def.categorias[k]} (${conteo[k] || 0})` }));
    estado.coloresCategoria = colores;
    document.getElementById("tematico-metodo").textContent =
      `Fuente: ${nombreFuente(def.fuente)}. Mapa categórico: cada entidad se pinta según el tipo de instrumento vigente, sin clases numéricas.`;
    // Circles make no sense for categories: keep the buttons but force colors
    estado.forma = "coropleta"; marcar("#sel-forma", "forma", "coropleta");
  }

  // Quantile breaks: robust to the heavy skew typical of these indicators
  function cortesCuantiles(valores, k) {
    const v = [...valores].sort((a, b) => a - b);
    if (!v.length) return [];
    const unicos = [...new Set(v)];
    if (unicos.length <= k) return unicos;
    const cortes = [];
    for (let i = 1; i <= k; i++) cortes.push(v[Math.min(v.length - 1, Math.ceil(i * v.length / k) - 1)]);
    return [...new Set(cortes)];
  }
  function claseDe(valor, cortes) {
    const i = cortes.findIndex(c => valor <= c);
    return Math.min(i < 0 ? cortes.length - 1 : i, cortes.length - 1);
  }

  // Upper bounds of each class for the chosen method; duplicates removed
  function calcularCortes(valores, k, metodo) {
    const v = [...valores].sort((a, b) => a - b);
    if (!v.length) return [];
    const unicos = [...new Set(v)];
    if (unicos.length <= k) return unicos;
    let cortes;
    const min = v[0], max = v[v.length - 1];
    if (metodo === "iguales") {
      cortes = Array.from({ length: k }, (_, i) => min + (max - min) * (i + 1) / k);
    } else if (metodo === "logaritmico") {
      const lo = Math.log(Math.max(min, 1)), hi = Math.log(max);
      cortes = Array.from({ length: k }, (_, i) => Math.exp(lo + (hi - lo) * (i + 1) / k));
    } else if (metodo === "naturales") {
      cortes = jenks(v, k);
    } else {
      cortes = cortesCuantiles(v, k);
    }
    cortes = cortes.map(c => redondear(c, max));
    cortes[cortes.length - 1] = max;
    return [...new Set(cortes)].filter(c => c >= min);
  }

  // Round class limits to a readable precision relative to the data range
  function redondear(x, max) {
    if (max < 10) return Math.round(x * 100) / 100;
    if (max < 100) return Math.round(x * 10) / 10;
    return Math.round(x);
  }

  // Jenks natural breaks (Fisher-Jenks dynamic programming); returns k upper bounds
  function jenks(v, k) {
    const n = v.length;
    const lower = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
    const variance = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
    for (let j = 1; j <= k; j++) { lower[1][j] = 1; variance[1][j] = 0; }
    for (let l = 2; l <= n; l++) {
      let sum = 0, sumSq = 0, w = 0;
      for (let m = 1; m <= l; m++) {
        const i3 = l - m + 1, val = v[i3 - 1];
        w++; sum += val; sumSq += val * val;
        const varTmp = sumSq - (sum * sum) / w;
        const i4 = i3 - 1;
        if (i4 !== 0) {
          for (let j = 2; j <= k; j++) {
            if (variance[l][j] >= varTmp + variance[i4][j - 1]) { lower[l][j] = i3; variance[l][j] = varTmp + variance[i4][j - 1]; }
          }
        }
      }
      lower[l][1] = 1; variance[l][1] = sumSq - (sum * sum) / w;
    }
    const cortes = new Array(k); let idx = n;
    cortes[k - 1] = v[n - 1];
    for (let j = k; j >= 2; j--) { idx = lower[idx][j] - 1; cortes[j - 2] = v[idx - 1]; }
    return cortes;
  }

  // k colors from the chosen palette; "tema" interpolates light grey to the theme color
  function crearRampa(colorTema, k) {
    const g = CONFIG.gamas[estado.gama];
    const paradas = (g && g.paradas) ? g.paradas : [CONFIG.colorClaro, colorTema];
    const rgb = paradas.map(hexRgb);
    return Array.from({ length: k }, (_, i) => {
      const t0 = k === 1 ? 1 : (paradas.length === 2 ? 0.15 + 0.85 * (i / (k - 1)) : i / (k - 1));
      const pos = t0 * (rgb.length - 1), j = Math.min(Math.floor(pos), rgb.length - 2), f = pos - j;
      return rgbHex(rgb[j].map((x, c) => Math.round(x + (rgb[j + 1][c] - x) * f)));
    });
  }
  function hexRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function rgbHex(rgb) { return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join(""); }

  function dibujarLeyendaColores(cortes, rampa, unidad, n) {
    const ley = document.getElementById("leyenda");
    if (!cortes.length) { ley.innerHTML = `<p class="nota">Sin datos para este mapa.</p>`; return; }
    let previo = 0;
    const filas = cortes.map((c, i) => {
      const txt = previo === c ? fmt(c) : previo === 0 ? `hasta ${fmt(c)}` : `${fmt(previo)} a ${fmt(c)}`;
      previo = c;
      return `<div class="leyenda__fila"><span class="leyenda__caja" style="background:${rampa[i]}"></span>${txt}</div>`;
    });
    filas.push(`<div class="leyenda__fila"><span class="leyenda__caja" style="background:${CONFIG.colorSinDato}"></span>Sin dato o cero</div>`);
    ley.innerHTML = `<p class="nota">${unidad}, ${n} unidades con dato</p>` + filas.join("");
  }

  // ---------- polygons ----------

  // Keep the group's base style in sync so hover can restore it
  const setStyleOriginal = capaPoligonos.setStyle.bind(capaPoligonos);
  capaPoligonos.setStyle = function (st) { capaPoligonos.options.style = st; return setStyleOriginal(st); };

  function estiloNeutro() {
    return { color: "#8a93a1", weight: 0.9, fillColor: "#ffffff", fillOpacity: 0.02 };
  }

  function alPoligono(feature, layer) {
    layer.on("mouseover", () => {
      layer.setStyle({ weight: 2.2, color: "#1f2a37" });
      if (layer.bringToFront) layer.bringToFront();
      if (!estado.indicador || estado.forma !== "coropleta") { layer.bindTooltip(feature.properties.nombre, { sticky: true, className: "tooltip-poligono" }).openTooltip(); return; }
      const d = datosTematicos()[claveDe(feature.properties)];
      const def = estado.indicador === "_eventos" ? { unidad: "eventos" } : estado.indicadores.definiciones.find(x => x.id === estado.indicador);
      layer.bindTooltip(d ? etiquetaValor(feature.properties.nombre, d, def.unidad) : `<strong>${feature.properties.nombre}</strong><br>sin dato`, { sticky: true }).openTooltip();
    });
    layer.on("mouseout", () => capaPoligonos.resetStyle(layer));
    layer.on("click", () => { clicEnCapa = true; navegar(() => mostrarDetallePoligono(feature.properties), true); });
  }

  function etiquetaValor(nombre, d, unidad) {
    if (typeof d.valor === "string") {
      const def = estado.indicadores.definiciones.find(x => x.id === estado.indicador);
      return `<strong>${nombre}</strong><br>${def && def.categorias ? def.categorias[d.valor] : d.valor}`;
    }
    return `<strong>${nombre}</strong><br>${d.valor.toLocaleString("es-MX")} ${unidad} (${d.periodo})${d.ejemplo ? "<br><em>dato de ejemplo</em>" : ""}`;
  }

  function mostrarDetallePoligono(p) {
    const nivel = mapaActual().nivel;
    const feat = estado.geos[estado.mapaId].features.find(f => claveDe(f.properties) === claveDe(p));
    // Only numeric values of the active theme, inside the selected period, newest first
    const defs = Object.fromEntries(estado.indicadores.definiciones.map(d => [d.id, d]));
    const vals = estado.indicadores.valores
      .filter(v => nivel === "municipio" ? v.cve_ent === p.cve_ent && v.cve_mun === p.cve_mun : v.cve_ent === p.cve_ent && !v.cve_mun)
      .filter(v => typeof v.valor === "number" && defs[v.indicador] && !defs[v.indicador].oculto && temaActivo(defs[v.indicador].tema)
        && (defs[v.indicador].tema !== "periodistas" || (grupoActivo(defs[v.indicador].grupo) && subtemaActivo(defs[v.indicador].subtema, false))) && valorEnRango(v, defs[v.indicador]))
      .sort((x, y) => x.indicador.localeCompare(y.indicador) || String(y.periodo).localeCompare(String(x.periodo)));
    const filas = vals.map(v => {
      const d = defs[v.indicador];
      return `<li><span class="detalle__tema" style="--tema:${CONFIG.temas[d.tema].color}">${CONFIG.temas[d.tema].nombre}</span><br>${d.nombre}: <strong>${v.valor.toLocaleString("es-MX")}</strong> ${d.unidad} (${v.periodo})${v.ejemplo ? " <span class='badge badge--ejemplo'>ejemplo</span>" : ""}</li>`;
    }).join("");
    const anioActual = new Date().getFullYear();
    const paisP = paisDeCve(p.cve_ent), esHN = paisP !== "MX";
    const cen = estado.poblacion[esHN ? CONFIG.paises[paisP].censos : "datos/poblacion/censos.json"];
    let htmlPob = "";
    // Population shows in the detail even though the theme itself is hidden from the menus
    if (cen) {
      const filas = (nivel === "municipio" ? cen.municipios[p.cve_ent + p.cve_mun] : cen.entidades[p.cve_ent]);
      const est = esHN ? null : poblacionDe(p.cve_ent, nivel === "municipio" ? p.cve_mun : null, anioActual);
      if (filas) {
        let ultimo = -1;
        cen.periodos.forEach((per, i) => { if (filas[i]) ultimo = i; });
        htmlPob = `<h4 class="detalle__sub">Población</h4>
          <p class="detalle__meta">${ultimo >= 0 ? `Censo ${cen.periodos[ultimo]} (${esHN ? CONFIG.paises[paisP].estadistica : "INEGI"}): ${fmt(filas[ultimo][0])}` : ""}${est && est.fuente === "CONAPO" ? ` · Estimación ${est.periodo} (CONAPO): ${fmt(est.valor)}` : ""}</p>`;
      }
    }
    const marco = nivel === "municipio" || !temaActivo("periodistas") ? null : marcoDe(p.cve_ent);
    const instrumentosEstado = marco && estado.comparativo ? estado.comparativo.instrumentos
      .filter(i => i.cve_ent === p.cve_ent || (paisDeCve(p.cve_ent) !== "MX" && i.pais === paisDeCve(p.cve_ent))).map(i => i.id) : [];
    const codificado = instrumentosEstado.length > 0;
    let htmlMarco = "";
    if (marco) {
      const cat = marco.categoriaNombre || estado.marcoLegal.categorias[marco.categoria];
      const items = marco.instrumentos.map(i => {
        const nombre = i.url ? `<a href="${i.url}" target="_blank" rel="noopener">${i.nombre}</a>` : i.nombre;
        const meta = [i.tipo, i.anio, i.organo].filter(Boolean).join(" · ");
        return `<li>${nombre}<br><small>${meta}${i.nota ? ". " + i.nota : ""}</small></li>`;
      }).join("");
      htmlMarco = `<p class="detalle__meta"><span class="leyenda__caja leyenda__caja--inline" style="background:${marco.color || (estado.indicador === "per_marco_legal" && estado.coloresCategoria ? estado.coloresCategoria : CONFIG.marcoLegalColores)[marco.categoria]}"></span>${cat}</p>
        ${items ? `<ul class="lista lista--marco">${items}</ul>` : ""}
        ${marco.nota ? `<p class="nota">${marco.nota}</p>` : ""}
        ${codificado ? `<p><button type="button" class="enlace" id="detalle-comparativo">Ver comparativo con la ley federal</button></p>` : marco.instrumentos.length ? `<p class="nota">Este instrumento aún no está codificado en el comparativo.</p>` : ""}`;
    }
    const dentroPol = estado.eventos.filter(eventoVisible).filter(e => dentro([e.lon, e.lat], feat.geometry))
      .sort((x, y) => y.fecha.localeCompare(x.fecha));
    const nEv = dentroPol.length;
    const itemEv = e => {
      const f = estado.fuentes.find(x => x.id === e.fuente);
      return `<li class="fila-ev"><div class="fila-ev__cab"><span class="fila-ev__titulo">${e.titulo}</span><button type="button" class="cmp__mas fila-ev__mas" aria-expanded="false" title="Ver detalle">+</button></div>
        <small>${formatoFecha(e.fecha)} · ${e.lugar}</small>
        <div class="fila-ev__detalle" hidden><p>${e.descripcion}</p><p><span class="badge badge--${clase(e.verificacion)}">${e.verificacion}</span> <span class="nota">Fuente: ${f ? f.nombre : e.fuente}</span></p>
          <p>${e.url ? `<a href="${e.url}" target="_blank" rel="noopener">Ver fuente original</a> · ` : ""}<button type="button" class="enlace" data-ev="${e.id}">Abrir ficha</button></p></div></li>`;
    };
    const htmlEv = nEv ? `<h4 class="detalle__sub">Eventos (${nEv})</h4><ul class="lista lista--eventos">${dentroPol.slice(0, 3).map(itemEv).join("")}</ul>
      ${nEv > 3 ? `<ul class="lista lista--eventos" id="eventos-mas" hidden>${dentroPol.slice(3).map(itemEv).join("")}</ul><p><button type="button" class="enlace" id="ver-mas-eventos" data-n="${nEv - 3}">+ ${nEv - 3} más</button></p>` : ""}` : "";
    const clave = nivel === "municipio" ? `Clave INEGI ${p.cve_ent}${p.cve_mun} · ${mapaActual().nombre}` : `Clave INEGI ${p.cve_ent}`;
    const tabEventos = `
      <p class="detalle__meta">${clave} · ${nEv} eventos con los filtros actuales</p>
      ${nivel === "entidad" ? `<p class="acciones"><button type="button" class="boton" id="detalle-municipios">Ver municipios de ${p.nombre}</button></p>` : ""}
      ${htmlEv}
      ${filas ? `<h4 class="detalle__sub">Indicadores</h4><ul class="lista lista--detalle">${filas}</ul>` : `<p class='nota'>Sin indicadores numéricos para esta unidad con los filtros actuales.</p>`}
      ${htmlPob}`;
    const conMarco = !!htmlMarco;
    abrirVentana(p.nombre, `
      ${conMarco ? `<div class="pestanas" role="tablist">
        <button type="button" class="pestana" data-p="eventos" aria-selected="true">Eventos e indicadores</button>
        <button type="button" class="pestana" data-p="marco" aria-selected="false">Marco legal</button>
      </div>` : ""}
      <section class="panel-p" data-p="eventos">${tabEventos}</section>
      ${conMarco ? `<section class="panel-p" data-p="marco" hidden>${htmlMarco}</section>` : ""}`);
    document.querySelectorAll("#ventana-cuerpo .pestana").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll("#ventana-cuerpo .pestana").forEach(x => x.setAttribute("aria-selected", String(x === b)));
      document.querySelectorAll("#ventana-cuerpo .panel-p").forEach(s => s.hidden = s.dataset.p !== b.dataset.p);
    }));
    const btn = document.getElementById("detalle-comparativo");
    if (btn) btn.addEventListener("click", () => navegar(() => mostrarComparativo(["federal", ...instrumentosEstado])));
    const mas = document.getElementById("ver-mas-eventos");
    if (mas) mas.addEventListener("click", () => {
      const lista = document.getElementById("eventos-mas"); lista.hidden = !lista.hidden;
      mas.textContent = lista.hidden ? `+ ${mas.dataset.n} más` : "– Mostrar menos";
    });
    document.querySelectorAll("#ventana-cuerpo [data-ev]").forEach(b => b.addEventListener("click", () => {
      const e = estado.eventos.find(x => x.id === b.dataset.ev); if (e) navegar(() => mostrarDetalleEvento(e));
    }));
    document.querySelectorAll("#ventana-cuerpo .fila-ev__mas").forEach(b => b.addEventListener("click", () => {
      const abierto = b.getAttribute("aria-expanded") === "true";
      b.setAttribute("aria-expanded", String(!abierto)); b.textContent = abierto ? "+" : "–";
      b.closest("li").querySelector(".fila-ev__detalle").hidden = abierto;
    }));
    const btnMun = document.getElementById("detalle-municipios");
    if (btnMun) btnMun.addEventListener("click", () => { estado.estadoCve = p.cve_ent; cambiarMapa(p.cve_ent); });
  }

  function mostrarDetalleEvento(e) {
    const f = estado.fuentes.find(x => x.id === e.fuente);
    const link = e.url ? `<p><a href="${e.url}" target="_blank" rel="noopener">Ver fuente original</a></p>` : "";
    // Other records that name any of the same people
    const nombres = (e.persona || "").split(";").map(x => x.trim()).filter(Boolean);
    const clave = s => normalizar(s).replace(/\s+/g, " ").trim();
    const claves = new Set(nombres.map(clave));
    const otros = claves.size ? estado.eventos.filter(x => x.id !== e.id && (x.persona || "").split(";").some(n => claves.has(clave(n))))
      .sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];
    const htmlPersona = nombres.length ? `<p class="detalle__meta">${nombres.length > 1 ? "Personas" : "Persona"}: ${nombres.join(", ")}</p>` : "";
    const htmlOtros = otros.length ? `<h4 class="detalle__sub">Otros registros de la misma persona (${otros.length})</h4>
      <ul class="lista lista--eventos">${otros.map(x => `<li class="fila-ev"><button type="button" class="enlace" data-otro="${x.id}">${x.titulo}</button><br><small>${formatoFecha(x.fecha)} · ${x.lugar}</small></li>`).join("")}</ul>` : "";
    const labor = e.labor && CONFIG.labores[e.labor] ? `<p class="detalle__meta">Labor: ${CONFIG.labores[e.labor]}${e.genero && e.genero !== "no aplica" ? " · Género: " + (CONFIG.generos[e.genero] || e.genero) : ""}</p>` : "";
    abrirVentana(e.titulo, `
      <p class="detalle__tema" style="--tema:${CONFIG.temas[e.tema].color}">${CONFIG.temas[e.tema].nombre} · ${e.tipo}</p>
      <p class="detalle__meta">${formatoFecha(e.fecha)} · ${e.lugar}</p>
      ${htmlPersona}
      ${labor}
      <p>${e.descripcion}</p>
      <p><span class="badge badge--${clase(e.verificacion)}">${e.verificacion}</span>
         ${e.ejemplo ? '<span class="badge badge--ejemplo">ejemplo</span>' : ""}</p>
      <p class="nota">Fuente: ${f ? f.nombre : e.fuente}</p>${link}
      ${htmlOtros}`);
    document.querySelectorAll("#ventana-cuerpo [data-otro]").forEach(b => b.addEventListener("click", () => {
      const x = estado.eventos.find(y => y.id === b.dataset.otro); if (x) navegar(() => mostrarDetalleEvento(x));
    }));
  }

  function dentroDeEstado(e) {
    const f = geoNacional() && geoNacional().features.find(x => x.properties.cve_ent === estado.mapaId);
    return f ? dentro([e.lon, e.lat], f.geometry) : true;
  }

  // ---------- geometry helpers ----------

  // Ray casting point-in-polygon for Polygon and MultiPolygon geometries
  function dentro(pt, geom) {
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    return polys.some(rings => enAnillo(pt, rings[0]) && !rings.slice(1).some(h => enAnillo(pt, h)));
  }
  function enAnillo(pt, anillo) {
    let dentroFlag = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      const cruza = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
      if (cruza) dentroFlag = !dentroFlag;
    }
    return dentroFlag;
  }

  // ---------- misc helpers ----------

  function clase(v) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"); }
  // Lowercase without accents, for searching
  function normalizar(s) { return String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function fmt(n) { return n.toLocaleString("es-MX"); }
  function nombreFuente(id) { const f = estado.fuentes.find(x => x.id === id); return f ? f.nombre : id; }
  function formatoFecha(iso) {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
  }
})();
