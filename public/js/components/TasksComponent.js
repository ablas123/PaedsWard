// داخل TasksComponent.js – أضف هذه الدالة

// ─── عند إنجاز مهمة متأخرة ───
toggle(id) {
  const state = stateManager.get();
  const t = state.tasks.find(task => task.id === id);
  if (!t) return;
  const wasOverdue = t.dueDate && t.dueDate < today() && !t.done;
  t.done = !t.done;
  t.updatedAt = Date.now();
  stateManager.save();
  stateManager.addToQueue('tasks', 'PATCH', { done: t.done, updatedAt: t.updatedAt }, t.id);
  bus.emit('render');
  
  if (t.done && wasOverdue) {
    showToast(`✅ تم إنجاز مهمة متأخرة: ${t.text}`, 'success', 5000);
  } else if (t.done) {
    showToast('✅ تم إنجاز المهمة', 'success');
  } else {
    showToast('🔄 أعيد فتح المهمة', 'warning');
  }
}