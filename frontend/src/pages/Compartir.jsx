import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useNavigate, useParams } from "react-router-dom"

export default function Compartir() {
  const { token } = useParams()
  const nav = useNavigate()
  const [msg, setMsg] = useState("Validando link...")

  useEffect(() => {
    (async () => {
      try {
        await api.get("/api/listas/me") // requiere sesión
      } catch (e) {
        if (e?.response?.status !== 401) {
          setMsg(e?.response?.data?.detail || "No se pudo validar tu sesión")
          return
        }
        nav(`/login?next=${encodeURIComponent(`/compartir/${token}`)}`, { replace: true })
        return
      }

      try {
        const r = await api.post(`/api/listas/aceptar/${token}`)
        nav(`/l/${r.data.lista_id}`)
      } catch (e) {
        setMsg(e?.response?.data?.detail || "Link inválido")
      }
    })()
  }, [token, nav])

  return <div className="p-6">{msg}</div>
}
