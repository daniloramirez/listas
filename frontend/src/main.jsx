import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import './index.css'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
const GOOGLE_CONFIGURADO =
  GOOGLE_CLIENT_ID &&
  !GOOGLE_CLIENT_ID.includes("TU_CLIENT_ID") &&
  GOOGLE_CLIENT_ID !== "CHANGE_ME"

const appConRouter = (
  <BrowserRouter basename="/listas">
    <App />
  </BrowserRouter>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {GOOGLE_CONFIGURADO ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        {appConRouter}
      </GoogleOAuthProvider>
    ) : (
      appConRouter
    )}
  </React.StrictMode>,
)
