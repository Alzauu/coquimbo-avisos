import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// reportes_cercanos (posibles duplicados al reportar): solo reportes
// públicos, de la categoría pedida, sin resolver y dentro del radio, con el
// radio acotado entre 10 y 200 m. Los reportes de prueba se insertan con
// service_role (sin el límite de 5 por hora) en un punto apartado de La
// Serena, lejos de los datos de ejemplo, y se borran al terminar.
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

const LA_SERENA = 4101;
// Punto de referencia. Hacia el norte, 0,00001° de latitud ≈ 1,11 m.
const BASE = { latitud: -29.7, longitud: -70.95 };
const METROS_POR_GRADO = 111_000;

type Usuario = { id: string; cliente: SupabaseClient };
type Moderacion = "pendiente" | "aprobado" | "oculto";

const idsCreados = new Set<string>();
let autor: Usuario;
let moderador: Usuario;
let calles: number;
let basura: number;

// Reportes de prueba, por su distancia al norte de BASE.
const r: Record<string, string> = {};

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
  idsCreados.add(data.user.id);

  const cliente = createClient(url, anonKey, sinSesionPersistente);
  const sesion = await cliente.auth.signInWithPassword({ email, password });
  if (sesion.error) {
    throw new Error(`No se pudo iniciar sesión: ${sesion.error.message}`);
  }
  return { id: data.user.id, cliente };
}

async function crearReporte(
  metrosAlNorte: number,
  {
    categoria = calles,
    moderacion = "aprobado",
    resuelto = false,
  }: { categoria?: number; moderacion?: Moderacion; resuelto?: boolean } = {},
) {
  const id = randomUUID();
  const latitud = BASE.latitud + metrosAlNorte / METROS_POR_GRADO;
  const { error } = await admin.from("reportes").insert({
    id,
    usuario_id: autor.id,
    categoria_id: categoria,
    comuna_id: LA_SERENA,
    titulo: `Prueba de cercanos a ${metrosAlNorte} m`,
    descripcion: "Creado por test:rls; se borra al terminar.",
    ubicacion: `SRID=4326;POINT(${BASE.longitud} ${latitud})`,
    moderacion,
    ...(resuelto
      ? { estado: "resuelto", resuelto_en: new Date().toISOString() }
      : {}),
  });
  expect(error).toBeNull();
  return id;
}

type Consulta = {
  latitud?: number;
  longitud?: number;
  categoria?: number | null;
  radio_m?: number;
};

async function cercanos(
  cliente: SupabaseClient,
  { categoria = calles, ...resto }: Consulta = {},
) {
  const { data, error } = await cliente.rpc("reportes_cercanos", {
    ...BASE,
    categoria,
    ...resto,
  });
  expect(error).toBeNull();
  return data as { id: string; distancia_m: number }[];
}

// Ids de los reportes de este archivo, en el orden devuelto (por si hay
// otros reportes públicos cerca del punto).
const nuestros = (filas: { id: string }[]) =>
  filas.map((f) => f.id).filter((id) => Object.values(r).includes(id));

async function limpiar() {
  const errores: string[] = [];
  for (const usuarioId of idsCreados) {
    try {
      const reportes = await admin
        .from("reportes")
        .delete()
        .eq("usuario_id", usuarioId);
      if (reportes.error) errores.push(`reportes: ${reportes.error.message}`);
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
  const { data, error } = await anon
    .from("categorias")
    .select("id, codigo")
    .eq("tipo", "reporte")
    .in("codigo", ["calles", "basura"]);
  expect(error).toBeNull();
  calles = data!.find((c) => c.codigo === "calles")!.id;
  basura = data!.find((c) => c.codigo === "basura")!.id;

  [autor, moderador] = await Promise.all([
    crearUsuario("autor-cercanos"),
    crearUsuario("moderador-cercanos"),
  ]);
  const rol = await admin
    .from("perfiles")
    .update({ rol: "moderador" })
    .eq("id", moderador.id);
  expect(rol.error).toBeNull();

  r.a5 = await crearReporte(5);
  r.a30 = await crearReporte(30);
  r.a60 = await crearReporte(60);
  r.a120 = await crearReporte(120);
  r.a250 = await crearReporte(250);
  r.pendiente10 = await crearReporte(10, { moderacion: "pendiente" });
  r.oculto15 = await crearReporte(15, { moderacion: "oculto" });
  r.resuelto40 = await crearReporte(40, { resuelto: true });
  r.basura20 = await crearReporte(20, { categoria: basura });
});

afterAll(limpiar);

describe("reportes cercanos a un punto", () => {
  it("anon ve solo los públicos de la categoría, sin resolver, dentro de 75 m y del más cercano al más lejano", async () => {
    expect(nuestros(await cercanos(anon))).toEqual([r.a5, r.a30, r.a60]);
  });

  it("nunca devuelve pendientes ni ocultos, ni a su autor ni a moderación", async () => {
    for (const cliente of [autor.cliente, moderador.cliente]) {
      const ids = nuestros(await cercanos(cliente));
      expect(ids).toEqual([r.a5, r.a30, r.a60]);
      expect(ids).not.toContain(r.pendiente10);
      expect(ids).not.toContain(r.oculto15);
    }
  });

  it("sin categoría incluye las demás categorías", async () => {
    expect(nuestros(await cercanos(anon, { categoria: null }))).toEqual([
      r.a5,
      r.basura20,
      r.a30,
      r.a60,
    ]);
  });

  it("entrega la distancia en metros", async () => {
    const filas = await cercanos(anon);
    const distancia = (id: string) =>
      filas.find((f) => f.id === id)!.distancia_m;
    expect(distancia(r.a5!)).toBeGreaterThanOrEqual(4);
    expect(distancia(r.a5!)).toBeLessThanOrEqual(6);
    expect(distancia(r.a60!)).toBeGreaterThanOrEqual(58);
    expect(distancia(r.a60!)).toBeLessThanOrEqual(62);
  });

  it("solo entrega columnas públicas", async () => {
    const [fila] = await cercanos(anon);
    expect(Object.keys(fila!).sort()).toEqual([
      "categoria_id",
      "creado_en",
      "direccion_referencia",
      "distancia_m",
      "estado",
      "id",
      "me_afecta",
      "titulo",
    ]);
  });
});

describe("radio", () => {
  it("respeta un radio pedido dentro del rango", async () => {
    expect(nuestros(await cercanos(anon, { radio_m: 150 }))).toEqual([
      r.a5,
      r.a30,
      r.a60,
      r.a120,
    ]);
  });

  it("acota un radio grande a 200 m", async () => {
    const ids = nuestros(await cercanos(anon, { radio_m: 1000 }));
    expect(ids).toContain(r.a120);
    expect(ids).not.toContain(r.a250);
  });

  it("acota un radio chico a 10 m", async () => {
    expect(nuestros(await cercanos(anon, { radio_m: 1 }))).toEqual([r.a5]);
  });
});

describe("casos límite", () => {
  it("un punto fuera de rango no devuelve nada ni falla", async () => {
    expect(await cercanos(anon, { latitud: 100 })).toEqual([]);
    expect(await cercanos(anon, { longitud: -200 })).toEqual([]);
  });

  it("devuelve como máximo 5 reportes", async () => {
    r.a15 = await crearReporte(15);
    r.a45 = await crearReporte(45);
    r.a70 = await crearReporte(70);
    expect(nuestros(await cercanos(anon))).toEqual([
      r.a5,
      r.a15,
      r.a30,
      r.a45,
      r.a60,
    ]);
  });
});
