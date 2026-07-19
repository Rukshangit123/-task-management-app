const api = {
  list: (filters) => {
    const params = new URLSearchParams(filters || {});
    return fetch('/api/tasks?' + params.toString()).then(r=>r.json());
  },
  create: (task) => fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(task)}).then(r=>r.json()),
  update: (id, task) => fetch('/api/tasks/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(task)}).then(r=>r.json()),
  patchStatus: (id, status) => fetch('/api/tasks/'+id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}).then(r=>r.json()),
  delete: (id) => fetch('/api/tasks/'+id,{method:'DELETE'})
}

const $ = sel => document.querySelector(sel);

function formatDate(d){
  return d;
}

async function loadTasks(){
  const filters = {};
  const fp = $('#filter-priority').value;
  const fs = $('#filter-status').value;
  if (fp) filters.priority = fp;
  if (fs) filters.status = fs;
  const tasks = await api.list(filters);
  renderTasks(tasks);
}

function renderTasks(tasks){
  const container = $('#tasks-list');
  if (!tasks.length) { container.innerHTML = '<p class="text-muted">No tasks yet.</p>'; return; }
  const rows = tasks.map(t => `
    <div class="card mb-2">
      <div class="card-body">
        <div class="d-flex w-100 justify-content-between">
          <h5>${escapeHtml(t.title)}</h5>
          <small class="text-muted">Due: ${escapeHtml(t.due_date)}</small>
        </div>
        <p class="mb-1">${escapeHtml(t.description || '')}</p>
        <div class="d-flex gap-2">
          <span class="badge bg-info text-dark">${escapeHtml(t.priority)}</span>
          <span class="badge bg-secondary">${escapeHtml(t.status)}</span>
        </div>
        <div class="mt-2">
          <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="btn btn-sm btn-outline-success me-1" data-action="status" data-id="${t.id}">Change Status</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${t.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  container.innerHTML = rows;
}

function escapeHtml(s){ return (s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function resetForm(){
  $('#task-id').value='';
  $('#title').value='';
  $('#description').value='';
  $('#priority').value='';
  $('#due_date').value='';
  $('#status').value='Pending';
  $('#submit-btn').textContent = 'Add Task';
}

document.addEventListener('submit', async (e)=>{
  if (e.target.id !== 'task-form') return;
  e.preventDefault();
  const id = $('#task-id').value;
  const payload = {
    title: $('#title').value.trim(),
    description: $('#description').value.trim(),
    priority: $('#priority').value,
    due_date: $('#due_date').value,
    status: $('#status').value
  };
  // basic validation
  if (!payload.title || !payload.priority || !payload.due_date) { alert('Please fill required fields'); return; }
  try{
    if (id) {
      await api.update(id, payload);
    } else {
      await api.create(payload);
    }
    resetForm();
    loadTasks();
  }catch(err){ console.error(err); alert('Error saving task'); }
});

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const action = btn.getAttribute('data-action'); const id = btn.getAttribute('data-id');
  if (action === 'delete'){
    if (!confirm('Delete this task?')) return; await api.delete(id); loadTasks();
  } else if (action === 'edit'){
    // load task and populate
    const tasks = await api.list(); const t = tasks.find(x=>String(x.id)===String(id)); if(!t) return; 
    $('#task-id').value = t.id;
    $('#title').value = t.title;
    $('#description').value = t.description;
    $('#priority').value = t.priority;
    $('#due_date').value = t.due_date;
    $('#status').value = t.status;
    $('#submit-btn').textContent = 'Save Changes';
    window.scrollTo({top:0,behavior:'smooth'});
  } else if (action === 'status'){
    const newStatus = prompt('Enter new status (Pending, In Progress, Completed):');
    if (!newStatus) return; await api.patchStatus(id, newStatus); loadTasks();
  }
});

$('#reset-btn').addEventListener('click', resetForm);
$('#filter-priority').addEventListener('change', loadTasks);
$('#filter-status').addEventListener('change', loadTasks);
$('#clear-filters').addEventListener('click', ()=>{ $('#filter-priority').value=''; $('#filter-status').value=''; loadTasks(); });

loadTasks();
