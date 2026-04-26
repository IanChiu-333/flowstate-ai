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

function parseEstimate(str) {
  if (!str) return null;
  let mins = 0;
  const h = str.match(/(\d+)\s*h/i);
  const m = str.match(/(\d+)\s*m/i);
  if (h) mins += parseInt(h[1]) * 60;
  if (m) mins += parseInt(m[1]);
  return mins > 0 ? mins : null;
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
        if (date.toDateString() === today.toDateString()) onTodayEvents(evts);
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

const FIELDS = {
  meeting: [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'Meeting name', required: true },
    { key: 'startTime', label: 'Start time', type: 'time' },
    { key: 'endTime', label: 'End time', type: 'time' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'Room or link' },
  ],
  work: [
    { key: 'name', label: 'Name', type: 'text', placeholder: 'Task name', required: true },
    { key: 'deadline', label: 'Deadline', type: 'time' },
    { key: 'estimate', label: 'Time estimate', type: 'text', placeholder: 'e.g. 2h 30m' },
  ],
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function formatEntry(type, form) {
  const parts = [form.name];
  if (type === 'meeting') {
    const times = [formatTime(form.startTime), formatTime(form.endTime)].filter(Boolean).join(' – ');
    if (times) parts.push(times);
    if (form.location?.trim()) parts.push(form.location.trim());
  } else {
    if (form.deadline) parts.push(`due ${formatTime(form.deadline)}`);
    if (form.estimate?.trim()) parts.push(form.estimate.trim());
  }
  return parts.join(' · ');
}

function TodoList({ title, type, items, checked, onToggle, onAdd }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  function handleSubmit() {
    if (!form.name?.trim()) return;
    onAdd(form);
    setForm({});
    setShowForm(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') setShowForm(false);
  }

  return (
    <div className="todo-panel">
      <h2 className="todo-title">{title}</h2>
      <ul className="todo-list">
        {items.map((item, i) => {
          const done = checked.has(i);
          return (
            <li key={i} className={`todo-item${done ? ' done' : ''}`} onClick={() => onToggle(i)}>
              <span className={`todo-checkbox${done ? ' checked' : ''}`} />
              <span>{item}</span>
            </li>
          );
        })}
      </ul>
      {showForm ? (
        <div className="todo-form" onKeyDown={handleKeyDown}>
          {FIELDS[type].map(f => (
            <div key={f.key} className="form-row">
              <label className="form-label">{f.label}</label>
              <input
                className="form-input"
                type={f.type}
                placeholder={f.placeholder || ''}
                value={form[f.key] || ''}
                autoFocus={f.key === 'name'}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="form-actions">
            <button className="form-btn-add" onClick={handleSubmit}>Add</button>
            <button className="form-btn-cancel" onClick={() => { setShowForm(false); setForm({}); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="todo-add-btn" onClick={() => setShowForm(true)}>+ Add item</button>
      )}
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
            { key: 'contextSwitch', label: 'Context switching', hint: 'minimum time per task' },
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

function App() {
  const [jwt, setJwt] = useState(() => localStorage.getItem('flowstate_jwt'));
  const [meetings, setMeetings] = useState([]); // [{ display, raw }]
  const [tasks, setTasks] = useState([]);        // [{ display, raw }]
  const [checkedMeetings, setCheckedMeetings] = useState(new Set());
  const [checkedTasks, setCheckedTasks] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [prefs, setPrefs] = useState({ breakTime: 15, contextSwitch: 30, burnout: 120, noWorkTimes: [] });

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
    setMeetings([]);
    setTasks([]);
  }

  async function handleSavePrefs(newPrefs) {
    setPrefs(newPrefs);
    if (!jwt) return;
    await api('/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        break_time: parseInt(newPrefs.breakTime) || 0,
        context_switch: parseInt(newPrefs.contextSwitch) || 0,
        burnout: parseInt(newPrefs.burnout) || 0,
        no_work_time: newPrefs.noWorkTimes.filter(t => t.start && t.end),
      }),
    }, jwt).catch(err => console.error('Prefs save failed', err));
  }

  const handleTodayEvents = useCallback((items) => {
    setMeetings(items
      .filter(e => !e.is_all_day)
      .map(e => ({
        display: `${e.title} — ${new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        raw: e,
      }))
    );
  }, []);

  function toggle(setChecked) {
    return i => setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleAddMeeting(form) {
    const today = getLocalYMD();
    setMeetings(prev => [...prev, {
      display: formatEntry('meeting', form),
      raw: {
        event_id: null,
        title: form.name,
        start: form.startTime ? `${today}T${form.startTime}:00` : null,
        end: form.endTime ? `${today}T${form.endTime}:00` : null,
        location: form.location || null,
        is_all_day: false,
      },
    }]);
  }

  function handleAddTask(form) {
    const today = getLocalYMD();
    setTasks(prev => [...prev, {
      display: formatEntry('work', form),
      raw: {
        task_id: `local_${Date.now()}`,
        title: form.name,
        duration_minutes: parseEstimate(form.estimate),
        deadline: form.deadline ? `${today}T${form.deadline}:00` : null,
      },
    }]);
  }

  async function handleSubmit() {
    if (!jwt) return;
    setIsSubmitting(true);
    const today = getLocalYMD();
    const payload = {
      date: today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      events: meetings.filter((_, i) => !checkedMeetings.has(i)).map(m => m.raw).filter(Boolean),
      tasks: tasks.filter((_, i) => !checkedTasks.has(i)).map(t => t.raw),
      preferences: {
        break_time: parseInt(prefs.breakTime) || 0,
        context_switch: parseInt(prefs.contextSwitch) || 0,
        burnout: parseInt(prefs.burnout) || 0,
        no_work_time: prefs.noWorkTimes.filter(t => t.start && t.end),
      },
    };
    try {
      const res = await api('/schedule/process', { method: 'POST', body: JSON.stringify(payload) }, jwt);
      const result = await res.json();
      
      if (!res.ok) {
        let errMsg = result.detail || 'An unknown error occurred';
        if (Array.isArray(result.detail)) {
          errMsg = result.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join('\n');
        }
        alert(`Failed to submit schedule:\n${errMsg}`);
        return;
      }
      
      console.log('Schedule result:', result);
      setCalendarRefreshKey(k => k + 1);
      alert('Schedule processed successfully!');
    } catch (err) {
      console.error('Submit failed', err);
      alert(`Submit failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const meetingItems = meetings.length > 0
    ? meetings.map(m => m.display)
    : jwt ? ['No meetings today'] : ['Sign in to load meetings'];

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
          <TodoList
            type="meeting" title="Meetings"
            items={meetingItems}
            checked={checkedMeetings}
            onToggle={toggle(setCheckedMeetings)}
            onAdd={handleAddMeeting}
          />
          <TodoList
            type="work" title="Deep Work"
            items={tasks.map(t => t.display)}
            checked={checkedTasks}
            onToggle={toggle(setCheckedTasks)}
            onAdd={handleAddTask}
          />
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
