import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import './App.css';

const HOUR_HEIGHT = 64;
const START_HOUR = 0;
const END_HOUR = 24;

function fetchDayEvents(token, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      }),
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(res => res.json());
}

// Assigns each overlapping event a column so they sit side-by-side
function layoutTimedEvents(events) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime)
  );
  const columns = []; // tracks the end time of the last event in each column
  const layout = sorted.map(event => {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    let col = columns.findIndex(colEnd => start >= colEnd);
    if (col === -1) col = columns.length;
    columns[col] = end;
    return { event, col };
  });
  // Determine total concurrent columns for each event
  return layout.map(item => {
    const start = new Date(item.event.start.dateTime);
    const end = new Date(item.event.end.dateTime);
    const concurrent = layout.filter(other => {
      const os = new Date(other.event.start.dateTime);
      const oe = new Date(other.event.end.dateTime);
      return os < end && oe > start;
    });
    const totalCols = Math.max(...concurrent.map(c => c.col)) + 1;
    return { ...item, totalCols };
  });
}

function DayCalendar({ token, onTodayEvents }) {
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
    if (!token) return;
    setLoading(true);
    fetchDayEvents(token, date)
      .then(data => {
        const items = data.items || [];
        setEvents(items);
        if (date.toDateString() === today.toDateString()) {
          onTodayEvents(items);
        }
      })
      .catch(err => console.error('Calendar fetch failed', err))
      .finally(() => setLoading(false));
  }, [token, date, refreshKey, today, onTodayEvents]);

  // Scroll to current time on first load
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const scrollTop = (mins - START_HOUR * 60) * (HOUR_HEIGHT / 60) - 120;
    scrollRef.current.scrollTop = Math.max(0, scrollTop);
  }, []);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const allDayEvents = events.filter(e => e.start.date && !e.start.dateTime);
  const timedEvents = events.filter(e => e.start.dateTime);
  const isToday = date.toDateString() === today.toDateString();

  const now = new Date();
  const nowTop = (now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) * (HOUR_HEIGHT / 60);

  function prevDay() {
    setDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  }
  function nextDay() {
    setDate(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; });
  }
  function goToday() {
    setDate(new Date(today));
  }

  function eventStyle(e) {
    const start = new Date(e.start.dateTime);
    const end = new Date(e.end.dateTime);
    const startMins = start.getHours() * 60 + start.getMinutes();
    const endMins = end.getHours() * 60 + end.getMinutes();
    const top = (startMins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
    const height = Math.max((endMins - startMins) * (HOUR_HEIGHT / 60), 24);
    return { top: `${top}px`, height: `${height}px` };
  }

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="day-cal">
      <div className="dc-header">
        <button className="dc-nav" onClick={prevDay}>‹</button>
        <span className="dc-date-label">
          {isToday ? <strong>Today</strong> : dateLabel}
          {isToday && <span className="dc-date-sub"> · {dateLabel}</span>}
        </span>
        <button className="dc-nav" onClick={nextDay}>›</button>
        {!isToday && (
          <button className="dc-today-btn" onClick={goToday}>Today</button>
        )}
        <button
          className="dc-refresh-btn"
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={loading}
          title="Refresh calendar"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {allDayEvents.length > 0 && (
        <div className="dc-allday-row">
          <div className="dc-time-gutter dc-allday-label">all-day</div>
          <div className="dc-allday-events">
            {allDayEvents.map((e, i) => (
              <div key={i} className="dc-event dc-event-allday">{e.summary}</div>
            ))}
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
              const left = `calc(${(col / totalCols) * 100}% + 2px)`;
              const width = `calc(${(1 / totalCols) * 100}% - 4px)`;
              return (
                <div key={i} className="dc-event dc-event-timed" style={{ top, height, left, width }}>
                  <span className="dc-event-title">{event.summary}</span>
                  <span className="dc-event-time">
                    {new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
    { key: 'name',      label: 'Name',          type: 'text', placeholder: 'Meeting name', required: true },
    { key: 'startTime', label: 'Start time',     type: 'time' },
    { key: 'endTime',   label: 'End time',       type: 'time' },
    { key: 'location',  label: 'Location',       type: 'text', placeholder: 'Room or link' },
  ],
  work: [
    { key: 'name',     label: 'Name',          type: 'text', placeholder: 'Task name', required: true },
    { key: 'deadline', label: 'Deadline',      type: 'time' },
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

function TodoList({ title, type, items, onAdd }) {
  const [checked, setChecked] = useState(new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  function toggleItem(i) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleSubmit() {
    if (!form.name?.trim()) return;
    onAdd(formatEntry(type, form));
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
            <li key={i} className={`todo-item${done ? ' done' : ''}`} onClick={() => toggleItem(i)}>
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

  function setField(key, value) {
    setLocal(prev => ({ ...prev, [key]: value }));
  }

  function addNoWork() {
    setLocal(prev => ({ ...prev, noWorkTimes: [...prev.noWorkTimes, { start: '', end: '' }] }));
  }

  function removeNoWork(i) {
    setLocal(prev => ({ ...prev, noWorkTimes: prev.noWorkTimes.filter((_, idx) => idx !== i) }));
  }

  function updateNoWork(i, field, value) {
    setLocal(prev => {
      const updated = prev.noWorkTimes.map((t, idx) => idx === i ? { ...t, [field]: value } : t);
      return { ...prev, noWorkTimes: updated };
    });
  }

  function handleSave() {
    onChange(local);
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Preferences</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          <div className="settings-row">
            <div className="settings-label">
              <span>Break time</span>
              <span className="settings-hint">minutes between sessions</span>
            </div>
            <div className="settings-input-group">
              <input
                className="settings-input settings-input-sm"
                type="number" min="1"
                value={local.breakTime}
                onChange={e => setField('breakTime', e.target.value)}
              />
              <span className="settings-unit">min</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <span>Context switching</span>
              <span className="settings-hint">minimum time per task</span>
            </div>
            <div className="settings-input-group">
              <input
                className="settings-input settings-input-sm"
                type="number" min="1"
                value={local.contextSwitch}
                onChange={e => setField('contextSwitch', e.target.value)}
              />
              <span className="settings-unit">min</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <span>Burnout limit</span>
              <span className="settings-hint">maximum focus time</span>
            </div>
            <div className="settings-input-group">
              <input
                className="settings-input settings-input-sm"
                type="number" min="1"
                value={local.burnout}
                onChange={e => setField('burnout', e.target.value)}
              />
              <span className="settings-unit">min</span>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-header">
              <span>No-work times</span>
              <button className="settings-add-time" onClick={addNoWork}>+ Add range</button>
            </div>
            {local.noWorkTimes.map((t, i) => (
              <div key={i} className="nowork-row">
                <input
                  className="settings-input"
                  type="time"
                  value={t.start}
                  onChange={e => updateNoWork(i, 'start', e.target.value)}
                />
                <span className="nowork-to">to</span>
                <input
                  className="settings-input"
                  type="time"
                  value={t.end}
                  onChange={e => updateNoWork(i, 'end', e.target.value)}
                />
                <button className="nowork-remove" onClick={() => removeNoWork(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({
    breakTime: 15,
    contextSwitch: 30,
    burnout: 120,
    noWorkTimes: [{ start: '', end: '' }],
  });

  const login = useGoogleLogin({
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/tasks.readonly',
    ].join(' '),
    onSuccess: ({ access_token }) => setToken(access_token),
    onError: () => console.error('Google login failed'),
  });

  useEffect(() => {
    if (!token) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?` +
        new URLSearchParams({
          showCompleted: false,
          showHidden: false,
          dueMin: start.toISOString(),
          dueMax: end.toISOString(),
        }),
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then(r => r.json())
      .then(data => {
        const items = (data.items || []).map(t => t.title).filter(Boolean);
        setTasks(items);
      })
      .catch(err => console.error('Tasks fetch failed', err));
  }, [token]);

  // Only calendar events (eventType 'default') go in the Meetings list
  const handleTodayEvents = useCallback((items) => {
    const formatted = items
      .filter(e => !e.eventType || e.eventType === 'default')
      .map(e => {
        const time = e.start.dateTime
          ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'All day';
        return `${e.summary} — ${time}`;
      });
    setMeetings(formatted);
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="app-name">Flowstate</span>
        <span className="app-tagline">Personal Secretary</span>
        <div className="top-bar-actions">
          {token ? (
            <button className="auth-btn signout" onClick={() => { setToken(null); setMeetings([]); setTasks([]); }}>
              Sign out
            </button>
          ) : (
            <button className="auth-btn signin" onClick={() => login()}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>
      {showSettings && (
        <SettingsModal
          prefs={prefs}
          onChange={setPrefs}
          onClose={() => setShowSettings(false)}
        />
      )}

      <main className="workspace">
        <section className="calendar-pane">
          <div className="pane-header">Calendar</div>
          {token ? (
            <DayCalendar token={token} onTodayEvents={handleTodayEvents} />
          ) : (
            <div className="calendar-placeholder">
              <p>Sign in with Google to view your calendar</p>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <TodoList
            type="meeting"
            title="Meetings"
            items={
              meetings.length > 0
                ? meetings
                : token
                ? ['No meetings today']
                : ['Sign in to load meetings']
            }
            onAdd={item => setMeetings(prev => [...prev, item])}
          />
          <TodoList
            type="work"
            title="Deep Work"
            items={tasks}
            onAdd={item => setTasks(prev => [...prev, item])}
          />
          <div className="sidebar-footer">
            <button className="prefs-btn" onClick={() => setShowSettings(true)}>Preferences</button>
            <button className="submit-btn">Submit</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
