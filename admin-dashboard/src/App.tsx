import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import {
  LayoutDashboard, ShoppingBag, Cookie, Store, Users, Truck,
  Plus, TrendingUp, Package, RefreshCw, Layers, LogOut,
  Search, Eye, UserPlus, ToggleLeft, ToggleRight, Pencil,
  Trash2, AlertTriangle, MapPin, CheckCircle2, X, Tag, Settings,
  Clock, Bike, CheckCheck, CircleDot, Menu,
} from 'lucide-react';

const SERVER_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:3000';
const API_BASE = SERVER_BASE + '/api';

// ── Types ──────────────────────────────────────────────────────────
interface AuthState { userId: string; name: string; role: string; token: string }
interface Stats { ordersToday: number; pending: number; revenueToday: number; topProducts: { name: string; quantity: number }[]; totalCustomers: number; totalBakeries: number; newCustomersToday: number; totalBakers: number; totalCouriers: number; activeCouriers: number; }
interface Customer { id: string; name: string; phoneNumber: string; walletBalance: number; walletPoints: number; orderCount: number; totalSpent: number; createdAt: string; }
interface Bakery { id: string; name: string; address: string | null; latitude?: number; longitude?: number; active?: boolean }
interface Order {
  id: string; pickupCode: string; total: number; status: string; deliveryType: string;
  recurrence: string; scheduledFor: string | null; address: string | null; extraFee: number;
  customerName: string; customerPhone: string; bakeryName: string | null; bakeryId: string | null;
  courierId: string | null; courierName: string | null;
  latitude?: number | null; longitude?: number | null;
  items: { name: string; quantity: number; price: number }[]; createdAt: string;
}
interface Staff {
  id: string; name: string; phoneNumber: string; role: string; active: boolean;
  bakeryId: string | null; bakeryName: string | null; createdAt: string;
}
interface Product {
  id: string; name: string; price: number; description: string | null;
  image: string | null; category: string | null;
  bakeryId: string | null; bakeryName: string | null;
}
interface OrderAlert { id: string; pickupCode: string; total: number; address: string; customerName: string; bakeryName: string | null; createdAt: string; waitingMinutes: number }
interface DeliveryAlert extends OrderAlert {}
interface OrderAlerts { pendingAlerts: OrderAlert[]; confirmedAlerts: OrderAlert[]; noLivreurAlerts: OrderAlert[]; pickedUpAlerts: OrderAlert[] }
interface Coupon { id: string; code: string; discountType: 'PERCENTAGE' | 'FIXED'; discountValue: number; maxUses: number | null; usedCount: number; active: boolean; createdAt: string }
interface PlatformSettings { feePerKm: number; roundingUnit: number; minFee: number; alertPendingMinutes: number; alertConfirmedMinutes: number; alertPickedUpMinutes: number; pointsEarnRate: number; pointsRedeemRate: number }

type Tab = 'overview' | 'orders' | 'products' | 'bakeries' | 'staff' | 'deliveries' | 'coupons' | 'customers' | 'settings' | 'points';

// ── Helpers ─────────────────────────────────────────────────────────
function authHeaders(token: string) { return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) }
function fmtCurrency(n: number) { return n.toLocaleString('fr-FR') + ' F' }
function statusColor(s: string) {
  if (s === 'DELIVERED') return 'badge-delivered';
  if (s === 'PICKED_UP') return 'badge-picked';
  if (s === 'READY')     return 'badge-ready';
  if (s === 'CONFIRMED') return 'badge-confirmed';
  return 'badge-pending';
}
function statusLabel(s: string) {
  if (s === 'PENDING')   return 'En attente';
  if (s === 'CONFIRMED') return 'En préparation';
  if (s === 'READY')     return 'Prête';
  if (s === 'PICKED_UP') return 'En livraison';
  if (s === 'DELIVERED') return 'Livrée';
  return s;
}
function roleLabel(r: string) { return r === 'BAKER' || r === 'BOULANGER' ? 'Boulanger' : r === 'COURIER' || r === 'LIVREUR' ? 'Livreur' : 'Admin' }

// ══════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════
function AdminLogin({ onAuth }: { onAuth: (a: AuthState) => void }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin) { setError('Numéro et PIN requis.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Identifiants incorrects.'); return; }
      if (d.role !== 'ADMIN') { setError('Accès réservé aux administrateurs.'); return; }
      onAuth({ userId: d.userId, name: d.name, role: d.role, token: d.token });
    } catch { setError('Impossible de joindre le serveur.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-icon"><Layers size={40} strokeWidth={1.5} /></div>
        <h1 className="login-title">LIMPA</h1>
        <p className="login-sub">Administration Centrale</p>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Numéro de téléphone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: 077123456" />
          </div>
          <div className="form-group">
            <label>Code PIN</label>
            <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════
function OverviewTab({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [orderAlerts, setOrderAlerts] = useState<OrderAlerts>({ pendingAlerts: [], confirmedAlerts: [], noLivreurAlerts: [], pickedUpAlerts: [] });
  const [couriers, setCouriers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignCourierVal, setAssignCourierVal] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = authHeaders(token);
      const [sR, oR, aR, cR] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/orders?`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/order-alerts`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/staff?role=COURIER`, { headers: hdrs }),
      ]);
      if (sR.ok) setStats(await sR.json());
      if (oR.ok) { const d = await oR.json(); setRecentOrders((d.orders ?? []).slice(0, 5)); }
      if (aR.ok) setOrderAlerts(await aR.json());
      if (cR.ok) { const d = await cR.json(); setCouriers(d.staff ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const doNotify = async (orderId: string, alertType: string) => {
    const key = `notify-${orderId}`;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${orderId}/notify`, {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ alertType }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? 'Erreur notification.'); return; }
      if (d.sent) alert(`Notification envoyée (${d.count ?? 1} destinataire(s)).`);
      else alert(d.reason ?? 'Aucune cible push disponible pour cette commande.');
    } catch { alert('Erreur réseau.'); }
    finally { setActionLoading(p => ({ ...p, [key]: false })); }
  };

  const doForceConfirm = async (orderId: string) => {
    const key = `confirm-${orderId}`;
    if (!window.confirm('Forcer la confirmation de cette commande (PENDING → EN PRÉPARATION) ?')) return;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${orderId}/confirm`, {
        method: 'PUT', headers: authHeaders(token),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? 'Erreur.'); return; }
      load();
    } catch { alert('Erreur réseau.'); }
    finally { setActionLoading(p => ({ ...p, [key]: false })); }
  };

  const doAssignCourier = async () => {
    if (!assigningId || !assignCourierVal) return;
    const key = `assign-${assigningId}`;
    setActionLoading(p => ({ ...p, [key]: true }));
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${assigningId}/assign-courier`, {
        method: 'PUT', headers: authHeaders(token),
        body: JSON.stringify({ courierId: assignCourierVal }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? 'Erreur.'); return; }
      setAssigningId(null); setAssignCourierVal(''); load();
    } catch { alert('Erreur réseau.'); }
    finally { setActionLoading(p => ({ ...p, [key]: false })); }
  };

  if (loading && !stats) return <div className="loading-center"><RefreshCw className="spin" size={32} /></div>;

  const totalAlerts = orderAlerts.pendingAlerts.length + orderAlerts.confirmedAlerts.length + orderAlerts.noLivreurAlerts.length + orderAlerts.pickedUpAlerts.length;

  const AlertRow = ({ color, icon, label, items, alertType, actions }: {
    color: string; icon: React.ReactNode; label: string; items: OrderAlert[]; alertType: string;
    actions: Array<{ label: string; actionKey: string; onClick: (id: string) => void; style?: React.CSSProperties }>;
  }) =>
    items.length === 0 ? null : (
      <div style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontWeight: 700, color, fontSize: 13 }}>{items.length} {label}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(a => (
            <div key={a.id} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>#{a.pickupCode}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>{a.waitingMinutes} min{a.bakeryName ? ` · ${a.bakeryName}` : ''}{a.customerName ? ` · ${a.customerName}` : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {actions.map(act => (
                  alertType === 'NO_LIVREUR' && act.actionKey === 'assign' ? (
                    assigningId === a.id ? (
                      <div key="assign-inline" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select value={assignCourierVal} onChange={e => setAssignCourierVal(e.target.value)}
                          style={{ fontSize: 12, padding: '3px 6px', borderRadius: 5, border: 'none', background: 'rgba(255,255,255,0.9)', color: '#111' }}>
                          <option value="">Choisir livreur…</option>
                          {couriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button disabled={!assignCourierVal || actionLoading[`assign-${a.id}`]}
                          onClick={doAssignCourier}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontWeight: 600 }}>
                          {actionLoading[`assign-${a.id}`] ? '…' : 'OK'}
                        </button>
                        <button onClick={() => { setAssigningId(null); setAssignCourierVal(''); }}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button key={act.actionKey}
                        onClick={() => { setAssigningId(a.id); setAssignCourierVal(''); }}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600, ...(act.style ?? { background: 'rgba(255,255,255,0.2)', color: '#fff' }) }}>
                        {act.label}
                      </button>
                    )
                  ) : (
                    <button key={act.actionKey}
                      disabled={actionLoading[`${act.actionKey}-${a.id}`]}
                      onClick={() => act.onClick(a.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 600, opacity: actionLoading[`${act.actionKey}-${a.id}`] ? 0.6 : 1, ...(act.style ?? { background: 'rgba(255,255,255,0.2)', color: '#fff' }) }}>
                      {actionLoading[`${act.actionKey}-${a.id}`] ? '…' : act.label}
                    </button>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div>
      {totalAlerts > 0 && (
        <div className="alert-banner" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <AlertTriangle size={18} />
            <span style={{ fontWeight: 700 }}>{totalAlerts} alerte(s) commande en cours</span>
          </div>
          <AlertRow color="#FCD34D" icon={<Clock size={15} />} label="commande(s) non acceptée(s)" items={orderAlerts.pendingAlerts} alertType="PENDING"
            actions={[
              { label: '🔔 Notifier boulanger', actionKey: 'notify', onClick: id => doNotify(id, 'PENDING'), style: { background: 'rgba(252,211,77,0.25)', color: '#FCD34D' } },
              { label: '⚡ Forcer confirmation', actionKey: 'confirm', onClick: id => doForceConfirm(id), style: { background: 'rgba(252,211,77,0.15)', color: '#FCD34D' } },
            ]} />
          <AlertRow color="#FCA5A5" icon={<CircleDot size={15} />} label="commande(s) non préparée(s)" items={orderAlerts.confirmedAlerts} alertType="CONFIRMED"
            actions={[
              { label: '🔔 Notifier boulanger', actionKey: 'notify', onClick: id => doNotify(id, 'CONFIRMED'), style: { background: 'rgba(252,165,165,0.25)', color: '#FCA5A5' } },
            ]} />
          <AlertRow color="#F97316" icon={<Bike size={15} />} label="livraison(s) sans livreur" items={orderAlerts.noLivreurAlerts} alertType="NO_LIVREUR"
            actions={[
              { label: '🛵 Assigner livreur', actionKey: 'assign', onClick: () => {}, style: { background: 'rgba(249,115,22,0.25)', color: '#F97316' } },
            ]} />
          <AlertRow color="#C4B5FD" icon={<CheckCheck size={15} />} label="livraison(s) non livrée(s)" items={orderAlerts.pickedUpAlerts} alertType="PICKED_UP"
            actions={[
              { label: '🔔 Notifier livreur', actionKey: 'notify', onClick: id => doNotify(id, 'PICKED_UP'), style: { background: 'rgba(196,181,253,0.25)', color: '#C4B5FD' } },
            ]} />
        </div>
      )}

      <div className="section-header">
        <h3>Indicateurs du jour</h3>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Actualiser</button>
      </div>

      <div className="kpi-section">
        <p className="kpi-group-label">Activité du jour</p>
        <div className="kpi-grid kpi-grid-3">
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><TrendingUp size={20} /></div>
            <p className="kpi-value">{fmtCurrency(stats?.revenueToday ?? 0)}</p>
            <p className="kpi-label">Chiffre d'affaires</p>
          </div>
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><Package size={20} /></div>
            <p className="kpi-value">{stats?.ordersToday ?? 0}</p>
            <p className="kpi-label">Commandes du jour</p>
          </div>
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><ShoppingBag size={20} /></div>
            <p className="kpi-value">{stats?.pending ?? 0}</p>
            <p className="kpi-label">En attente</p>
          </div>
        </div>
      </div>

      <div className="kpi-section">
        <p className="kpi-group-label">Équipe & Réseau</p>
        <div className="kpi-grid kpi-grid-4">
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><Users size={20} /></div>
            <p className="kpi-value">{stats?.totalCustomers ?? 0}</p>
            <p className="kpi-label">Clients <span className="kpi-badge-new">+{stats?.newCustomersToday ?? 0} aujourd'hui</span></p>
          </div>
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><Store size={20} /></div>
            <p className="kpi-value">{stats?.totalBakeries ?? 0}</p>
            <p className="kpi-label">Boulangeries</p>
          </div>
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><Cookie size={20} /></div>
            <p className="kpi-value">{stats?.totalBakers ?? 0}</p>
            <p className="kpi-label">Boulangers</p>
          </div>
          <div className="glass-panel kpi-card">
            <div className="kpi-icon-wrap"><Truck size={20} /></div>
            <p className="kpi-value">
              {stats?.activeCouriers ?? 0}
              <span className="kpi-value-sub">/{stats?.totalCouriers ?? 0}</span>
            </p>
            <p className="kpi-label">Livreurs actifs</p>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="glass-panel table-container" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Top Produits</h3>
          <table className="admin-table">
            <thead><tr><th>Produit</th><th>Vendus</th></tr></thead>
            <tbody>
              {(stats?.topProducts || []).map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.quantity}</td></tr>)}
              {stats?.topProducts?.length === 0 && <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucune vente aujourd'hui.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="glass-panel table-container" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Commandes récentes</h3>
          {recentOrders.length === 0
            ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Aucune commande en attente.</p>
            : recentOrders.map(o => (
              <div key={o.id} className="recent-order-row">
                <span className="recent-code">{o.pickupCode}</span>
                <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 13 }}>{o.bakeryName}</span>
                <span style={{ fontWeight: 600 }}>{fmtCurrency(o.total)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ORDERS TAB
// ══════════════════════════════════════════════════════════════════
function OrdersTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bakeries, setBakeries] = useState<Bakery[]>([]);
  const [couriers, setCouriers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBakery, setFilterBakery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterBakery) params.set('bakeryId', filterBakery);
    if (filterDate) params.set('date', filterDate);
    if (search) params.set('search', search);
    try {
      const hdrs = authHeaders(token);
      const [oR, bR, cR] = await Promise.all([
        fetch(`${API_BASE}/admin/orders?${params}`, { headers: hdrs }),
        fetch(`${API_BASE}/order/bakeries`),
        fetch(`${API_BASE}/admin/staff?role=COURIER`, { headers: hdrs }),
      ]);
      if (oR.ok) { const d = await oR.json(); setOrders(d.orders ?? []); }
      if (bR.ok) { const d = await bR.json(); setBakeries(d.bakeries ?? []); }
      if (cR.ok) { const d = await cR.json(); setCouriers(d.staff ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterStatus, filterBakery, filterDate, search]);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const assignCourier = async () => {
    if (!assigningId || !selectedCourier) return;
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${assigningId}/assign-courier`, {
        method: 'PUT', headers: authHeaders(token),
        body: JSON.stringify({ courierId: selectedCourier }),
      });
      if (r.ok) { setAssigningId(null); setSelectedCourier(''); load(); }
      else { const d = await r.json(); alert(d.error); }
    } catch { alert('Erreur réseau.'); }
  };

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <Search size={16} />
          <input placeholder="Code ou nom..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="CONFIRMED">En préparation</option>
          <option value="READY">Prête</option>
          <option value="PICKED_UP">En livraison</option>
          <option value="DELIVERED">Livré</option>
        </select>
        <select value={filterBakery} onChange={e => setFilterBakery(e.target.value)}>
          <option value="">Toutes les boulangeries</option>
          {bakeries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th><th>Client</th><th>Boulangerie</th><th>Total</th>
                <th>Type</th><th>Statut</th><th>Livreur</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.pickupCode}</td>
                  <td>{o.customerName || '—'}</td>
                  <td style={{ fontSize: 13 }}>{o.bakeryName || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCurrency(o.total)}</td>
                  <td><span className="badge badge-type">{o.deliveryType.replace('_', ' ')}</span></td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td>{o.courierName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(o.createdAt)}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" title="Détails" onClick={() => setSelected(o)}><Eye size={15} /></button>
                      {o.deliveryType.includes('DELIVERY') && !o.courierId && (
                        <button className="btn-icon btn-icon-gold" title="Assigner livreur" onClick={() => { setAssigningId(o.id); setSelectedCourier(''); }}>
                          <Truck size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucune commande trouvée.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Commande #{selected.pickupCode}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="detail-grid">
              <div className="detail-row"><span>Client</span><span>{selected.customerName}</span></div>
              <div className="detail-row"><span>Téléphone</span><span>{selected.customerPhone}</span></div>
              <div className="detail-row"><span>Boulangerie</span><span>{selected.bakeryName || '—'}</span></div>
              <div className="detail-row"><span>Type</span><span>{selected.deliveryType.replace('_', ' ')}</span></div>
              <div className="detail-row"><span>Statut</span><span className={`badge ${statusColor(selected.status)}`}>{statusLabel(selected.status)}</span></div>
              <div className="detail-row"><span>Total</span><span style={{ fontWeight: 700 }}>{fmtCurrency(selected.total)}{selected.extraFee > 0 ? ` (+${selected.extraFee} F)` : ''}</span></div>
              {selected.address && <div className="detail-row"><span>Adresse</span><span>{selected.address}</span></div>}
              {selected.courierName && <div className="detail-row"><span>Livreur</span><span>{selected.courierName}</span></div>}
              <div className="detail-row"><span>Date</span><span>{fmtDate(selected.createdAt)}</span></div>
            </div>
            <h4 style={{ margin: '20px 0 8px', fontSize: 14, color: 'var(--text-muted)' }}>Articles</h4>
            <table className="admin-table" style={{ fontSize: 13 }}>
              <thead><tr><th>Produit</th><th>Qté</th><th>Prix</th></tr></thead>
              <tbody>
                {selected.items.map((it, i) => <tr key={i}><td>{it.name}</td><td>{it.quantity}</td><td>{fmtCurrency(it.price)}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign courier modal */}
      {assigningId && (
        <div className="modal-overlay" onClick={() => setAssigningId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Assigner un livreur</h3>
            <p>Sélectionnez le livreur pour cette commande.</p>
            <div className="form-group">
              <label>Livreur</label>
              <select value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                <option value="">— Choisir —</option>
                {couriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAssigningId(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={assignCourier} disabled={!selectedCourier}>Assigner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PRODUCTS TAB
// ══════════════════════════════════════════════════════════════════

const IMAGE_OPTIONS = [
  { key: 'croissant', emoji: '🥐', label: 'Croissant' },
  { key: 'baguette',  emoji: '🥖', label: 'Baguette' },
  { key: 'bread',     emoji: '🍞', label: 'Pain' },
  { key: 'eclair',    emoji: '⚡', label: 'Éclair' },
  { key: 'tarte',     emoji: '🥧', label: 'Tarte' },
  { key: 'palmier',   emoji: '🍪', label: 'Palmier' },
  { key: 'sandwich',  emoji: '🥪', label: 'Sandwich' },
];

const CATEGORY_OPTIONS = [
  { value: 'pain',        label: '🥖 Pain' },
  { value: 'viennoiserie',label: '🥐 Viennoiserie' },
  { value: 'patisserie',  label: '🍰 Pâtisserie' },
  { value: 'sale',        label: '🥪 Sandwich / Salé' },
];

function ImageUpload({ value, onChange, token }: { value: string; onChange: (url: string) => void; token: string }) {
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const savedPreviewUrl = value.startsWith('/uploads/') ? `${SERVER_BASE}${value}` : null;
  const legacyEmoji = IMAGE_OPTIONS.find(o => o.key === value)?.emoji;
  const previewUrl = localPreview ?? savedPreviewUrl;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Format non valide. Choisissez une image.'); return; }
    if (file.size > 50 * 1024 * 1024) { alert('Image trop lourde (max 50 Mo).'); return; }

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${SERVER_BASE}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erreur upload');
      const { url } = await res.json();
      onChange(url);
    } catch (err: any) {
      alert(err.message ?? "Erreur lors du chargement de l'image.");
      setLocalPreview(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          width: '100%', height: 180, borderRadius: 14,
          border: `2px dashed ${previewUrl ? 'var(--accent)' : 'var(--border)'}`,
          background: previewUrl ? '#000' : 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          overflow: 'hidden', position: 'relative', transition: 'border-color .2s',
          marginBottom: 10,
        }}
      >
        {uploading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Cliquer pour ajouter une vraie photo</p>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Ajouter une photo</p>
            <p style={{ fontSize: 12, marginTop: 2 }}>JPG, PNG, WEBP · Max 50 Mo</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}

function ProductsTab({ token }: { token: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch ALL products (platform + specialties) via the admin endpoint
      const r = await fetch(`${API_BASE}/admin/products`, { headers: authHeaders(token) });
      if (r.ok) { const d = await r.json(); setProducts(d.products ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null); setName(''); setPrice(''); setDescription('');
    setImage(''); setCategory('');
    setShowModal(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p); setName(p.name); setPrice(String(p.price));
    setDescription(p.description || ''); setImage(p.image || '');
    setCategory(p.category || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = JSON.stringify({
      name, price: parseFloat(price),
      description: description || null,
      image: image || null,
      category: category || null,
    });
    try {
      const url = editing ? `${API_BASE}/admin/products/${editing.id}` : `${API_BASE}/admin/products`;
      const method = editing ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: authHeaders(token), body });
      if (r.ok) { setShowModal(false); load(); }
      else { const d = await r.json(); alert(d.error); }
    } catch { alert('Erreur réseau.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p: Product) => {
    const label = p.bakeryId ? `la spécialité "${p.name}" (${p.bakeryName})` : `le produit plateforme "${p.name}"`;
    if (!confirm(`Supprimer ${label} ?`)) return;
    try {
      const r = await fetch(`${API_BASE}/admin/products/${p.id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (r.ok) load();
      else { const d = await r.json(); alert(d.error); }
    } catch { alert('Erreur réseau.'); }
  };

  const platform   = products.filter(p => !p.bakeryId);
  const specialties = products.filter(p =>  p.bakeryId);

  return (
    <div>
      <div className="section-header">
        <div>
          <h3 style={{ margin: 0 }}>{platform.length} produit(s) plateforme · {specialties.length} spécialité(s)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Les produits plateforme sont visibles par tous les clients. Les spécialités sont créées et gérées par chaque boulanger.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Nouveau produit plateforme</button>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Illustration</th>
                <th>Nom</th>
                <th>Type</th>
                <th>Catégorie</th>
                <th>Prix (FCFA)</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const imgOpt = IMAGE_OPTIONS.find(o => o.key === p.image);
                const isSpecialty = !!p.bakeryId;
                return (
                  <tr key={p.id}>
                    <td style={{ textAlign: 'center' }}>
                      {p.image?.startsWith('/uploads/') ? (
                        <img src={`${SERVER_BASE}${p.image}`} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, display: 'block', margin: '0 auto' }} alt={p.name} />
                      ) : (
                        <span style={{ fontSize: 28 }}>{imgOpt?.emoji ?? '❓'}</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>
                      {isSpecialty ? (
                        <span style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                          🏪 {p.bakeryName}
                        </span>
                      ) : (
                        <span style={{ background: '#DBEAFE', color: '#1D4ED8', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                          🌐 Plateforme
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {CATEGORY_OPTIONS.find(c => c.value === p.category)?.label ?? (p.category || '—')}
                    </td>
                    <td>{fmtCurrency(p.price)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.description || '—'}
                    </td>
                    <td>
                      <div className="action-btns">
                        {!isSpecialty && (
                          <button className="btn-icon" title="Modifier" onClick={() => openEdit(p)}><Pencil size={15} /></button>
                        )}
                        <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(p)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', padding: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>{editing ? '✏️ Modifier le produit' : '🌐 Nouveau produit plateforme'}</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  {editing ? 'Mise à jour visible par tous les clients' : 'Visible par tous les clients de la plateforme'}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
            {/* Scrollable body */}
            <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '24px 28px', flex: 1 }}>
              {/* Photo first */}
              <div className="form-group">
                <label>Photo du produit</label>
                <ImageUpload value={image} onChange={setImage} token={token} />
              </div>
              {/* Name + Price side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Nom *</label>
                  <input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Croissant au beurre" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Prix (FCFA) *</label>
                  <input required type="number" min="0" value={price} onChange={e => setPrice(e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label>Catégorie</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">— Sans catégorie —</option>
                  {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description courte…" />
              </div>
              <div className="modal-actions" style={{ paddingBottom: 0 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Enregistrement...' : editing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// BAKERIES TAB
// ══════════════════════════════════════════════════════════════════
function BakeriesTab({ token }: { token: string }) {
  const [bakeries, setBakeries] = useState<Bakery[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('0.0000');
  const [lng, setLng] = useState('0.0000');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const r = await fetch(`${API_BASE}/order/bakeries`);
      const d = await r.json();
      setBakeries(d.bakeries || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/bakeries`, {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ name, address, latitude: parseFloat(lat), longitude: parseFloat(lng) }),
      });
      if (r.ok) { setShowModal(false); load(); setName(''); setAddress(''); }
      else alert('Erreur lors de la création.');
    } catch { alert('Erreur réseau.'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="section-header">
        <h3>{bakeries.length} noeud(s) logistique(s)</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Nouveau noeud</button>
      </div>

      <div className="glass-panel table-container">
        <table className="admin-table">
          <thead><tr><th>Nom</th><th>Adresse</th><th>GPS</th><th>Statut</th></tr></thead>
          <tbody>
            {bakeries.map(b => (
              <tr key={b.id}>
                <td style={{ fontWeight: 600 }}>{b.name}</td>
                <td>{b.address || '—'}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 12 }}>
                  {b.latitude?.toFixed(4)}, {b.longitude?.toFixed(4)}
                </td>
                <td><span className="badge badge-active">ACTIF</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Déployer un noeud</h3>
            <p>Enregistrer un nouveau point logistique pour les livraisons.</p>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Nom *</label><input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Limpa - Owendo" /></div>
              <div className="form-group"><label>Adresse</label><input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse physique" /></div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div className="form-group" style={{ flex: 1 }}><label>Latitude *</label><input required value={lat} onChange={e => setLat(e.target.value)} type="number" step="0.0001" /></div>
                <div className="form-group" style={{ flex: 1 }}><label>Longitude *</label><input required value={lng} onChange={e => setLng(e.target.value)} type="number" step="0.0001" /></div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Déploiement...' : 'Déployer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// STAFF TAB
// ══════════════════════════════════════════════════════════════════
function StaffTab({ token }: { token: string }) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [bakeries, setBakeries] = useState<Bakery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [regType, setRegType] = useState<'BAKER' | 'COURIER'>('BAKER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterRole ? `?role=${filterRole}` : '';
    try {
      const hdrs = authHeaders(token);
      const [sR, bR] = await Promise.all([
        fetch(`${API_BASE}/admin/staff${params}`, { headers: hdrs }),
        fetch(`${API_BASE}/order/bakeries`),
      ]);
      if (sR.ok) { const d = await sR.json(); setStaff(d.staff ?? []); }
      if (bR.ok) { const d = await bR.json(); setBakeries(d.bakeries ?? []); if (d.bakeries?.length > 0 && !nodeId) setNodeId(d.bakeries[0].id); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterRole]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (s: Staff) => {
    try {
      const r = await fetch(`${API_BASE}/admin/staff/${s.id}/toggle`, { method: 'PUT', headers: authHeaders(token) });
      if (r.ok) load();
    } catch {}
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg({ text: '', type: '' });
    const url = regType === 'BAKER' ? `${API_BASE}/admin/register-baker` : `${API_BASE}/admin/register-courier`;
    const body: any = { name, phone, pin };
    if (regType === 'BAKER') body.bakeryId = nodeId;
    try {
      const r = await fetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        setMsg({ text: `${regType === 'BAKER' ? 'Boulanger' : 'Livreur'} créé (ID: ${d.userId})`, type: 'success' });
        setName(''); setPhone(''); setPin('');
        load();
      } else setMsg({ text: d.error || 'Erreur', type: 'error' });
    } catch { setMsg({ text: 'Erreur réseau.', type: 'error' }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="filter-bar">
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="BAKER">Boulangers</option>
          <option value="COURIER">Livreurs</option>
          <option value="ADMIN">Admins</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setMsg({ text: '', type: '' }); }}>
          <UserPlus size={16} /> Nouveau personnel
        </button>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead><tr><th>Nom</th><th>Téléphone</th><th>Rôle</th><th>Boulangerie</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.name || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{s.phoneNumber}</td>
                  <td><span className={`badge badge-role-${s.role.toLowerCase()}`}>{roleLabel(s.role)}</span></td>
                  <td style={{ fontSize: 13 }}>{s.bakeryName || '—'}</td>
                  <td>
                    <span className={`badge ${s.active ? 'badge-active' : 'badge-inactive'}`}>
                      {s.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(s.createdAt)}</td>
                  <td>
                    <button className="btn-icon" title={s.active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(s)}>
                      {s.active ? <ToggleRight size={18} color="var(--success)" /> : <ToggleLeft size={18} color="var(--text-muted)" />}
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucun personnel trouvé.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Enregistrer du personnel</h3>

            <div className="toggle-row" style={{ marginBottom: 20 }}>
              <button className={`toggle-btn ${regType === 'BAKER' ? 'active' : ''}`} onClick={() => setRegType('BAKER')}>Boulanger</button>
              <button className={`toggle-btn ${regType === 'COURIER' ? 'active' : ''}`} onClick={() => setRegType('COURIER')}>Livreur</button>
            </div>

            {msg.text && (
              <div className={`msg-box ${msg.type}`}>{msg.text}</div>
            )}

            <form onSubmit={handleRegister}>
              {regType === 'BAKER' && (
                <div className="form-group">
                  <label>Noeud logistique *</label>
                  <select required value={nodeId} onChange={e => setNodeId(e.target.value)}>
                    {bakeries.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group"><label>Nom</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Jean Dupont" /></div>
              <div className="form-group"><label>Téléphone *</label><input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ex: 077654321" /></div>
              <div className="form-group"><label>Code PIN (4-6 chiffres) *</label><input required type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Création...' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// DELIVERIES TAB
// ══════════════════════════════════════════════════════════════════
type CourierLocation = { id: string; name: string; courierLat: number; courierLng: number; courierLocationAt: string };

function buildDeliveryMapHtml(deliveries: Order[], courierLocations: CourierLocation[]) {
  const esc = (s: string) => s?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') ?? '';
  const deliveryMarkers = deliveries.filter(o => o.latitude && o.longitude && o.status === 'CONFIRMED').map(o =>
    `L.marker([${o.latitude},${o.longitude}],{icon:redIcon}).addTo(map).bindPopup('<b>${esc(o.pickupCode)}</b><br/>${esc(o.customerName||'')}<br/>${esc(o.address||'')}');`
  ).join('\n');
  const courierMarkers = courierLocations.map(c =>
    `L.marker([${c.courierLat},${c.courierLng}],{icon:blueIcon}).addTo(map).bindPopup('<b>&#x1F6B4; ${esc(c.name)}</b>');`
  ).join('\n');
  const center = courierLocations[0] ? `[${courierLocations[0].courierLat},${courierLocations[0].courierLng}]`
    : deliveries[0]?.latitude ? `[${deliveries[0].latitude},${deliveries[0].longitude}]` : '[0.4162,9.4673]';

  return `<!DOCTYPE html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>*{margin:0;padding:0;box-sizing:border-box}html,body,#map{width:100%;height:100%}</style>
</head><body><div id="map"></div><script>
  var map=L.map('map',{attributionControl:false}).setView(${center},12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var redIcon=L.divIcon({html:'<div style="background:#EF4444;width:32px;height:32px;border-radius:50%;border:3px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.3)">&#x1F4E6;</div>',iconSize:[32,32],iconAnchor:[16,16],className:''});
  var blueIcon=L.divIcon({html:'<div style="background:#3B82F6;width:34px;height:34px;border-radius:50%;border:3px solid #FFF;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.3)">&#x1F6B4;</div>',iconSize:[34,34],iconAnchor:[17,17],className:''});
  ${deliveryMarkers}
  ${courierMarkers}
</script></body></html>`;
}

function DeliveriesTab({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<DeliveryAlert[]>([]);
  const [couriers, setCouriers] = useState<Staff[]>([]);
  const [courierLocations, setCourierLocations] = useState<CourierLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCourier, setSelectedCourier] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hdrs = authHeaders(token);
      const [oR, aR, cR, lR] = await Promise.all([
        fetch(`${API_BASE}/admin/orders?`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/delivery-alerts`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/staff?role=COURIER`, { headers: hdrs }),
        fetch(`${API_BASE}/admin/courier-locations`, { headers: hdrs }),
      ]);
      if (oR.ok) {
        const d = await oR.json();
        const deliveries = (d.orders ?? []).filter((o: Order) => o.deliveryType.includes('DELIVERY'));
        setOrders(deliveries);
      }
      if (aR.ok) { const d = await aR.json(); setAlerts(d.alerts ?? []); }
      if (cR.ok) { const d = await cR.json(); setCouriers(d.staff ?? []); }
      if (lR.ok) { const d = await lR.json(); setCourierLocations(d.couriers ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const assignCourier = async () => {
    if (!assigningId || !selectedCourier) return;
    try {
      const r = await fetch(`${API_BASE}/admin/orders/${assigningId}/assign-courier`, {
        method: 'PUT', headers: authHeaders(token),
        body: JSON.stringify({ courierId: selectedCourier }),
      });
      if (r.ok) { setAssigningId(null); setSelectedCourier(''); load(); }
      else { const d = await r.json(); alert(d.error); }
    } catch { alert('Erreur réseau.'); }
  };

  const unassigned = orders.filter(o => !o.courierId && o.status === 'CONFIRMED');
  const accepted = orders.filter(o => o.courierId && o.status === 'CONFIRMED');
  const completed = orders.filter(o => o.status === 'DELIVERED');

  return (
    <div>
      {alerts.length > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={18} />
          <span>{alerts.length} livraison(s) en attente de livreur depuis 5+ min</span>
        </div>
      )}

      <div className="section-header">
        <h3>Suivi des livraisons</h3>
        <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Actualiser</button>
      </div>

      {/* Live map */}
      <div className="glass-panel" style={{ marginBottom: 24, overflow: 'hidden', borderRadius: 12 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
          <MapPin size={16} />
          <span style={{ fontWeight: 600 }}>Carte en direct</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {courierLocations.length} livreur(s) actif(s) · {orders.filter(o => o.status === 'CONFIRMED').length} livraison(s)
          </span>
        </div>
        <iframe
          srcDoc={buildDeliveryMapHtml(orders, courierLocations)}
          style={{ width: '100%', height: 380, border: 'none' }}
          title="Carte livraisons"
        />
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrap" style={{ color: 'var(--danger)' }}><AlertTriangle size={20} /></div>
          <p className="kpi-value">{unassigned.length}</p>
          <p className="kpi-label">Sans livreur</p>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrap" style={{ color: '#3B82F6' }}><Truck size={20} /></div>
          <p className="kpi-value">{accepted.length}</p>
          <p className="kpi-label">En cours</p>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrap" style={{ color: 'var(--success)' }}><CheckCircle2 size={20} /></div>
          <p className="kpi-value">{completed.length}</p>
          <p className="kpi-label">Livrées</p>
        </div>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead><tr><th>Code</th><th>Client</th><th>Adresse</th><th>Boulangerie</th><th>Total</th><th>Livreur</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className={!o.courierId && o.status === 'CONFIRMED' ? 'row-alert' : ''}>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.pickupCode}</td>
                  <td>{o.customerName || '—'}</td>
                  <td style={{ fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.address || '—'}</td>
                  <td style={{ fontSize: 13 }}>{o.bakeryName || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCurrency(o.total)}</td>
                  <td>{o.courierName || <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 12 }}>NON ASSIGNÉ</span>}</td>
                  <td><span className={`badge ${statusColor(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td>
                    {!o.courierId && o.status === 'CONFIRMED' && (
                      <button className="btn btn-primary btn-sm" onClick={() => { setAssigningId(o.id); setSelectedCourier(''); }}>
                        <Truck size={14} /> Assigner
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucune livraison.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {assigningId && (
        <div className="modal-overlay" onClick={() => setAssigningId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Assigner un livreur</h3>
            <div className="form-group">
              <label>Livreur</label>
              <select value={selectedCourier} onChange={e => setSelectedCourier(e.target.value)}>
                <option value="">— Choisir —</option>
                {couriers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name} ({c.phoneNumber})</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setAssigningId(null)}>Annuler</button>
              <button className="btn btn-primary" onClick={assignCourier} disabled={!selectedCourier}>Assigner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// COUPONS TAB
// ══════════════════════════════════════════════════════════════════
function CouponsTab({ token }: { token: string }) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/admin/coupons`, { headers: authHeaders(token) });
      if (r.ok) { const d = await r.json(); setCoupons(d.coupons ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setCode(''); setDiscountType('PERCENTAGE'); setDiscountValue(''); setMaxUses(''); setError(''); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const r = await fetch(`${API_BASE}/admin/coupons`, {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ code, discountType, discountValue: parseFloat(discountValue), maxUses: maxUses ? parseInt(maxUses) : null }),
      });
      const d = await r.json();
      if (r.ok) { setShowModal(false); load(); }
      else setError(d.error || 'Erreur.');
    } catch { setError('Erreur réseau.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      const r = await fetch(`${API_BASE}/admin/coupons/${c.id}/toggle`, { method: 'PUT', headers: authHeaders(token) });
      if (r.ok) load();
    } catch {}
  };

  const handleDelete = async (c: Coupon) => {
    if (!confirm(`Supprimer le coupon "${c.code}" ?`)) return;
    try {
      const r = await fetch(`${API_BASE}/admin/coupons/${c.id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (r.ok) load();
      else { const d = await r.json(); alert(d.error); }
    } catch { alert('Erreur réseau.'); }
  };

  const activeCoupons = coupons.filter(c => c.active);

  return (
    <div>
      <div className="section-header">
        <h3>{coupons.length} code(s) promo · <span style={{ color: 'var(--success)' }}>{activeCoupons.length} actif(s)</span></h3>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Créer un coupon</button>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead>
              <tr><th>Code</th><th>Type</th><th>Réduction</th><th>Utilisations</th><th>Max</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}>{c.code}</td>
                  <td><span className={`badge ${c.discountType === 'PERCENTAGE' ? 'badge-confirmed' : 'badge-type'}`}>{c.discountType === 'PERCENTAGE' ? '%' : 'FIXE'}</span></td>
                  <td style={{ fontWeight: 600 }}>
                    {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : fmtCurrency(c.discountValue)}
                  </td>
                  <td style={{ textAlign: 'center' }}>{c.usedCount}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{c.maxUses ?? '∞'}</td>
                  <td>
                    <span className={`badge ${c.active ? 'badge-active' : 'badge-inactive'}`}>
                      {c.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(c.createdAt)}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-icon" title={c.active ? 'Désactiver' : 'Activer'} onClick={() => toggleActive(c)}>
                        {c.active ? <ToggleRight size={18} color="var(--success)" /> : <ToggleLeft size={18} color="var(--text-muted)" />}
                      </button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(c)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucun coupon créé.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>Nouveau code promo</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            {error && <div className="msg-box error" style={{ marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Code *</label>
                <input required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: BIENVENUE20" style={{ fontFamily: 'monospace', letterSpacing: 1 }} />
              </div>
              <div className="form-group">
                <label>Type de réduction *</label>
                <select value={discountType} onChange={e => setDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED')}>
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                  <option value="FIXED">Montant fixe (FCFA)</option>
                </select>
              </div>
              <div className="form-group">
                <label>{discountType === 'PERCENTAGE' ? 'Pourcentage (ex: 15 pour 15%) *' : 'Montant (FCFA) *'}</label>
                <input required type="number" min="0" max={discountType === 'PERCENTAGE' ? '100' : undefined} step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'PERCENTAGE' ? 'Ex: 15' : 'Ex: 500'} />
              </div>
              <div className="form-group">
                <label>Nombre max d'utilisations (laisser vide = illimité)</label>
                <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Ex: 100" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Création...' : 'Créer le coupon'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CUSTOMERS TAB
// ══════════════════════════════════════════════════════════════════
function CustomersTab({ token }: { token: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    try {
      const r = await fetch(`${API_BASE}/admin/customers?${params}`, { headers: authHeaders(token) });
      if (r.ok) { const d = await r.json(); setCustomers(d.customers ?? []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="section-header">
        <h3>{customers.length} client(s) enregistré(s)</h3>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group">
            <Search size={16} />
            <input placeholder="Nom ou téléphone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={32} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Solde Wallet</th>
                <th>Points</th>
                <th>Commandes</th>
                <th>Total dépensé</th>
                <th>Inscrit le</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.phoneNumber}</td>
                  <td style={{ fontWeight: 600, color: c.walletBalance > 0 ? 'var(--success)' : 'inherit' }}>
                    {fmtCurrency(c.walletBalance)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ background: '#FEF3C7', color: '#D97706', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                      ⭐ {c.walletPoints}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.orderCount}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCurrency(c.totalSpent)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(c.createdAt)}</td>
                  <td>
                    <button className="btn-icon" title="Détails" onClick={() => setSelected(c)}><Eye size={15} /></button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>Aucun client trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top">
              <h3>👤 {selected.name}</h3>
              <button className="btn-icon" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>
            <div className="detail-grid">
              <div className="detail-row"><span>Téléphone</span><span style={{ fontFamily: 'monospace' }}>{selected.phoneNumber}</span></div>
              <div className="detail-row"><span>Solde Wallet</span><span style={{ fontWeight: 700, color: 'var(--success)' }}>{fmtCurrency(selected.walletBalance)}</span></div>
              <div className="detail-row"><span>Points fidélité</span><span>⭐ {selected.walletPoints} pts</span></div>
              <div className="detail-row"><span>Commandes passées</span><span style={{ fontWeight: 700 }}>{selected.orderCount}</span></div>
              <div className="detail-row"><span>Total dépensé</span><span style={{ fontWeight: 700 }}>{fmtCurrency(selected.totalSpent)}</span></div>
              <div className="detail-row"><span>Inscrit le</span><span>{fmtDate(selected.createdAt)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ══════════════════════════════════════════════════════════════════
function SettingsTab({ token }: { token: string }) {
  const [form, setForm] = useState<PlatformSettings>({ feePerKm: 300, roundingUnit: 25, minFee: 0, alertPendingMinutes: 15, alertConfirmedMinutes: 45, alertPickedUpMinutes: 90, pointsEarnRate: 1, pointsRedeemRate: 10 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/admin/settings`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { if (d.settings) setForm(d.settings); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof PlatformSettings, v: string) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const r = await fetch(`${API_BASE}/admin/settings`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(form) });
      if (!r.ok) { setError('Erreur lors de la sauvegarde.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError('Connexion impossible.'); }
    finally { setSaving(false); }
  };

  // Live preview for fee calculation
  const previewKm = 5;
  const rawFee = Math.max(0, previewKm - 0.2) * form.feePerKm; // 0.2 km ≈ nearest bakery
  const unit = form.roundingUnit <= 1 ? 1 : form.roundingUnit;
  const roundedFee = rawFee === 0 ? 0 : Math.max(form.minFee, Math.round(rawFee / unit) * unit);

  if (loading) return <div className="loading-center"><RefreshCw className="spin" size={32} /></div>;

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Fee settings */}
      <div className="glass-panel" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>💰 Tarification des livraisons</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          La surcharge est calculée sur la distance supplémentaire au-delà de la boulangerie la plus proche.
          Au Gabon, la plus petite pièce est de 25 FCFA — tous les montants sont arrondis à l'unité configurée.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div className="form-group">
            <label>Frais par km (FCFA)</label>
            <input type="number" min="0" step="25" value={form.feePerKm} onChange={e => set('feePerKm', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>Montant facturé par km supplémentaire</span>
          </div>
          <div className="form-group">
            <label>Unité d'arrondi (FCFA)</label>
            <input type="number" min="1" step="25" value={form.roundingUnit} onChange={e => set('roundingUnit', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>25 = arrondi à la pièce la plus proche (Gabon)</span>
          </div>
          <div className="form-group">
            <label>Frais minimum (FCFA)</label>
            <input type="number" min="0" step="25" value={form.minFee} onChange={e => set('minFee', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>0 = aucun minimum imposé</span>
          </div>
        </div>

        {/* Live preview */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>Exemple de calcul — boulangerie à {previewKm} km</p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}>Distance supplémentaire : <strong>{(previewKm - 0.2).toFixed(1)} km</strong></span>
            <span style={{ fontSize: 14 }}>Avant arrondi : <strong>{rawFee.toLocaleString('fr-FR')} F</strong></span>
            <span style={{ fontSize: 14, color: 'var(--success)' }}>→ Facturé : <strong>{roundedFee.toLocaleString('fr-FR')} F</strong></span>
          </div>
        </div>
      </div>

      {/* Alert thresholds */}
      <div className="glass-panel" style={{ padding: 28, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>🔔 Seuils d'alerte (minutes)</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
          Une alerte rouge s'affiche dans "Vue d'ensemble" lorsqu'une commande dépasse ces délais sans progresser.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> PENDING non accepté</label>
            <input type="number" min="1" step="1" value={form.alertPendingMinutes} onChange={e => set('alertPendingMinutes', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>min avant alerte "boulanger n'accepte pas"</span>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CircleDot size={14} /> CONFIRMED non préparé</label>
            <input type="number" min="1" step="1" value={form.alertConfirmedMinutes} onChange={e => set('alertConfirmedMinutes', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>min avant alerte "commande pas prête"</span>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CheckCheck size={14} /> PICKED_UP non livré</label>
            <input type="number" min="1" step="1" value={form.alertPickedUpMinutes} onChange={e => set('alertPickedUpMinutes', e.target.value)} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>min avant alerte "livreur ne livre pas"</span>
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}
      {saved && <p style={{ color: 'var(--success)', marginBottom: 12 }}>✓ Paramètres sauvegardés. Actifs immédiatement pour les nouvelles commandes.</p>}

      <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 180 }}>
        {saving ? <><RefreshCw size={14} className="spin" /> Sauvegarde...</> : <><CheckCircle2 size={14} /> Sauvegarder les paramètres</>}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// POINTS TAB
// ══════════════════════════════════════════════════════════════════
interface PointsUser { id: string; name: string; phoneNumber: string; points: number; balance: number }

function PointsTab({ token }: { token: string }) {
  const [users, setUsers] = useState<PointsUser[]>([]);
  const [earnRate, setEarnRate] = useState(1);
  const [redeemRate, setRedeemRate] = useState(10);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [deltaInput, setDeltaInput] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [editRates, setEditRates] = useState(false);
  const [rateForm, setRateForm] = useState({ earn: 1, redeem: 10 });

  const load = useCallback(async (q = search) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const r = await fetch(`${API_BASE}/admin/points${params}`, { headers: authHeaders(token) });
      if (r.ok) {
        const d = await r.json();
        setUsers(d.users ?? []);
        setEarnRate(d.earnRate ?? 1);
        setRedeemRate(d.redeemRate ?? 10);
        setRateForm({ earn: d.earnRate ?? 1, redeem: d.redeemRate ?? 10 });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, []);

  const handleAdjust = async (userId: string) => {
    const delta = parseInt(deltaInput);
    if (isNaN(delta) || delta === 0) { alert('Entrez un nombre non nul (positif pour créditer, négatif pour débiter).'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/admin/points/${userId}/adjust`, {
        method: 'POST', headers: authHeaders(token),
        body: JSON.stringify({ delta, reason }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? 'Erreur.'); return; }
      alert(`Points mis à jour : ${d.points} pts`);
      setAdjusting(null); setDeltaInput(''); setReason('');
      load();
    } catch { alert('Erreur réseau.'); }
    finally { setSaving(false); }
  };

  const handleSaveRates = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT', headers: authHeaders(token),
        body: JSON.stringify({ pointsEarnRate: rateForm.earn, pointsRedeemRate: rateForm.redeem }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error ?? 'Erreur.'); return; }
      setEarnRate(d.settings.pointsEarnRate);
      setRedeemRate(d.settings.pointsRedeemRate);
      setEditRates(false);
      alert('Taux mis à jour !');
    } catch { alert('Erreur réseau.'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {/* Rates summary */}
      <div className="glass-panel" style={{ padding: 20, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Taux d'acquisition</p>
            {editRates
              ? <input type="number" min={1} value={rateForm.earn} onChange={e => setRateForm(f => ({ ...f, earn: parseInt(e.target.value) || 1 }))}
                  style={{ width: 80, fontWeight: 700, fontSize: 18, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }} />
              : <p style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>{earnRate} pt / 100 F</p>}
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Taux de rachat</p>
            {editRates
              ? <input type="number" min={1} value={rateForm.redeem} onChange={e => setRateForm(f => ({ ...f, redeem: parseInt(e.target.value) || 1 }))}
                  style={{ width: 80, fontWeight: 700, fontSize: 18, border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px' }} />
              : <p style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>1 pt = {redeemRate} F</p>}
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>Valeur effective</p>
            <p style={{ fontWeight: 700, fontSize: 20, margin: 0, color: 'var(--text-muted)' }}>100 F → {earnRate} pt → {earnRate * redeemRate} F</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editRates
            ? <><button className="btn btn-primary btn-sm" onClick={handleSaveRates} disabled={saving}>{saving ? '...' : 'Enregistrer'}</button>
               <button className="btn btn-secondary btn-sm" onClick={() => setEditRates(false)}>Annuler</button></>
            : <button className="btn btn-secondary btn-sm" onClick={() => setEditRates(true)}><Pencil size={14} /> Modifier les taux</button>}
        </div>
      </div>

      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div className="filter-group">
            <Search size={16} />
            <input placeholder="Chercher un client..." value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load(search)} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => load(search)}><RefreshCw size={14} /></button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>{users.length} client(s)</p>
      </div>

      {loading ? <div className="loading-center"><RefreshCw className="spin" size={28} /></div> : (
        <div className="glass-panel table-container">
          <table className="admin-table">
            <thead><tr><th>Client</th><th>Téléphone</th><th>Points</th><th>Solde</th><th>Action</th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun client.</td></tr>}
              {users.map(u => (
                <React.Fragment key={u.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.phoneNumber}</td>
                    <td><span style={{ background: '#FDF4FF', color: '#7C3AED', borderRadius: 8, padding: '3px 10px', fontWeight: 700, fontSize: 13 }}>⭐ {u.points}</span></td>
                    <td>{fmtCurrency(u.balance)}</td>
                    <td>
                      <button className="btn-icon btn-icon-gold" title="Ajuster les points"
                        onClick={() => { setAdjusting(adjusting === u.id ? null : u.id); setDeltaInput(''); setReason(''); }}>
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                  {adjusting === u.id && (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 4px', flexWrap: 'wrap' }}>
                          <input type="number" placeholder="+100 ou -50" value={deltaInput} onChange={e => setDeltaInput(e.target.value)}
                            style={{ width: 120, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontWeight: 700 }} />
                          <input placeholder="Raison (ex: bonus événement)" value={reason} onChange={e => setReason(e.target.value)}
                            style={{ flex: 1, minWidth: 180, border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }} />
                          <button className="btn btn-primary btn-sm" onClick={() => handleAdjust(u.id)} disabled={saving}>Confirmer</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setAdjusting(null)}>Annuler</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// MAIN APP
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!auth) return <AdminLogin onAuth={setAuth} />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Vue d\'ensemble', icon: <LayoutDashboard size={18} /> },
    { key: 'orders', label: 'Commandes', icon: <ShoppingBag size={18} /> },
    { key: 'products', label: 'Produits', icon: <Cookie size={18} /> },
    { key: 'bakeries', label: 'Boulangeries', icon: <Store size={18} /> },
    { key: 'customers', label: 'Clients', icon: <UserPlus size={18} /> },
    { key: 'staff', label: 'Personnel', icon: <Users size={18} /> },
    { key: 'deliveries', label: 'Livraisons', icon: <Truck size={18} /> },
    { key: 'coupons', label: 'Codes Promo', icon: <Tag size={18} /> },
    { key: 'settings', label: 'Tarification', icon: <Settings size={18} /> },
    { key: 'points',   label: 'Points Fidélité', icon: <span style={{ fontSize: 16 }}>⭐</span> },
  ];

  const tabTitles: Record<Tab, string> = {
    overview: 'Vue d\'ensemble',
    orders: 'Gestion des Commandes',
    products: 'Catalogue Produits',
    bakeries: 'Noeuds Logistiques',
    customers: 'Gestion des Clients',
    staff: 'Gestion du Personnel',
    deliveries: 'Suivi des Livraisons',
    coupons: 'Codes Promo',
    settings: 'Tarification & Alertes',
    points:   'Gestion des Points Fidélité',
  };

  const handleNavClick = (key: Tab) => {
    setActiveTab(key);
    setSidebarOpen(false);
  };

  return (
    <div className={`app-container${sidebarOpen ? ' sidebar-open' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <nav className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Layers size={24} strokeWidth={2} /></div>
          <h1>LIMPA</h1>
        </div>

        <div className="nav-links">
          {tabs.map(t => (
            <button key={t.key} className={`nav-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => handleNavClick(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <p className="sidebar-user">{auth.name}</p>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setAuth(null)}>
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </nav>

      <main className="main-content">
        <header className="topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <h2>{tabTitles[activeTab]}</h2>
        </header>
        <div className="content-wrapper">
          {activeTab === 'overview' && <OverviewTab token={auth.token} />}
          {activeTab === 'orders' && <OrdersTab token={auth.token} />}
          {activeTab === 'products' && <ProductsTab token={auth.token} />}
          {activeTab === 'bakeries' && <BakeriesTab token={auth.token} />}
          {activeTab === 'customers' && <CustomersTab token={auth.token} />}
          {activeTab === 'staff' && <StaffTab token={auth.token} />}
          {activeTab === 'deliveries' && <DeliveriesTab token={auth.token} />}
          {activeTab === 'coupons' && <CouponsTab token={auth.token} />}
          {activeTab === 'settings' && <SettingsTab token={auth.token} />}
          {activeTab === 'points'   && <PointsTab token={auth.token} />}
        </div>
      </main>
    </div>
  );
}
