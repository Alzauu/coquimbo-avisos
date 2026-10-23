import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Crea usuarios de prueba reales, inicia sesión con cada uno y prueba lo
// que pueden hacer con la API, sin pasar por la app. Los clientes van sin
// tipos a propósito: piden columnas que el usuario no debería poder llenar.
// El mensaje de error nombra la variable, nunca muestra su valor.
function variable(nombre: string, archivo: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta ${nombre} en apps/web/${archivo}.`);
  return valor;
}

const url = variable("NEXT_PUBLIC_SUPABASE_URL", ".env.local");
const anonKey = variable("NEXT_PUBLIC_SUPABASE_ANON_KEY", ".env.local");
const serviceKey = variable("SUPABASE_SERVICE_ROLE_KEY", ".env.test.local");

const sinSesionPersistente = {
  auth: { persistSession: false, autoRefreshToken: false },
};
// Solo crea y borra usuarios de prueba y limpia lo que crearon.
const admin = createClient(url, serviceKey, sinSesionPersistente);
const anon = createClient(url, anonKey, sinSesionPersistente);

const BUCKET = "reportes-fotos";
const LA_SERENA = 4101;
const COQUIMBO_INACTIVA = 4102;
const PUNTO = "SRID=4326;POINT(-71.25 -29.905)";
const PERMISO_DENEGADO = "42501";
const CHECK_VIOLADO = "23514";

type Usuario = { id: string; cliente: SupabaseClient };

const idsCreados: string[] = [];
let a: Usuario;
let b: Usuario;
let c: Usuario;
let categoriaId: number;

async function crearUsuario(nombre: string): Promise<Usuario> {
  const email = `rls-${nombre}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  }
  idsCreados.push(data.user.id);

  const cliente = createClient(url, anonKey, sinSesionPersistente);
  const sesion = await cliente.auth.signInWithPassword({ email, password });
  if (sesion.error) {
    throw new Error(`No se pudo iniciar sesión: ${sesion.error.message}`);
  }
  return { id: data.user.id, cliente };
}

function nuevoReporte(extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    categoria_id: categoriaId,
    comuna_id: LA_SERENA,
    titulo: "Reporte de prueba RLS",
    descripcion: "Creado por test:rls; se borra al terminar.",
    ubicacion: PUNTO,
    ...extra,
  };
}

async function crearReporte(usuario: Usuario) {
  const reporte = nuevoReporte();
  const { error } = await usuario.cliente.from("reportes").insert(reporte);
  expect(error).toBeNull();
  return reporte.id;
}

const rutaFoto = (usuarioId: string, reporteId: string) =>
  `${usuarioId}/${reporteId}/${randomUUID()}.webp`;

function subir(
  usuario: Usuario,
  ruta: string,
  opciones: { bytes?: number; tipo?: string; upsert?: boolean } = {},
) {
  return usuario.cliente.storage
    .from(BUCKET)
    .upload(ruta, Buffer.alloc(opciones.bytes ?? 1024), {
      contentType: opciones.tipo ?? "image/webp",
      upsert: opciones.upsert ?? false,
    });
}

// Borra solo lo que pertenece a los usuarios creados por este archivo,
// filtrando siempre por su ID. El usuario se borra en un finally, aunque
// falle la limpieza de sus reportes o archivos; los errores se informan
// al final para no ocultarlos.
async function limpiar() {
  const errores: string[] = [];
  for (const usuarioId of idsCreados) {
    try {
      // Las fotos registradas se borran en cascada con el reporte.
      const reportes = await admin
        .from("reportes")
        .delete()
        .eq("usuario_id", usuarioId);
      if (reportes.error) errores.push(`reportes: ${reportes.error.message}`);

      const carpetas = await admin.storage.from(BUCKET).list(usuarioId);
      for (const carpeta of carpetas.data ?? []) {
        const prefijo = `${usuarioId}/${carpeta.name}`;
        const archivos = await admin.storage.from(BUCKET).list(prefijo);
        const rutas = (archivos.data ?? []).map((f) => `${prefijo}/${f.name}`);
        if (rutas.length === 0) continue;
        const borrado = await admin.storage.from(BUCKET).remove(rutas);
        if (borrado.error) errores.push(`fotos: ${borrado.error.message}`);
      }
    } finally {
      const usuario = await admin.auth.admin.deleteUser(usuarioId);
      if (usuario.error) errores.push(`usuario: ${usuario.error.message}`);
    }
  }
  if (errores.length > 0) {
    throw new Error(`Limpieza incompleta de test:rls: ${errores.join("; ")}`);
  }
}

beforeAll(async () => {
  const { data } = await anon
    .from("categorias")
    .select("id")
    .eq("tipo", "reporte")
    .eq("codigo", "calles")
    .single();
  categoriaId = data!.id;
  [a, b, c] = await Promise.all([
    crearUsuario("a"),
    crearUsuario("b"),
    crearUsuario("c"),
  ]);
});

afterAll(limpiar);

describe("crear reportes", () => {
  it("anon no puede crear reportes", async () => {
    const { error } = await anon.from("reportes").insert(nuevoReporte());
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("un usuario crea un reporte pendiente a su nombre", async () => {
    const id = await crearReporte(a);

    const { data: fila } = await admin
      .from("reportes")
      .select("usuario_id, moderacion, estado")
      .eq("id", id)
      .single();
    expect(fila).toEqual({
      usuario_id: a.id,
      moderacion: "pendiente",
      estado: "recibido",
    });
  });

  it.each([
    ["moderacion", () => "aprobado"],
    ["usuario_id", () => b.id],
    ["estado", () => "resuelto"],
    ["es_anonimo", () => true],
    ["resuelto_en", () => new Date().toISOString()],
    ["entidad_asignada_id", () => 1],
  ])("no puede fijar %s", async (columna, valor) => {
    const { error } = await a.cliente
      .from("reportes")
      .insert(nuevoReporte({ [columna]: valor() }));
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("la base rechaza un punto fuera del rectángulo de La Serena", async () => {
    // Plaza de Armas de Santiago.
    const { error } = await a.cliente
      .from("reportes")
      .insert(
        nuevoReporte({ ubicacion: "SRID=4326;POINT(-70.6506 -33.4378)" }),
      );
    expect(error?.hint).toBe("fuera_de_comuna");
  });

  it("no puede crear en una comuna inactiva", async () => {
    const { error } = await a.cliente
      .from("reportes")
      .insert(nuevoReporte({ comuna_id: COQUIMBO_INACTIVA }));
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("la base rechaza una categoría inactiva o de obras, también con service_role", async () => {
    const { data: categorias } = await anon
      .from("categorias")
      .select("id, tipo, codigo, activa");
    const semaforo = categorias!.find(
      (cat) => cat.tipo === "reporte" && cat.codigo === "semaforo",
    )!;
    const obra = categorias!.find((cat) => cat.tipo === "obra")!;
    expect(semaforo.activa).toBe(false);

    for (const categoria_id of [semaforo.id, obra.id]) {
      const { error } = await a.cliente
        .from("reportes")
        .insert(nuevoReporte({ categoria_id }));
      expect(error?.hint, String(categoria_id)).toBe("categoria_invalida");
    }
    // La regla no depende de quién inserta.
    const deServicio = await admin.from("reportes").insert({
      ...nuevoReporte({ categoria_id: semaforo.id }),
      usuario_id: a.id,
    });
    expect(deServicio.error?.hint).toBe("categoria_invalida");
  });

  it("la base rechaza un título demasiado corto", async () => {
    const { error } = await a.cliente
      .from("reportes")
      .insert(nuevoReporte({ titulo: "abc" }));
    expect(error?.code).toBe(CHECK_VIOLADO);
  });

  it("no puede cambiar el estado, editar ni borrar su reporte", async () => {
    const id = await crearReporte(a);
    const estado = await a.cliente
      .from("reportes")
      .update({ estado: "resuelto" })
      .eq("id", id);
    const moderacion = await a.cliente
      .from("reportes")
      .update({ moderacion: "aprobado" })
      .eq("id", id);
    const titulo = await a.cliente
      .from("reportes")
      .update({ titulo: "Título cambiado" })
      .eq("id", id);
    const borrar = await a.cliente.from("reportes").delete().eq("id", id);

    expect(estado.error?.code).toBe(PERMISO_DENEGADO);
    expect(moderacion.error?.code).toBe(PERMISO_DENEGADO);
    expect(titulo.error?.code).toBe(PERMISO_DENEGADO);
    expect(borrar.error?.code).toBe(PERMISO_DENEGADO);

    const { data: fila } = await admin
      .from("reportes")
      .select("estado, moderacion, titulo")
      .eq("id", id)
      .single();
    expect(fila).toEqual({
      estado: "recibido",
      moderacion: "pendiente",
      titulo: "Reporte de prueba RLS",
    });
  });
});

describe("lectura de reportes propios", () => {
  let id: string;
  beforeAll(async () => {
    id = await crearReporte(a);
  });

  it("el autor ve su reporte pendiente con mis_reportes", async () => {
    const { data, error } = await a.cliente.rpc("mis_reportes");
    expect(error).toBeNull();
    const propio = data?.find((r: { id: string }) => r.id === id);
    expect(propio).toMatchObject({ moderacion: "pendiente", fotos: [] });
    expect(typeof propio?.latitud).toBe("number");
  });

  it("otro usuario no lo ve con mis_reportes ni en la tabla", async () => {
    const propios = await b.cliente.rpc("mis_reportes");
    const tabla = await b.cliente.from("reportes").select("id").eq("id", id);
    expect(propios.data?.map((r: { id: string }) => r.id)).not.toContain(id);
    expect(tabla.data).toEqual([]);
  });

  it("anon no puede usar mis_reportes", async () => {
    const { error } = await anon.rpc("mis_reportes");
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("el reporte pendiente no aparece en el mapa público, ni para su autor", async () => {
    const zona = { oeste: -71.35, sur: -30.0, este: -71.15, norte: -29.8 };
    for (const cliente of [a.cliente, anon]) {
      const vista = await cliente
        .from("v_reportes_publicos")
        .select("id")
        .eq("id", id);
      const enZona = await cliente.rpc("reportes_en_zona", zona);
      expect(vista.data).toEqual([]);
      expect(enZona.data?.map((r: { id: string }) => r.id)).not.toContain(id);
    }
  });
});

describe("fotos", () => {
  let reporteA: string;
  let reporteB: string;
  const subidas: string[] = [];

  beforeAll(async () => {
    [reporteA, reporteB] = await Promise.all([
      crearReporte(a),
      crearReporte(b),
    ]);
  });

  it("rechaza tipos que no son WebP", async () => {
    const { error } = await subir(a, rutaFoto(a.id, reporteA), {
      tipo: "image/png",
    });
    expect(error).not.toBeNull();
  });

  it("rechaza archivos de más de 800 KB", async () => {
    const { error } = await subir(a, rutaFoto(a.id, reporteA), {
      bytes: 900 * 1024,
    });
    expect(error).not.toBeNull();
  });

  it("rechaza nombres de archivo predecibles", async () => {
    const { error } = await subir(a, `${a.id}/${reporteA}/foto1.webp`);
    expect(error).not.toBeNull();
  });

  it("no puede subir al reporte de otro usuario", async () => {
    const enSuCarpeta = await subir(a, rutaFoto(a.id, reporteB));
    const enCarpetaAjena = await subir(a, rutaFoto(b.id, reporteB));
    expect(enSuCarpeta.error).not.toBeNull();
    expect(enCarpetaAjena.error).not.toBeNull();
  });

  it("sube hasta 3 fotos a su reporte y la cuarta se rechaza", async () => {
    for (let i = 0; i < 3; i++) {
      const ruta = rutaFoto(a.id, reporteA);
      const { error } = await subir(a, ruta);
      expect(error).toBeNull();
      subidas.push(ruta);
    }
    const { error } = await subir(a, rutaFoto(a.id, reporteA));
    expect(error).not.toBeNull();
  });

  it("no puede reemplazar ni borrar una foto subida", async () => {
    const ruta = subidas[0]!;
    const reemplazo = await subir(a, ruta, { upsert: true });
    await a.cliente.storage.from(BUCKET).remove([ruta]);
    expect(reemplazo.error).not.toBeNull();

    const { data: archivos } = await admin.storage
      .from(BUCKET)
      .list(`${a.id}/${reporteA}`);
    expect(archivos).toHaveLength(3);
  });

  it("registra sus fotos subidas, en orden 1 a 3", async () => {
    const { error } = await a.cliente.from("reporte_fotos").insert(
      subidas.map((ruta, i) => ({
        reporte_id: reporteA,
        ruta,
        orden: i + 1,
      })),
    );
    expect(error).toBeNull();

    const { data } = await a.cliente.rpc("mis_reportes");
    const propio = data?.find((r: { id: string }) => r.id === reporteA);
    expect(propio?.fotos).toEqual(subidas);
  });

  it("no puede registrar una cuarta foto", async () => {
    const { error } = await a.cliente
      .from("reporte_fotos")
      .insert({ reporte_id: reporteA, ruta: subidas[0], orden: 4 });
    expect(error).not.toBeNull();
  });

  it("no puede registrar un archivo que no subió", async () => {
    const { error } = await a.cliente.from("reporte_fotos").insert({
      reporte_id: reporteA,
      ruta: rutaFoto(a.id, reporteA),
      orden: 1,
    });
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("otro usuario no puede registrar fotos en el reporte ajeno", async () => {
    const { error } = await b.cliente
      .from("reporte_fotos")
      .insert({ reporte_id: reporteA, ruta: subidas[0], orden: 1 });
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("solo el autor puede firmar URLs de sus fotos", async () => {
    const ruta = subidas[0]!;
    const autor = await a.cliente.storage
      .from(BUCKET)
      .createSignedUrl(ruta, 60);
    const otro = await b.cliente.storage.from(BUCKET).createSignedUrl(ruta, 60);
    const visitante = await anon.storage.from(BUCKET).createSignedUrl(ruta, 60);

    expect(autor.error).toBeNull();
    expect(autor.data?.signedUrl).toBeTruthy();
    expect(otro.error).not.toBeNull();
    expect(visitante.error).not.toBeNull();
  });

  it("el bucket no es público", async () => {
    const { data } = anon.storage.from(BUCKET).getPublicUrl(subidas[0]!);
    const respuesta = await fetch(data.publicUrl);
    expect(respuesta.ok).toBe(false);
  });
});

describe("límite de frecuencia", () => {
  it("permite 5 reportes por hora y rechaza el sexto", async () => {
    for (let i = 0; i < 5; i++) await crearReporte(c);

    const { error } = await c.cliente.from("reportes").insert(nuevoReporte());
    expect(error?.hint).toBe("limite_frecuencia");
    expect(error?.message).toBe("Alcanzaste el límite de 5 reportes por hora.");
  });
});
