import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Calendar, Filter, Users, Clock, AlertTriangle, Play } from 'lucide-react';
import { api } from '../../services/api';

export default function HistorySection({ refreshTrigger }) {
  const [records, setRecords] = useState([]);
  const [analytics, setAnalytics] = useState({
    patients_served_today: 0,
    avg_wait_time: 0,
    avg_consultation_time: 0,
    no_show_count: 0
  });
  const [loading, setLoading] = useState(false);

  // Filter States
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHistory({ name, status_filter: status, date_filter: date });
      setRecords(data.records || []);
      setAnalytics(data.analytics || {
        patients_served_today: 0,
        avg_wait_time: 0,
        avg_consultation_time: 0,
        no_show_count: 0
      });
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
    }
  }, [name, status, date]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshTrigger]);

  const handleClearFilters = () => {
    setName('');
    setStatus('');
    setDate('');
  };

  const STATUS_LABELS = {
    waiting: { text: 'Waiting', bg: 'bg-yellow-50 text-yellow-750 border-yellow-100' },
    in_consultation: { text: 'In Room', bg: 'bg-emerald-50 text-emerald-750 border-emerald-100' },
    completed: { text: 'Completed', bg: 'bg-slate-50 text-slate-650 border-slate-100' },
    no_show: { text: 'No Show', bg: 'bg-red-50 text-red-750 border-red-100' }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mt-8 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-slate-850 tracking-tight">Queue History</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Access past clinic day records and performance statistics
          </p>
        </div>
        
        {/* Active filters indicator */}
        {(name || status || date) && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            Clear Active Filters
          </button>
        )}
      </div>

      {/* Analytics Summaries */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Served Card */}
        <div className="bg-slate-50 rounded-2xl border border-slate-150 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Served Today</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{analytics.patients_served_today}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Wait Time Card */}
        <div className="bg-slate-50 rounded-2xl border border-slate-150 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Avg. Wait Time</p>
            <p className="text-3xl font-black text-slate-800 mt-1">
              {analytics.avg_wait_time} <span className="text-sm font-semibold text-slate-500">min</span>
            </p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Consultation Duration Card */}
        <div className="bg-slate-50 rounded-2xl border border-slate-150 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Avg. Consult Time</p>
            <p className="text-3xl font-black text-slate-800 mt-1">
              {analytics.avg_consultation_time} <span className="text-sm font-semibold text-slate-500">min</span>
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* No Shows Card */}
        <div className="bg-slate-50 rounded-2xl border border-slate-150 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No Show Count</p>
            <p className="text-3xl font-black text-slate-800 mt-1">{analytics.no_show_count}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Name Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by patient name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
            <Filter className="w-4 h-4" />
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
          >
            <option value="">Filter by Status</option>
            <option value="completed">Completed</option>
            <option value="no_show">No Show</option>
            <option value="waiting">Waiting</option>
            <option value="in_consultation">In Consultation</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
            <Calendar className="w-4 h-4" />
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* History Grid */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-250 font-semibold text-slate-655">
                <th className="py-3.5 px-4 text-center">Token</th>
                <th className="py-3.5 px-4">Patient Name</th>
                <th className="py-3.5 px-4">Archived Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-center">Wait Time</th>
                <th className="py-3.5 px-4 text-center">Consult Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading history log...
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No historical logs match search criteria.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const cfg = STATUS_LABELS[r.status] || STATUS_LABELS.waiting;
                  const dateStr = format(new Date(r.archived_at + 'Z'), 'yyyy-MM-dd hh:mm a');
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        #{r.token_number}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {r.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {dateStr}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center border px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg}`}>
                          {cfg.text}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold">
                        {r.wait_time_minutes !== null ? `${r.wait_time_minutes}m` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-semibold">
                        {r.consultation_duration_minutes !== null ? `${r.consultation_duration_minutes}m` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
