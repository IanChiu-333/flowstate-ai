import { useState } from 'react';
import './App.css';

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
  const [meetings, setMeetings] = useState([
    'Sync with design team — 10:00 AM',
    'Product roadmap review — 1:00 PM',
    '1:1 with manager — 3:30 PM',
    'Sprint planning — 4:00 PM',
  ]);

  const [tasks, setTasks] = useState([
    'Finish Q2 report draft',
    'Review pull requests',
    'Update project documentation',
    'Respond to stakeholder emails',
  ]);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <span className="app-name">Flowstate</span>
        <span className="app-tagline">Personal Secretary</span>
      </header>

      <main className="workspace">
        <section className="calendar-pane">
          <div className="pane-header">Calendar</div>
          <iframe
            title="Google Calendar"
            src="https://calendar.google.com/calendar/embed?showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=0&mode=WEEK"
            className="calendar-frame"
          />
        </section>

        <aside className="sidebar">
          <TodoList
            title="Meetings"
            items={meetings}
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
