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

function formatDateISO(d){
  try{ const dt = new Date(d); return dt.toLocaleDateString(); }catch(e){ return d; }
}

function priorityClass(p){
  if (p === 'Low') return 'bg-success text-white';
  if (p === 'Medium') return 'bg-warning text-dark';
  if (p === 'High') return 'bg-danger text-white';
  return 'bg-secondary text-white';
}

function statusClass(s){
  if (s === 'Pending') return 'bg-secondary text-white';
  if (s === 'In Progress') return 'bg-info text-dark';
  if (s === 'Completed') return 'bg-success text-white';
  return 'bg-secondary text-white';
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
  const empty = $('#empty-state');
  if (!tasks.length) { container.innerHTML = '<p class="text-muted">No tasks yet. Use the form to add one.</p>'; empty.classList.remove('d-none'); updateCounts([], true); return; }
  empty.classList.add('d-none');
  const rows = tasks.map(t => `
    <div class="card mb-3 task-card">
      <div class="card-body">
        <div class="d-flex w-100 justify-content-between align-items-start">
          <div>
            <h5 class="mb-1">${escapeHtml(t.title)}</h5>
            <div class="mb-2 small text-muted">Due: ${escapeHtml(formatDateISO(t.due_date))}</div>
          </div>
          <div class="text-end">
            <span class="badge ${priorityClass(t.priority)} me-1">${escapeHtml(t.priority)}</span>
            <span class="badge ${statusClass(t.status)}">${escapeHtml(t.status)}</span>
          </div>
        </div>
        <p class="mt-2 mb-2">${escapeHtml(t.description || '')}</p>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${t.id}"><i class="bi bi-pencil"></i> Edit</button>
          <button class="btn btn-sm btn-outline-success" data-action="status" data-id="${t.id}" data-status="${t.status}"><i class="bi bi-arrow-repeat"></i> Status</button>
          <button class="btn btn-sm btn-outline-danger ms-auto" data-action="delete" data-id="${t.id}"><i class="bi bi-trash"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
  container.innerHTML = rows;
  updateCounts(tasks);
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

function updateCounts(tasks, empty=false){
  const all = empty ? 0 : tasks.length;
  const pending = empty ? 0 : tasks.filter(t=>t.status==='Pending').length;
  const progress = empty ? 0 : tasks.filter(t=>t.status==='In Progress').length;
  const completed = empty ? 0 : tasks.filter(t=>t.status==='Completed').length;
  $('#count-all').textContent = `All: ${all}`;
  $('#count-pending').textContent = `Pending: ${pending}`;
  $('#count-progress').textContent = `In Progress: ${progress}`;
  $('#count-completed').textContent = `Completed: ${completed}`;
}

function showToast(message, kind='info'){
  let toastEl = document.getElementById('ui-toast');
  if(!toastEl){
    toastEl = document.createElement('div'); toastEl.id='ui-toast'; toastEl.className='toast align-items-center text-bg-primary position-fixed bottom-0 end-0 m-4';
    toastEl.role='alert'; toastEl.ariaLive='assertive'; toastEl.ariaAtomic='true';
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    document.body.appendChild(toastEl);
  } else { toastEl.querySelector('.toast-body').textContent = message; }
  const t = new bootstrap.Toast(toastEl, { delay: 2500 }); t.show();
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
  // validation
  if (!payload.title || !payload.priority || !payload.due_date) { alert('Please fill required fields'); return; }
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(payload.due_date);
  if (due < today) { if(!confirm('Due date is in the past. Continue?')) return; }
  try{
    if (id) {
      await api.update(id, payload);
      showToast('Task updated');
    } else {
      await api.create(payload);
      showToast('Task added');
    }
    resetForm();
    loadTasks();
  }catch(err){ console.error(err); alert('Error saving task'); }
});

// Modal instances
let statusModal, deleteModal;
document.addEventListener('DOMContentLoaded', ()=>{
  statusModal = new bootstrap.Modal(document.getElementById('statusModal'));
  deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
});

document.addEventListener('click', async (e)=>{
  const btn = e.target.closest('button'); if(!btn) return;
  const action = btn.getAttribute('data-action'); const id = btn.getAttribute('data-id');
  if (action === 'delete'){
    $('#delete-task-id').value = id;
    deleteModal.show();
  } else if (action === 'edit'){
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
    $('#modal-task-id').value = id;
    const current = btn.getAttribute('data-status') || 'Pending';
    $('#modal-status').value = current;
    statusModal.show();
  }
});

document.getElementById('modal-save-status').addEventListener('click', async ()=>{
  const id = $('#modal-task-id').value; const status = $('#modal-status').value;
  try{ await api.patchStatus(id, status); statusModal.hide(); loadTasks(); }catch(e){ alert('Failed to update status'); }
});

document.getElementById('modal-confirm-delete').addEventListener('click', async ()=>{
  const id = $('#delete-task-id').value;
  try{ await api.delete(id); deleteModal.hide(); loadTasks(); }catch(e){ alert('Failed to delete'); }
});

$('#reset-btn').addEventListener('click', resetForm);
$('#filter-priority').addEventListener('change', loadTasks);
$('#filter-status').addEventListener('change', loadTasks);
$('#clear-filters').addEventListener('click', ()=>{ $('#filter-priority').value=''; $('#filter-status').value=''; loadTasks(); });

loadTasks();
