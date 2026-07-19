const path = require('path');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'tasks.db');
const fs = require('fs');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT DEFAULT (datetime('now'))
)`).run();

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
const serialize = row => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  due_date: row.due_date,
  status: row.status,
  created_at: row.created_at
});

// Get tasks with optional filters
app.get('/api/tasks', (req, res) => {
  const { status, priority } = req.query;
  let sql = 'SELECT * FROM tasks';
  const clauses = [];
  const params = {};
  if (status) { clauses.push('status = @status'); params.status = status; }
  if (priority) { clauses.push('priority = @priority'); params.priority = priority; }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY due_date ASC, created_at ASC';
  const rows = db.prepare(sql).all(params);
  res.json(rows.map(serialize));
});

// Create task
app.post('/api/tasks', (req, res) => {
  const { title, description, priority, due_date } = req.body;
  if (!title || !priority || !due_date) return res.status(400).json({ error: 'Missing required fields' });
  const stmt = db.prepare('INSERT INTO tasks (title, description, priority, due_date) VALUES (@title,@description,@priority,@due_date)');
  const info = stmt.run({ title, description: description || '', priority, due_date });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

// Update task
app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, description, priority, due_date, status } = req.body;
  if (!title || !priority || !due_date || !status) return res.status(400).json({ error: 'Missing required fields' });
  const stmt = db.prepare('UPDATE tasks SET title=@title, description=@description, priority=@priority, due_date=@due_date, status=@status WHERE id=@id');
  const info = stmt.run({ id, title, description: description || '', priority, due_date, status });
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(serialize(row));
});

// Update status only
app.patch('/api/tasks/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Missing status' });
  const info = db.prepare('UPDATE tasks SET status=@status WHERE id=@id').run({ id, status });
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(serialize(row));
});

// Delete
app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
