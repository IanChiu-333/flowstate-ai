import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const HOUR_HEIGHT = 64;
const START_HOUR = 0;
const END_HOUR = 24;

function api(path, options = {}, jwt = null) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  return fetch(`${BACKEND}${path}`, { ...options, headers });
}

function getLocalYMD(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function layoutTimedEvents(events) {
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
  const columns = [];
  const layout = sorted.map(event => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    let col = columns.findIndex(colEnd => start >= colEnd);
    if (col === -1) col = columns.length;
    columns[col] = end;
    return { event, col };
  });
  return layout.map(item => {
    const start = new Date(item.event.start);
    const end = new Date(item.event.end);
    const concurrent = layout.filter(other => {
      const os = new Date(other.event.start);
      const oe = new Date(other.event.end);
      return os < end && oe > start;
    });
    const totalCols = Math.max(...concurrent.map(c => c.col)) + 1;
    return { ...item, totalCols };
  });
}

function DayCalendar({ jwt, onTodayEvents, externalRefreshKey }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [date, setDate] = useState(new Date(today));
  const [events, setEvents] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!jwt) return;
    setLoading(true);
    const dateStr = getLocalYMD(date);
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
    api(`/calendar/events?date=${dateStr}&timezone=${tz}`, { cache: 'no-store' }, jwt)
      .then(r => r.json())
      .then(items => {
        const evts = Array.isArray(items) ? items : [];
        setEvents(evts);
        onTodayEvents(evts, date);
      })
      .catch(err => console.error('Calendar fetch failed', err))
      .finally(() => setLoading(false));
  }, [jwt, date, refreshKey, externalRefreshKey, today, onTodayEvents]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    scrollRef.current.scrollTop = Math.max(0, (mins - START_HOUR * 60) * (HOUR_HEIGHT / 60) - 120);
  }, []);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const allDayEvents = events.filter(e => e.is_all_day);
  const timedEvents = events.filter(e => !e.is_all_day);
  const isToday = date.toDateString() === today.toDateString();
  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) * (HOUR_HEIGHT / 60);

  function prevDay() { setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; }); }
  function nextDay() { setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; }); }
  function goToday() { setDate(new Date(today)); }

  function eventStyle(e) {
    const start = new Date(e.start);
    const end = new Date(e.end);
    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();
    return {
      top: `${(startMins - START_HOUR * 60) * (HOUR_HEIGHT / 60)}px`,
      height: `${Math.max((endMins - startMins) * (HOUR_HEIGHT / 60), 24)}px`,
    };
  }

  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="day-cal">
      <div className="dc-header">
        <button className="dc-nav" onClick={prevDay}>‹</button>
        <span className="dc-date-label">
          {isToday ? <strong>Today</strong> : dateLabel}
          {isToday && <span className="dc-date-sub"> · {dateLabel}</span>}
        </span>
        <button className="dc-nav" onClick={nextDay}>›</button>
        {!isToday && <button className="dc-today-btn" onClick={goToday}>Today</button>}
        <button className="dc-refresh-btn" onClick={() => setRefreshKey(k => k + 1)} disabled={loading} title="Refresh">
          {loading ? '…' : '↻'}
        </button>
      </div>

      {allDayEvents.length > 0 && (
        <div className="dc-allday-row">
          <div className="dc-time-gutter dc-allday-label">all-day</div>
          <div className="dc-allday-events">
            {allDayEvents.map((e, i) => <div key={i} className="dc-event dc-event-allday">{e.title}</div>)}
          </div>
        </div>
      )}

      <div className="dc-scroll" ref={scrollRef}>
        <div className="dc-body">
          <div className="dc-time-col">
            {hours.map(h => (
              <div key={h} className="dc-hour-label">
                {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : h === 24 ? '12 AM' : `${h - 12} PM`}
              </div>
            ))}
          </div>
          <div className="dc-events-col">
            {hours.map(h => <div key={h} className="dc-hour-cell" />)}
            {isToday && nowTop >= 0 && (
              <div className="dc-now-line" style={{ top: `${nowTop}px` }}>
                <div className="dc-now-dot" />
              </div>
            )}
            {layoutTimedEvents(timedEvents).map(({ event, col, totalCols }, i) => {
              const { top, height } = eventStyle(event);
              return (
                <div key={i} className="dc-event dc-event-timed" style={{
                  top, height,
                  left: `calc(${(col / totalCols) * 100}% + 2px)`,
                  width: `calc(${(1 / totalCols) * 100}% - 4px)`,
                }}>
                  <span className="dc-event-title">{event.title}</span>
                  <span className="dc-event-time">
                    {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FreeformTodos({ todos, onChange }) {
  const inputRefs = useRef([]);

  function addItem() {
    onChange([...todos, '']);
    setTimeout(() => inputRefs.current[todos.length]?.focus(), 0);
  }

  function handleChange(i, value) {
    const next = [...todos];
    next[i] = value;
    onChange(next);
  }

  function handleKeyDown(e, i) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = [...todos];
      next.splice(i + 1, 0, '');
      onChange(next);
      setTimeout(() => inputRefs.current[i + 1]?.focus(), 0);
    } else if (e.key === 'Backspace' && todos[i] === '' && todos.length > 1) {
      e.preventDefault();
      const next = todos.filter((_, idx) => idx !== i);
      onChange(next);
      setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 0);
    }
  }

  return (
    <div className="todos-panel">
      <h2 className="todo-title">To-dos</h2>
      <ul className="todos-list">
        {todos.map((todo, i) => (
          <li key={i} className="todos-item">
            <span className="todos-bullet" />
            <input
              ref={el => { inputRefs.current[i] = el; }}
              className="todos-input"
              type="text"
              value={todo}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(e, i)}
              placeholder="Type a todo…"
            />
          </li>
        ))}
      </ul>
      <div className="todos-click-zone" onClick={addItem} />
    </div>
  );
}

function SettingsModal({ prefs, onChange, onClose }) {
  const [local, setLocal] = useState(prefs);

  function setField(key, value) { setLocal(prev => ({ ...prev, [key]: value })); }
  function addNoWork() { setLocal(prev => ({ ...prev, noWorkTimes: [...prev.noWorkTimes, { start: '', end: '' }] })); }
  function removeNoWork(i) { setLocal(prev => ({ ...prev, noWorkTimes: prev.noWorkTimes.filter((_, idx) => idx !== i) })); }
  function updateNoWork(i, field, value) {
    setLocal(prev => ({ ...prev, noWorkTimes: prev.noWorkTimes.map((t, idx) => idx === i ? { ...t, [field]: value } : t) }));
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Preferences</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          {[
            { key: 'breakTime', label: 'Break time', hint: 'minutes between sessions' },
            { key: 'burnout', label: 'Burnout limit', hint: 'maximum focus time' },
          ].map(({ key, label, hint }) => (
            <div key={key} className="settings-row">
              <div className="settings-label">
                <span>{label}</span>
                <span className="settings-hint">{hint}</span>
              </div>
              <div className="settings-input-group">
                <input className="settings-input settings-input-sm" type="number" min="1"
                  value={local[key]} onChange={e => setField(key, e.target.value)} />
                <span className="settings-unit">min</span>
              </div>
            </div>
          ))}
          <div className="settings-row">
            <div className="settings-label">
              <span>Context switching</span>
              <span className="settings-hint">group tasks to avoid interruptions</span>
            </div>
            <input type="checkbox" checked={local.contextSwitch}
              onChange={e => setField('contextSwitch', e.target.checked)} />
          </div>
          <div className="settings-section">
            <div className="settings-section-header">
              <span>No-work times</span>
              <button className="settings-add-time" onClick={addNoWork}>+ Add range</button>
            </div>
            {local.noWorkTimes.map((t, i) => (
              <div key={i} className="nowork-row">
                <input className="settings-input" type="time" value={t.start} onChange={e => updateNoWork(i, 'start', e.target.value)} />
                <span className="nowork-to">to</span>
                <input className="settings-input" type="time" value={t.end} onChange={e => updateNoWork(i, 'end', e.target.value)} />
                <button className="nowork-remove" onClick={() => removeNoWork(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-save" onClick={() => { onChange(local); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="loading-spinner" />
        <p className="loading-title">Optimizing your day</p>
        <p className="loading-sub">Gemini is scheduling your tasks…</p>
      </div>
    </div>
  );
}

function ToastNotification({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`toast-popup toast-${toast.type}`}>
      <div className="toast-header">
        <span className="toast-label">
          {toast.type === 'success' ? 'Done' : toast.type === 'error' ? 'Error' : 'Gemini'}
        </span>
        <button className="toast-close" onClick={onDismiss}>✕</button>
      </div>
      <p className="toast-message">{toast.message}</p>
    </div>
  );
}

function App() {
  const [jwt, setJwt] = useState(() => localStorage.getItem('flowstate_jwt'));
  const [todos, setTodos] = useState(['']);
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [sidebarDate, setSidebarDate] = useState(new Date());
  const [prefs, setPrefs] = useState({ breakTime: 15, contextSwitch: true, burnout: 120, noWorkTimes: [] });

  // Handle OAuth callback (?code=...&state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;
    api(`/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .then(r => r.json())
      .then(data => {
        localStorage.setItem('flowstate_jwt', data.token);
        setJwt(data.token);
        window.history.replaceState(null, '', window.location.pathname);
      })
      .catch(err => console.error('Auth callback failed', err));
  }, []);

  // Verify JWT on load
  useEffect(() => {
    if (!jwt) return;
    api('/auth/status', {}, jwt)
      .then(r => { if (!r.ok) throw new Error(); })
      .catch(() => { localStorage.removeItem('flowstate_jwt'); setJwt(null); });
  }, [jwt]);

  // Load preferences from backend
  useEffect(() => {
    if (!jwt) return;
    api('/preferences', {}, jwt)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setPrefs({
          breakTime: data.break_time,
          contextSwitch: data.context_switch,
          burnout: data.burnout,
          noWorkTimes: data.no_work_time || [],
        });
      })
      .catch(() => { });
  }, [jwt]);

  async function handleLogin() {
    const res = await api('/auth/login');
    const data = await res.json();
    window.location.href = data.authorization_url;
  }

  async function handleLogout() {
    if (jwt) await api('/auth/logout', { method: 'POST' }, jwt).catch(() => { });
    localStorage.removeItem('flowstate_jwt');
    setJwt(null);
    setTodos(['']);
  }

  async function handleSavePrefs(newPrefs) {
    setPrefs(newPrefs);
    if (!jwt) return;
    await api('/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        break_time: parseInt(newPrefs.breakTime) || 0,
        context_switch: Boolean(newPrefs.contextSwitch),
        burnout: parseInt(newPrefs.burnout) || 0,
        no_work_time: newPrefs.noWorkTimes.filter(t => t.start && t.end),
      }),
    }, jwt).catch(err => console.error('Prefs save failed', err));
  }

  const handleTodayEvents = useCallback((items, date) => {
    setSidebarDate(date);
    const formatted = items.map(e => {
      if (e.is_all_day) return `"${e.title}" all day`;
      const start = new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const end = new Date(e.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const base = `"${e.title}" at ${start} to ${end}`;
      return e.location?.trim() ? `${base} with ${e.location.trim()}` : base;
    });
    setTodos(formatted.length > 0 ? [...formatted, ''] : ['']);
  }, []);

  async function handleSubmit() {
    if (!jwt) return;
    const todoList = todos.map(t => t.trim()).filter(Boolean);
    setIsSubmitting(true);
    const payload = {
      date: getLocalYMD(sidebarDate),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      todos: todoList,
      preferences: {
        break_time: parseInt(prefs.breakTime) || 0,
        context_switch: Boolean(prefs.contextSwitch),
        burnout: parseInt(prefs.burnout) || 0,
        no_work_time: prefs.noWorkTimes.filter(t => t.start && t.end),
      },
    };
    try {
      const res = await api('/schedule/process', { method: 'POST', body: JSON.stringify(payload) }, jwt);
      const text = await res.text();

      if (!res.ok) {
        let errMsg = text;
        try {
          const parsed = JSON.parse(text);
          errMsg = parsed.detail || text;
          if (Array.isArray(parsed.detail)) {
            errMsg = parsed.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join('\n');
          }
        } catch { }
        setToast({ message: errMsg, type: 'error' });
        return;
      }

      let result;
      try { result = JSON.parse(text); } catch { result = null; }

      if (result !== null && typeof result === 'object' && !Array.isArray(result)) {
        setCalendarRefreshKey(k => k + 1);
        setTodos(['']);
        setToast({ message: 'Your day has been optimized!', type: 'success' });
      } else {
        // String response → Gemini needs clarification
        setToast({ message: typeof result === 'string' ? result : text, type: 'clarification' });
      }
    } catch (err) {
      console.error('Submit failed', err);
      setToast({ message: `Submit failed: ${err.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="app-name">Flowstate</span>
        <span className="app-tagline">Personal Secretary</span>
        <div className="top-bar-actions">
          {jwt ? (
            <button className="auth-btn signout" onClick={handleLogout}>Sign out</button>
          ) : (
            <button className="auth-btn signin" onClick={handleLogin}>Sign in with Google</button>
          )}
        </div>
      </header>
      {showSettings && (
        <SettingsModal prefs={prefs} onChange={handleSavePrefs} onClose={() => setShowSettings(false)} />
      )}
      <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      <main className="workspace">
        <section className="calendar-pane">
          <div className="pane-header">Calendar</div>
          {jwt ? (
            <DayCalendar jwt={jwt} onTodayEvents={handleTodayEvents} externalRefreshKey={calendarRefreshKey} />
          ) : (
            <div className="calendar-placeholder">
              <p>Sign in with Google to view your calendar</p>
            </div>
          )}
        </section>
        <aside className="sidebar">
          <div className="sidebar-date-label">
            {sidebarDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <FreeformTodos todos={todos} onChange={setTodos} />
          <div className="sidebar-footer">
            <button className="prefs-btn" onClick={() => setShowSettings(true)}>Preferences</button>
            <button className="submit-btn" onClick={handleSubmit}>Submit</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
