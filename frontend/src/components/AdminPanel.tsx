import React, { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { 
  Users, 
  Shield, 
  Database, 
  RefreshCw, 
  Trash2, 
  UserCheck, 
  AlertTriangle, 
  Send, 
  MessageCircle, 
  Sparkles, 
  CheckCircle2, 
  Bell,
  Eye,
  Globe,
  Activity,
  ExternalLink
} from 'lucide-react';

interface AdminUser {
  id: number;
  phone_number: string;
  email?: string;
  display_name?: string;
  role: string;
  subscription_tier: string;
  plan_name: string;
  is_pro: boolean;
  is_trial: boolean;
  days_left: number;
  status: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
  is_auto_scanning: boolean;
  created_at: string;
  dhan_client_id?: string;
  has_dhan_token: boolean;
}

interface SystemStats {
  total_users: number;
  total_visitors?: number;
  today_visitors?: number;
  total_pageviews?: number;
  total_portfolios: number;
  active_alert_rules: number;
  rsi_scanner_logs: number;
  broadcast_messages_sent?: number;
}

export const AdminPanel: React.FC = () => {
  const { token, user } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'trial' | 'pro' | 'expired'>('all');

  // Newsletter Broadcast State
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'trial' | 'pro' | 'expired'>('all');
  const [channels, setChannels] = useState<string[]>(['telegram', 'whatsapp']);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [whatsappLinks, setWhatsappLinks] = useState<{ phone: string; link: string; user_id: number }[]>([]);

  // Reminders Dispatch state
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderData, setReminderData] = useState<{ count: number; reminders?: any[] } | null>(null);

  const fetchAdminData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${BACKEND_URL}/api/admin/system-stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (usersRes.ok && statsRes.ok) {
        const usersData = await usersRes.json();
        const statsData = await statsRes.json();
        setUsers(usersData);
        setStats(statsData);
      } else {
        setError("Failed to fetch admin statistics. Make sure you are logged in as Owner.");
      }
    } catch (err: any) {
      setError(err.message || "Error connecting to admin API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [token]);

  const handleSubscriptionChange = async (userId: number, planType: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ plan_type: planType })
      });
      const d = await res.json();
      if (res.ok) {
        setActionMessage(d.message || "Subscription updated!");
        fetchAdminData();
      } else {
        alert(d.detail || "Failed to update subscription");
      }
    } catch (e: any) {
      alert(e.message || "Error updating subscription");
    }
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/role?role=${newRole}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMessage(`User ID #${userId} role changed to ${newRole.toUpperCase()}`);
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.detail || "Failed to update role");
      }
    } catch (e: any) {
      alert(e.message || "Error updating role");
    }
  };

  const handleDeleteUser = async (userId: number, identifier: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete user ${identifier}? This action cannot be undone.`)) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMessage(`User ${identifier} deleted successfully.`);
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.detail || "Failed to delete user");
      }
    } catch (e: any) {
      alert(e.message || "Error deleting user");
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastSubject || !broadcastMessage) {
      alert("Please enter a subject and message for the broadcast.");
      return;
    }
    if (channels.length === 0) {
      alert("Please select at least one broadcast channel (Telegram, WhatsApp, or Email).");
      return;
    }

    setIsBroadcasting(true);
    setBroadcastSuccess(null);
    setWhatsappLinks([]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/broadcast/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: broadcastSubject,
          message: broadcastMessage,
          channels,
          target_audience: targetAudience
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBroadcastSuccess(data.message);
        if (data.whatsapp_links) setWhatsappLinks(data.whatsapp_links);
        setBroadcastSubject('');
        setBroadcastMessage('');
        fetchAdminData();
      } else {
        alert(data.detail || "Failed to send broadcast.");
      }
    } catch (err: any) {
      alert(err.message || "Broadcast error.");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleSendReminders = async () => {
    setIsSendingReminders(true);
    setReminderData(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/broadcast/trial-reminders`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setReminderData(data);
        setActionMessage(data.message);
      } else {
        alert(data.detail || "Failed to send reminders.");
      }
    } catch (e: any) {
      alert(e.message || "Error sending reminders.");
    } finally {
      setIsSendingReminders(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (userFilter === 'all') return true;
    if (userFilter === 'trial') return u.is_trial;
    if (userFilter === 'pro') return u.subscription_tier === 'pro' || u.subscription_tier === 'owner';
    if (userFilter === 'expired') return u.subscription_tier === 'free';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-borderClr/30 pb-4 text-left">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">
              Super Admin & Subscriber Management
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage subscriber access, 15-day trials, Pro plan renewals (₹499/mo, 6-Mo, 1-Yr), and broadcast newsletters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/40 text-blue-300 hover:bg-blue-500/25 text-xs font-bold transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Google Analytics (GA4)</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>

          <button
            onClick={handleSendReminders}
            disabled={isSendingReminders}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isSendingReminders ? "Checking Expiries..." : "📢 Send Trial Reminders (<= 3d)"}</span>
          </button>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-900 border border-borderClr hover:bg-gray-800 text-xs font-bold text-gray-300 hover:text-white transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Action and Error Banners */}
      {actionMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center justify-between animate-fadeIn text-left">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-500 hover:text-emerald-300 font-bold ml-2">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded-xl flex items-center space-x-2 text-left">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Trial Reminders Summary Drawer if available */}
      {reminderData && reminderData.reminders && reminderData.reminders.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-left">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            {reminderData.reminders.length} Subscribers with Expiring Access (&le; 3 Days)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {reminderData.reminders.map((r, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-gray-950 border border-borderClr/30 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-white block">{r.phone}</span>
                  <span className="text-[10px] text-amber-400 font-semibold">{r.days_left} day(s) remaining</span>
                </div>
                <a
                  href={r.whatsapp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold hover:bg-emerald-500/30 flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  Send WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System & Visitor Traffic Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Today's Visitors</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-extrabold text-emerald-300 mt-1">
            {stats?.today_visitors ?? 0}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Total Visitors</span>
            <Globe className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-extrabold text-cyan-300 mt-1">
            {stats?.total_visitors ?? 0}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Page Views</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-extrabold text-blue-300 mt-1">
            {stats?.total_pageviews ?? 0}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Subscribers</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-extrabold text-white mt-1">
            {stats ? stats.total_users : '-'}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Pro Subscribers</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-amber-300 mt-1">
            {users.filter(u => u.subscription_tier === 'pro' || u.subscription_tier === 'owner').length}
          </div>
        </div>

        <div className="glass-panel p-3.5 rounded-xl border border-borderClr/30 bg-gray-950/40 text-left">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Active Portfolios</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-extrabold text-white mt-1">
            {stats ? stats.total_portfolios : '-'}
          </div>
        </div>
      </div>

      {/* SECTION: Newsletter & Market Update Broadcast Center */}
      <div className="glass-panel rounded-xl p-5 border border-borderClr/30 bg-gray-950/40 text-left space-y-4">
        <div className="flex items-center justify-between border-b border-borderClr/20 pb-3">
          <div className="flex items-center space-x-2">
            <Send className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Newsletter & Subscriber Broadcast Center
            </h3>
          </div>
          <span className="text-[10px] text-gray-400 font-semibold">
            Broadcast daily market regime analysis, trade setups, or renewal updates
          </span>
        </div>

        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                Broadcast Title / Subject
              </label>
              <input
                type="text"
                placeholder="e.g. 🎯 Market Regime Update: Bullish Drift Detected on NIFTY"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                className="w-full bg-gray-900 border border-borderClr/60 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  Target Audience
                </label>
                <select
                  value={targetAudience}
                  onChange={(e: any) => setTargetAudience(e.target.value)}
                  className="w-full bg-gray-900 border border-borderClr/60 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="all">All Registered Users ({users.length})</option>
                  <option value="trial">15-Day Free Trial Users ({users.filter(u => u.is_trial).length})</option>
                  <option value="pro">Paid Pro Subscribers ({users.filter(u => u.subscription_tier === 'pro').length})</option>
                  <option value="expired">Expired Trial (Win-Back) ({users.filter(u => u.subscription_tier === 'free').length})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
                  Delivery Channels
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.includes('telegram')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels([...channels, 'telegram']);
                        else setChannels(channels.filter(c => c !== 'telegram'));
                      }}
                      className="rounded bg-gray-900 border-gray-700 text-cyan-500 focus:ring-0"
                    />
                    <span>Telegram</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channels.includes('whatsapp')}
                      onChange={(e) => {
                        if (e.target.checked) setChannels([...channels, 'whatsapp']);
                        else setChannels(channels.filter(c => c !== 'whatsapp'));
                      }}
                      className="rounded bg-gray-900 border-gray-700 text-emerald-500 focus:ring-0"
                    />
                    <span>WhatsApp</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">
              Message Body (Supports Markdown formatting)
            </label>
            <textarea
              rows={4}
              placeholder="Write your daily market regime briefing, trade ideas, or subscription updates..."
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="w-full bg-gray-900 border border-borderClr/60 rounded-lg p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 font-sans"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-500 italic">
              Dispatches instantly to the official Telegram bot channel and generates one-click WhatsApp subscriber links.
            </span>
            <button
              type="submit"
              disabled={isBroadcasting}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isBroadcasting ? "Sending Broadcast..." : "Publish & Broadcast Update"}</span>
            </button>
          </div>
        </form>

        {broadcastSuccess && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs rounded-lg flex items-center justify-between">
            <span>{broadcastSuccess}</span>
            <button onClick={() => setBroadcastSuccess(null)} className="text-cyan-500 hover:text-cyan-300 font-bold ml-2">✕</button>
          </div>
        )}

        {/* WhatsApp Direct Links preview if generated */}
        {whatsappLinks.length > 0 && (
          <div className="mt-3 p-3 rounded-lg bg-gray-900/80 border border-emerald-500/30">
            <h5 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              1-Click WhatsApp Direct Delivery Links:
            </h5>
            <div className="flex flex-wrap gap-2">
              {whatsappLinks.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25 flex items-center gap-1"
                >
                  <span>{item.phone}</span>
                  <span>➔</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION: Subscribers Table */}
      <div className="glass-panel rounded-xl p-5 border border-borderClr/30 bg-gray-950/40 text-left space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderClr/20 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              All Subscribers ({filteredUsers.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Filter:</span>
            <select
              value={userFilter}
              onChange={(e: any) => setUserFilter(e.target.value)}
              className="bg-gray-900 border border-borderClr/60 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-400"
            >
              <option value="all">All ({users.length})</option>
              <option value="trial">15-Day Free Trials ({users.filter(u => u.is_trial).length})</option>
              <option value="pro">Pro & Owners ({users.filter(u => u.subscription_tier === 'pro' || u.subscription_tier === 'owner').length})</option>
              <option value="expired">Expired Plan ({users.filter(u => u.subscription_tier === 'free').length})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center text-gray-400 space-x-2 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading registered subscribers...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-xs">
            No subscribers found in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-borderClr/30 text-gray-400 text-[10px] uppercase tracking-wider bg-gray-900/40">
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Plan & Tier</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Days Left</th>
                  <th className="py-2.5 px-3">Registered</th>
                  <th className="py-2.5 px-3 text-right">Quick Subscription Grants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderClr/20">
                {filteredUsers.map((u) => {
                  const isOwnerAccount = u.role.toLowerCase() === 'owner' || u.id === 1;
                  return (
                    <tr key={u.id} className="hover:bg-gray-900/50 transition-colors">
                      {/* Subscriber Name & Phone */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">
                          {u.display_name || (u.phone_number.startsWith('fb_') ? (u.email || 'Google User') : u.phone_number)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {u.email && u.phone_number && !u.phone_number.startsWith('fb_') ? `${u.phone_number} • ${u.email}` : (u.email || u.phone_number)}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                          isOwnerAccount 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                            : 'bg-gray-800 text-gray-300 border-gray-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Plan */}
                      <td className="py-3 px-3 font-semibold text-gray-200">
                        {u.plan_name}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          isOwnerAccount
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : u.is_trial
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                            : u.subscription_tier === 'pro'
                            ? 'bg-greenBrand/15 text-greenBrand border-greenBrand/30'
                            : 'bg-redBrand/15 text-redBrand border-redBrand/30'
                        }`}>
                          {u.status}
                        </span>
                      </td>

                      {/* Days Left */}
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        {isOwnerAccount ? '∞' : `${u.days_left}d`}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-3 text-gray-400 text-[11px]">
                        {u.created_at.split(' ')[0]}
                      </td>

                      {/* Subscription Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 15 Days Trial Grant */}
                          <button
                            onClick={() => handleSubscriptionChange(u.id, 'trial_15')}
                            title="Grant 15-Day Full Pro Trial"
                            className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[9.5px] font-bold transition-all"
                          >
                            +15d Trial
                          </button>

                          {/* 1 Month Pro Grant (₹499) */}
                          <button
                            onClick={() => handleSubscriptionChange(u.id, 'pro_1mo')}
                            title="Grant 1 Month Pro (₹499)"
                            className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9.5px] font-bold transition-all"
                          >
                            +1 Mo (₹499)
                          </button>

                          {/* 6 Months Pro Grant (₹2,499) */}
                          <button
                            onClick={() => handleSubscriptionChange(u.id, 'pro_6mo')}
                            title="Grant 6 Months Pro (₹2,499)"
                            className="px-2 py-1 rounded bg-accentBrand/15 hover:bg-accentBrand/30 border border-accentBrand/40 text-accentBrand text-[9.5px] font-bold transition-all"
                          >
                            +6 Mos (₹2,499)
                          </button>

                          {/* 1 Year Pro Grant (₹4,499) */}
                          <button
                            onClick={() => handleSubscriptionChange(u.id, 'pro_1yr')}
                            title="Grant 1 Year Pro (₹4,499)"
                            className="px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-[9.5px] font-bold transition-all"
                          >
                            +1 Yr (₹4,499)
                          </button>

                          {/* Toggle Owner Role */}
                          <button
                            onClick={() => handleRoleChange(u.id, u.role.toLowerCase() === 'owner' ? 'subscriber' : 'owner')}
                            title="Toggle Owner / Subscriber role"
                            className="p-1 text-gray-400 hover:text-amber-400 hover:bg-gray-800 rounded transition-all ml-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete User */}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.display_name || u.phone_number)}
                            title="Delete User"
                            disabled={isOwnerAccount && user?.id === u.id}
                            className="p-1 text-gray-500 hover:text-redBrand hover:bg-gray-800 rounded transition-all disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
