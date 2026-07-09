// داخل WardComponent.js – أضف هذه الدالة

// ─── عند تغيير حالة المريض إلى "حرج" ───
changeStatus(id) {
  const state = stateManager.get();
  const p = state.patients.find(pt => pt.id === id);
  if (!p) return;
  const newStatus = prompt('اختر الحالة (stable, monitoring, critical, intervention):', p.patientStatus || 'stable');
  if (newStatus && ['stable','monitoring','critical','intervention'].includes(newStatus)) {
    p.patientStatus = newStatus;
    p.updatedAt = Date.now();
    addAuditLog('تغيير حالة المريض', `تم تغيير حالة ${p.name} إلى ${newStatus}`);
    stateManager.save();
    bus.emit('render');
    showToast('✅ تم تحديث حالة المريض', 'success');
    
    // 🔥 تنبيه إذا كانت الحالة "حرج"
    if (newStatus === 'critical') {
      showToast(`🚨 تنبيه: ${p.name} بحالة حرجة!`, 'error', 8000);
      // إرسال تنبيه عبر EventBus للمكونات الأخرى
      bus.emit('patientCritical', { patientId: p.id, name: p.name });
    }
  }
}