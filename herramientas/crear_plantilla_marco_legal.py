#!/usr/bin/env python3
"""Build plantillas/marco_legal.xlsx from datos/marco_legal.json.

Usage (from the repository root):
    python herramientas/crear_plantilla_marco_legal.py
"""
from openpyxl import Workbook
from openpyxl.worksheet.datavalidation import DataValidation

from comun import DIR_PLANTILLAS, RUTA_MARCO, estilizar_hoja, hoja_instrucciones, leer_json, verificar_raiz

COLS_ENT = ["cve_ent", "entidad", "categoria", "fecha_corte", "fuente", "nota"]
COLS_INST = ["cve_ent", "entidad", "nombre", "tipo", "anio", "url", "organo", "nota"]
TIPOS = ["ley", "decreto", "acuerdo", "protocolo", "unidad", "reforma", "iniciativa", "reglamento"]
DESGLOSE_VALORES = ["si", "no", "parcial", "sin dato"]

INSTRUCCIONES = [
    "Plantilla de captura del marco legal estatal de protección a periodistas y personas defensoras",
    "",
    "Hoja 'entidades': una fila por entidad (32). categoria es una lista desplegable con las cinco situaciones; fecha_corte es la fecha de la revisión.",
    "Las columnas a partir de 'define_periodista' son el desglose por entidad: si / no / parcial / sin dato. Llénalas solo cuando los indicadores estén definidos.",
    "Hoja 'instrumentos': una fila por ley, decreto, acuerdo, protocolo, unidad, reforma o iniciativa. Una entidad puede tener varias filas; una entidad sin instrumentos no lleva fila.",
    "anio: cuatro dígitos, vacío si no consta en la fuente. url: enlace al texto oficial.",
    "Hoja 'catalogos': claves y categorías válidas.",
    "",
    "Para publicar: guarda el archivo y ejecuta desde la raíz del repositorio",
    "    python herramientas/actualizar_marco_legal.py plantillas/marco_legal.xlsx",
    "El script valida y reescribe datos/marco_legal.json completo (las dos hojas son el registro íntegro), con respaldo del anterior.",
]


def main():
    verificar_raiz()
    ml = leer_json(RUTA_MARCO)
    desglose_campos = list(ml["entidades"][0]["desglose"].keys()) if ml["entidades"] else []
    cols_ent = COLS_ENT + desglose_campos

    wb = Workbook()
    we = wb.active
    we.title = "entidades"
    we.append(cols_ent)
    for e in ml["entidades"]:
        fila = [e["cve_ent"], e["entidad"], e["categoria"], e.get("fecha_corte", ""), e.get("fuente", ""), e.get("nota", "")]
        fila += [("" if e["desglose"].get(k) is None else e["desglose"][k]) for k in desglose_campos]
        we.append(fila)
    estilizar_hoja(we, [9, 22, 20, 12, 10, 60] + [18] * len(desglose_campos), filas_editables=len(ml["entidades"]), columnas_ajustables=(6,))
    we.freeze_panes = "C2"

    wi = wb.create_sheet("instrumentos")
    wi.append(COLS_INST)
    n_inst = 0
    for e in ml["entidades"]:
        for i in e["instrumentos"]:
            wi.append([e["cve_ent"], e["entidad"], i["nombre"], i["tipo"], i.get("anio") or "", i.get("url", ""), i.get("organo", ""), i.get("nota", "")])
            n_inst += 1
    estilizar_hoja(wi, [9, 20, 70, 12, 8, 50, 40, 50], filas_editables=200, columnas_ajustables=(3, 6, 7, 8))
    wi.freeze_panes = "C2"

    wc = wb.create_sheet("catalogos")
    wc.append(["cve_ent", "entidad", "", "categoria", "descripcion", "", "tipo_instrumento", "", "desglose"])
    cats = list(ml["categorias"].items())
    n = max(len(ml["entidades"]), len(cats), len(TIPOS), len(DESGLOSE_VALORES))
    for k in range(n):
        e = ml["entidades"][k] if k < len(ml["entidades"]) else None
        c = cats[k] if k < len(cats) else ("", "")
        wc.append([e["cve_ent"] if e else "", e["entidad"] if e else "", "", c[0], c[1], "",
                   TIPOS[k] if k < len(TIPOS) else "", "", DESGLOSE_VALORES[k] if k < len(DESGLOSE_VALORES) else ""])
    estilizar_hoja(wc, [10, 22, 3, 18, 55, 3, 18, 3, 12])

    reglas = [
        (we, DataValidation(type="list", formula1=f"=catalogos!$D$2:$D${len(cats) + 1}", allow_blank=False), "C", 33),
        (wi, DataValidation(type="list", formula1="=catalogos!$A$2:$A$33", allow_blank=True), "A", 201),
        (wi, DataValidation(type="list", formula1=f"=catalogos!$G$2:$G${len(TIPOS) + 1}", allow_blank=True), "D", 201),
        (wi, DataValidation(type="whole", operator="between", formula1="1990", formula2="2100", allow_blank=True), "E", 201),
    ]
    for ws, dv, col, fin in reglas:
        dv.error, dv.showErrorMessage = "Valor no permitido", True
        dv.add(f"{col}2:{col}{fin}")
        ws.add_data_validation(dv)
    if desglose_campos:
        dv = DataValidation(type="list", formula1=f"=catalogos!$I$2:$I${len(DESGLOSE_VALORES) + 1}", allow_blank=True)
        dv.error, dv.showErrorMessage = "Valor no permitido", True
        ini = len(COLS_ENT) + 1
        from openpyxl.utils import get_column_letter
        dv.add(f"{get_column_letter(ini)}2:{get_column_letter(ini + len(desglose_campos) - 1)}33")
        we.add_data_validation(dv)

    hoja_instrucciones(wb, INSTRUCCIONES)
    DIR_PLANTILLAS.mkdir(exist_ok=True)
    salida = DIR_PLANTILLAS / "marco_legal.xlsx"
    wb.save(salida)
    print(f"{salida}: {len(ml['entidades'])} entidades, {n_inst} instrumentos")


if __name__ == "__main__":
    main()
