#!/usr/bin/env python3
"""Regenerate every capture template in plantillas/ from the current data files.

Usage (from the repository root):
    python herramientas/crear_todas_las_plantillas.py
"""
import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).parent

for cmd in (["crear_plantilla_eventos.py"], ["crear_plantilla_marco_legal.py"], ["crear_plantilla_comparativo.py"], ["crear_plantilla_indicador.py", "--todos"]):
    subprocess.run([sys.executable, str(AQUI / cmd[0]), *cmd[1:]], check=True)
