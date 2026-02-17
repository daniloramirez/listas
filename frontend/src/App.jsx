import React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login.jsx"
import Home from "./pages/Home.jsx"
import ListaDetalle from "./pages/ListaDetalle.jsx"
import Compartir from "./pages/Compartir.jsx"

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-yellow-50 to-cyan-50">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/l/:id" element={<ListaDetalle />} />
        <Route path="/compartir/:token" element={<Compartir />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}