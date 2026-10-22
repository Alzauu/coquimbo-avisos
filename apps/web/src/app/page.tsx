export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Coquimbo Avisos
      </h1>
      <p className="text-lg text-zinc-700 dark:text-zinc-300">
        Reporta y revisa incidentes y obras en tu comuna: pavimentación, cortes
        de agua o luz y desvíos.
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Piloto en La Serena. Muy pronto en más comunas de la región.
      </p>
    </main>
  );
}
