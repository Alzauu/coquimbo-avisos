import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Moderación: solo moderadores y admins revisan reportes, cada decisión
// queda en el historial y lo oculto deja de ser público. Igual que
// crear-reportes.test.ts, crea usuarios reales y llama a la API sin pasar
// por la app; el rol de moderador se asigna con service_role, como se
// haría desde el panel de Supabase.
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
// Solo prepara datos, revisa el resultado y limpia.
const admin = createClient(url, serviceKey, sinSesionPersistente);
const anon = createClient(url, anonKey, sinSesionPersistente);

const BUCKET = "reportes-fotos";
const LA_SERENA = 4101;
const PUNTO = "SRID=4326;POINT(-71.25 -29.905)";
const ZONA = { oeste: -71.35, sur: -30.0, este: -71.15, norte: -29.8 };
const PERMISO_DENEGADO = "42501";

type Usuario = { id: string; cliente: SupabaseClient };
type Reporte = { id: string; fotoId: number; ruta: string };

const idsCreados: string[] = [];
let autor: Usuario;
let otro: Usuario;
let moderador: Usuario;
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

// Reporte pendiente del autor, con una foto subida y registrada. Se crea
// con service_role para no chocar con el límite de 5 reportes por hora;
// crear-reportes.test.ts ya prueba la creación por el propio usuario.
async function crearReporte(): Promise<Reporte> {
  const id = randomUUID();
  const reporte = await admin.from("reportes").insert({
    id,
    usuario_id: autor.id,
    categoria_id: categoriaId,
    comuna_id: LA_SERENA,
    titulo: "Reporte de prueba de moderación",
    descripcion: "Creado por test:rls; se borra al terminar.",
    ubicacion: PUNTO,
  });
  expect(reporte.error).toBeNull();

  const ruta = `${autor.id}/${id}/${randomUUID()}.webp`;
  const subida = await admin.storage
    .from(BUCKET)
    .upload(ruta, Buffer.alloc(1024), { contentType: "image/webp" });
  expect(subida.error).toBeNull();
  const { data: foto, error } = await admin
    .from("reporte_fotos")
    .insert({ reporte_id: id, ruta, orden: 1 })
    .select("id")
    .single();
  expect(error).toBeNull();
  return { id, fotoId: foto!.id, ruta };
}

async function moderacionDe(reporteId: string) {
  const { data } = await admin
    .from("reportes")
    .select("moderacion, estado, resuelto_en")
    .eq("id", reporteId)
    .single();
  return data;
}

async function historialDe(reporteId: string) {
  const { data } = await admin
    .from("reporte_historial")
    .select(
      "accion, estado_anterior, estado_nuevo, moderacion_anterior, moderacion_nueva, cambiado_por, nota, foto_id",
    )
    .eq("reporte_id", reporteId)
    .order("id");
  return data ?? [];
}

async function idsEnMapa(cliente: SupabaseClient) {
  const { data, error } = await cliente.rpc("reportes_en_zona", ZONA);
  expect(error).toBeNull();
  return (data ?? []).map((r: { id: string }) => r.id);
}

async function fotosPublicas(cliente: SupabaseClient, reporteId: string) {
  const { data, error } = await cliente
    .from("reporte_fotos")
    .select("id, orden")
    .eq("reporte_id", reporteId);
  expect(error).toBeNull();
  return data ?? [];
}

// Todas las funciones de moderación, con argumentos válidos.
const llamadas = (reporte: Reporte) =>
  [
    ["reportes_pendientes", {}],
    ["aprobar_reporte", { reporte: reporte.id }],
    ["rechazar_reporte", { reporte: reporte.id, motivo: "Motivo de prueba" }],
    ["ocultar_reporte", { reporte: reporte.id }],
    ["ocultar_foto", { foto: reporte.fotoId }],
    ["cambiar_estado_reporte", { reporte: reporte.id, nuevo: "resuelto" }],
  ] as const;

// Igual que en crear-reportes.test.ts: borra solo lo de los usuarios
// creados aquí y siempre borra el usuario, aunque falle lo demás.
async function limpiar() {
  const errores: string[] = [];
  for (const usuarioId of idsCreados) {
    try {
      // Fotos registradas e historial se borran en cascada con el reporte.
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
  [autor, otro, moderador] = await Promise.all([
    crearUsuario("autor"),
    crearUsuario("otro"),
    crearUsuario("moderador"),
  ]);
  const rol = await admin
    .from("perfiles")
    .update({ rol: "moderador" })
    .eq("id", moderador.id);
  expect(rol.error).toBeNull();
});

afterAll(limpiar);

describe("sin rol de moderador", () => {
  let reporte: Reporte;
  beforeAll(async () => {
    reporte = await crearReporte();
  });

  it("anon no puede ejecutar ninguna función de moderación", async () => {
    for (const [funcion, argumentos] of llamadas(reporte)) {
      const { error } = await anon.rpc(funcion, argumentos);
      expect(error?.code, funcion).toBe(PERMISO_DENEGADO);
    }
  });

  it("un usuario normal no puede ejecutar ninguna, ni siquiera sobre su reporte", async () => {
    for (const [funcion, argumentos] of llamadas(reporte)) {
      const { error } = await autor.cliente.rpc(funcion, argumentos);
      expect(error?.code, funcion).toBe(PERMISO_DENEGADO);
    }
    expect(await moderacionDe(reporte.id)).toMatchObject({
      moderacion: "pendiente",
      estado: "recibido",
    });
    expect(await historialDe(reporte.id)).toEqual([]);
  });

  it("no puede llamar a las funciones internas", async () => {
    const exigir = await autor.cliente.rpc("exigir_moderador");
    const moderar = await autor.cliente.rpc("moderar_reporte", {
      reporte: reporte.id,
      esperada: "pendiente",
      nueva: "aprobado",
      accion: "aprobar",
      nota: null,
    });
    expect(exigir.error).not.toBeNull();
    expect(moderar.error).not.toBeNull();
    expect((await moderacionDe(reporte.id))?.moderacion).toBe("pendiente");
  });

  it("no puede ocultar fotos ni leer el historial directamente", async () => {
    const foto = await autor.cliente
      .from("reporte_fotos")
      .update({ oculta: true })
      .eq("id", reporte.fotoId);
    const historial = await autor.cliente
      .from("reporte_historial")
      .select("id");
    expect(foto.error?.code).toBe(PERMISO_DENEGADO);
    expect(historial.error?.code).toBe(PERMISO_DENEGADO);
  });

  it("es_moderador responde false", async () => {
    const { data } = await autor.cliente.rpc("es_moderador");
    expect(data).toBe(false);
  });
});

describe("como moderador", () => {
  it("es_moderador responde true", async () => {
    const { data } = await moderador.cliente.rpc("es_moderador");
    expect(data).toBe(true);
  });

  it("lista los pendientes con sus fotos y sin datos del autor", async () => {
    const reporte = await crearReporte();
    const { data, error } = await moderador.cliente.rpc("reportes_pendientes");
    expect(error).toBeNull();
    const fila = data?.find((r: { id: string }) => r.id === reporte.id);
    expect(fila).toBeDefined();
    expect(fila).not.toHaveProperty("usuario_id");
    expect(typeof fila.latitud).toBe("number");
    expect(fila.fotos).toEqual([
      { id: reporte.fotoId, ruta: reporte.ruta, orden: 1, oculta: false },
    ]);
  });

  it("puede firmar fotos pendientes; otro usuario no", async () => {
    const reporte = await crearReporte();
    const deModerador = await moderador.cliente.storage
      .from(BUCKET)
      .createSignedUrl(reporte.ruta, 60);
    const deOtro = await otro.cliente.storage
      .from(BUCKET)
      .createSignedUrl(reporte.ruta, 60);
    expect(deModerador.error).toBeNull();
    expect(deOtro.error).not.toBeNull();
  });

  it("aprueba: el reporte y su foto pasan a ser públicos y queda registrado", async () => {
    const reporte = await crearReporte();
    expect(await idsEnMapa(anon)).not.toContain(reporte.id);
    expect(await fotosPublicas(anon, reporte.id)).toEqual([]);

    const { error } = await moderador.cliente.rpc("aprobar_reporte", {
      reporte: reporte.id,
    });
    expect(error).toBeNull();

    expect(await idsEnMapa(anon)).toContain(reporte.id);
    expect(await fotosPublicas(anon, reporte.id)).toEqual([
      { id: reporte.fotoId, orden: 1 },
    ]);
    expect(await historialDe(reporte.id)).toEqual([
      {
        accion: "aprobar",
        estado_anterior: "recibido",
        estado_nuevo: "recibido",
        moderacion_anterior: "pendiente",
        moderacion_nueva: "aprobado",
        cambiado_por: moderador.id,
        nota: null,
        foto_id: null,
      },
    ]);

    const otraVez = await moderador.cliente.rpc("aprobar_reporte", {
      reporte: reporte.id,
    });
    expect(otraVez.error?.hint).toBe("ya_revisado");
  });

  it("rechaza solo con motivo; el autor ve el motivo y el público no ve nada", async () => {
    const reporte = await crearReporte();

    for (const motivo of ["", "   ", "abc", "x".repeat(501)]) {
      const { error } = await moderador.cliente.rpc("rechazar_reporte", {
        reporte: reporte.id,
        motivo,
      });
      expect(error?.hint).toBe("motivo_invalido");
    }
    expect((await moderacionDe(reporte.id))?.moderacion).toBe("pendiente");

    const { error } = await moderador.cliente.rpc("rechazar_reporte", {
      reporte: reporte.id,
      motivo: "  Es un duplicado de otro reporte.  ",
    });
    expect(error).toBeNull();

    expect((await moderacionDe(reporte.id))?.moderacion).toBe("rechazado");
    expect(await idsEnMapa(anon)).not.toContain(reporte.id);
    expect(await fotosPublicas(anon, reporte.id)).toEqual([]);
    expect(await historialDe(reporte.id)).toMatchObject([
      {
        accion: "rechazar",
        moderacion_nueva: "rechazado",
        cambiado_por: moderador.id,
        nota: "Es un duplicado de otro reporte.",
      },
    ]);

    const { data } = await autor.cliente.rpc("mis_reportes");
    const propio = data?.find((r: { id: string }) => r.id === reporte.id);
    expect(propio).toMatchObject({
      moderacion: "rechazado",
      motivo_rechazo: "Es un duplicado de otro reporte.",
    });
  });

  it("cambia el estado del problema de un reporte publicado", async () => {
    const reporte = await crearReporte();
    const pendiente = await moderador.cliente.rpc("cambiar_estado_reporte", {
      reporte: reporte.id,
      nuevo: "resuelto",
    });
    expect(pendiente.error?.hint).toBe("no_publicado");

    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    const rechazado = await moderador.cliente.rpc("cambiar_estado_reporte", {
      reporte: reporte.id,
      nuevo: "rechazado",
    });
    expect(rechazado.error?.hint).toBe("estado_invalido");

    const resuelto = await moderador.cliente.rpc("cambiar_estado_reporte", {
      reporte: reporte.id,
      nuevo: "resuelto",
    });
    expect(resuelto.error).toBeNull();
    const fila = await moderacionDe(reporte.id);
    expect(fila?.estado).toBe("resuelto");
    expect(fila?.resuelto_en).not.toBeNull();

    const reabierto = await moderador.cliente.rpc("cambiar_estado_reporte", {
      reporte: reporte.id,
      nuevo: "en_revision",
    });
    expect(reabierto.error).toBeNull();
    expect(await moderacionDe(reporte.id)).toMatchObject({
      estado: "en_revision",
      resuelto_en: null,
    });

    expect(
      (await historialDe(reporte.id)).filter(
        (h) => h.accion === "cambiar_estado",
      ),
    ).toMatchObject([
      { estado_anterior: "recibido", estado_nuevo: "resuelto" },
      { estado_anterior: "resuelto", estado_nuevo: "en_revision" },
    ]);
  });

  it("oculta una foto suelta: deja de ser pública y queda registrado", async () => {
    const reporte = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    expect(await fotosPublicas(anon, reporte.id)).toHaveLength(1);

    const { error } = await moderador.cliente.rpc("ocultar_foto", {
      foto: reporte.fotoId,
    });
    expect(error).toBeNull();

    expect(await fotosPublicas(anon, reporte.id)).toEqual([]);
    expect(await idsEnMapa(anon)).toContain(reporte.id);
    expect(await historialDe(reporte.id)).toMatchObject([
      { accion: "aprobar" },
      {
        accion: "ocultar_foto",
        foto_id: reporte.fotoId,
        cambiado_por: moderador.id,
      },
    ]);

    const otraVez = await moderador.cliente.rpc("ocultar_foto", {
      foto: reporte.fotoId,
    });
    expect(otraVez.error?.hint).toBe("foto_no_disponible");
  });

  it("oculta un reporte publicado: deja de verse en el mapa público", async () => {
    const reporte = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    expect(await idsEnMapa(anon)).toContain(reporte.id);

    const { error } = await moderador.cliente.rpc("ocultar_reporte", {
      reporte: reporte.id,
      motivo: "La foto muestra una patente.",
    });
    expect(error).toBeNull();

    for (const cliente of [anon, otro.cliente, autor.cliente]) {
      expect(await idsEnMapa(cliente)).not.toContain(reporte.id);
      const vista = await cliente
        .from("v_reportes_publicos")
        .select("id")
        .eq("id", reporte.id);
      expect(vista.data).toEqual([]);
      expect(await fotosPublicas(cliente, reporte.id)).toEqual([]);
    }
    expect(await historialDe(reporte.id)).toMatchObject([
      { accion: "aprobar" },
      {
        accion: "ocultar_reporte",
        moderacion_anterior: "aprobado",
        moderacion_nueva: "oculto",
        nota: "La foto muestra una patente.",
      },
    ]);
  });
});

describe("fotos públicas", () => {
  it("nadie puede leer la ruta de una foto, ni de reportes publicados", async () => {
    const reporte = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    for (const cliente of [anon, autor.cliente, moderador.cliente]) {
      const { error } = await cliente
        .from("reporte_fotos")
        .select("ruta")
        .eq("id", reporte.fotoId);
      expect(error?.code).toBe(PERMISO_DENEGADO);
    }
  });

  it("solo service_role puede ejecutar ruta_foto_publica", async () => {
    const reporte = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    for (const cliente of [anon, autor.cliente, moderador.cliente]) {
      const { error } = await cliente.rpc("ruta_foto_publica", {
        foto: reporte.fotoId,
      });
      expect(error?.code).toBe(PERMISO_DENEGADO);
    }
  });

  it("ruta_foto_publica solo entrega fotos visibles de reportes publicados", async () => {
    const ruta = async (foto: number) =>
      (await admin.rpc("ruta_foto_publica", { foto })).data;

    const pendiente = await crearReporte();
    expect(await ruta(pendiente.fotoId)).toBeNull();

    const publicado = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: publicado.id });
    expect(await ruta(publicado.fotoId)).toBe(publicado.ruta);

    await moderador.cliente.rpc("ocultar_foto", { foto: publicado.fotoId });
    expect(await ruta(publicado.fotoId)).toBeNull();

    const oculto = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: oculto.id });
    await moderador.cliente.rpc("ocultar_reporte", { reporte: oculto.id });
    expect(await ruta(oculto.fotoId)).toBeNull();

    const rechazado = await crearReporte();
    await moderador.cliente.rpc("rechazar_reporte", {
      reporte: rechazado.id,
      motivo: "Motivo de prueba",
    });
    expect(await ruta(rechazado.fotoId)).toBeNull();
  });

  it("anon no puede firmar URLs de fotos publicadas", async () => {
    const reporte = await crearReporte();
    await moderador.cliente.rpc("aprobar_reporte", { reporte: reporte.id });
    const { error } = await anon.storage
      .from(BUCKET)
      .createSignedUrl(reporte.ruta, 60);
    expect(error).not.toBeNull();
  });
});
