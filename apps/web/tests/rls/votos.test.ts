import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Votos «Me afecta» / «No me afecta»: un voto por usuario y reporte, solo
// en reportes públicos ajenos, solo con votar_reporte y nadie lee votos
// de otros. Igual que crear-reportes.test.ts, crea usuarios reales y
// llama a la API sin pasar por la app; los reportes se aprueban y el rol
// de moderador se asigna con service_role.
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
const PUNTO = "SRID=4326;POINT(-71.25 -29.905)";
const PERMISO_DENEGADO = "42501";
const LIMITE_POR_HORA = 60;

type Usuario = { id: string; cliente: SupabaseClient };

const idsCreados = new Set<string>();
let autor: Usuario;
let vecino: Usuario;
let otro: Usuario;
let moderador: Usuario;
let categoriaId: number;
let publico: string;
let pendiente: string;

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

async function borrarUsuario(usuario: Usuario) {
  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  expect(error).toBeNull();
  idsCreados.delete(usuario.id);
}

async function crearReporte(aprobado: boolean) {
  const id = randomUUID();
  const { error } = await autor.cliente.from("reportes").insert({
    id,
    categoria_id: categoriaId,
    comuna_id: LA_SERENA,
    titulo: "Reporte de prueba de votos",
    descripcion: "Creado por test:rls; se borra al terminar.",
    ubicacion: PUNTO,
  });
  expect(error).toBeNull();
  if (aprobado) {
    const aprobacion = await admin
      .from("reportes")
      .update({ moderacion: "aprobado" })
      .eq("id", id);
    expect(aprobacion.error).toBeNull();
  }
  return id;
}

const votar = (usuario: Usuario, reporte: string, voto: 1 | -1 | null) =>
  usuario.cliente.rpc("votar_reporte", { reporte, voto });

async function totalesPublicos(reporte: string) {
  const { data, error } = await anon
    .from("v_reportes_publicos")
    .select("me_afecta, no_me_afecta")
    .eq("id", reporte)
    .single();
  expect(error).toBeNull();
  return data;
}

// Valor guardado del voto de un usuario, leído con service_role.
async function votoGuardado(usuario: Usuario, reporte: string) {
  const { data } = await admin
    .from("reporte_votos")
    .select("valor")
    .eq("reporte_id", reporte)
    .eq("usuario_id", usuario.id)
    .maybeSingle();
  return data?.valor ?? null;
}

// Borra los reportes de los usuarios creados (sus votos y totales se van
// en cascada) y después los usuarios, aunque falle lo primero.
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
  const { data } = await anon
    .from("categorias")
    .select("id")
    .eq("tipo", "reporte")
    .eq("codigo", "calles")
    .single();
  categoriaId = data!.id;
  [autor, vecino, otro, moderador] = await Promise.all([
    crearUsuario("autor"),
    crearUsuario("vecino"),
    crearUsuario("otro"),
    crearUsuario("moderador"),
  ]);
  const rol = await admin
    .from("perfiles")
    .update({ rol: "moderador" })
    .eq("id", moderador.id);
  expect(rol.error).toBeNull();
  publico = await crearReporte(true);
  pendiente = await crearReporte(false);
});

afterAll(limpiar);

describe("votar un reporte público", () => {
  it("anon no puede votar ni leer votos", async () => {
    const voto = await anon.rpc("votar_reporte", { reporte: publico, voto: 1 });
    const lectura = await anon.from("reporte_votos").select("valor");
    expect(voto.error?.code).toBe(PERMISO_DENEGADO);
    expect(lectura.error?.code).toBe(PERMISO_DENEGADO);
  });

  it("un vecino vota, cambia y quita su voto; los totales lo siguen", async () => {
    const meAfecta = await votar(vecino, publico, 1);
    expect(meAfecta.error).toBeNull();
    expect(meAfecta.data).toEqual([{ me_afecta: 1, no_me_afecta: 0 }]);
    expect(await totalesPublicos(publico)).toEqual({
      me_afecta: 1,
      no_me_afecta: 0,
    });

    const cambio = await votar(vecino, publico, -1);
    expect(cambio.data).toEqual([{ me_afecta: 0, no_me_afecta: 1 }]);

    // Repetir el mismo voto no lo cuenta dos veces.
    const repetido = await votar(vecino, publico, -1);
    expect(repetido.data).toEqual([{ me_afecta: 0, no_me_afecta: 1 }]);

    const quitado = await votar(vecino, publico, null);
    expect(quitado.data).toEqual([{ me_afecta: 0, no_me_afecta: 0 }]);
    expect(await totalesPublicos(publico)).toEqual({
      me_afecta: 0,
      no_me_afecta: 0,
    });
  });

  it("cada usuario ve solo su voto, sin usuario_id", async () => {
    expect((await votar(vecino, publico, 1)).error).toBeNull();
    expect((await votar(otro, publico, -1)).error).toBeNull();

    const { data, error } = await vecino.cliente
      .from("reporte_votos")
      .select("reporte_id, valor")
      .eq("reporte_id", publico);
    expect(error).toBeNull();
    expect(data).toEqual([{ reporte_id: publico, valor: 1 }]);

    const conUsuario = await vecino.cliente
      .from("reporte_votos")
      .select("usuario_id");
    expect(conUsuario.error?.code).toBe(PERMISO_DENEGADO);

    expect(await totalesPublicos(publico)).toEqual({
      me_afecta: 1,
      no_me_afecta: 1,
    });
  });

  it("rechaza un voto que no es 1, -1 ni nulo", async () => {
    const { error } = await vecino.cliente.rpc("votar_reporte", {
      reporte: publico,
      voto: 2,
    });
    expect(error?.hint).toBe("voto_invalido");
  });
});

describe("votos no permitidos", () => {
  it("el autor no puede votar su reporte", async () => {
    const { error } = await votar(autor, publico, 1);
    expect(error?.hint).toBe("reporte_propio");
  });

  it("nadie vota un reporte pendiente, ni un moderador", async () => {
    const vecinoVota = await votar(vecino, pendiente, 1);
    const moderadorVota = await votar(moderador, pendiente, 1);
    expect(vecinoVota.error?.hint).toBe("no_existe");
    expect(moderadorVota.error?.hint).toBe("no_existe");
  });

  it("nadie escribe en reporte_votos directamente, ni su propio voto", async () => {
    const insertar = await vecino.cliente
      .from("reporte_votos")
      .insert({ reporte_id: publico, valor: 1 });
    const aNombreDeOtro = await vecino.cliente
      .from("reporte_votos")
      .insert({ reporte_id: publico, usuario_id: otro.id, valor: 1 });
    const cambiarPropio = await vecino.cliente
      .from("reporte_votos")
      .update({ valor: -1 })
      .eq("reporte_id", publico);
    const cambiarAjeno = await vecino.cliente
      .from("reporte_votos")
      .update({ valor: 1 })
      .eq("reporte_id", publico)
      .eq("usuario_id", otro.id);
    const borrarPropio = await vecino.cliente
      .from("reporte_votos")
      .delete()
      .eq("reporte_id", publico);

    for (const { error } of [
      insertar,
      aNombreDeOtro,
      cambiarPropio,
      cambiarAjeno,
      borrarPropio,
    ]) {
      expect(error?.code).toBe(PERMISO_DENEGADO);
    }
    expect(await votoGuardado(vecino, publico)).toBe(1);
    expect(await votoGuardado(otro, publico)).toBe(-1);
  });

  it("nadie escribe los totales ni lee el límite desde la API", async () => {
    const totales = await vecino.cliente
      .from("reporte_votos_totales")
      .update({ me_afecta: 100 })
      .eq("reporte_id", publico);
    const limite = await vecino.cliente
      .from("reporte_votos_limite")
      .select("votos");
    expect(totales.error?.code).toBe(PERMISO_DENEGADO);
    expect(limite.error?.code).toBe(PERMISO_DENEGADO);
  });

  it("los totales de un reporte pendiente no son públicos", async () => {
    const { data, error } = await anon
      .from("reporte_votos_totales")
      .select("reporte_id")
      .eq("reporte_id", pendiente);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("los votos no cambian el estado ni la moderación del reporte", async () => {
    const { data } = await admin
      .from("reportes")
      .select("moderacion, estado")
      .eq("id", publico)
      .single();
    expect(data).toEqual({ moderacion: "aprobado", estado: "recibido" });
  });
});

describe("totales con votos simultáneos y borrados en cascada", () => {
  it("cuenta todos los votos simultáneos", async () => {
    const antes = await totalesPublicos(publico);
    const vecinos = await Promise.all(
      ["s1", "s2", "s3", "s4", "s5"].map(crearUsuario),
    );
    const resultados = await Promise.all(
      vecinos.map((v) => votar(v, publico, 1)),
    );
    for (const { error } of resultados) expect(error).toBeNull();
    expect(await totalesPublicos(publico)).toEqual({
      me_afecta: antes!.me_afecta! + vecinos.length,
      no_me_afecta: antes!.no_me_afecta,
    });

    // Borrar la cuenta borra sus votos y los descuenta.
    await Promise.all(vecinos.map(borrarUsuario));
    expect(await totalesPublicos(publico)).toEqual(antes);
  });

  it("borrar el reporte borra sus votos y sus totales", async () => {
    const reporte = await crearReporte(true);
    expect((await votar(vecino, reporte, 1)).error).toBeNull();

    const borrado = await admin.from("reportes").delete().eq("id", reporte);
    expect(borrado.error).toBeNull();

    const votos = await admin
      .from("reporte_votos")
      .select("valor")
      .eq("reporte_id", reporte);
    const totales = await admin
      .from("reporte_votos_totales")
      .select("me_afecta")
      .eq("reporte_id", reporte);
    expect(votos.data).toEqual([]);
    expect(totales.data).toEqual([]);
  });
});

describe("límite de frecuencia", () => {
  it(`permite ${LIMITE_POR_HORA} votos por hora y rechaza el siguiente`, async () => {
    const insistente = await crearUsuario("insistente");
    for (let i = 0; i < LIMITE_POR_HORA; i++) {
      const { error } = await votar(insistente, publico, i % 2 ? -1 : 1);
      expect(error, `voto ${i + 1}`).toBeNull();
    }
    const { error } = await votar(insistente, publico, null);
    expect(error?.hint).toBe("limite_frecuencia");
    // El voto rechazado no se aplicó: sigue el último guardado.
    expect(await votoGuardado(insistente, publico)).toBe(-1);
  }, 60_000);
});
