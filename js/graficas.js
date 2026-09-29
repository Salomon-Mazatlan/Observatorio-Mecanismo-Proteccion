// Charts (event timeline, indicator bars and series) and filtered-data downloads.
// Chart.js is loaded on demand from cdnjs; app.js hands over a context with the filtered data.
const Graficas = (() => {
  const CHARTJS = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
  const SANS = '"IBM Plex Sans", system-ui, sans-serif';
  let instancias = [];

  async function abrir(ctx) {
    ctx.abrirVentana("Gráficas y datos", "<p class='nota'>Cargando...</p>", "ventana--documento");
    try {
      if (!window.Chart) await ctx.cargarScript(CHARTJS);
    } catch (e) {
      document.getElementById("ventana-cuerpo").innerHTML = "<p class='nota'>No se pudo cargar la librería de gráficas.</p>";
      return;
    }
    Chart.defaults.font.family = SANS;
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#5b6673";
    render(ctx);
  }

  function render(ctx) {
    destruir();
    const cuerpo = document.getElementById("ventana-cuerpo");
    const ind = ctx.indicador;
    cuerpo.innerHTML = `
      <div class="pestanas" role="tablist">
        <button type="button" class="pestana" data-p="tiempo" aria-selected="true">Línea de tiempo</button>
        <button type="button" class="pestana" data-p="indicador" aria-selected="false" ${ind ? "" : "disabled"}>Indicador</button>
        <button type="button" class="pestana" data-p="nacional" aria-selected="false" ${ctx.seriesNacionales ? "" : "disabled"}>Series nacionales</button>
        <button type="button" class="pestana" data-p="datos" aria-selected="false">Descargar datos</button>
      </div>
      <section class="panel-p" data-p="tiempo">
        <p class="nota">${ctx.eventos.length} eventos con los filtros actuales (${ctx.periodoTexto}). Clic en una barra para acotar el periodo a ese tramo.</p>
        <div class="grafica"><canvas id="g-tiempo"></canvas></div>
        <p class="acciones"><button type="button" class="boton" data-png="g-tiempo">Descargar gráfica (PNG)</button></p>
      </section>
      <section class="panel-p" data-p="indicador" hidden>
        ${ind ? `<p class="nota">${ind.nombre}${ind.unidad ? ", " + ind.unidad : ""}. ${ctx.mapaNombre}, ${ctx.periodoTexto}.</p>
        <div class="grafica grafica--alta"><canvas id="g-barras"></canvas></div>
        <p class="acciones"><button type="button" class="boton" data-png="g-barras">Descargar gráfica (PNG)</button></p>
        ${ctx.series.periodos.length > 1 ? `<h3 class="detalle__sub">Evolución por periodo</h3>
        <p class="nota">Unidades con más valor en el último periodo (máximo 8).</p>
        <div class="grafica"><canvas id="g-series"></canvas></div>
        <p class="acciones"><button type="button" class="boton" data-png="g-series">Descargar gráfica (PNG)</button></p>` : ""}` : "<p class='nota'>Elige un indicador en la barra superior.</p>"}
      </section>
      <section class="panel-p" data-p="nacional" hidden>
        ${ctx.seriesNacionales ? ctx.seriesNacionales.series.map((s, i) => `
          <h3 class="detalle__sub">${s.nombre}</h3>
          <p class="nota">${s.nota || ""} Fuente: ${ctx.nombreFuente(s.fuente)}.</p>
          <div class="grafica"><canvas id="g-nac-${i}"></canvas></div>
          <p class="acciones"><button type="button" class="boton" data-png="g-nac-${i}">Descargar gráfica (PNG)</button></p>`).join("") : ""}
      </section>
      <section class="panel-p" data-p="datos" hidden>
        <p>Se descarga lo que está filtrado en este momento: tema, verificación, texto y periodo para los eventos; mapa, tema y periodo para el indicador.</p>
        <p class="acciones">
          <button type="button" class="boton" data-csv="eventos">Eventos filtrados (CSV)</button>
          <button type="button" class="boton" data-json="eventos">Eventos filtrados (JSON)</button>
        </p>
        <p class="acciones">
          <button type="button" class="boton" data-csv="indicador" ${ind ? "" : "disabled"}>Indicador actual (CSV)</button>
          <button type="button" class="boton" data-json="indicador" ${ind ? "" : "disabled"}>Indicador actual (JSON)</button>
        </p>
        <p class="nota">Los CSV van en UTF-8 con separador de coma; en Excel se abren directamente. Cada archivo incluye la fuente de cada registro.</p>
      </section>`;

    cuerpo.querySelectorAll(".pestana").forEach(b => b.addEventListener("click", () => {
      cuerpo.querySelectorAll(".pestana").forEach(x => x.setAttribute("aria-selected", String(x === b)));
      cuerpo.querySelectorAll(".panel-p").forEach(s => s.hidden = s.dataset.p !== b.dataset.p);
      if (b.dataset.p === "indicador" && ind && !instancias.some(i => i.canvas.id === "g-barras")) dibujarIndicador(ctx);
      if (b.dataset.p === "nacional" && ctx.seriesNacionales && !instancias.some(i => i.canvas.id === "g-nac-0")) dibujarNacionales(ctx);
    }));
    cuerpo.querySelectorAll("[data-png]").forEach(b => b.addEventListener("click", () => descargarPng(b.dataset.png, ctx)));
    cuerpo.querySelectorAll("[data-csv]").forEach(b => b.addEventListener("click", () => exportarDatos(ctx, b.dataset.csv, "csv")));
    cuerpo.querySelectorAll("[data-json]").forEach(b => b.addEventListener("click", () => exportarDatos(ctx, b.dataset.json, "json")));
    dibujarTiempo(ctx);
  }

  // ---------- timeline ----------

  function dibujarTiempo(ctx) {
    const meses = ctx.eventos.map(e => e.fecha.slice(0, 7)).sort();
    if (!meses.length) { document.getElementById("g-tiempo").parentElement.innerHTML = "<p class='nota'>Sin eventos con los filtros actuales.</p>"; return; }
    // Monthly buckets up to three years, yearly beyond that
    const span = mesesEntre(meses[0], meses[meses.length - 1]);
    const porAnio = span > 36;
    const clave = f => porAnio ? f.slice(0, 4) : f.slice(0, 7);
    const etiquetas = porAnio ? rangoAnios(meses[0].slice(0, 4), meses[meses.length - 1].slice(0, 4)) : rangoMeses(meses[0], meses[meses.length - 1]);
    const datasets = Object.entries(ctx.temas).filter(([id]) => ctx.eventos.some(e => e.tema === id)).map(([id, t]) => ({
      label: t.nombre, backgroundColor: t.color, borderRadius: 2,
      data: etiquetas.map(k => ctx.eventos.filter(e => e.tema === id && clave(e.fecha) === k).length)
    }));
    const chart = new Chart(document.getElementById("g-tiempo"), {
      type: "bar",
      data: { labels: etiquetas, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { precision: 0 }, title: { display: true, text: "eventos" } } },
        plugins: { legend: { position: "bottom" }, tooltip: { mode: "index" } },
        onClick: (ev, elems) => {
          if (!elems.length) return;
          const k = etiquetas[elems[0].index];
          ctx.aplicarPeriodo(porAnio ? k + "-01" : k, porAnio ? k + "-12" : k);
        }
      }
    });
    instancias.push(chart);
  }

  // ---------- indicator ----------

  function dibujarIndicador(ctx) {
    const ind = ctx.indicador;
    const filas = [...ctx.valores].sort((a, b) => (typeof a.valor === "number" ? b.valor - a.valor : String(a.valor).localeCompare(String(b.valor))));
    const cv = document.getElementById("g-barras");
    if (!filas.length) { cv.parentElement.innerHTML = "<p class='nota'>Sin valores para este mapa y periodo.</p>"; return; }
    let labels, data, colores;
    if (ind.tipo === "categoria") {
      // Categories: how many units fall in each
      const conteo = {};
      filas.forEach(f => { conteo[f.valor] = (conteo[f.valor] || 0) + 1; });
      labels = Object.keys(ind.categorias); data = labels.map(k => conteo[k] || 0);
      colores = labels.map(k => (ctx.coloresCategoria || ind.colores)[k]); labels = labels.map(k => ind.categorias[k]);
    } else {
      const variosPeriodos = new Set(filas.map(f => f.periodo)).size > 1;
      labels = filas.map(f => variosPeriodos ? `${f.nombre} (${f.periodo})` : f.nombre); data = filas.map(f => f.valor);
      colores = filas.map(f => f.ejemplo ? "#c9ced6" : ctx.color);
    }
    cv.parentElement.style.height = Math.max(220, 26 * labels.length + 60) + "px";
    instancias.push(new Chart(cv, {
      type: "bar",
      data: { labels, datasets: [{ label: ind.unidad || "", data, backgroundColor: colores, borderRadius: 2 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.x.toLocaleString("es-MX")} ${ind.unidad || ""}` } } }
      }
    }));
    if (ctx.series.periodos.length > 1 && ind.tipo !== "categoria") {
      const { periodos, unidades } = ctx.series;
      const paleta = ["#0f7b6c", "#c2410c", "#5b21b6", "#b91c1c", "#1d4ed8", "#a16207", "#0e7490", "#6b7280"];
      instancias.push(new Chart(document.getElementById("g-series"), {
        type: "line",
        data: { labels: periodos, datasets: unidades.map((u, i) => ({ label: u.nombre, data: u.valores, borderColor: paleta[i % paleta.length], backgroundColor: paleta[i % paleta.length], tension: 0.2, spanGaps: true })) },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: ind.unidad || "" } } }, plugins: { legend: { position: "bottom" } } }
      }));
    }
  }

  // ---------- national series ----------

  function dibujarNacionales(ctx) {
    ctx.seriesNacionales.series.forEach((s, i) => {
      const labels = s.puntos.map(p => p.fecha);
      const campos = [["total", "Total", "#1f2a37"], ["periodistas", "Periodistas", "#b91c1c"], ["defensoras", "Personas defensoras", "#8b5cf6"], ["operadores", "Operadores de justicia", "#0f766e"]]
        .filter(([k]) => s.puntos.some(p => p[k] !== null && p[k] !== undefined));
      const anual = labels.every(l => l.length === 4);
      instancias.push(new Chart(document.getElementById(`g-nac-${i}`), {
        type: anual ? "bar" : "line",
        data: { labels, datasets: campos.map(([k, nombre, color]) => ({ label: nombre, data: s.puntos.map(p => p[k] ?? null), borderColor: color, backgroundColor: color, tension: 0.2, spanGaps: true, borderRadius: 2 })) },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: s.unidad } } },
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { afterBody: items => { const p = s.puntos[items[0].dataIndex]; return p.nota ? [p.nota] : []; } } } } }
      }));
    });
  }

  // ---------- downloads ----------

  function descargarPng(id, ctx) {
    const chart = instancias.find(i => i.canvas.id === id);
    if (!chart) return;
    // White background, otherwise the PNG is transparent
    const c = document.createElement("canvas"); c.width = chart.canvas.width; c.height = chart.canvas.height;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(chart.canvas, 0, 0);
    c.toBlob(b => bajar(b, `observatorio_${id.replace("g-", "grafica_")}_${hoy()}.png`));
  }

  function exportarDatos(ctx, que, formato) {
    let filas, nombre;
    if (que === "eventos") {
      filas = ctx.eventos.map(e => ({ ...e, tema_nombre: ctx.temas[e.tema].nombre, fuente_nombre: ctx.nombreFuente(e.fuente) }));
      nombre = `observatorio_eventos_${hoy()}`;
    } else {
      const ind = ctx.indicador;
      filas = ctx.valores.map(v => ({ indicador: ind.id, nombre_indicador: ind.nombre, clave: v.clave, unidad_geografica: v.nombre, periodo: v.periodo,
        valor: typeof v.valor === "string" && ind.categorias ? ind.categorias[v.valor] : v.valor, unidad: ind.unidad || "", ejemplo: v.ejemplo ? "si" : "no",
        fuente: ctx.nombreFuente(ind.fuente), mapa: ctx.mapaNombre, periodo_filtro: ctx.periodoTexto }));
      nombre = `observatorio_${ind.id}_${hoy()}`;
    }
    if (formato === "json") {
      bajar(new Blob([JSON.stringify(filas, null, 2)], { type: "application/json" }), nombre + ".json");
    } else {
      bajar(new Blob(["\ufeff" + aCsv(filas)], { type: "text/csv;charset=utf-8" }), nombre + ".csv");
    }
  }

  function aCsv(filas) {
    if (!filas.length) return "";
    const cols = [...new Set(filas.flatMap(f => Object.keys(f)))];
    const esc = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [cols.join(","), ...filas.map(f => cols.map(c => esc(typeof f[c] === "boolean" ? (f[c] ? "si" : "no") : f[c])).join(","))].join("\r\n");
  }

  function bajar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ---------- helpers ----------

  function destruir() { instancias.forEach(i => i.destroy()); instancias = []; }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function mesesEntre(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
  function rangoMeses(a, b) {
    const out = []; let y = +a.slice(0, 4), m = +a.slice(5, 7);
    while (true) { const k = `${y}-${String(m).padStart(2, "0")}`; out.push(k); if (k >= b) break; m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  function rangoAnios(a, b) { const out = []; for (let y = +a; y <= +b; y++) out.push(String(y)); return out; }

  return { abrir, destruir };
})();
