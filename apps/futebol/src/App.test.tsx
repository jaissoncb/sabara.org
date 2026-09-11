import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppRoutes } from './App'

describe('AppRoutes', () => {
  it('renderiza a fundacao mobile-first na rota inicial', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes bootstrap={{ authCallback: { kind: 'none' } }} />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: /times equilibrados em poucos toques/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /começar jogo/i })).toBeDisabled()
  })

  it('possui fallback interno sem depender do 404 da raiz', () => {
    render(
      <MemoryRouter initialEntries={['/rota-inexistente']}>
        <AppRoutes bootstrap={{ authCallback: { kind: 'none' } }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /esta tela ainda não existe/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ir para o início/i })).toHaveAttribute('href', '/')
  })
})
