import React from 'react'
import { ErrorScreen } from '@/components/layout/ErrorScreen'

interface State { error: Error | null }

// Evita a "tela vazia": se algum componente quebrar ao desenhar, mostra o motivo.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  handleReset = () => {
    ;['medplanner_token', 'medplanner_user'].forEach(k => {
      try { localStorage.removeItem(k) } catch (e) {}
    })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Algo deu errado ao abrir o app"
          message={this.state.error.message}
          onRetry={() => window.location.reload()}
          onLogout={this.handleReset}
        />
      )
    }
    return this.props.children
  }
}
