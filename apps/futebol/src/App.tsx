import { useState, type FormEvent, type ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/auth-context'
import type { BootstrapContext } from './bootstrap/auth-pkce'
import { GroupDashboard } from './groups/GroupDashboard'

interface AppProps {
  bootstrap: BootstrapContext
}

export function AppRoutes({ bootstrap }: AppProps) {
  return (
    <Routes>
      <Route path="/" element={<HomePage bootstrap={bootstrap} />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<SignUpPage />} />
      <Route path="/esqueci-senha" element={<RecoveryPage />} />
      <Route path="/nova-senha" element={<NewPasswordPage />} />
      <Route path="/conta" element={<AccountPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function App({ bootstrap }: AppProps) {
  return (
    <AuthProvider client={bootstrap.client} initialSession={bootstrap.session}>
      <HashRouter>
        <AppRoutes bootstrap={bootstrap} />
      </HashRouter>
    </AuthProvider>
  )
}

function HomePage({ bootstrap }: AppProps) {
  const { session } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Futebol - início">
          <span className="brand-mark" aria-hidden="true">⚽</span>
          <span>Futebol</span>
        </a>
        {session ? <Link className="topbar-link" to="/conta">Conta</Link> : <Link className="topbar-link" to="/login">Entrar</Link>}
      </header>

      <main className="main-content">
        {bootstrap.message ? (
          <p className="notice" role="status">{bootstrap.message}</p>
        ) : null}

        {session ? (
          <GroupDashboard key={session.user.id} client={bootstrap.client} userId={session.user.id} />
        ) : (
          <>
            <section className="hero-card" aria-labelledby="hero-title">
              <p className="eyebrow">Seu jogo, sem complicação</p>
              <h1 id="hero-title">Times equilibrados em poucos toques.</h1>
              <p className="hero-copy">
                Selecione quem chegou, escolha dois ou três times e deixe o sorteio cuidar do resto.
              </p>
            <Link className="primary-action" to="/login">
              Entrar para começar <span aria-hidden="true">→</span>
            </Link>
              <p className="helper-text">Partidas e sorteios serão habilitados em uma fase posterior.</p>
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
          </>
        )}
      </main>

      <footer className="footer">Sabará · Futebol entre amigos</footer>
    </div>
  )
}

function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const result = await signIn(readFormString(form, 'email'), readFormString(form, 'password'))
    setBusy(false)
    setStatus(result.error)
    if (!result.error) void navigate('/')
  }

  return (
    <AuthPage title="Entre na sua conta" description="Use o e-mail e a senha cadastrados.">
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <EmailField />
        <PasswordField autoComplete="current-password" />
        <FormStatus message={status} />
        <SubmitButton busy={busy}>Entrar</SubmitButton>
      </form>
      <div className="auth-links">
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
        <Link to="/cadastro">Criar uma conta</Link>
      </div>
    </AuthPage>
  )
}

function SignUpPage() {
  const { session, signUp } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const result = await signUp({
      displayName: readFormString(form, 'displayName'),
      email: readFormString(form, 'email'),
      password: readFormString(form, 'password'),
    })
    setBusy(false)
    setStatus(result.error)
    setSuccess(!result.error)
  }

  return (
    <AuthPage title="Crie sua conta" description="Você receberá uma confirmação por e-mail se ela estiver habilitada no projeto.">
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <label>Nome<input name="displayName" autoComplete="name" minLength={2} maxLength={80} required /></label>
        <EmailField />
        <PasswordField autoComplete="new-password" />
        <FormStatus message={success ? 'Cadastro recebido. Confira seu e-mail para continuar.' : status} success={success} />
        <SubmitButton busy={busy}>Criar conta</SubmitButton>
      </form>
      <div className="auth-links"><Link to="/login">Já tenho uma conta</Link></div>
    </AuthPage>
  )
}

function RecoveryPage() {
  const { sendPasswordRecovery } = useAuth()
  const [status, setStatus] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const result = await sendPasswordRecovery(readFormString(form, 'email'))
    setBusy(false)
    setStatus(result.error)
    setSuccess(!result.error)
  }

  return (
    <AuthPage title="Recupere sua senha" description="Enviaremos um link seguro para o seu e-mail.">
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
        <EmailField />
        <FormStatus message={success ? 'Se houver uma conta para este e-mail, o link será enviado.' : status} success={success} />
        <SubmitButton busy={busy}>Enviar link</SubmitButton>
      </form>
      <div className="auth-links"><Link to="/login">Voltar para entrar</Link></div>
    </AuthPage>
  )
}

function NewPasswordPage() {
  const { session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const result = await updatePassword(readFormString(form, 'password'))
    setBusy(false)
    setStatus(result.error)
    if (!result.error) void navigate('/conta')
  }

  return (
    <AuthPage title="Defina uma nova senha" description="Escolha uma senha com pelo menos 8 caracteres.">
      {session ? (
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <PasswordField autoComplete="new-password" />
          <FormStatus message={status} />
          <SubmitButton busy={busy}>Salvar nova senha</SubmitButton>
        </form>
      ) : (
        <FormStatus message="Abra novamente o link de recuperação enviado ao seu e-mail." />
      )}
    </AuthPage>
  )
}

function AccountPage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | null>(null)

  if (!session) return <Navigate to="/login" replace />

  async function handleSignOut() {
    const result = await signOut()
    setStatus(result.error)
    if (!result.error) void navigate('/login')
  }

  return (
    <AuthPage title="Sua conta" description={session.user.email ?? 'Conta autenticada'}>
      <FormStatus message={status} />
      <button className="secondary-action" type="button" onClick={() => void handleSignOut()}>Sair deste dispositivo</button>
    </AuthPage>
  )
}

function AuthPage({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <main className="auth-page">
      <Link className="brand" to="/" aria-label="Futebol - início"><span className="brand-mark" aria-hidden="true">⚽</span><span>Futebol</span></Link>
      <section className="auth-card">
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  )
}

function EmailField() {
  return <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
}

function PasswordField({ autoComplete }: { autoComplete: 'current-password' | 'new-password' }) {
  return <label>Senha<input name="password" type="password" autoComplete={autoComplete} minLength={8} required /></label>
}

function FormStatus({ message, success = false }: { message: string | null; success?: boolean }) {
  return message ? <p className={success ? 'form-status success' : 'form-status'} role="status">{message}</p> : null
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Aguarde…' : children}</button>
}

function readFormString(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
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
