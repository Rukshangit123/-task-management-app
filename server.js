const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'tasks.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ lastId: 0, tasks: [] }, null, 2));

function readDB(){
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(db){
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

function serialize(task){ return task; }

app.get('/api/tasks', (req, res) => {
  const { status, priority } = req.query;
  const db = readDB();
  let tasks = db.tasks.slice();
  if (status) tasks = tasks.filter(t=>t.status===status);
  if (priority) tasks = tasks.filter(t=>t.priority===priority);
  tasks.sort((a,b)=> a.due_date.localeCompare(b.due_date) || a.id - b.id);
  res.json(tasks.map(serialize));
});

app.post('/api/tasks', (req, res) => {
  const { title, description, priority, due_date } = req.body;
  if (!title || !priority || !due_date) return res.status(400).json({ error: 'Missing required fields' });
  const db = readDB();
  const id = db.lastId + 1;
  const task = { id, title, description: description || '', priority, due_date, status: 'Pending', created_at: new Date().toISOString() };
  db.tasks.push(task);
  db.lastId = id;
  writeDB(db);
  res.status(201).json(serialize(task));
});

app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, description, priority, due_date, status } = req.body;
  if (!title || !priority || !due_date || !status) return res.status(400).json({ error: 'Missing required fields' });
  const db = readDB();
  const idx = db.tasks.findIndex(t=>t.id===id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.tasks[idx] = { ...db.tasks[idx], title, description: description||'', priority, due_date, status };
  writeDB(db);
  res.json(serialize(db.tasks[idx]));
});

app.patch('/api/tasks/:id/status', (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Missing status' });
  const db = readDB();
  const t = db.tasks.find(t=>t.id===id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  t.status = status;
  writeDB(db);
  res.json(serialize(t));
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = readDB();
  const idx = db.tasks.findIndex(t=>t.id===id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.tasks.splice(idx,1);
  writeDB(db);
  res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
