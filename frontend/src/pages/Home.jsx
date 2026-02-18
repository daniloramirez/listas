import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useNavigate } from "react-router-dom"
import {
  Plus,
  Trash2,
  LogOut,
  ArrowRight,
  CheckCircle2,
  Clock3,
  UserRound,
} from "lucide-react"

const DECORALCO_LOGO = `${import.meta.env.BASE_URL}decoralco-logo.png`

function etiquetaRol(lista) {
  const rol = (lista?.rol || "").toLowerCase()
  if (lista?.es_dueno || rol === "dueno") return "PROPIETARIO"
  if (rol === "lector") return "LECTOR"
  return "EDITOR"
}

export default function Home() {
  const nav = useNavigate()
  const [me, setMe] = useState(null)
  const [listas, setListas] = useState([])
  const [nombre, setNombre] = useState("")
  const [msg, setMsg] = useState("")
  const [listaAEliminar, setListaAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = async () => {
    const u = await api.get("/api/listas/me")
    setMe(u.data)
    const l = await api.get("/api/listas/listas")
    setListas(l.data)
  }

  useEffect(() => {
    cargar().catch((e) => {
      if (e?.response?.status === 401) {
        nav("/login")
        return
      }
      setMsg(e?.response?.data?.detail || "No se pudieron cargar tus listas")
    })
  }, [nav])

  const crear = async () => {
    setMsg("")
    const limpio = nombre.trim()
    if (!limpio) {
      setMsg("Ingresa un nombre para la lista")
      return
    }
    try {
      const r = await api.post("/api/listas/listas", { nombre: limpio, foto: null })
      setNombre("")
      setListas((prev) => [r.data, ...prev])
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Error")
    }
  }

  const confirmarEliminarLista = async () => {
    if (!listaAEliminar) return
    setEliminando(true)
    try {
      await api.delete(`/api/listas/listas/${listaAEliminar.id}`)
      setListas((prev) => prev.filter((x) => x.id !== listaAEliminar.id))
      setListaAEliminar(null)
    } catch (e) {
      setMsg(e?.response?.data?.detail || "No se pudo eliminar la lista")
    } finally {
      setEliminando(false)
    }
  }

  const salir = async () => {
    await api.post("/api/listas/auth/logout")
    nav("/login")
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="navbar bg-white/70 backdrop-blur rounded-2xl shadow border border-white flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <img src={DECORALCO_LOGO} alt="Decoralco" className="h-4 sm:h-5 w-auto object-contain shrink-0" loading="eager" />
          <span className="font-black text-lg sm:text-xl leading-none">MIS LISTAS</span>
        </div>
        <div className="flex gap-2 items-center w-full sm:w-auto justify-between sm:justify-end">
          <div className="badge badge-info badge-outline max-w-[66vw] sm:max-w-[320px] truncate">{me?.correo}</div>
          <button className="btn btn-sm btn-ghost shrink-0" onClick={salir}>
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </div>

      {msg && <div className="alert alert-error mt-4"><span>{msg}</span></div>}

      <div className="mt-4 card bg-white/80 border border-white shadow">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="input input-bordered w-full uppercase"
              placeholder="NOMBRE DE LA LISTA"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              maxLength={200}
            />
            <button className="btn btn-primary sm:w-40" onClick={crear}>
              <Plus className="w-4 h-4" />
              Crear
            </button>
          </div>
        </div>
      </div>

      {listas.length === 0 && (
        <div className="mt-4 alert bg-white border border-white shadow">
          <span>Aun no tienes listas. Crea tu primera lista arriba.</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {listas.map((l, idx) => (
          <div
            key={l.id}
            role="button"
            tabIndex={0}
            onClick={() => nav(`/l/${l.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                nav(`/l/${l.id}`)
              }
            }}
            className="group relative overflow-hidden card bg-gradient-to-br from-white via-sky-50 to-indigo-50 border border-white shadow hover:shadow-2xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
            style={{ animation: "cardFadeIn .45s ease-out both", animationDelay: `${idx * 80}ms` }}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-cyan-200/55 to-fuchsia-200/55 blur-2xl" />
            <div className="card-body">
              <div className="flex justify-between items-start gap-2">
                <h2 className="card-title break-words flex items-center gap-2">
                  <span className="text-lg">{l.total_pendiente === 0 && l.total_refs > 0 ? "✅" : "🛒"}</span>
                  <span>{l.nombre}</span>
                </h2>
                {l.es_dueno && (
                  <button
                    className="btn btn-sm btn-error btn-outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setListaAEliminar(l)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className={`badge gap-1 ${l.total_pendiente === 0 && l.total_refs > 0 ? "badge-success" : "badge-warning"}`}>
                  {l.total_pendiente === 0 && l.total_refs > 0 ? <CheckCircle2 className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}
                  {l.total_pendiente === 0 && l.total_refs > 0 ? "COMPLETA" : "PENDIENTE"}
                </span>
                <span className="badge badge-outline gap-1">
                  <UserRound className="w-3 h-3" />
                  {etiquetaRol(l)}
                </span>
              </div>

              <div className="mt-2 text-sm grid gap-1">
                <div className="rounded-lg bg-white/70 px-2 py-1 border border-white/80">📌 Productos: <b>{l.total_refs}</b></div>
                <div className="rounded-lg bg-white/70 px-2 py-1 border border-white/80">💰 Comprado: <b>${(l.total_comprado || 0).toLocaleString("es-CO")} COP</b></div>
                <div className="rounded-lg bg-white/70 px-2 py-1 border border-white/80">🧾 Falta: <b>${(l.total_pendiente || 0).toLocaleString("es-CO")} COP</b></div>
              </div>

              <div className="mt-3 text-primary flex items-center gap-1 text-sm font-semibold">
                Abrir lista
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <style>
        {`
          @keyframes cardFadeIn {
            from { opacity: 0; transform: translateY(12px) scale(.985); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>

      <dialog className={`modal ${listaAEliminar ? "modal-open" : ""}`}>
        <div className="modal-box bg-white">
          <h3 className="font-bold text-lg">Eliminar lista</h3>
          <p className="py-3">
            Esta accion eliminara <b>{listaAEliminar?.nombre}</b> y no se puede deshacer.
          </p>
          <div className="modal-action">
            <button className="btn" onClick={() => setListaAEliminar(null)} disabled={eliminando}>Cancelar</button>
            <button className={`btn btn-error ${eliminando ? "btn-disabled" : ""}`} onClick={confirmarEliminarLista}>
              {eliminando ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setListaAEliminar(null)}>cerrar</button>
        </form>
      </dialog>
    </div>
  )
}
