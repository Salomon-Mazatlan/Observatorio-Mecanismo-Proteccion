#!/usr/bin/env python3
"""Build plantillas/indicador_<id>.xlsx from datos/indicadores/<id>.json.

Usage (from the repository root):
    python herramientas/crear_plantilla_indicador.py per_beneficiarios
    python herramientas/crear_plantilla_indicador.py --todos
"""
import sys

from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

from openpyxl.styles import PatternFill

from comun import (AMARILLO, DIR_INDICADORES, DIR_PLANTILLAS, RUTA_INDICE, catalogo_entidades, catalogo_municipios,
                   estilizar_hoja, hoja_instrucciones, leer_json, verificar_raiz)

SIN_RELLENO = PatternFill(fill_type=None)

COLS = ["cve_ent", "entidad", "cve_mun", "municipio", "periodo", "valor", "ejemplo", "nota"]
ANCHOS = [9, 22, 9, 22, 12, 12, 9, 50]
MAX_FILAS = 500

INSTRUCCIONES = [
    "Plantilla de captura de un indicador",
    "",
    "Hoja 'definicion': metadatos del indicador (id, nombre, tema, unidad, fuente, nota). Se pueden corregir nombre, unidad, fuente y nota; el id no se cambia.",
    "Hoja 'valores': una fila por unidad geográfica y periodo (celdas amarillas).",
    "",
    "cve_ent: clave INEGI de la entidad, dos dígitos (lista desplegable). entidad se llena sola con la fórmula, no la edites.",
    "cve_mun: clave INEGI del municipio, tres dígitos, solo para valores municipales. Vacío para valores estatales. La hoja 'catalogos' lista los 2 mil 469 municipios con su entidad.",
    "periodo: año (2025), mes (2025-06) o fecha de corte (2025-06-30). Un mismo indicador puede tener varios periodos; el mapa muestra el más reciente dentro del rango elegido.",
    "valor: número. Para categorías de texto (como el marco legal) usa el archivo específico, no esta plantilla.",
    "ejemplo: si / no. nota: aclaraciones de esa cifra (fecha de corte, cálculo, fuente puntual).",
    "",
    "Para publicar: guarda el archivo y ejecuta desde la raíz del repositorio",
    "    python herramientas/actualizar_indicador.py plantillas/indicador_<id>.xlsx",
    "El script valida, reemplaza los valores del indicador por los del Excel y deja un respaldo del JSON anterior.",
]


def crear(id_indicador):
    doc = leer_json(DIR_INDICADORES / f"{id_indicador}.json")
    d = doc["definicion"]
    if d.get("externo"):
        print(f"{id_indicador}: sus valores viven en {d['externo']['archivo']}, no se genera plantilla")
        return
    ents = catalogo_entidades()
    muns = catalogo_municipios()
    nombre_ent = dict(ents)
    nombre_mun = {(e, m): n for e, m, n in muns}

    wb = Workbook()
    wd = wb.active
    wd.title = "definicion"
    for k in ["id", "nombre", "tema", "unidad", "fuente", "nota", "tipo"]:
        wd.append([k, d.get(k, "")])
    estilizar_hoja(wd, [14, 100], filas_editables=0, columnas_ajustables=(2,))
    for r in range(3, 7):
        wd.cell(r, 2).fill = AMARILLO

    wv = wb.create_sheet("valores")
    wv.append(COLS)
    for v in sorted(doc.get("valores", []), key=lambda x: (str(x.get("periodo")), x["cve_ent"], x.get("cve_mun") or "")):
        cm = v.get("cve_mun") or ""
        wv.append([v["cve_ent"], None, cm, nombre_mun.get((v["cve_ent"], cm), "") if cm else "",
                   v.get("periodo", ""), v.get("valor"), "si" if v.get("ejemplo") else "no", v.get("nota", "")])
    for r in range(2, MAX_FILAS + 2):
        wv.cell(r, 2).value = f'=IFERROR(INDEX(catalogos!$B$2:$B$33,MATCH(A{r},catalogos!$A$2:$A$33,0)),"")'
    estilizar_hoja(wv, ANCHOS, filas_editables=MAX_FILAS, columnas_ajustables=(8,))
    for r in range(2, MAX_FILAS + 2):
        wv.cell(r, 2).fill = SIN_RELLENO
    wv.freeze_panes = "C2"

    wc = wb.create_sheet("catalogos")
    wc.append(["cve_ent", "entidad", "", "cve_ent_mun", "cve_mun", "municipio"])
    n = max(len(ents), len(muns))
    for i in range(n):
        e = ents[i] if i < len(ents) else ("", "")
        m = muns[i] if i < len(muns) else ("", "", "")
        wc.append([e[0], e[1], "", m[0], m[1], m[2]])
    estilizar_hoja(wc, [10, 24, 3, 12, 10, 24])

    dv_ent = DataValidation(type="list", formula1="=catalogos!$A$2:$A$33", allow_blank=True)
    dv_mun = DataValidation(type="list", formula1=f"=catalogos!$E$2:$E${len(muns) + 1}", allow_blank=True)
    dv_ej = DataValidation(type="list", formula1='"si,no"', allow_blank=True)
    dv_num = DataValidation(type="decimal", allow_blank=True)
    for dv, col in ((dv_ent, "A"), (dv_mun, "C"), (dv_ej, "G"), (dv_num, "F")):
        dv.error, dv.showErrorMessage = "Valor no permitido", True
        dv.add(f"{col}2:{col}{MAX_FILAS + 1}")
        wv.add_data_validation(dv)

    hoja_instrucciones(wb, INSTRUCCIONES)
    DIR_PLANTILLAS.mkdir(exist_ok=True)
    salida = DIR_PLANTILLAS / f"indicador_{id_indicador}.xlsx"
    wb.save(salida)
    print(f"{salida}: {len(doc.get('valores', []))} valores")


def main():
    verificar_raiz()
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    if sys.argv[1] == "--todos":
        for f in leer_json(RUTA_INDICE)["archivos"]:
            crear(f[:-5])
    else:
        crear(sys.argv[1])


if __name__ == "__main__":
    main()
