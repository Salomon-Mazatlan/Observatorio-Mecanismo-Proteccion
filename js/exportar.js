// Renders the current map view to a PNG with title, legend, north arrow, scale bar and credits.
// No external library: tiles are copied from the DOM and vectors are redrawn on a canvas.
const Exportar = (() => {
  const ESCALA = 2;                 // output pixel ratio
  const MARGEN = 32;
  const ALTO_CABECERA = 96;
  const LINEA_PIE = 15;
  const SERIF = '"Newsreader", Georgia, serif';
  const SANS = '"IBM Plex Sans", system-ui, sans-serif';

  async function png(mapa, capas, info) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const cont = mapa.getContainer();
    const mw = cont.clientWidth, mh = cont.clientHeight;
    const W = mw + MARGEN * 2;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    // Footer height depends on how many wrapped lines the credits need
    ctx.font = `11.5px ${SANS}`;
    const lineasPie = info.pie.flatMap(l => envolver(ctx, l, W - MARGEN * 2));
    const altoPie = 24 + lineasPie.length * LINEA_PIE + 12;
    const H = ALTO_CABECERA + mh + altoPie;
    canvas.width = W * ESCALA; canvas.height = H * ESCALA;
    ctx.scale(ESCALA, ESCALA);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

    dibujarCabecera(ctx, W, info);

    // Map frame
    ctx.save();
    ctx.translate(MARGEN, ALTO_CABECERA);
    ctx.beginPath(); ctx.rect(0, 0, mw, mh); ctx.clip();
    ctx.fillStyle = "#eef0f3"; ctx.fillRect(0, 0, mw, mh);
    dibujarTiles(ctx, mapa);
    capas.forEach(g => g.eachLayer(l => dibujarVector(ctx, mapa, l)));
    dibujarLeyenda(ctx, mw, mh, info);
    dibujarNorte(ctx, mw);
    dibujarEscala(ctx, mapa, mw, mh);
    ctx.restore();
    ctx.strokeStyle = "#8a93a1"; ctx.lineWidth = 1; ctx.strokeRect(MARGEN + 0.5, ALTO_CABECERA + 0.5, mw - 1, mh - 1);

    dibujarPie(ctx, ALTO_CABECERA + mh, lineasPie);
    return new Promise((res, rej) => {
      try { canvas.toBlob(b => b ? res(b) : rej(new Error("No se pudo generar la imagen")), "image/png"); }
      catch (e) { rej(e); }
    });
  }

  function dibujarCabecera(ctx, W, info) {
    ctx.fillStyle = "#1f2a37";
    ctx.font = `500 26px ${SERIF}`;
    ctx.fillText(info.titulo, MARGEN, 44);
    ctx.fillStyle = "#5b6673";
    ctx.font = `14px ${SANS}`;
    ctx.fillText(info.subtitulo, MARGEN, 70);
  }

  function dibujarPie(ctx, yInicio, lineas) {
    ctx.fillStyle = "#5b6673";
    ctx.font = `11.5px ${SANS}`;
    lineas.forEach((linea, i) => ctx.fillText(linea, MARGEN, yInicio + 22 + i * LINEA_PIE));
  }

  // Word-wraps one paragraph to the given width; an empty string yields a blank line
  function envolver(ctx, texto, ancho) {
    if (!texto) return [""];
    const lineas = []; let actual = "";
    texto.split(" ").forEach(p => {
      const prueba = actual ? actual + " " + p : p;
      if (ctx.measureText(prueba).width > ancho && actual) { lineas.push(actual); actual = p; }
      else actual = prueba;
    });
    if (actual) lineas.push(actual);
    return lineas;
  }

  function dibujarTiles(ctx, mapa) {
    const r0 = mapa.getContainer().getBoundingClientRect();
    mapa.getPanes().tilePane.querySelectorAll("img.leaflet-tile-loaded").forEach(img => {
      if (!img.complete || !img.naturalWidth) return;
      const r = img.getBoundingClientRect();
      try { ctx.drawImage(img, r.left - r0.left, r.top - r0.top, r.width, r.height); } catch (e) { /* skip broken tile */ }
    });
  }

  function dibujarVector(ctx, mapa, l) {
    const o = l.options;
    if (o.etiqueta) {
      const p = mapa.latLngToContainerPoint(l.getLatLng());
      ctx.font = `500 11px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineJoin = "round";
      ctx.strokeText(o.etiqueta, p.x, p.y);
      ctx.fillStyle = "#1f2a37"; ctx.fillText(o.etiqueta, p.x, p.y);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    } else if (l instanceof L.CircleMarker) {
      const p = mapa.latLngToContainerPoint(l.getLatLng());
      ctx.beginPath(); ctx.arc(p.x, p.y, l.getRadius(), 0, Math.PI * 2);
      pintar(ctx, o);
    } else if (l instanceof L.Polygon) {
      ctx.beginPath();
      anillos(l.getLatLngs()).forEach(anillo => {
        anillo.forEach((ll, i) => { const p = mapa.latLngToContainerPoint(ll); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
        ctx.closePath();
      });
      pintar(ctx, o, "evenodd");
    }
  }

  // Flattens Polygon / MultiPolygon latlng arrays into a list of rings
  function anillos(ll) {
    if (!ll.length) return [];
    if (ll[0] instanceof L.LatLng) return [ll];
    return ll.flatMap(anillos);
  }

  function pintar(ctx, o, regla) {
    if (o.fill !== false) {
      ctx.globalAlpha = o.fillOpacity ?? 0.2;
      ctx.fillStyle = o.fillColor || o.color || "#3388ff";
      regla ? ctx.fill(regla) : ctx.fill();
    }
    if (o.stroke !== false) {
      ctx.globalAlpha = o.opacity ?? 1;
      ctx.strokeStyle = o.color || "#3388ff";
      ctx.lineWidth = o.weight ?? 3;
      ctx.setLineDash(o.dashArray ? String(o.dashArray).split(/[\s,]+/).map(Number) : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  // Legend box, bottom-left inside the map
  function dibujarLeyenda(ctx, mw, mh, info) {
    const items = info.leyenda || [];
    if (!items.length) return;
    ctx.font = `12px ${SANS}`;
    const ancho = Math.max(150, ...items.map(i => ctx.measureText(i.texto).width + 40), ctx.measureText(info.leyendaTitulo || "").width + 20);
    const alto = 14 + (info.leyendaTitulo ? 20 : 0) + items.length * 20;
    const x = 12, y = mh - alto - 12;
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(x, y, ancho, alto);
    ctx.strokeStyle = "#d6dae0"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, ancho - 1, alto - 1);
    let cy = y + 12;
    if (info.leyendaTitulo) {
      ctx.fillStyle = "#1f2a37"; ctx.font = `600 12px ${SANS}`;
      ctx.fillText(info.leyendaTitulo, x + 10, cy + 6); cy += 20;
    }
    ctx.font = `12px ${SANS}`;
    items.forEach(it => {
      if (it.forma === "circulo") {
        ctx.beginPath(); ctx.arc(x + 18, cy + 6, 6, 0, Math.PI * 2);
        ctx.fillStyle = it.color; ctx.globalAlpha = it.alpha ?? 1; ctx.fill(); ctx.globalAlpha = 1;
        ctx.setLineDash(it.punteado ? [2, 2] : []); ctx.strokeStyle = it.borde || "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.fillStyle = it.color; ctx.fillRect(x + 10, cy, 18, 12);
        ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.strokeRect(x + 10.5, cy + 0.5, 17, 11);
      }
      ctx.fillStyle = "#1f2a37"; ctx.fillText(it.texto, x + 34, cy + 10);
      cy += 20;
    });
  }

  function dibujarNorte(ctx, mw) {
    const x = mw - 30, y = 22;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 26); ctx.lineTo(x, y + 20); ctx.lineTo(x + 8, y + 26); ctx.closePath();
    ctx.fillStyle = "#1f2a37"; ctx.fill();
    ctx.font = `600 12px ${SANS}`; ctx.textAlign = "center"; ctx.fillText("N", x, y + 40); ctx.textAlign = "left";
  }

  // Scale bar with a round distance, bottom-right inside the map
  function dibujarEscala(ctx, mapa, mw, mh) {
    const centro = mapa.getCenter();
    const p = mapa.latLngToContainerPoint(centro);
    const metrosPorPx = mapa.distance(centro, mapa.containerPointToLatLng([p.x + 100, p.y])) / 100;
    const objetivo = metrosPorPx * 120;
    const pot = Math.pow(10, Math.floor(Math.log10(objetivo)));
    const nice = [1, 2, 5, 10].map(n => n * pot).reduce((a, b) => Math.abs(b - objetivo) < Math.abs(a - objetivo) ? b : a);
    const px = nice / metrosPorPx;
    const x = mw - 12 - px, y = mh - 18;
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(x - 6, y - 18, px + 12, 26);
    ctx.strokeStyle = "#1f2a37"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 6); ctx.stroke();
    ctx.fillStyle = "#1f2a37"; ctx.font = `11px ${SANS}`; ctx.textAlign = "center";
    ctx.fillText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`, x + px / 2, y - 8); ctx.textAlign = "left";
  }

  function descargar(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return { png, descargar };
})();
