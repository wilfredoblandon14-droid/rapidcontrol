import Link from "next/link"; 
const resumen = [
  {
    titulo: "Pedidos hoy",
    valor: "40",
    detalle: "Total registrados",
    icono: "📦",
  },
  {
    titulo: "Pendientes",
    valor: "8",
    detalle: "Esperando asignación",
    icono: "⏳",
  },
  {
    titulo: "En camino",
    valor: "7",
    detalle: "Pedidos activos",
    icono: "🛵",
  },
  {
    titulo: "Entregados",
    valor: "25",
    detalle: "Completados hoy",
    icono: "✅",
  },
];

const pedidos = [
  {
    numero: "#2548",
    cliente: "Juan Pérez",
    direccion: "Farmacia San José → Villa Fontana",
    motorizado: "Carlos",
    estado: "En camino",
    total: "C$ 470",
  },
  {
    numero: "#2547",
    cliente: "María López",
    direccion: "Supermercado → El Carmen",
    motorizado: "Sin asignar",
    estado: "Pendiente",
    total: "C$ 220",
  },
  {
    numero: "#2546",
    cliente: "Carlos Mairena",
    direccion: "Mercado → Las Brisas",
    motorizado: "Luis",
    estado: "En camino",
    total: "C$ 380",
  },
  {
    numero: "#2545",
    cliente: "Ana Mendoza",
    direccion: "Farmacia → Centro",
    motorizado: "Kevin",
    estado: "Entregado",
    total: "C$ 150",
  },
];

const motorizados = [
  { nombre: "Carlos López", estado: "En entrega", pedidos: 12 },
  { nombre: "Luis Hernández", estado: "Disponible", pedidos: 8 },
  { nombre: "Kevin Ramírez", estado: "En entrega", pedidos: 11 },
  { nombre: "Miguel Díaz", estado: "Disponible", pedidos: 9 },
];

function colorEstado(estado: string) {
  if (estado === "Entregado") {
    return "bg-emerald-500/15 text-emerald-400";
  }

  if (estado === "En camino" || estado === "En entrega") {
    return "bg-amber-500/15 text-amber-400";
  }

  if (estado === "Disponible") {
    return "bg-blue-500/15 text-blue-400";
  }

  return "bg-slate-500/15 text-slate-300";
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        {/* Menú lateral */}
        <aside className="hidden w-64 border-r border-slate-800 bg-slate-900 lg:flex lg:flex-col">
          <div className="border-b border-slate-800 p-6">
            <h1 className="text-2xl font-black">
              MANDADOS <span className="text-green-500">RAPID</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">RapidControl</p>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <a
              href="#"
              className="flex items-center gap-3 rounded-xl bg-green-600 px-4 py-3 font-semibold"
            >
              🏠 Dashboard
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              📦 Pedidos
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              👥 Clientes
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              🛵 Motorizados
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              💰 Caja
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              📊 Reportes
            </a>

            <a
              href="#"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-slate-800"
            >
              ⚙️ Configuración
            </a>
          </nav>

          <div className="border-t border-slate-800 p-4">
            <div className="rounded-xl bg-slate-800 p-4">
              <p className="font-semibold">Administrador</p>
              <p className="text-sm text-slate-400">Mandados Rapid</p>
            </div>
          </div>
        </aside>

        {/* Contenido */}
        <section className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-5 py-4 md:px-8">
            <div>
              <p className="text-sm text-slate-400">Panel administrativo</p>
              <h2 className="text-2xl font-bold">Dashboard</h2>
            </div>

            <Link
  href="/pedidos/nuevo"
  className="rounded-xl bg-green-600 px-5 py-3 font-bold hover:bg-green-700"
>
  + Nuevo pedido
</Link>
          </header>

          <div className="space-y-8 p-5 md:p-8">
            {/* Tarjetas superiores */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {resumen.map((item) => (
                <article
                  key={item.titulo}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{item.titulo}</p>
                      <p className="mt-2 text-4xl font-black">{item.valor}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {item.detalle}
                      </p>
                    </div>

                    <span className="text-3xl">{item.icono}</span>
                  </div>
                </article>
              ))}
            </section>

            {/* Finanzas */}
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-5">
                <p className="text-sm text-emerald-300">Ingresos del día</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">
                  C$ 8,600
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Envíos y compras cobradas
                </p>
              </article>

              <article className="rounded-2xl border border-red-900 bg-red-950/30 p-5">
                <p className="text-sm text-red-300">Gastos del día</p>
                <p className="mt-2 text-3xl font-black text-red-400">
                  C$ 1,250
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Combustible y otros gastos
                </p>
              </article>

              <article className="rounded-2xl border border-green-900 bg-green-950/40 p-5">
                <p className="text-sm text-green-300">Ganancia neta</p>
                <p className="mt-2 text-3xl font-black text-green-400">
                  C$ 7,350
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Ingresos menos gastos
                </p>
              </article>
            </section>

            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              {/* Pedidos */}
              <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 p-5">
                  <div>
                    <h3 className="text-lg font-bold">Pedidos recientes</h3>
                    <p className="text-sm text-slate-400">
                      Actividad de hoy
                    </p>
                  </div>

                  <button className="text-sm font-semibold text-green-400">
                    Ver todos
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="bg-slate-950/50 text-sm text-slate-400">
                      <tr>
                        <th className="px-5 py-4">Pedido</th>
                        <th className="px-5 py-4">Cliente</th>
                        <th className="px-5 py-4">Dirección</th>
                        <th className="px-5 py-4">Motorizado</th>
                        <th className="px-5 py-4">Estado</th>
                        <th className="px-5 py-4">Total</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pedidos.map((pedido) => (
                        <tr
                          key={pedido.numero}
                          className="border-t border-slate-800 text-sm"
                        >
                          <td className="px-5 py-4 font-bold text-green-400">
                            {pedido.numero}
                          </td>
                          <td className="px-5 py-4">{pedido.cliente}</td>
                          <td className="px-5 py-4 text-slate-300">
                            {pedido.direccion}
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            {pedido.motorizado}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${colorEstado(
                                pedido.estado
                              )}`}
                            >
                              {pedido.estado}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-semibold">
                            {pedido.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Motorizados */}
              <section className="rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <h3 className="text-lg font-bold">Motorizados</h3>
                  <p className="text-sm text-slate-400">
                    Estado actual del equipo
                  </p>
                </div>

                <div className="space-y-3 p-4">
                  {motorizados.map((motorizado) => (
                    <article
                      key={motorizado.nombre}
                      className="rounded-xl bg-slate-800/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-700 text-xl">
                            🛵
                          </div>

                          <div>
                            <p className="font-semibold">{motorizado.nombre}</p>
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-1 text-xs font-bold ${colorEstado(
                                motorizado.estado
                              )}`}
                            >
                              {motorizado.estado}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-2xl font-black">
                            {motorizado.pedidos}
                          </p>
                          <p className="text-xs text-slate-400">pedidos</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}