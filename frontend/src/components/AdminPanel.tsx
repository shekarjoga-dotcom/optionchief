import React, { useState, useEffect } from 'react';
import { useStore } from '../hooks/useStore';
import { BACKEND_URL } from '../config';
import { Users, Shield, Server, Database, RefreshCw, Trash2, UserCheck, AlertTriangle, Key } from 'lucide-react';

interface AdminUser {
  id: number;
  phone_number: string;
  role: string;
  is_auto_scanning: boolean;
  created_at: string;
  dhan_client_id?: string;
  has_dhan_token: boolean;
}

interface SystemStats {
  total_users: number;
  total_portfolios: number;
  active_alert_rules: number;
  rsi_scanner_logs: number;
}

export const AdminPanel: React.FC = () => {
  const { token, user } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

  const handleDeleteUser = async (userId: number, phone: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete user ${phone}? This action cannot be undone.`)) return;
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setActionMessage(`User ${phone} deleted successfully.`);
        fetchAdminData();
      } else {
        const d = await res.json();
        alert(d.detail || "Failed to delete user");
      }
    } catch (e: any) {
      alert(e.message || "Error deleting user");
    }
  };

  if (user?.role.toLowerCase() !== 'owner') {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-300">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400 max-w-md mx-auto">
          The Admin Dashboard is restricted strictly to the platform **Owner (Super Admin)**. Please log in with Owner credentials to access user management.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">Owner Control Panel</h1>
              <p className="text-slate-400 text-sm">Manage registered traders, system permissions, and platform health</p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium transition duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {actionMessage && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-rose-950/80 border border-rose-500/50 text-rose-300 px-4 py-3 rounded-lg text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* System Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">Total Traders</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.total_users ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Registered Platform Accounts</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">Portfolios Deployed</span>
            <Database className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.total_portfolios ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Active & Past Paper Trades</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">Active Alert Rules</span>
            <Server className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.active_alert_rules ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Server-side Scanners Running</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-sm font-medium">RSI Scanner Logs</span>
            <RefreshCw className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats?.rsi_scanner_logs ?? 0}</div>
          <p className="text-xs text-slate-500 mt-1">Total Signals Detected</p>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Registered Users & Permissions</h3>
          </div>
          <span className="text-xs text-slate-400">{users.length} total user accounts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-xs border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">User ID</th>
                <th className="py-3.5 px-4 font-semibold">Phone Number</th>
                <th className="py-3.5 px-4 font-semibold">Platform Role</th>
                <th className="py-3.5 px-4 font-semibold">Dhan Broker Status</th>
                <th className="py-3.5 px-4 font-semibold">Joined Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/50 transition">
                  <td className="py-3.5 px-4 font-mono text-slate-400">#{u.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-white">{u.phone_number}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      u.role.toLowerCase() === 'owner'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {u.has_dhan_token ? (
                      <span className="flex items-center space-x-1 text-emerald-400 text-xs font-medium">
                        <Key className="w-3.5 h-3.5" />
                        <span>Connected ({u.dhan_client_id || 'Active'})</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs">Not Configured</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">{u.created_at || 'N/A'}</td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <select
                      value={u.role.toLowerCase()}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-xs text-white rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="viewer">VIEWER</option>
                      <option value="owner">OWNER</option>
                    </select>

                    <button
                      onClick={() => handleDeleteUser(u.id, u.phone_number)}
                      title="Delete User"
                      className="p-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-400 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
