import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import type { BootstrapContext } from './bootstrap/auth-pkce'

interface AppProps {
  bootstrap: BootstrapContext
}

export function AppRoutes({ bootstrap }: AppProps) {
  return (
    <Routes>
      <Route path="/" element={<HomePage bootstrap={bootstrap} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function App({ bootstrap }: AppProps) {
  return (
    <HashRouter>
      <AppRoutes bootstrap={bootstrap} />
    </HashRouter>
  )
}

function HomePage({ bootstrap }: AppProps) {
  const callbackMessage =
    bootstrap.authCallback.kind === 'pkce'
      ? 'Retorno seguro de autenticação detectado.'
      : bootstrap.authCallback.kind === 'error'
        ? 'Não foi possível concluir a autenticação.'
        : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Futebol - início">
          <span className="brand-mark" aria-hidden="true">⚽</span>
          <span>Futebol</span>
        </a>
        <span className="phase-badge">Fundação</span>
      </header>

      <main className="main-content">
        {callbackMessage ? (
          <p className="notice" role="status">{callbackMessage}</p>
        ) : null}

        <section className="hero-card" aria-labelledby="hero-title">
          <p className="eyebrow">Seu jogo, sem complicação</p>
          <h1 id="hero-title">Times equilibrados em poucos toques.</h1>
          <p className="hero-copy">
            Selecione quem chegou, escolha dois ou três times e deixe o sorteio cuidar do resto.
          </p>
          <button className="primary-action" type="button" disabled>
            Começar jogo
            <span aria-hidden="true">→</span>
          </button>
          <p className="helper-text">O fluxo de partidas será habilitado nas próximas fases.</p>
        </section>

        <section className="foundation" aria-labelledby="foundation-title">
          <div>
            <p className="eyebrow">Base preparada</p>
            <h2 id="foundation-title">Rápida, instalável e feita para celular.</h2>
          </div>
          <ul className="feature-list">
            <li><span aria-hidden="true">✓</span> Navegação segura no GitHub Pages</li>
            <li><span aria-hidden="true">✓</span> PWA limitada a /futebol/</li>
            <li><span aria-hidden="true">✓</span> Retorno PKCE antes das rotas</li>
          </ul>
        </section>
      </main>

      <footer className="footer">Sabará · Futebol entre amigos</footer>
    </div>
  )
}

function NotFoundPage() {
  return (
    <main className="standalone-message">
      <span className="brand-mark" aria-hidden="true">⚽</span>
      <h1>Esta tela ainda não existe.</h1>
      <p>Volte para o inicio da aplicacao.</p>
      <Link className="text-link" to="/">Ir para o início</Link>
    </main>
  )
}
