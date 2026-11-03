// Notes, corrections and comments: builds a prefilled GitHub issue that the person submits with their own account.
// No token or backend; app.js hands over abrirVentana, the current country, the sources and a description of the view.
const Reportar = (() => {
  const LIMITE_URL = 7500;    // GitHub rejects longer issue URLs
  const LIMITE_CORREO = 1800; // mail clients truncate long mailto links
  const CLAVE_BORRADOR = "observatorio_borrador_reporte";

  const TIPOS = {
    nota: { nombre: "Agregar una nota", plantilla: "nota.yml", prefijo: "[Nota] ", conVista: false,
      ayuda: "Una nota periodística o noticia sobre agresiones, asesinatos o desapariciones de periodistas o personas defensoras. Queda como issue en el repositorio para pasarla después a la base de datos." },
    correccion: { nombre: "Corregir un dato", plantilla: "correccion.yml", prefijo: "[Corrección] ", conVista: true,
      ayuda: "Un registro, una cifra, una fuente, una ubicación o un instrumento legal que está mal o desactualizado." },
    comentario: { nombre: "Comentario", plantilla: "comentario.yml", prefijo: "[Comentario] ", conVista: true,
      ayuda: "Ideas, dudas sobre la metodología, problemas para usar el sitio o propuestas de indicadores." }
  };
  // Closed vocabulary of docs/plan_busqueda_prensa.md with the subtema each one counts under
  const QUE_PASO = [
    ["asesinato", "Asesinato", "asesinato"], ["desaparición", "Desaparición", "desaparicion"],
    ["tentativa de asesinato", "Tentativa de asesinato", "agresion"], ["agresión física", "Agresión física", "agresion"],
    ["agresión por autoridad", "Agresión por autoridad", "agresion"], ["amenaza", "Amenaza", "amenaza"],
    ["intimidación", "Intimidación", "amenaza"], ["hostigamiento digital", "Hostigamiento digital", "amenaza"],
    ["acoso judicial", "Acoso judicial", "acoso_judicial"], ["detención arbitraria", "Detención arbitraria", "acoso_judicial"],
    ["ataque a medio", "Ataque a medio", "ataque_medio"], ["ataque a domicilio u oficina", "Ataque a domicilio u oficina", "ataque_medio"],
    ["desplazamiento por la labor", "Desplazamiento por la labor", ""], ["medidas de protección", "Medidas de protección", ""],
    ["otro", "Otro (explicar en el resumen)", ""]
  ];
  const GRUPOS = [["periodista", "Periodista"], ["defensor", "Persona defensora"], ["ambos", "Ambos"], ["?", "No se sabe"]];
  const VERIF = [["prensa", "Prensa"], ["organización", "Organización civil"], ["oficial", "Fuente oficial"]];
  const MEDIDAS = [["sí", "Sí"], ["no", "No"], ["no se sabe", "No se sabe"]];
  const AUTORIA = [["agente estatal", "Agente estatal"], ["particular", "Particular"], ["grupo criminal", "Grupo criminal"], ["desconocida", "Desconocida"]];
  const TEMAS_COMENTARIO = ["Metodología", "Un indicador", "Marco legal y comparativo", "Uso del mapa", "Datos y descargas", "Otro"].map(x => [x, x]);
  // Fields of the note that start empty again when a new note begins (the country stays)
  const CAMPOS_NOTA = ["enlace", "titular", "medio", "fecha", "lugar", "grupo", "tipo", "persona", "genero", "labor", "medidas", "autoria", "verificacion", "resumen"];

  let borrador = leerBorrador();
  let ctx = null;
  let avisoDatosVisto = false;

  function leerBorrador() {
    try { const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR)); if (b && TIPOS[b.tipo]) return b; } catch (e) { /* storage unavailable */ }
    return { tipo: "nota", campos: {}, adjuntarVista: true };
  }
  function guardarBorrador() { try { localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador)); } catch (e) { /* storage unavailable */ } }

  function repo() { return (CONFIG.reportes && CONFIG.reportes.repositorio) || ""; }
  function correo() { return (CONFIG.reportes && CONFIG.reportes.correo) || ""; }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function etiqueta(opciones, v) { const o = opciones.find(x => x[0] === v); return o ? o[1] : v || ""; }

  // opciones: { tipo, registro, campos } to open on a given type with some fields already filled in
  function abrir(contexto, opciones = {}) {
    ctx = contexto;
    if (opciones.tipo && TIPOS[opciones.tipo]) borrador.tipo = opciones.tipo;
    if (opciones.registro) borrador.campos.registro = opciones.registro;
    if (opciones.campos) {
      // A shared link that differs from the draft's starts a new note
      if (opciones.campos.enlace && opciones.campos.enlace !== borrador.campos.enlace) limpiarNota();
      Object.assign(borrador.campos, opciones.campos);
      completarDesdeEnlace();
    }
    if (!borrador.campos.pais) borrador.campos.pais = ctx.pais;
    guardarBorrador();
    avisoDatosVisto = false;
    render();
  }

  function limpiarNota() { CAMPOS_NOTA.forEach(k => delete borrador.campos[k]); }

  // Source id from the link's domain, and the outlet name and source type that go with it
  function fuenteDeEnlace(url) {
    let host = "";
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return null; }
    const mapa = (CONFIG.reportes && CONFIG.reportes.dominiosFuente) || {};
    const dom = Object.keys(mapa).find(d => host === d || host.endsWith("." + d));
    const id = dom && mapa[dom];
    return id ? (ctx.fuentes || []).find(f => f.id === id) || { id, nombre: "", tipo: "" } : null;
  }
  function completarDesdeEnlace() {
    const c = borrador.campos, f = fuenteDeEnlace(c.enlace || "");
    if (!f) return;
    if (!c.medio && f.nombre) c.medio = f.nombre;
    if (!c.verificacion) c.verificacion = f.tipo === "organizacion" ? "organización" : f.tipo === "oficial" ? "oficial" : "prensa";
  }

  // ---------- form ----------

  function campo(id, etiq, html, ayuda) {
    return `<label class="campo reporte__campo" for="rep-${id}"><span>${etiq}</span>${html}${ayuda ? `<small class="nota">${ayuda}</small>` : ""}</label>`;
  }
  function texto(id, etiq, { requerido, placeholder, ayuda, tipo = "text", max = 300 } = {}) {
    return campo(id, etiq + (requerido ? " *" : ""),
      `<input class="reporte__entrada" type="${tipo}" id="rep-${id}" data-campo="${id}" value="${esc(borrador.campos[id] || "")}" maxlength="${max}" ${requerido ? "required" : ""} placeholder="${esc(placeholder || "")}">`, ayuda);
  }
  function area(id, etiq, { requerido, placeholder, ayuda, max = 4000 } = {}) {
    return campo(id, etiq + (requerido ? " *" : ""),
      `<textarea class="reporte__entrada" id="rep-${id}" data-campo="${id}" rows="4" maxlength="${max}" ${requerido ? "required" : ""} placeholder="${esc(placeholder || "")}">${esc(borrador.campos[id] || "")}</textarea>`, ayuda);
  }
  function lista(id, etiq, opciones, { requerido, vacio = "Elige una opción" } = {}) {
    const v = borrador.campos[id] || "";
    return campo(id, etiq + (requerido ? " *" : ""),
      `<select class="reporte__entrada" id="rep-${id}" data-campo="${id}" ${requerido ? "required" : ""}><option value="">${vacio}</option>${opciones.map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
  }

  function opcionesPais() { return Object.entries(CONFIG.paises).map(([k, p]) => [k, p.nombre]); }

  function camposDelTipo(tipo) {
    if (tipo === "nota") return `
      <label class="campo reporte__campo" for="rep-enlace"><span>Enlace a la nota *</span>
        <span class="reporte__con-boton"><input class="reporte__entrada" type="url" id="rep-enlace" data-campo="enlace" value="${esc(borrador.campos.enlace || "")}" maxlength="1000" required placeholder="https://..." inputmode="url" autocomplete="off"><button type="button" class="boton" id="rep-pegar">Pegar</button></span>
      </label>
      <div class="reporte__fila">
        ${texto("fecha", "Fecha del hecho", { requerido: true, tipo: "date", max: 10 })}
        ${lista("pais", "País", opcionesPais(), { requerido: true })}
      </div>
      <div class="reporte__fila">
        ${lista("grupo", "Grupo", GRUPOS, { requerido: true })}
        ${lista("tipo", "Qué pasó", QUE_PASO.map(([k, l]) => [k, l]), { requerido: true })}
      </div>
      ${texto("lugar", "Lugar", { placeholder: "Municipio y estado o departamento" })}
      ${texto("persona", "Persona afectada", { ayuda: "Solo si la nota la nombra y es una persona asesinada, desaparecida o que hizo público su caso." })}
      ${area("resumen", "Resumen", { max: 1500, ayuda: "Qué pasó según la nota y quién da la versión. Puede quedar vacío si vas con prisa." })}
      <details class="reporte__mas"${["titular", "medio", "genero", "labor", "medidas", "autoria"].some(k => borrador.campos[k]) ? " open" : ""}>
        <summary>Más datos (opcional)</summary>
        ${texto("titular", "Titular de la nota")}
        <div class="reporte__fila">
          ${texto("medio", "Medio", { ayuda: "Se llena solo con los medios del catálogo de fuentes." })}
          ${lista("verificacion", "Tipo de fuente", VERIF, { vacio: "Prensa" })}
        </div>
        <div class="reporte__fila">
          ${lista("genero", "Género", Object.entries(CONFIG.generos).concat([["no determinado", "No determinado"]]), { vacio: "Sin dato" })}
          ${lista("labor", "Labor de la persona defensora", Object.entries(CONFIG.labores), { vacio: "Sin dato" })}
        </div>
        <div class="reporte__fila">
          ${lista("medidas", "Tenía medidas de protección", MEDIDAS, { vacio: "Sin dato" })}
          ${lista("autoria", "Presunta autoría", AUTORIA, { vacio: "Sin dato" })}
        </div>
      </details>`;
    if (tipo === "correccion") return `
      ${texto("titulo", "Título breve", { requerido: true, placeholder: "Ej. Fecha equivocada en el asesinato de ..." })}
      ${texto("registro", "Registro o dato", { requerido: true, placeholder: "Ej. ev-009, indicador de beneficiarios, Sinaloa", ayuda: "Si abriste este formulario desde una ficha, ya viene escrito." })}
      ${area("problema", "Qué está mal", { requerido: true })}
      ${area("correccion", "Dato correcto", { ayuda: "Cómo debería quedar, si lo sabes." })}
      ${texto("fuente", "Fuente que respalda la corrección", { requerido: true, placeholder: "https://...", ayuda: "Enlace a la nota, informe o documento oficial. Si es un error de captura, escribe \"error de captura\"." })}`;
    return `
      ${texto("titulo", "Título breve", { requerido: true })}
      ${lista("tema", "Sobre qué", TEMAS_COMENTARIO, { requerido: true })}
      ${area("comentario", "Comentario", { requerido: true })}`;
  }

  function render() {
    const t = TIPOS[borrador.tipo];
    const privado = correo()
      ? ` Si la información no debe ser pública, escribe a <a href="mailto:${esc(correo())}">${esc(correo())}</a>.`
      : " Si la información no debe ser pública, no la envíes por este medio.";
    const aviso = borrador.tipo === "nota"
      ? `<strong>Lo que envíes por GitHub queda publicado.</strong> Solo se registran hechos ya publicados. No incluyas domicilios, teléfonos ni datos que permitan localizar a personas en riesgo.${privado}`
      : `<strong>Lo que envíes por GitHub queda publicado.</strong> No incluyas nombres, domicilios, teléfonos ni datos de personas que no hayan sido publicados por ellas mismas o por una fuente.${privado}`;
    ctx.abrirVentana("Notas, correcciones y comentarios", `
      <div class="reporte">
        <div class="segmentos reporte__tipos" role="group" aria-label="Tipo de envío">
          ${Object.entries(TIPOS).map(([k, x]) => `<button type="button" data-tipo="${k}" aria-pressed="${k === borrador.tipo}">${x.nombre}</button>`).join("")}
        </div>
        <p class="nota">${t.ayuda}</p>
        <div class="reporte__aviso" role="note">${aviso}</div>
        <form id="rep-form" novalidate>
          ${camposDelTipo(borrador.tipo)}
          ${t.conVista ? `
          <label class="campo--inline reporte__adjuntar"><input type="checkbox" id="rep-vista" ${borrador.adjuntarVista ? "checked" : ""}> Adjuntar la vista del mapa que estaba viendo</label>
          <details class="reporte__vista"><summary>Qué se adjunta</summary><pre>${esc(ctx.vista())}</pre></details>` : ""}
          <p class="reporte__error" id="rep-error" role="alert" hidden></p>
          <div class="reporte__listo" id="rep-listo" hidden>
            <p>Se abrió GitHub en otra pestaña. Revisa, marca las casillas finales y pulsa "Create" (o "Submit new issue").</p>
            <button type="button" class="boton" id="rep-otra">${borrador.tipo === "nota" ? "Capturar otra nota" : "Empezar de nuevo"}</button>
          </div>
          <div class="acciones">
            <button type="submit" class="boton boton--principal" id="rep-github">Continuar en GitHub</button>
            <button type="button" class="boton" id="rep-copiar">Copiar texto</button>
            ${correo() ? `<button type="button" class="boton" id="rep-correo">Enviar por correo</button>` : ""}
          </div>
        </form>
        <p class="nota">Para publicar en el repositorio necesitas una cuenta de GitHub, que es gratuita. Se abre el formulario ya lleno y solo falta enviarlo; así cada registro queda con autor. Sin cuenta, usa "Enviar por correo" o "Copiar texto". Lo que escribes se guarda en este navegador hasta que empieces otro.</p>
        <p class="nota"><a href="https://github.com/${repo()}/issues" target="_blank" rel="noopener">Ver notas y comentarios recibidos</a></p>
      </div>`, "ventana--documento");
    conectar();
  }

  function conectar() {
    const cuerpo = document.getElementById("ventana-cuerpo");
    cuerpo.querySelectorAll(".reporte__tipos button").forEach(b => b.addEventListener("click", () => {
      guardar(); borrador.tipo = b.dataset.tipo; guardarBorrador(); avisoDatosVisto = false; render();
    }));
    cuerpo.querySelectorAll("[data-campo]").forEach(i => {
      i.addEventListener("input", () => { guardar(); avisoDatosVisto = false; ocultarError(); });
      i.addEventListener("change", () => { guardar(); if (i.dataset.campo === "enlace") alCambiarEnlace(); });
    });
    const vista = document.getElementById("rep-vista");
    if (vista) vista.addEventListener("change", () => { borrador.adjuntarVista = vista.checked; guardarBorrador(); });
    const pegar = document.getElementById("rep-pegar");
    if (pegar) pegar.addEventListener("click", async () => {
      const entrada = document.getElementById("rep-enlace");
      try {
        const t = await navigator.clipboard.readText();
        const url = extraerEnlace(t);
        if (url) { entrada.value = url; guardar(); alCambiarEnlace(); } else entrada.focus();
      } catch (e) { entrada.focus(); }
    });
    document.getElementById("rep-form").addEventListener("submit", ev => { ev.preventDefault(); enviar("github"); });
    document.getElementById("rep-copiar").addEventListener("click", () => enviar("copiar"));
    const c = document.getElementById("rep-correo");
    if (c) c.addEventListener("click", () => enviar("correo"));
    document.getElementById("rep-otra").addEventListener("click", () => {
      if (borrador.tipo === "nota") limpiarNota();
      else Object.keys(borrador.campos).forEach(k => { if (!CAMPOS_NOTA.includes(k) && k !== "pais") delete borrador.campos[k]; });
      guardarBorrador(); render();
      const primero = document.querySelector("#rep-form [data-campo]"); if (primero) primero.focus();
    });
  }

  // Fill in the outlet and source type from the link without overwriting what was typed
  function alCambiarEnlace() {
    const antes = { medio: borrador.campos.medio, verificacion: borrador.campos.verificacion };
    completarDesdeEnlace();
    ["medio", "verificacion"].forEach(k => {
      const el = document.getElementById("rep-" + k);
      if (el && borrador.campos[k] !== antes[k]) el.value = borrador.campos[k];
    });
    guardarBorrador();
  }

  function extraerEnlace(t) { const m = String(t || "").match(/https?:\/\/[^\s<>"']+/); return m ? m[0] : ""; }

  function guardar() {
    document.querySelectorAll("#ventana-cuerpo [data-campo]").forEach(i => { borrador.campos[i.dataset.campo] = i.value; });
    guardarBorrador();
  }
  function mostrarError(msg) { const e = document.getElementById("rep-error"); e.innerHTML = msg; e.hidden = false; }
  function ocultarError() { const e = document.getElementById("rep-error"); if (e) e.hidden = true; }

  // Emails and long digit runs (phones, IDs) are a sign of private data
  function pareceDatoPersonal(s) {
    return /[\w.+-]+@[\w-]+\.[\w.]+/.test(s) || /(?:\d[\s().-]?){8,}/.test(s.replace(/https?:\/\/\S+/g, ""));
  }

  function validar() {
    const faltan = [...document.querySelectorAll("#rep-form [required]")].filter(i => !i.value.trim());
    if (faltan.length) { faltan[0].focus(); return "Faltan campos obligatorios, marcados con *."; }
    if (borrador.tipo === "nota" && !/^https?:\/\/\S+\.\S+/.test((borrador.campos.enlace || "").trim()))
      return "El enlace a la nota tiene que empezar con http:// o https://.";
    return "";
  }

  // ---------- what gets sent ----------

  // Specific wording of the closed vocabulary, e.g. "asesinato de persona defensora ambiental"
  function tipoTexto() {
    const c = borrador.campos, t = c.tipo || "";
    if (t !== "asesinato" && t !== "desaparición") return t;
    if (c.grupo === "periodista") return `${t} de periodista`;
    if (c.grupo !== "defensor") return t;
    if (t === "asesinato" && c.labor === "busqueda") return "asesinato de persona buscadora";
    if (t === "asesinato" && c.labor === "ambiental") return "asesinato de persona defensora ambiental";
    return `${t} de persona defensora`;
  }
  function mayuscula(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function paisNombre(k) { return CONFIG.paises[k] ? CONFIG.paises[k].nombre : k || ""; }

  function tituloNota() {
    const c = borrador.campos;
    return (c.titular || "").trim() || [mayuscula(tipoTexto()), (c.persona || "").trim(), (c.lugar || "").trim() || paisNombre(c.pais)].filter(Boolean).join(", ");
  }
  function titulo() {
    const t = TIPOS[borrador.tipo];
    if (borrador.tipo === "nota") return t.prefijo + tituloNota() + (borrador.campos.fecha ? `, ${borrador.campos.fecha}` : "");
    return t.prefijo + (borrador.campos.titulo || "").trim();
  }

  // Row of plantillas/eventos.xlsx from column B (pais) on, tab-separated; id stays empty so the script assigns it
  function filaExcel(corte) {
    const c = borrador.campos, f = fuenteDeEnlace(c.enlace || "");
    const sub = (QUE_PASO.find(x => x[0] === c.tipo) || [])[2] || "";
    const extra = [
      c.medidas && `Medidas de protección: ${c.medidas}.`,
      c.autoria && `Presunta autoría: ${c.autoria}.`,
      !f && c.medio && `Medio: ${c.medio}.`
    ].filter(Boolean).join(" ");
    let resumen = (c.resumen || "").trim();
    if (resumen && !/[.!?]$/.test(resumen)) resumen += ".";
    const desc = corte([resumen, extra].filter(Boolean).join(" "));
    const fila = [c.pais || "", c.persona || "", "periodistas", c.grupo === "?" ? "" : c.grupo || "", sub, c.genero || "", c.labor || "",
      tipoTexto(), c.fecha || "", "", "", c.lugar || "", tituloNota(), desc, f ? f.id : "", (c.enlace || "").trim(), c.verificacion || "prensa", "no"];
    return fila.map(v => String(v).replace(/[\t\r\n]+/g, " ").trim()).join("\t");
  }

  const ETIQUETAS = {
    enlace: "Enlace a la nota", titular: "Titular", medio: "Medio", fecha: "Fecha del hecho", pais: "País", lugar: "Lugar", grupo: "Grupo",
    tipo: "Qué pasó", persona: "Persona afectada", genero: "Género", labor: "Labor de la persona defensora", medidas: "Tenía medidas de protección",
    autoria: "Presunta autoría", verificacion: "Tipo de fuente", resumen: "Resumen", fila: "Fila para eventos.xlsx",
    registro: "Registro o dato", problema: "Qué está mal", correccion: "Dato correcto", fuente: "Fuente", tema: "Sobre qué", comentario: "Comentario", contexto: "Vista del mapa"
  };

  // Pairs [field id, text] in the same order and with the same ids as the issue forms; corte shortens long free text
  function camposEnvio(corte = s => s, conFila = true) {
    const c = borrador.campos, t = TIPOS[borrador.tipo];
    const v = k => (c[k] || "").trim();
    let campos;
    if (borrador.tipo === "nota") {
      campos = [
        ["enlace", v("enlace")], ["titular", v("titular")], ["medio", v("medio")], ["fecha", v("fecha")], ["pais", paisNombre(c.pais)],
        ["lugar", v("lugar")], ["grupo", etiqueta(GRUPOS, c.grupo)], ["tipo", tipoTexto()], ["persona", v("persona")],
        ["genero", c.genero ? (CONFIG.generos[c.genero] || c.genero) : ""], ["labor", c.labor ? CONFIG.labores[c.labor] || c.labor : ""],
        ["medidas", c.medidas || ""], ["autoria", c.autoria || ""], ["verificacion", etiqueta(VERIF, c.verificacion || "prensa")],
        ["resumen", corte(v("resumen"))]
      ];
      if (conFila) campos.push(["fila", filaExcel(corte)]);
    } else {
      const ids = { correccion: ["registro", "problema", "correccion", "fuente"], comentario: ["tema", "comentario"] }[borrador.tipo];
      campos = ids.map(id => [id, ["problema", "correccion", "comentario"].includes(id) ? corte(v(id)) : v(id)]);
    }
    if (t.conVista && borrador.adjuntarVista) campos.push(["contexto", ctx.vista()]);
    return campos;
  }

  function urlGitHub() {
    const armar = cs => {
      const p = new URLSearchParams({ template: TIPOS[borrador.tipo].plantilla, title: titulo() });
      cs.forEach(([k, val]) => { if (val) p.set(k, val); });
      // Fallback body: GitHub ignores it when the issue form exists and shows it when the form is missing
      p.set("body", cs.filter(([, val]) => val).map(([k, val]) => `### ${ETIQUETAS[k]}\n\n${val}`).join("\n\n"));
      return `https://github.com/${repo()}/issues/new?${p.toString()}`;
    };
    // Shorter and shorter free text, then without the map view, then without the Excel row
    const cortes = [Infinity, 1500, 800, 400, 200].map(n => s => (s.length > n ? s.slice(0, n) + " [...]" : s));
    for (const sinVista of [false, true]) {
      for (const corte of cortes) {
        const cs = camposEnvio(corte).filter(([k]) => !(sinVista && k === "contexto"));
        const url = armar(cs);
        if (url.length <= LIMITE_URL) return { url, recortado: corte !== cortes[0] || sinVista };
      }
    }
    return { url: armar(camposEnvio(cortes[cortes.length - 1], false).filter(([k]) => k !== "contexto")), recortado: true };
  }

  function textoPlano() {
    const campos = camposEnvio();
    return `${titulo()}\n\n` + campos.filter(([, v]) => v).map(([k, v]) => `### ${ETIQUETAS[k]}\n\n${v}`).join("\n\n") + "\n";
  }

  async function enviar(modo) {
    guardar();
    const error = validar();
    if (error) { mostrarError(esc(error)); return; }
    const libre = Object.entries(borrador.campos).filter(([k]) => !["enlace", "fuente", "fecha"].includes(k)).map(([, v]) => v).join(" ");
    if (modo !== "correo" && !avisoDatosVisto && pareceDatoPersonal(libre)) {
      avisoDatosVisto = true;
      mostrarError("El texto parece incluir un correo o un número de teléfono. Si no es un dato público, bórralo antes de continuar. Si lo es, vuelve a pulsar el botón.");
      return;
    }
    ocultarError();
    if (modo === "github") {
      const { url, recortado } = urlGitHub();
      window.open(url, "_blank", "noopener");
      document.getElementById("rep-listo").hidden = false;
      if (recortado) mostrarError("El texto era muy largo y se recortó para abrirlo en GitHub. Usa \"Copiar texto\" si necesitas pegarlo completo.");
      return;
    }
    const plano = textoPlano();
    if (modo === "correo") {
      const cuerpo = plano.length > LIMITE_CORREO ? plano.slice(0, LIMITE_CORREO) + "\n[...]" : plano;
      location.href = `mailto:${correo()}?subject=${encodeURIComponent(titulo())}&body=${encodeURIComponent(cuerpo)}`;
      return;
    }
    try {
      await navigator.clipboard.writeText(plano);
      const b = document.getElementById("rep-copiar");
      b.textContent = "Copiado"; setTimeout(() => { b.textContent = "Copiar texto"; }, 2000);
    } catch (e) {
      mostrarError("El navegador no permitió copiar. Selecciona el texto de abajo y cópialo a mano.");
      document.getElementById("rep-error").insertAdjacentHTML("afterend", `<pre class="reporte__plano">${esc(plano)}</pre>`);
    }
  }

  return { abrir, extraerEnlace };
})();
