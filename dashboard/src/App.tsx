import React, { useEffect, useState, useCallback, useRef } from 'react'
import './App.css'
import { get, set } from 'idb-keyval'
import {
  CheckCircle2, WifiOff, ScanLine, Clock, Repeat,
  MapPin, RefreshCw, Package, User, TrendingUp,
  ChefHat, Wifi, LogOut, ShoppingBag, AlarmClock,
  Upload, ShieldAlert, Building2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────
interface OrderItem { name: string; quantity: number; price: number }
interface Order {
  id: string
  pickupCode: string
  total: number
  status: string
  items: OrderItem[]
  deliveryType: string
  recurrence: string
  scheduledFor: string | null
  address?: string
  extraFee?: number
  customerName?: string
  bakeryName?: string | null
  createdAt?: string
  courierId?: string | null
  courierName?: string | null
}

interface AuthState {
  userId: string
  token: string
  name: string
  bakeryId: string | null
  bakeryName: string
}

// ── Config ─────────────────────────────────────────────────────────
const SERVER_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:3000'
const API_BASE = SERVER_BASE + '/api'
const AUTO_REFRESH_INTERVAL = 30

// ── Helpers ────────────────────────────────────────────────────────
function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function formatTime(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000)
}

function urgencyClass(iso: string | null): 'urgent' | 'soon' | 'normal' {
  const min = minutesUntil(iso)
  if (min === null) return 'normal'
  if (min <= 10) return 'urgent'
  if (min <= 25) return 'soon'
  return 'normal'
}

// ── Baker Login ────────────────────────────────────────────────────
// Boulangers se connectent avec leur numéro de téléphone + PIN personnel.
// Le bakeryId est retourné dans le JWT et utilisé pour filtrer les commandes.
function BakeryLogin({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !pin) { setError('Numéro de téléphone et code PIN requis.'); return }
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Identifiants incorrects.')
        return
      }

      const role: string = data.role ?? ''
      if (role !== 'BAKER' && role !== 'BOULANGER') {
        setError('Accès réservé aux boulangers. Contactez votre administrateur.')
        return
      }

      if (!data.bakeryId) {
        setError("Votre compte n'est associé à aucune boulangerie. Contactez l'admin.")
        return
      }

      // Fetch bakery name
      let bakeryName = data.name ?? 'Mon Fournil'
      try {
        const bRes = await fetch(`${API_BASE}/order/bakeries`, {
          headers: authHeaders(data.token),
        })
        if (bRes.ok) {
          const bData = await bRes.json()
          const found = (bData.bakeries ?? []).find((b: any) => b.id === data.bakeryId)
          if (found) bakeryName = found.name
        }
      } catch { /* non-blocking */ }

      onAuth({
        userId: data.userId,
        token: data.token,
        name: data.name ?? 'Boulanger',
        bakeryId: data.bakeryId,
        bakeryName,
      })
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <ChefHat size={40} strokeWidth={1.5} />
        </div>
        <h1 className="login-title">LIMPA</h1>
        <p className="login-sub">Terminal Boulanger — Connexion</p>

        <form onSubmit={handleLogin} className="login-form">
          <label className="field-label">Numéro de téléphone</label>
          <input
            className="field-input"
            type="tel"
            inputMode="numeric"
            placeholder="Ex: 077123456"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            autoFocus
          />

          <label className="field-label" style={{ marginTop: '16px' }}>Code PIN</label>
          <input
            className="field-input"
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••"
            value={pin}
            onChange={e => setPin(e.target.value)}
          />

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Accéder au Terminal →'}
          </button>
        </form>

        <p className="login-hint">Votre compte doit être créé par un administrateur Limpa.</p>
      </div>
    </div>
  )
}

// ── Types ───────────────────────────────────────────────────────────
interface Specialty {
  id: string
  name: string
  price: number
  description: string | null
  image: string | null
  category: string | null
}

const IMAGE_OPTIONS = [
  { key: 'croissant', emoji: '🥐', label: 'Croissant' },
  { key: 'baguette',  emoji: '🥖', label: 'Baguette' },
  { key: 'bread',     emoji: '🍞', label: 'Pain' },
  { key: 'eclair',    emoji: '⚡', label: 'Éclair' },
  { key: 'tarte',     emoji: '🥧', label: 'Tarte' },
  { key: 'palmier',   emoji: '🍪', label: 'Palmier' },
  { key: 'sandwich',  emoji: '🥪', label: 'Sandwich' },
]

const CATEGORY_OPTIONS = [
  { value: 'pain',         label: '🥖 Pain' },
  { value: 'viennoiserie', label: '🥐 Viennoiserie' },
  { value: 'patisserie',   label: '🍰 Pâtisserie' },
  { value: 'sale',         label: '🥪 Sandwich / Salé' },
]

function ImageUpload({ value, onChange, token }: { value: string; onChange: (url: string) => void; token: string }) {
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const savedPreviewUrl = value.startsWith('/uploads/') ? `${SERVER_BASE}${value}` : null
  const legacyEmoji = IMAGE_OPTIONS.find(o => o.key === value)?.emoji
  const previewUrl = localPreview ?? savedPreviewUrl

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Format non valide. Choisissez une image.'); return }
    if (file.size > 50 * 1024 * 1024) { alert('Image trop lourde (max 50 Mo).'); return }

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch(`${SERVER_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur upload')
      const { url } = await res.json()
      onChange(url)
    } catch (err: any) {
      alert(err.message ?? "Erreur lors du chargement de l'image.")
      setLocalPreview(null)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          width: '100%', height: 180, borderRadius: 14,
          border: `2px dashed ${previewUrl ? '#D4A46C' : '#d1d5db'}`,
          background: previewUrl ? '#000' : '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden', position: 'relative', transition: 'border-color .2s',
          marginBottom: 10,
        }}
      >
        {uploading ? (
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
            <p style={{ fontSize: 13 }}>Chargement en cours...</p>
          </div>
        ) : previewUrl ? (
          <>
            <img src={previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
              Cliquer pour changer
            </div>
          </>
        ) : legacyEmoji ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>{legacyEmoji}</div>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Cliquer pour ajouter une vraie photo</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#6b7280' }}>Ajouter une photo</p>
            <p style={{ fontSize: 12, marginTop: 2 }}>JPG, PNG, WEBP · Max 50 Mo</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ── Specialties panel ─────────────────────────────────────────────
function SpecialtiesPanel({ auth }: { auth: AuthState }) {
  const [products, setProducts] = useState<Specialty[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<Specialty | null>(null)
  const [form, setForm] = useState({ name: '', price: '', description: '', image: '', category: '' })
  const [saving, setSaving] = useState(false)
  const hdrs = authHeaders(auth.token)

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/baker/products`, { headers: hdrs })
      if (res.ok) setProducts((await res.json()).products ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadProducts() }, [])

  const openAdd = () => {
    setEditTarget(null)
    setForm({ name: '', price: '', description: '', image: '', category: '' })
    setShowForm(true)
  }

  const openEdit = (p: Specialty) => {
    setEditTarget(p)
    setForm({ name: p.name, price: String(p.price), description: p.description ?? '', image: p.image ?? '', category: p.category ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { alert('Nom et prix requis.'); return }
    setSaving(true)
    try {
      const body = JSON.stringify({
        name: form.name.trim(),
        price: parseFloat(form.price),
        description: form.description.trim() || null,
        image: form.image.trim() || null,
        category: form.category.trim() || null,
      })
      const url = editTarget
        ? `${API_BASE}/baker/products/${editTarget.id}`
        : `${API_BASE}/baker/products`
      const res = await fetch(url, { method: editTarget ? 'PUT' : 'POST', headers: hdrs, body })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur')
      await loadProducts()
      setShowForm(false)
    } catch (e: any) {
      alert(e.message ?? 'Erreur lors de l\'enregistrement.')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return
    try {
      await fetch(`${API_BASE}/baker/products/${id}`, { method: 'DELETE', headers: hdrs })
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch { alert('Erreur lors de la suppression.') }
  }

  if (loading) return (
    <div className="state-center">
      <div className="spin" style={{ fontSize: 28 }}>⏳</div>
      <p>Chargement de vos spécialités...</p>
    </div>
  )

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'inherit', fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
            Mes Spécialités Maison
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            {products.length} produit{products.length !== 1 ? 's' : ''} · visibles uniquement sur votre boulangerie
          </p>
        </div>
        <button onClick={openAdd} className="validate-btn" style={{ maxWidth: 200 }}>
          + Ajouter une spécialité
        </button>
      </div>

      {products.length === 0 ? (
        <div className="state-center" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🥐</div>
          <p style={{ fontSize: 16, color: '#6b7280' }}>Aucune spécialité pour l'instant.</p>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>
            Créez vos propres produits qui s'afficheront uniquement à vos clients.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {products.map(p => {
            const imgOpt = IMAGE_OPTIONS.find(o => o.key === p.image)
            const catLabel = CATEGORY_OPTIONS.find(c => c.value === p.category)?.label
            return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 16, padding: 18, border: '1px solid #f3f4f6', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              {/* Active badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#16a34a', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                  🟢 Actif — visible aux clients à proximité
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  {p.image?.startsWith('/uploads/') ? (
                    <img src={`${SERVER_BASE}${p.image}`} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} alt={p.name} />
                  ) : imgOpt ? (
                    <span style={{ fontSize: 36, flexShrink: 0 }}>{imgOpt.emoji}</span>
                  ) : null}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>{p.name}</h3>
                    {catLabel && (
                      <span style={{ fontSize: 11, color: '#D4A46C', fontWeight: 600 }}>
                        {catLabel}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#D4A46C', marginLeft: 12 }}>
                  {p.price.toLocaleString('fr-FR')} F
                </span>
              </div>
              {p.description && (
                <p style={{
                  fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{p.description}</p>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => openEdit(p)}
                  style={{ flex: 1, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#dc2626' }}
                >
                  🗑
                </button>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 24, width: '100%', maxWidth: 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
                  {editTarget ? '✏️ Modifier la spécialité' : '✨ Nouvelle spécialité'}
                </h3>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
                  {editTarget ? 'Mettez à jour votre produit' : 'Créez un produit exclusif à votre boulangerie'}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontSize: 16, color: '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ overflowY: 'auto', padding: 24, flex: 1 }}>

              {/* Photo first */}
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Photo du produit</label>
              <div style={{ marginBottom: 20 }}>
                <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} token={auth.token} />
              </div>

              {/* Name + Price side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom du produit *</label>
                  <input className="field-input" placeholder="Ex: Brioche maison..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Prix (FCFA) *</label>
                  <input className="field-input" type="number" placeholder="Ex: 1200" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>

              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Catégorie</label>
              <select className="field-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ marginBottom: 14 }}>
                <option value="">-- Sélectionner --</option>
                {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>

              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
              <textarea
                className="field-input"
                placeholder="Décrivez votre spécialité en quelques mots..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* ── Sticky footer ── */}
            <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderTop: '1px solid #f3f4f6', flexShrink: 0, borderRadius: '0 0 24px 24px' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ flex: 1, padding: '12px', background: '#f3f4f6', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, color: '#6b7280', fontSize: 14 }}
              >
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving} className="validate-btn" style={{ flex: 2 }}>
                {saving ? 'Enregistrement...' : editTarget ? '✅ Enregistrer' : '✨ Créer la spécialité'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────
function Dashboard({ auth, onLogout }: { auth: AuthState; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [completedOrders, setCompletedOrders] = useState<Order[]>([])
  const [dashTab, setDashTab] = useState<'pending' | 'history' | 'specialties'>('pending')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [codeInput, setCodeInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [outboxCount, setOutboxCount] = useState(0)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(AUTO_REFRESH_INTERVAL)
  const [validatingId, setValidatingId] = useState<string | null>(null)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const [statsRevenue, setStatsRevenue] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hdrs = authHeaders(auth.token)

  // ── Load orders ──────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    setLoading(true)
    if (navigator.onLine) {
      try {
        const bakeryParam = auth.bakeryId ? `?bakeryId=${auth.bakeryId}` : ''
        const [res, statsRes] = await Promise.all([
          fetch(`${API_BASE}/admin/orders/pending${bakeryParam}`, { headers: hdrs }),
          fetch(`${API_BASE}/admin/stats${bakeryParam}`, { headers: hdrs }),
        ])
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const fetched: Order[] = data.orders ?? []
        setOrders(fetched)
        await set('baker_orders_cache', fetched)
        setLastSync(new Date().toLocaleTimeString('fr-FR'))
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStatsRevenue(statsData.revenueToday ?? null)
        }
        // Today's completed orders for history tab
        try {
          const today = new Date().toISOString().split('T')[0]
          const completedUrl = `${API_BASE}/admin/orders?status=DELIVERED&date=${today}` + (auth.bakeryId ? `&bakeryId=${auth.bakeryId}` : '')
          const completedRes = await fetch(completedUrl, { headers: hdrs })
          if (completedRes.ok) {
            const completedData = await completedRes.json()
            setCompletedOrders(completedData.orders ?? [])
          }
        } catch { /* non-critical */ }
      } catch {
        const cached = (await get('baker_orders_cache')) || []
        setOrders(cached as Order[])
      }
    } else {
      const cached = (await get('baker_orders_cache')) || []
      setOrders(cached as Order[])
    }
    setSecondsUntilRefresh(AUTO_REFRESH_INTERVAL)
    const outbox: string[] = (await get('baker_validation_outbox')) || []
    setOutboxCount(outbox.length)
    setLoading(false)
  }, [auth.bakeryId, auth.token])

  // ── Auto-refresh countdown ───────────────────────────────────
  useEffect(() => {
    loadOrders()
    timerRef.current = setInterval(() => {
      setSecondsUntilRefresh(s => {
        if (s <= 1) { loadOrders(); return AUTO_REFRESH_INTERVAL }
        return s - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [loadOrders])

  // ── Online / offline events ──────────────────────────────────
  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); syncOutbox(); loadOrders() }
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [loadOrders])

  // ── Outbox sync ──────────────────────────────────────────────
  const syncOutbox = async () => {
    const outbox: string[] = (await get('baker_validation_outbox')) || []
    if (outbox.length === 0) return
    const failed: string[] = []
    for (const id of outbox) {
      try {
        const res = await fetch(`${API_BASE}/order/${id}/deliver`, { method: 'POST', headers: hdrs })
        if (!res.ok) throw new Error()
      } catch { failed.push(id) }
    }
    await set('baker_validation_outbox', failed)
    setOutboxCount(failed.length)
  }

  // ── Validate order ───────────────────────────────────────────
  const handleValidate = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault()
    const code = overrideCode ?? codeInput
    if (!code) return

    const match = orders.find(o =>
      o.pickupCode.toUpperCase() === code.toUpperCase() || o.id === code
    )
    if (!match) { alert('❌ Code introuvable. Vérifiez le PIN du client.'); return }

    setValidatingId(match.id)

    setTimeout(async () => {
      setExitingIds(prev => new Set(prev).add(match.id))
      setTimeout(async () => {
        const updated = orders.filter(o => o.id !== match.id)
        setOrders(updated)
        await set('baker_orders_cache', updated)
        setExitingIds(prev => { const s = new Set(prev); s.delete(match.id); return s })
        setValidatingId(null)
      }, 420)

      if (navigator.onLine) {
        try {
          const res = await fetch(`${API_BASE}/order/${match.id}/deliver`, { method: 'POST', headers: hdrs })
          if (!res.ok) throw new Error()
        } catch {
          const outbox: string[] = (await get('baker_validation_outbox')) || []
          outbox.push(match.id)
          await set('baker_validation_outbox', outbox)
          setOutboxCount(outbox.length)
        }
      } else {
        const outbox: string[] = (await get('baker_validation_outbox')) || []
        outbox.push(match.id)
        await set('baker_validation_outbox', outbox)
        setOutboxCount(outbox.length)
      }
    }, 200)

    setCodeInput('')
  }

  // ── Confirm order (PENDING → CONFIRMED) ──────────────────────
  const handleConfirm = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/confirm`, { method: 'PUT', headers: hdrs })
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CONFIRMED' } : o))
      } else {
        alert('Impossible de confirmer cette commande.')
      }
    } catch { alert('Erreur réseau.') }
  }

  // ── Mark order READY (CONFIRMED → READY) ─────────────────────
  const handleMarkReady = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/ready`, { method: 'PUT', headers: hdrs })
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'READY' } : o))
      } else {
        alert('Impossible de marquer la commande comme prête.')
      }
    } catch { alert('Erreur réseau.') }
  }

  // ── Confirm physical handoff to courier (READY → PICKED_UP) ──
  const handleHandoff = async (orderId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/orders/${orderId}/handoff`, { method: 'PUT', headers: hdrs })
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'PICKED_UP' } : o))
      } else {
        const d = await res.json()
        alert(d.error || 'Impossible de confirmer la remise.')
      }
    } catch { alert('Erreur réseau.') }
  }

  // ── KPIs ──────────────────────────────────────────────────────
  const pendingOrders   = orders.filter(o => o.status === 'PENDING')
  const confirmedOrders = orders.filter(o => o.status === 'CONFIRMED')
  const readyOrders     = orders.filter(o => o.status === 'READY')
  const pickedUpOrders  = orders.filter(o => o.status === 'PICKED_UP')
  const todayRevenue = orders
    .filter(o => o.createdAt && new Date(o.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + o.total, 0)

  const urgentCount = confirmedOrders.filter(o => urgencyClass(o.scheduledFor) === 'urgent').length
  const deliveryCount = orders.filter(o => o.deliveryType.includes('DELIVERY')).length

  return (
    <div className="app">

      {/* ── SIDEBAR (35%) ── */}
      <div className="sidebar">

        <div className="sidebar-header">
          <div className="sidebar-logo-wrap">
            <ChefHat size={28} strokeWidth={1.5} />
          </div>
          <div>
            <p className="sidebar-brand">LIMPA</p>
            <p className="sidebar-sub">Terminal de Retrait</p>
          </div>
        </div>

        <div className="node-badge">
          <Building2 size={14} />
          <span>{auth.bakeryName}</span>
        </div>

        <div className={`status-pill ${isOffline ? 'status-offline' : 'status-online'}`}>
          {isOffline
            ? <><WifiOff size={15} /> <span>MODE SECOURS HORS-LIGNE</span></>
            : <><Wifi size={15} /> <span>SYSTÈME EN LIGNE</span></>}
        </div>

        {outboxCount > 0 && (
          <div className="outbox-pill">
            <Upload size={13} />
            <span>{outboxCount} validation{outboxCount > 1 ? 's' : ''} en attente de sync</span>
          </div>
        )}

        {lastSync && !isOffline && (
          <p className="sync-info">
            Synchro : {lastSync} · Prochain dans {secondsUntilRefresh}s
          </p>
        )}

        <div className="scanner-card">
          <div className="scanner-icon-wrap">
            <ScanLine size={40} strokeWidth={1.5} />
          </div>
          <h2 className="scanner-title">Scanner QR ou Code PIN</h2>
          <p className="scanner-hint">Douchette USB ou saisie manuelle.</p>

          <form className="code-form" onSubmit={handleValidate}>
            <input
              id="pin-input"
              type="text"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex: A-192"
              className="code-input"
              autoFocus
              autoComplete="off"
            />
            <button type="submit" className="code-btn">OK</button>
          </form>
        </div>

        <button onClick={loadOrders} className="refresh-btn">
          <RefreshCw size={14} /> Rafraîchir maintenant
        </button>

        <button onClick={onLogout} className="logout-btn">
          <LogOut size={14} /> Déconnexion
        </button>
      </div>

      {/* ── MAIN PANEL (65%) ── */}
      <div className="main">

        <div className="kpi-bar">
          <div className="kpi-card">
            <ShoppingBag size={18} className="kpi-icon kpi-amber" />
            <div>
              <p className="kpi-value">{orders.length}</p>
              <p className="kpi-label">En attente</p>
            </div>
          </div>
          <div className="kpi-card">
            <TrendingUp size={18} className="kpi-icon kpi-green" />
            <div>
              <p className="kpi-value">{(statsRevenue ?? todayRevenue).toLocaleString('fr-FR')} F</p>
              <p className="kpi-label">CA Aujourd'hui{statsRevenue !== null ? ' ✓' : ''}</p>
            </div>
          </div>
          <div className="kpi-card">
            <AlarmClock size={18} className={`kpi-icon ${urgentCount > 0 ? 'kpi-red' : 'kpi-gray'}`} />
            <div>
              <p className="kpi-value">{urgentCount}</p>
              <p className="kpi-label">Urgents (≤10 min)</p>
            </div>
          </div>
          <div className="kpi-card">
            <MapPin size={18} className="kpi-icon kpi-blue" />
            <div>
              <p className="kpi-value">{deliveryCount}</p>
              <p className="kpi-label">Livraisons</p>
            </div>
          </div>
          <div className="kpi-card">
            <CheckCircle2 size={18} className="kpi-icon kpi-green" />
            <div>
              <p className="kpi-value">{completedOrders.length}</p>
              <p className="kpi-label">Livrées</p>
            </div>
          </div>
          {isOffline && (
            <div className="kpi-card kpi-offline-card">
              <ShieldAlert size={18} className="kpi-icon kpi-orange" />
              <div>
                <p className="kpi-value" style={{ fontSize: '12px', lineHeight: '1.2' }}>Cache local</p>
                <p className="kpi-label">Hors ligne</p>
              </div>
            </div>
          )}
        </div>

        <div className="dash-tabs">
          <button className={`dash-tab ${dashTab === 'pending' ? 'active' : ''}`} onClick={() => setDashTab('pending')}>
            En cours ({orders.length})
          </button>
          <button className={`dash-tab ${dashTab === 'history' ? 'active' : ''}`} onClick={() => setDashTab('history')}>
            Historique ({completedOrders.length})
          </button>
          <button className={`dash-tab ${dashTab === 'specialties' ? 'active' : ''}`} onClick={() => setDashTab('specialties')}>
            ✨ Mes Spécialités
          </button>
        </div>

        {dashTab !== 'specialties' && (
        <div className="orders-header">
          <div>
            <h2 className="orders-title">{dashTab === 'pending' ? 'Commandes à Préparer' : "Commandes Livrées Aujourd'hui"}</h2>
            <p className="orders-sub">
              {dashTab === 'pending'
                ? `${orders.length} sac${orders.length !== 1 ? 's' : ''} en attente · Prochain refresh dans ${secondsUntilRefresh}s`
                : `${completedOrders.length} commande${completedOrders.length !== 1 ? 's' : ''} livrée${completedOrders.length !== 1 ? 's' : ''} aujourd'hui`}
            </p>
          </div>
          <div className="refresh-countdown">
            <div
              className="countdown-arc"
              style={{ '--pct': `${(secondsUntilRefresh / AUTO_REFRESH_INTERVAL) * 100}%` } as any}
            />
          </div>
        </div>
        )}

        {dashTab === 'specialties' && <SpecialtiesPanel auth={auth} />}

        <div className="orders-scroll" style={{ display: dashTab === 'specialties' ? 'none' : undefined }}>
          {dashTab === 'history' ? (
            completedOrders.length === 0 ? (
              <div className="state-center">
                <CheckCircle2 size={64} strokeWidth={1} style={{ color: '#bbf7d0', marginBottom: '16px' }} />
                <p style={{ fontSize: '18px', color: '#6b7280' }}>Aucune commande livrée aujourd'hui.</p>
              </div>
            ) : (
              <div className="order-grid">
                {completedOrders.map(order => (
                  <div key={order.id} className="order-card completed-card">
                    <div className="card-badges">
                      <span className="badge-type badge-delivered-tag">LIVRÉE</span>
                      {order.recurrence === 'DAILY' && (
                        <span className="badge-daily"><Repeat size={9} /> Quotidien</span>
                      )}
                    </div>
                    <div className="card-code">{order.pickupCode}</div>
                    <p className="card-total">{order.total.toLocaleString('fr-FR')} FCFA</p>
                    {order.customerName && (
                      <div className="card-meta">
                        <div className="meta-row"><User size={12} /><span>{order.customerName}</span></div>
                      </div>
                    )}
                    {order.items?.length > 0 && (
                      <div className="card-items">
                        {order.items.map((it, i) => <p key={i}>• {it.name} ×{it.quantity}</p>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : loading ? (
            <div className="state-center">
              <RefreshCw size={32} className="spin" />
              <p>Chargement des commandes...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="state-center">
              <CheckCircle2 size={64} strokeWidth={1} style={{ color: '#bbf7d0', marginBottom: '16px' }} />
              <p style={{ fontSize: '18px', color: '#6b7280' }}>Toutes les commandes sont livrées.</p>
              <button onClick={loadOrders} className="refresh-btn" style={{ marginTop: '16px', alignSelf: 'center' }}>
                Vérifier de nouvelles commandes
              </button>
            </div>
          ) : (
            <div className="order-grid">
              {pendingOrders.length > 0 && (
                <div style={{ gridColumn: '1 / -1', background: '#FEF3C7', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, border: '1px solid #FBBF24' }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <strong style={{ color: '#B45309', fontSize: 13 }}>{pendingOrders.length} nouvelle{pendingOrders.length > 1 ? 's' : ''} commande{pendingOrders.length > 1 ? 's' : ''} à accepter</strong>
                </div>
              )}
              {[...pendingOrders, ...confirmedOrders, ...readyOrders, ...pickedUpOrders].map(order => {
                const isDelivery = order.deliveryType.includes('DELIVERY')
                const urg = order.status === 'PENDING' ? 'normal' : urgencyClass(order.scheduledFor)
                const isExiting = exitingIds.has(order.id)
                const isValidating = validatingId === order.id
                const mins = minutesUntil(order.scheduledFor)
                return (
                  <div
                    key={order.id}
                    className={`order-card ${order.status === 'PENDING' ? 'urgency-pending' : order.status === 'PICKED_UP' ? 'urgency-normal' : `urgency-${urg}`} ${isExiting ? 'card-exit' : ''} ${isValidating ? 'card-validating' : ''}`}
                  >
                    <div className="card-badges">
                      <span className={`badge-type badge-${order.deliveryType.toLowerCase().replace('_', '-')}`}>
                        {order.deliveryType.replace('_', ' ')}
                      </span>
                      {/* Status badge */}
                      {order.status === 'CONFIRMED' && <span className="badge-confirmed-tag">EN PRÉPARATION</span>}
                      {order.status === 'READY' && !isDelivery && <span className="badge-ready-tag">✅ PRÊTE</span>}
                      {order.status === 'READY' && isDelivery && !order.courierId && <span className="badge-ready-tag">✅ PRÊTE · Attend livreur</span>}
                      {order.status === 'READY' && isDelivery && order.courierId && <span className="badge-courier-tag">🛵 Livreur en route</span>}
                      {order.status === 'PICKED_UP' && <span className="badge-picked-tag">🚀 En livraison</span>}
                      {order.recurrence === 'DAILY' && <span className="badge-daily"><Repeat size={9} /> Quotidien</span>}
                      {urg === 'urgent' && order.status !== 'PICKED_UP' && <span className="badge-urgent">🔥 URGENT</span>}
                    </div>

                    <div className="card-code">{order.pickupCode}</div>
                    <p className="card-total">{order.total.toLocaleString('fr-FR')} FCFA</p>
                    {order.extraFee != null && order.extraFee > 0 && (
                      <p className="card-extra">+{order.extraFee} FCFA surcharge</p>
                    )}

                    <div className="card-meta">
                      {order.customerName && (
                        <div className="meta-row"><User size={12} /><span>{order.customerName}</span></div>
                      )}
                      {order.scheduledFor && (
                        <div className={`meta-row ${urg !== 'normal' ? 'meta-urgent' : ''}`}>
                          <Clock size={12} />
                          <span>{formatTime(order.scheduledFor)}{mins !== null && ` (${mins > 0 ? `dans ${mins} min` : 'maintenant'})`}</span>
                        </div>
                      )}
                      {isDelivery && order.address && (
                        <div className="meta-row"><MapPin size={12} /><span>{order.address}</span></div>
                      )}
                      {order.bakeryName && (
                        <div className="meta-row"><Package size={12} /><span style={{ color: '#92400e' }}>{order.bakeryName}</span></div>
                      )}
                      {order.courierName && (order.status === 'READY' || order.status === 'PICKED_UP') && (
                        <div className="meta-row" style={{ color: '#1d4ed8' }}>
                          <span>🛵</span><span style={{ fontWeight: 600 }}>{order.courierName}</span>
                        </div>
                      )}
                    </div>

                    {order.items?.length > 0 && (
                      <div className="card-items">
                        {order.items.map((it, i) => <p key={i}>• {it.name} ×{it.quantity}</p>)}
                      </div>
                    )}

                    {/* ── Action button — depends on status + type ── */}
                    {order.status === 'PENDING' && (
                      <button onClick={() => handleConfirm(order.id)} className="validate-btn" style={{ background: '#D97706' }}>
                        <CheckCircle2 size={16} /> Accepter la commande
                      </button>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <button onClick={() => handleMarkReady(order.id)} className="validate-btn" style={{ background: '#059669' }}>
                        <CheckCircle2 size={16} /> {isDelivery ? 'Prête — Libérer pour livreur' : 'Commande prête'}
                      </button>
                    )}
                    {order.status === 'READY' && !isDelivery && (
                      <button
                        onClick={() => handleValidate(undefined, order.pickupCode)}
                        className="validate-btn"
                        disabled={isValidating || isExiting}
                      >
                        {isValidating ? <RefreshCw size={16} className="spin" /> : <><CheckCircle2 size={16} /> Remettre au client</>}
                      </button>
                    )}
                    {order.status === 'READY' && isDelivery && !order.courierId && (
                      <div className="status-info-btn">
                        <span>⏳ En attente d'un livreur…</span>
                      </div>
                    )}
                    {order.status === 'READY' && isDelivery && order.courierId && (
                      <button onClick={() => handleHandoff(order.id)} className="validate-btn" style={{ background: '#2563EB' }}>
                        <CheckCircle2 size={16} /> Confirmer remise au livreur
                      </button>
                    )}
                    {order.status === 'PICKED_UP' && (
                      <div className="status-info-btn status-info-delivered">
                        <span>🚀 En livraison par {order.courierName ?? 'le livreur'}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null)

  const handleAuth = (a: AuthState) => setAuth(a)
  const handleLogout = () => setAuth(null)

  if (!auth) return <BakeryLogin onAuth={handleAuth} />
  return <Dashboard auth={auth} onLogout={handleLogout} />
}
