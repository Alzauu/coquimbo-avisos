"""
Cortes de luz de CGE para la Región de Coquimbo.

Cada minuto descarga el KMZ del mapa de afectaciones de CGE, guarda
respaldos locales (CSV y GeoJSON con la fecha del día) en scripts/coquimbo/
y scripts/chile/, y reemplaza la tabla cortes_luz de Supabase con los cortes
de la región: su área afectada (polígonos, con sus huecos) y su punto de
referencia.

Si la descarga o la lectura fallan, no toca Supabase: el mapa sigue
mostrando los últimos datos buenos. Ningún error detiene el bucle; se
detiene con Ctrl+C.

Variables en scripts/.env (no se suben al repositorio):
    CGE_KMZ_URL                URL del KMZ (incluye la clave de CGE)
    SUPABASE_URL               URL del proyecto de Supabase
    SUPABASE_SERVICE_ROLE_KEY  clave service_role (se salta la RLS)

Uso:
    pip install -r scripts/requirements.txt
    python scripts/cge_cortes.py                  # cada 60 s, hasta Ctrl+C
    python scripts/cge_cortes.py --una-vez        # un solo ciclo
    python scripts/cge_cortes.py --una-vez --sin-supabase --debug
"""

import argparse
import io
import json
import os
import re
import sys
import time
import zipfile
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

import pandas as pd
import requests
from dotenv import load_dotenv

# --- Configuración ---

CARPETA_SCRIPT = Path(__file__).resolve().parent
INTERVALO_SEGUNDOS = 60

# Bounding box de la Región de Coquimbo. Debe coincidir con los CHECK de
# latitud y longitud de cortes_luz
# (supabase/migrations/20261023210000_cortes_luz.sql).
COQUIMBO_BBOX = {
    "lat_min": -32.3,   # sur (frontera con Valparaíso)
    "lat_max": -29.0,   # norte (frontera con Atacama)
    "lon_min": -72.0,   # oeste (océano Pacífico)
    "lon_max": -69.5,   # este (cordillera / Argentina)
}

# Filtro de respaldo por texto, por si alguna coordenada viene mal. Estos
# cortes quedan en el CSV, pero no se suben: el mapa no sabría dónde
# dibujarlos.
COMUNAS_COQUIMBO = [
    "la serena", "coquimbo", "ovalle", "illapel", "los vilos",
    "salamanca", "canela", "combarbalá", "combarbala", "monte patria",
    "punitaqui", "río hurtado", "rio hurtado", "andacollo",
    "paihuano", "vicuña", "vicuna", "la higuera", "tongoy", "guanaqueros",
]

# Largos máximos: deben coincidir con los CHECK de cortes_luz.
LARGO_NOMBRE_MAX = 200
LARGO_DESCRIPCION_MAX = 2000

# Vértices por corte. Más que esto no cabe en el CHECK de tamaño de
# cortes_luz.geometria (los de CGE traen menos de 300); si se pasa, se sube
# solo el punto.
MAX_VERTICES = 5000
# 6 decimales: unos 10 cm, más que suficiente y achica el JSON.
DECIMALES = 6

NS = {"kml": "http://www.opengis.net/kml/2.2"}


def log(mensaje):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {mensaje}", flush=True)


# --- Utilidades ---

def parse_coords(coord_str):
    """
    Convierte 'lon,lat[,alt]' (string KML) a (lon, lat) float.
    Devuelve None si el formato es inválido.
    """
    if not coord_str:
        return None
    try:
        partes = coord_str.split(",")
        return float(partes[0]), float(partes[1])
    except (ValueError, IndexError):
        return None


def coordenada_valida(lon, lat):
    return -180 <= lon <= 180 and -90 <= lat <= 90


def leer_anillo(texto):
    """
    Anillo de un polígono KML ('lon,lat[,alt] lon,lat[,alt] ...') como
    lista de [lon, lat] para GeoJSON. Lo cierra si hace falta (el primer
    punto debe repetirse al final). None si no forma un anillo (menos de 4
    posiciones ya cerrado).
    """
    posiciones = []
    for tupla in (texto or "").split():
        par = parse_coords(tupla)
        if par is None or not coordenada_valida(*par):
            continue
        posiciones.append([round(par[0], DECIMALES), round(par[1], DECIMALES)])
    if posiciones and posiciones[0] != posiciones[-1]:
        posiciones.append(list(posiciones[0]))
    return posiciones if len(posiciones) >= 4 else None


def texto_de(elemento):
    return elemento.text if elemento is not None and elemento.text else ""


def poligono_de(elemento):
    """Anillos de un <Polygon>: el borde exterior primero y luego los huecos."""
    exterior = leer_anillo(texto_de(
        elemento.find("kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", NS)))
    if exterior is None:
        return None
    huecos = [
        anillo
        for anillo in (
            leer_anillo(texto_de(co))
            for co in elemento.findall("kml:innerBoundaryIs/kml:LinearRing/kml:coordinates", NS)
        )
        if anillo
    ]
    return [exterior, *huecos]


def punto_de(placemark):
    """(lon, lat) del <Point> del placemark: el punto de referencia de CGE."""
    par = parse_coords(texto_de(placemark.find(".//kml:Point/kml:coordinates", NS)).strip())
    if par is None or not coordenada_valida(*par):
        return None
    return round(par[0], DECIMALES), round(par[1], DECIMALES)


def poligonos_de_geometria(geometria):
    """Lista de polígonos (cada uno, lista de anillos) de un Polygon o MultiPolygon."""
    if geometria["type"] == "Polygon":
        return [geometria["coordinates"]]
    return geometria["coordinates"]


def contar_vertices(geometria):
    if geometria is None:
        return 0
    if geometria["type"] == "Point":
        return 1
    return sum(len(anillo) for poligono in poligonos_de_geometria(geometria) for anillo in poligono)


def geometria_de(placemark):
    """
    Geometría GeoJSON del corte: Polygon (o MultiPolygon si hay varios),
    con sus huecos, buscando en cualquier nivel (también dentro de
    <MultiGeometry>). Si no hay polígono, el <Point> como Point. None si no
    hay ninguno.
    """
    poligonos = [
        poligono
        for poligono in (poligono_de(p) for p in placemark.findall(".//kml:Polygon", NS))
        if poligono
    ]
    if len(poligonos) == 1:
        return {"type": "Polygon", "coordinates": poligonos[0]}
    if poligonos:
        return {"type": "MultiPolygon", "coordinates": poligonos}
    punto = punto_de(placemark)
    if punto:
        return {"type": "Point", "coordinates": list(punto)}
    return None


def punto_de_referencia(placemark, geometria):
    """
    El <Point> de CGE. Si no lo trae, el centro del rectángulo que encierra
    la geometría.
    """
    punto = punto_de(placemark)
    if punto or geometria is None:
        return punto
    if geometria["type"] == "Point":
        return tuple(geometria["coordinates"])
    exteriores = [poligono[0] for poligono in poligonos_de_geometria(geometria)]
    lons = [p[0] for anillo in exteriores for p in anillo]
    lats = [p[1] for anillo in exteriores for p in anillo]
    return (
        round((min(lons) + max(lons)) / 2, DECIMALES),
        round((min(lats) + max(lats)) / 2, DECIMALES),
    )


def en_coquimbo(lon, lat):
    """True si el punto cae dentro del bounding box de Coquimbo."""
    b = COQUIMBO_BBOX
    return (b["lon_min"] <= lon <= b["lon_max"]) and (b["lat_min"] <= lat <= b["lat_max"])


def texto_coquimbo(texto):
    """Filtro de respaldo: True si el texto menciona alguna comuna de Coquimbo."""
    if not texto:
        return False
    t = texto.lower()
    return any(c in t for c in COMUNAS_COQUIMBO)


class _ExtractorTexto(HTMLParser):
    """Junta el texto de un fragmento HTML; los bloques pasan a ser líneas."""

    BLOQUES = {"br", "p", "div", "tr", "li", "table", "h1", "h2", "h3", "h4"}
    # Su contenido no es texto para mostrar.
    IGNORADOS = {"script", "style"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.partes = []
        self.ignorando = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.IGNORADOS:
            self.ignorando += 1
        elif tag in self.BLOQUES:
            self.partes.append("\n")
        elif tag in ("td", "th"):
            self.partes.append(" ")

    def handle_endtag(self, tag):
        if tag in self.IGNORADOS:
            self.ignorando = max(0, self.ignorando - 1)
        elif tag in self.BLOQUES:
            self.partes.append("\n")

    def handle_data(self, data):
        if not self.ignorando:
            self.partes.append(data)


def limpiar_html(texto):
    """
    Texto plano a partir de la descripción de un placemark, que suele traer
    HTML (tablas, <br>, entidades). Quita etiquetas y caracteres de control,
    junta espacios y deja una línea por bloque.
    """
    if not texto:
        return ""
    extractor = _ExtractorTexto()
    try:
        extractor.feed(texto)
        extractor.close()
        plano = "".join(extractor.partes)
    except Exception:
        # HTML muy roto: se quitan las etiquetas a la fuerza.
        plano = re.sub(r"<[^>]*>", " ", unescape(texto))
    plano = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", " ", plano)
    lineas = (re.sub(r"[ \t ]+", " ", linea).strip() for linea in plano.split("\n"))
    return "\n".join(linea for linea in lineas if linea)


def recortar(texto, maximo):
    return texto if len(texto) <= maximo else texto[: maximo - 1].rstrip() + "…"


# --- Extracción ---

def descargar_kmz(url):
    """Descarga el KMZ y devuelve el XML del KML interno como bytes."""
    r = requests.get(url, timeout=30)
    r.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        kml_name = next((n for n in z.namelist() if n.endswith(".kml")), None)
        if not kml_name:
            raise RuntimeError("El KMZ no contiene archivo .kml")
        return z.read(kml_name)


def extraer_cortes(kml_bytes):
    """Parsea el KML y devuelve todos los cortes (de todo Chile)."""
    root = ET.fromstring(kml_bytes)
    cortes = []
    for pm in root.findall(".//kml:Placemark", NS):
        nombre = limpiar_html(texto_de(pm.find("kml:name", NS)))
        desc = limpiar_html(texto_de(pm.find("kml:description", NS)))

        geometria = geometria_de(pm)
        referencia = punto_de_referencia(pm, geometria)
        if contar_vertices(geometria) > MAX_VERTICES:
            # No cabría en la base: se queda con el punto de referencia.
            geometria = {"type": "Point", "coordinates": list(referencia)} if referencia else None
        lon, lat = referencia if referencia else (None, None)
        cortes.append({
            # CGE suele dejar los placemarks sin nombre.
            "nombre": nombre or "Corte de luz",
            "descripcion": desc,
            "longitud": lon,
            "latitud": lat,
            "geometria": geometria,
        })
    return cortes


def filtrar_coquimbo(cortes, debug=False):
    """
    Cortes de la Región de Coquimbo: dentro del bounding box o, si sus
    coordenadas faltan o caen fuera, que mencionen una comuna de la región.
    """
    elegidos = []
    fuera_bbox = sin_coord = 0
    for c in cortes:
        lon, lat = c["longitud"], c["latitud"]
        menciona = texto_coquimbo(c["nombre"]) or texto_coquimbo(c["descripcion"])
        if lon is None or lat is None:
            if not menciona:
                sin_coord += 1
                continue
        elif not en_coquimbo(lon, lat) and not menciona:
            fuera_bbox += 1
            continue
        elegidos.append(c)

    if debug:
        log(f"   Total placemarks en KMZ : {len(cortes)}")
        log(f"   Descartados (fuera bbox): {fuera_bbox}")
        log(f"   Descartados (sin coord) : {sin_coord}")
        log(f"   Cortes de Coquimbo      : {len(elegidos)}")
    return elegidos


def para_supabase(cortes):
    """
    Filas para reemplazar_cortes_luz: solo los cortes con coordenadas dentro
    de la región (los CHECK de la tabla rechazarían el resto), con los
    textos recortados al largo que acepta la base.
    """
    filas = []
    for c in cortes:
        lon, lat = c["longitud"], c["latitud"]
        if lon is None or lat is None or not en_coquimbo(lon, lat):
            continue
        filas.append({
            "nombre": recortar(c["nombre"], LARGO_NOMBRE_MAX),
            "descripcion": recortar(c["descripcion"], LARGO_DESCRIPCION_MAX) or None,
            "latitud": lat,
            "longitud": lon,
            # Si falta, la base guarda el punto de referencia.
            "geometria": c["geometria"],
        })
    return filas


# --- Salidas ---

def exportar_csv(cortes, path):
    """Una fila por corte; la geometría completa va en el GeoJSON."""
    filas = [
        {
            "nombre": c["nombre"],
            "descripcion": c["descripcion"],
            "longitud": c["longitud"],
            "latitud": c["latitud"],
            "tipo_geometria": c["geometria"]["type"] if c["geometria"] else "",
            "vertices": contar_vertices(c["geometria"]),
        }
        for c in cortes
    ]
    columnas = ["nombre", "descripcion", "longitud", "latitud", "tipo_geometria", "vertices"]
    df = pd.DataFrame(filas, columns=columnas)
    df["fecha_consulta"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    df.to_csv(path, index=False, encoding="utf-8-sig")


def exportar_geojson(cortes, path, region):
    """Exporta a GeoJSON (útil para MapTiler, QGIS, etc.)."""
    features = [
        {
            "type": "Feature",
            "geometry": c["geometria"],
            "properties": {
                "nombre": c["nombre"],
                "descripcion": c["descripcion"],
                "punto_referencia": (
                    [c["longitud"], c["latitud"]] if c["longitud"] is not None else None
                ),
            },
        }
        for c in cortes
        if c["geometria"] is not None
    ]
    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "fuente": "CGE - mapa de afectaciones",
            "region": region,
            "fecha": datetime.now().isoformat(),
            "total": len(features),
        },
        "features": features,
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)


def guardar_respaldos(cortes, carpeta, region):
    """CSV y GeoJSON del día (se sobrescriben en cada ciclo del mismo día)."""
    carpeta.mkdir(parents=True, exist_ok=True)
    base = f"{region}_{datetime.now():%Y-%m-%d}"
    exportar_csv(cortes, carpeta / f"{base}.csv")
    exportar_geojson(cortes, carpeta / f"{base}.geojson", region)


# --- Supabase ---

def conectar_supabase():
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def sincronizar(cliente, filas):
    """Reemplaza cortes_luz en una sola transacción y devuelve cuántos quedaron."""
    respuesta = cliente.rpc("reemplazar_cortes_luz", {"cortes": filas}).execute()
    return respuesta.data


# --- Ciclo ---

def descripcion_error(error):
    """
    Texto corto del error sin la URL: la de CGE lleva su clave y no debe
    quedar en los registros.
    """
    if isinstance(error, requests.HTTPError) and error.response is not None:
        return f"HTTP {error.response.status_code}"
    if isinstance(error, requests.RequestException):
        return type(error).__name__
    return f"{type(error).__name__}: {error}"


def ciclo(url_kmz, cliente, base_dir, debug=False):
    # 1. Descargar y leer. Si falla, no se toca nada más.
    try:
        todos = extraer_cortes(descargar_kmz(url_kmz))
    except (requests.RequestException, zipfile.BadZipFile, ET.ParseError, RuntimeError) as error:
        log(f"No se pudo descargar o leer el KMZ ({descripcion_error(error)}). "
            "Supabase conserva los últimos datos.")
        return
    coquimbo = filtrar_coquimbo(todos, debug=debug)

    # 2. Respaldos locales. Un error al escribir no impide sincronizar.
    try:
        guardar_respaldos(coquimbo, base_dir / "coquimbo", "Coquimbo")
        guardar_respaldos(todos, base_dir / "chile", "Chile")
    except OSError as error:
        log(f"No se pudieron guardar los respaldos: {descripcion_error(error)}")

    # 3. Supabase.
    filas = para_supabase(coquimbo)
    if debug:
        tipos = {}
        for fila in filas:
            tipo = fila["geometria"]["type"] if fila["geometria"] else "sin geometría"
            tipos[tipo] = tipos.get(tipo, 0) + 1
        log(f"   Geometrías a subir      : {tipos or 'ninguna'}")
    if cliente is None:
        log(f"Chile: {len(todos)} cortes · Coquimbo: {len(coquimbo)} "
            f"({len(filas)} con coordenadas). Sin Supabase (--sin-supabase).")
        return
    try:
        cantidad = sincronizar(cliente, filas)
        log(f"Chile: {len(todos)} cortes · Coquimbo: {len(coquimbo)} · "
            f"en Supabase: {cantidad}.")
    except Exception as error:
        log(f"No se pudo actualizar Supabase ({descripcion_error(error)}). "
            "Se mantienen los datos anteriores.")


def main():
    parser = argparse.ArgumentParser(
        description="Sincroniza cada minuto los cortes de luz de CGE (Región de Coquimbo) con Supabase.")
    parser.add_argument("--debug", action="store_true",
                        help="Mostrar estadísticas de filtrado.")
    parser.add_argument("--una-vez", action="store_true",
                        help="Ejecutar un solo ciclo y terminar.")
    parser.add_argument("--sin-supabase", action="store_true",
                        help="Solo descargar y guardar respaldos (para probar).")
    parser.add_argument("--base-dir", type=Path, default=CARPETA_SCRIPT,
                        help="Carpeta donde se crean 'coquimbo' y 'chile' (por defecto, la del script).")
    args = parser.parse_args()

    load_dotenv(CARPETA_SCRIPT / ".env")
    necesarias = ["CGE_KMZ_URL"] + ([] if args.sin_supabase else ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
    faltan = [nombre for nombre in necesarias if not os.environ.get(nombre)]
    if faltan:
        sys.exit(f"Faltan variables en {CARPETA_SCRIPT / '.env'}: {', '.join(faltan)}")

    cliente = None if args.sin_supabase else conectar_supabase()
    log(f"Sincronizando cortes de CGE cada {INTERVALO_SEGUNDOS} s. Ctrl+C para detener.")

    try:
        while True:
            try:
                ciclo(os.environ["CGE_KMZ_URL"], cliente, args.base_dir, debug=args.debug)
            except Exception as error:
                # Último recurso: un error inesperado no detiene el bucle.
                log(f"Error inesperado: {descripcion_error(error)}")
            if args.una_vez:
                break
            time.sleep(INTERVALO_SEGUNDOS)
    except KeyboardInterrupt:
        log("Detenido.")


if __name__ == "__main__":
    main()
