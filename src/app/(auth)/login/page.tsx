'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: email.split('@')[0] },
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      if (data.user && !data.session) {
        setError('Conta criada! Verifique seu e-mail para confirmar, ou desative a confirmação no Supabase (Authentication → Providers → Email → Confirm email: OFF)')
        setLoading(false)
        return
      }
      // Create profile manually after signup
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: email.split('@')[0],
          role: 'owner',
        })
      }
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-xl">
            A
          </div>
          <h1 className="mt-4 text-2xl font-bold">Ana Assistente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="mt-1"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === 'login' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-primary hover:underline font-medium"
          >
            {mode === 'login' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
