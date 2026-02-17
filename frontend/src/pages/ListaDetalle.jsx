import React, { useEffect, useRef, useState } from "react"
import { api } from "../api"
import { useNavigate, useParams } from "react-router-dom"
import {
  Plus,
  Share2,
  Trash2,
  Ruler,
  ClipboardCheck,
  Hash,
  DollarSign,
  Save,
} from "lucide-react"

function etiquetaRol(data) {
  const rol = (data?.rol || "").toLowerCase()
  if (data?.es_dueno || rol === "dueno") return "PROPIETARIO"
  if (rol === "lector") return "LECTOR"
  return "EDITOR"
}

function formatearCOP(valor) {
  return `$${(valor || 0).toLocaleString("es-CO")} COP`
}

function soloDigitos(texto) {
  return String(texto || "").replace(/[^\d]/g, "")
}

function formatearMiles(texto) {
  const digitos = soloDigitos(texto)
  if (!digitos) return ""
  return Number(digitos).toLocaleString("es-CO")
}

function cantidadEntera(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.round(n))
}

function extraerMensajeError(error, fallback = "Error") {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const textos = detail.map((x) => (typeof x === "string" ? x : x?.msg)).filter(Boolean)
    return textos[0] || "Revisa los campos requeridos"
  }
  if (detail && typeof detail === "object" && detail.msg) return detail.msg
  return fallback
}

export default function ListaDetalle() {
  const { id } = useParams()
  const nav = useNavigate()
  const toastTimerRef = useRef(null)

  const [data, setData] = useState(null)
  const [producto, setProducto] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [precio, setPrecio] = useState("0")
  const [unidadTexto, setUnidadTexto] = useState("")
  const [unidadId, setUnidadId] = useState(null)
  const [sugProductos, setSugProductos] = useState([])
  const [sugUnidades, setSugUnidades] = useState([])
  const [cantidadesEdit, setCantidadesEdit] = useState({})
  const [msg, setMsg] = useState("")

  const [abrirModalCopiar, setAbrirModalCopiar] = useState(false)
  const [copiandoRol, setCopiandoRol] = useState("")
  const [msgCopiar, setMsgCopiar] = useState("")
  const [ultimoLink, setUltimoLink] = useState("")
  const [itemAEliminar, setItemAEliminar] = useState(null)
  const [eliminandoItem, setEliminandoItem] = useState(false)

  const [toast, setToast] = useState({ visible: false, texto: "", tipo: "success" })

  const mostrarToast = (texto, tipo = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ visible: true, texto, tipo })
    toastTimerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }))
    }, 2400)
  }

  const cargar = async () => {
    const r = await api.get(`/api/listas/listas/${id}`)
    setData(r.data)
    const mapCantidades = {}
    for (const item of r.data.items || []) {
      mapCantidades[item.id] = String(cantidadEntera(item.cantidad))
    }
    setCantidadesEdit(mapCantidades)
  }

  useEffect(() => {
    cargar().catch((e) => {
      if (e?.response?.status === 401) {
        nav("/login")
        return
      }
      setMsg(e?.response?.data?.detail || "No se pudo cargar la lista")
    })
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [id, nav])

  const rolActual = (data?.rol || "").toLowerCase()
  const puedeEditar = !!data && (data.es_dueno || rolActual === "dueno" || rolActual === "editor")

  const buscarProductos = async (q) => {
    if (!q || q.length < 2) {
      setSugProductos([])
      return
    }
    const r = await api.get(`/api/listas/productos?q=${encodeURIComponent(q)}`)
    setSugProductos(r.data || [])
  }

  const buscarUnidades = async (q) => {
    if (!q || q.length < 1) {
      setSugUnidades([])
      return
    }
    const r = await api.get(`/api/listas/unidades?q=${encodeURIComponent(q)}`)
    setSugUnidades(r.data || [])
  }

  const seleccionarProducto = (p) => {
    setProducto((p?.nombre || "").toUpperCase())
    setPrecio(formatearMiles(String(p?.precio_ultimo || 0)))
    if (p?.unidad_id_ultima) {
      setUnidadId(p.unidad_id_ultima)
      setUnidadTexto((p.unidad_ultima || "").toUpperCase())
    }
    setSugProductos([])
  }

  const seleccionarUnidad = (u) => {
    setUnidadId(u.id)
    setUnidadTexto((u.nombre || "").toUpperCase())
    setSugUnidades([])
  }

  const agregar = async () => {
    if (!puedeEditar) {
      setMsg("🚫 Tu rol es de solo lectura en esta lista")
      return
    }
    setMsg("")
    const prod = (producto || "").trim().toUpperCase()
    const cant = Number(cantidad)
    const pre = Number(soloDigitos(precio) || 0)

    if (!prod) {
      setMsg("⚠️ Debes ingresar un producto")
      return
    }
    if (!Number.isFinite(cant) || cant < 1) {
      setMsg("⚠️ La cantidad debe ser numérica y mayor o igual a 1")
      return
    }
    if (!Number.isFinite(pre) || pre < 0) {
      setMsg("⚠️ El precio debe ser numérico y mayor o igual a 0")
      return
    }

    try {
      await api.post(`/api/listas/listas/${id}/items`, {
        producto: prod,
        cantidad: cant,
        precio: pre,
        unidad_id: unidadId,
      })
      setProducto("")
      setCantidad("1")
      setPrecio("0")
      setUnidadTexto("")
      setUnidadId(null)
      setSugProductos([])
      setSugUnidades([])
      await cargar()
      mostrarToast("✅ Registro agregado correctamente")
    } catch (e) {
      setMsg(extraerMensajeError(e, "Error"))
    }
  }

  const toggleComprado = async (item) => {
    if (!puedeEditar) return
    await api.patch(`/api/listas/listas/${id}/items/${item.id}`, { comprado: !item.comprado })
    await cargar()
    mostrarToast("✅ Estado de compra actualizado")
  }

  const confirmarEliminarItem = async () => {
    if (!puedeEditar || !itemAEliminar) return
    setEliminandoItem(true)
    try {
      await api.delete(`/api/listas/listas/${id}/items/${itemAEliminar.id}`)
      await cargar()
      mostrarToast(`🗑️ ${itemAEliminar.producto} retirado de la lista`)
      setItemAEliminar(null)
    } catch (e) {
      setMsg(extraerMensajeError(e, "No se pudo eliminar el producto"))
    } finally {
      setEliminandoItem(false)
    }
  }

  const pedirEliminarItem = (item) => {
    if (!puedeEditar) return
    setItemAEliminar(item)
  }

  const guardarCantidad = async (item) => {
    if (!puedeEditar) return
    const raw = String(cantidadesEdit[item.id] ?? "").replace(",", ".")
    const nuevaCantidad = Number(raw)
    const actual = cantidadEntera(item.cantidad)

    if (!Number.isFinite(nuevaCantidad) || nuevaCantidad < 1) {
      setCantidadesEdit((prev) => ({ ...prev, [item.id]: String(actual) }))
      mostrarToast("⚠️ Cantidad inválida. Debe ser >= 1", "warning")
      return
    }
    if (nuevaCantidad === actual) return

    try {
      await api.patch(`/api/listas/listas/${id}/items/${item.id}`, { cantidad: nuevaCantidad })
      await cargar()
      mostrarToast("💾 Cantidad actualizada")
    } catch (e) {
      setCantidadesEdit((prev) => ({ ...prev, [item.id]: String(actual) }))
      setMsg(extraerMensajeError(e, "No se pudo actualizar la cantidad"))
      mostrarToast("❌ No se pudo actualizar la cantidad", "error")
    }
  }

  const copiarTextoPortapapeles = async (texto) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
        return true
      }
    } catch {
      // fallback abajo
    }

    try {
      const area = document.createElement("textarea")
      area.value = texto
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.focus()
      area.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }

  const copiarEnlace = async (rol) => {
    setMsgCopiar("")
    setCopiandoRol(rol)
    try {
      const r = await api.post(`/api/listas/listas/${id}/compartir/link?rol=${rol}`)
      const url = r.data.url
      setUltimoLink(url)
      const ok = await copiarTextoPortapapeles(url)
      if (ok) {
        setMsgCopiar(`✅ Enlace copiado como ${rol === "lector" ? "Lector" : "Editor"}`)
        mostrarToast(`📋 Enlace copiado como ${rol === "lector" ? "Lector" : "Editor"}`)
      } else {
        setMsgCopiar("⚠️ No se pudo copiar automáticamente. Usa el enlace manual debajo.")
      }
    } catch (e) {
      setMsgCopiar(extraerMensajeError(e, "❌ No se pudo copiar el enlace"))
    } finally {
      setCopiandoRol("")
    }
  }

  if (!data) return <div className="p-6">Cargando...</div>

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/70 backdrop-blur rounded-2xl p-4 shadow border border-white">
        <div className="min-w-0">
          <div className="text-xs opacity-60">LISTA</div>
          <div className="text-xl sm:text-2xl font-black break-words">{data.nombre}</div>
          <div className="badge badge-outline mt-1">{etiquetaRol(data)}</div>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
          <button
            className={`btn btn-secondary btn-sm sm:btn-md flex-1 sm:flex-none min-w-0 ${!puedeEditar ? "btn-disabled" : ""}`}
            onClick={() => {
              setMsgCopiar("")
              setUltimoLink("")
              setAbrirModalCopiar(true)
            }}
            disabled={!puedeEditar}
          >
            <Share2 className="w-4 h-4" />
            📋 Copiar enlace
          </button>
          <button className="btn btn-ghost btn-sm sm:btn-md flex-1 sm:flex-none" onClick={() => nav("/")}>Volver</button>
        </div>
      </div>

      {msg && <div className="alert alert-error mt-4"><span>⚠️ {msg}</span></div>}

      {!puedeEditar && (
        <div className="alert alert-info mt-4">
          <span>👀 Estás en modo lectura. Solo un Editor o Propietario puede agregar o retirar productos.</span>
        </div>
      )}

      {puedeEditar && (
        <div className="mt-4 card bg-white/80 border border-white shadow">
          <div className="card-body">
            <div className="font-bold">🛒 Agregar producto</div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
              <div className="lg:col-span-4">
                <label className="input input-bordered w-full flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 opacity-70" />
                  <input
                    className="grow uppercase"
                    placeholder="PRODUCTO"
                    value={producto}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase()
                      setProducto(v)
                      buscarProductos(v)
                    }}
                  />
                </label>
                {sugProductos.length > 0 && (
                  <div className="mt-2 bg-white rounded-xl border shadow p-2 max-h-52 overflow-auto">
                    {sugProductos.map((x) => (
                      <button
                        key={x.id}
                        className="btn btn-ghost btn-sm justify-start w-full"
                        onClick={() => seleccionarProducto(x)}
                      >
                        {x.nombre}
                        <span className="ml-auto text-xs opacity-65">
                          {formatearCOP(x.precio_ultimo)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-3">
                <label className="input input-bordered w-full flex items-center gap-2">
                  <Ruler className="w-4 h-4 opacity-70" />
                  <input
                    className="grow uppercase"
                    placeholder="UNIDAD"
                    value={unidadTexto}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase()
                      setUnidadTexto(v)
                      setUnidadId(null)
                      buscarUnidades(v)
                    }}
                  />
                </label>
                {sugUnidades.length > 0 && (
                  <div className="mt-2 bg-white rounded-xl border shadow p-2 max-h-52 overflow-auto">
                    {sugUnidades.map((u) => (
                      <button
                        key={u.id}
                        className="btn btn-ghost btn-sm justify-start w-full"
                        onClick={() => seleccionarUnidad(u)}
                      >
                        {u.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="input input-bordered w-full flex items-center gap-2">
                  <Hash className="w-4 h-4 opacity-70" />
                  <input
                    className="grow"
                    type="number"
                    min={1}
                    step={1}
                    placeholder="CANTIDAD"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </label>
              </div>

              <div className="lg:col-span-3">
                <label className="input input-bordered w-full flex items-center gap-2">
                  <DollarSign className="w-4 h-4 opacity-70" />
                  <input
                    className="grow"
                    inputMode="numeric"
                    placeholder="PRECIO (COP)"
                    value={precio}
                    onChange={(e) => setPrecio(formatearMiles(e.target.value))}
                  />
                </label>
              </div>
            </div>

            <div className="mt-2">
              <button className="btn btn-primary" onClick={agregar}>
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 cuaderno texto-manuscrita p-4">
        <div className="pl-14">
          {data.items.length === 0 && (
            <div className="opacity-60">🧺 Aún no hay productos en la lista.</div>
          )}

          {data.items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 py-2 border-b border-dashed border-slate-200">
              <input
                type="checkbox"
                className="checkbox checkbox-success mt-1"
                checked={item.comprado}
                onChange={() => toggleComprado(item)}
                disabled={!puedeEditar}
              />

              <div className="flex-1">
                <div className={`font-bold text-[1.05rem] ${item.comprado ? "line-through opacity-70" : ""}`}>
                  {(item.comprado ? "COMPRADO · " : "PENDIENTE · ") + item.producto}
                </div>

                <div className="text-sm opacity-80 mt-1">
                  Unidad: <b>{item.unidad || "UNIDAD"}</b> · Precio: <b>{formatearCOP(item.precio || 0)}</b>
                </div>

                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm">Cantidad:</span>
                  <input
                    className="input input-bordered input-sm w-24"
                    type="number"
                    min={1}
                    step={1}
                    value={cantidadesEdit[item.id] ?? String(cantidadEntera(item.cantidad))}
                    onChange={(e) => {
                      const v = soloDigitos(e.target.value)
                      setCantidadesEdit((prev) => ({ ...prev, [item.id]: v }))
                    }}
                    onBlur={() => guardarCantidad(item)}
                    disabled={!puedeEditar}
                  />
                  <span className="text-xs opacity-60 flex items-center gap-1">
                    <Save className="w-3 h-3" />
                    Se guarda al salir del campo
                  </span>
                </div>

                {item.tocado_por?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tocado_por.map((n, i) => (
                      <span key={i} className="badge badge-accent badge-outline">{n}</span>
                    ))}
                  </div>
                )}
              </div>

              {puedeEditar && (
                <button className="btn btn-sm btn-error btn-outline" onClick={() => pedirEliminarItem(item)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 card bg-white/80 border border-white shadow">
        <div className="card-body">
          <div className="flex flex-wrap gap-4">
            <div>Refs: <b>{data.total_refs}</b></div>
            <div>Comprado: <b>{formatearCOP(data.total_comprado || 0)}</b></div>
            <div>Falta: <b>{formatearCOP(data.total_pendiente || 0)}</b></div>
          </div>
        </div>
      </div>

      <dialog className={`modal ${abrirModalCopiar ? "modal-open" : ""}`}>
        <div className="modal-box bg-white">
          <h3 className="font-bold text-lg">🔗 Copiar enlace</h3>
          <p className="text-sm opacity-70 mt-1">Selecciona el tipo de acceso para quien reciba el enlace.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <button
              className={`btn btn-primary h-auto py-3 flex-col items-start ${copiandoRol ? "btn-disabled" : ""}`}
              onClick={() => copiarEnlace("editor")}
            >
              <span className="font-bold">✍️ Copiar como Editor</span>
              <span className="text-xs normal-case">Puede agregar, quitar y actualizar productos.</span>
            </button>

            <button
              className={`btn btn-outline h-auto py-3 flex-col items-start ${copiandoRol ? "btn-disabled" : ""}`}
              onClick={() => copiarEnlace("lector")}
            >
              <span className="font-bold">👀 Copiar como Lector</span>
              <span className="text-xs normal-case">Solo puede ver la lista compartida.</span>
            </button>
          </div>

          {msgCopiar && (
            <div className="alert alert-info mt-4">
              <span>{msgCopiar}</span>
            </div>
          )}

          {ultimoLink && (
            <label className="form-control mt-3">
              <div className="label">
                <span className="label-text">Enlace generado</span>
              </div>
              <input className="input input-bordered" value={ultimoLink} readOnly />
            </label>
          )}

          <div className="modal-action">
            <button className="btn" onClick={() => setAbrirModalCopiar(false)}>Cerrar</button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setAbrirModalCopiar(false)}>cerrar</button>
        </form>
      </dialog>

      <dialog className={`modal ${itemAEliminar ? "modal-open" : ""}`}>
        <div className="modal-box bg-white">
          <h3 className="font-bold text-lg">🧹 Retirar producto</h3>
          <p className="py-3">
            ¿Seguro que deseas retirar de la lista el producto <b>{itemAEliminar?.producto}</b>?
          </p>
          <div className="modal-action">
            <button className="btn btn-success" onClick={confirmarEliminarItem} disabled={eliminandoItem}>
              {eliminandoItem ? "Procesando..." : "SI"}
            </button>
            <button className="btn btn-outline" onClick={() => setItemAEliminar(null)} disabled={eliminandoItem}>
              NO
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setItemAEliminar(null)}>cerrar</button>
        </form>
      </dialog>

      {toast.visible && (
        <div className="toast toast-top toast-end z-[90]">
          <div className={`alert ${toast.tipo === "error" ? "alert-error" : toast.tipo === "warning" ? "alert-warning" : "alert-success"}`}>
            <span>{toast.texto}</span>
          </div>
        </div>
      )}
    </div>
  )
}
