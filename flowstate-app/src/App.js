import { useState, useEffect, useRef } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import './App.css';

const HOUR_HEIGHT = 64;
const START_HOUR = 6;
const END_HOUR = 23;

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  }, [token, date, refreshKey]);

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
                {h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
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

function TodoList({ title, items, onAdd }) {
  const [input, setInput] = useState('');

  function handleKeyDown(e) {
    if (e.key === 'Enter' && input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  }

  return (
    <div className="todo-panel">
      <h2 className="todo-title">{title}</h2>
      <ul className="todo-list">
        {items.map((item, i) => (
          <li key={i} className="todo-item">
            <span className="todo-checkbox" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <input
        className="todo-input"
        type="text"
        placeholder="Add item…"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function App() {
  const [token, setToken] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [tasks, setTasks] = useState([
    'Finish Q2 report draft',
    'Review pull requests',
    'Update project documentation',
    'Respond to stakeholder emails',
  ]);

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: ({ access_token }) => setToken(access_token),
    onError: () => console.error('Google login failed'),
  });

  function handleTodayEvents(items) {
    const formatted = items.map(e => {
      const time = e.start.dateTime
        ? new Date(e.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'All day';
      return `${e.summary} — ${time}`;
    });
    setMeetings(formatted);
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="app-name">Flowstate</span>
        <span className="app-tagline">Personal Secretary</span>
        <div className="top-bar-actions">
          {token ? (
            <button className="auth-btn signout" onClick={() => { setToken(null); setMeetings([]); }}>
              Sign out
            </button>
          ) : (
            <button className="auth-btn signin" onClick={() => login()}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>

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
            title="Deep Work"
            items={tasks}
            onAdd={item => setTasks(prev => [...prev, item])}
          />
          <div className="sidebar-footer">
            <button className="submit-btn">Submit</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
