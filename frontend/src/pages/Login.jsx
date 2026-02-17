import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useLocation, useNavigate } from "react-router-dom"
import { GoogleLogin } from "@react-oauth/google"
import { Mail, Lock, Sparkles, Eye, EyeOff, Chrome } from "lucide-react"

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim()
const GOOGLE_CONFIGURADO =
  GOOGLE_CLIENT_ID &&
  !GOOGLE_CLIENT_ID.includes("TU_CLIENT_ID") &&
  GOOGLE_CLIENT_ID !== "CHANGE_ME"
const DECORALCO_LOGO = `${import.meta.env.BASE_URL}decoralco-logo.png`

function extraerMensajeError(error, fallback = "Error") {
  const detail = error?.response?.data?.detail
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const textos = detail
      .map((x) => (typeof x === "string" ? x : x?.msg))
      .filter(Boolean)
    if (textos.length > 0) return textos.join(". ")
    return "Revisa los campos requeridos"
  }
  if (detail && typeof detail === "object" && detail.msg) {
    return detail.msg
  }
  return fallback
}

export default function Login() {
  const nav = useNavigate()
  const location = useLocation()
  const [correo, setCorreo] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [modo, setModo] = useState("login") // login | registro
  const [msg, setMsg] = useState("")
  const [loading, setLoading] = useState(false)

  const next = new URLSearchParams(location.search).get("next")
  const nextPath = next && next.startsWith("/") ? next : "/"

  useEffect(() => {
    api.get("/api/listas/me").then(() => nav(nextPath, { replace: true })).catch(() => {})
  }, [nav, nextPath])

  const submit = async () => {
    setMsg("")
    const correoTrim = (correo || "").trim()
    if (!correoTrim) {
      setMsg("📧 Debes ingresar el correo")
      return
    }
    if (!password) {
      setMsg("🔒 Debes ingresar la contraseña")
      return
    }
    if (modo === "registro" && password.length < 8) {
      setMsg("🔒 La contraseña debe tener al menos 8 caracteres")
      return
    }

    setLoading(true)
    try {
      const body = { correo: correoTrim, password }
      if (modo === "registro") await api.post("/api/listas/auth/registro", body)
      else await api.post("/api/listas/auth/login", body)
      nav(nextPath, { replace: true })
    } catch (e) {
      setMsg(extraerMensajeError(e, "No se pudo iniciar sesión"))
    } finally {
      setLoading(false)
    }
  }

  const onGoogleOk = async (cred) => {
    setMsg("")
    setLoading(true)
    try {
      await api.post("/api/listas/auth/google", { id_token: cred.credential })
      nav(nextPath, { replace: true })
    } catch (e) {
      setMsg(extraerMensajeError(e, "No se pudo iniciar con Google"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-100 via-amber-100 to-sky-100 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-[420px]">
        <div className="card bg-white/75 items-center backdrop-blur shadow-2xl border border-white/80">
          <div className="card-body items-center text-center">
            <img
              src={DECORALCO_LOGO}
              alt="Decoralco"
              className="w-52 max-w-full rounded-xl object-contain"
              loading="eager"
            />

            <div className="flex items-center gap-2 mb-4">
              <h1 className="text-3xl font-black tracking-tight">LISTAS</h1>
            </div>
            <p className="text-sm opacity-70 max-w-sm">
              Crea y comparte listas de mercado.
            </p>

            {msg && <div className="alert alert-error mt-3 w-full"><span>{msg}</span></div>}

            <form
              className="mt-4 space-y-3 w-full"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <label className="input input-bordered h-11 min-h-11 flex items-center gap-2 bg-white">
                <Mail className="w-4 h-4 opacity-60" />
                <input
                  className="grow"
                  type="email"
                  placeholder="correo@dominio.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
              </label>

              <label className="input input-bordered h-11 min-h-11 flex items-center gap-2 bg-white">
                <Lock className="w-4 h-4 opacity-60" />
                <input
                  className="grow"
                  placeholder="mínimo 8 caracteres"
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </label>
              <div className="mt-6 space-y-3 w-full">
              <button
                type="submit"
                className={`btn btn-primary btn-block !py-0 text-xs font-bold whitespace-nowrap overflow-hidden leading-none ${loading ? "btn-disabled" : ""}`}
                style={{ height: "44px", minHeight: "44px", maxHeight: "44px" }}
              >
                {modo === "registro" ? "CREAR CUENTA" : "ENTRAR"}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-block !py-0 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis leading-none"
                style={{ height: "44px", minHeight: "44px", maxHeight: "44px" }}
                onClick={() => setModo(modo === "login" ? "registro" : "login")}
              >
                {modo === "login" ? "No tengo cuenta, registrarme" : "Ya tengo cuenta, iniciar sesión"}
              </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-3 text-center text-xs opacity-60">
          Hecho por <b>Decoralco / listas</b>
        </div>
      </div>
    </div>
  )
}
