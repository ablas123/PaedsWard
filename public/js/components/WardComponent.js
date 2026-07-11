// CoreWard - Ward Component (Enhanced)

(function() {
  'use strict';
  
  console.log('[CoreWard] 📦 WardComponent.js loading...');

  class WardComponent {
    constructor() {
      console.log('[CoreWard] 🔧 WardComponent constructor');
      this.container = document.getElementById('appMain');
      if (!this.container) {
        console.error('[CoreWard] ❌ appMain container not found!');
        return;
      }
      this.currentPatientId = null;
      this.bindEvents();
      console.log('[CoreWard] ✅ WardComponent initialized');
    }

    bindEvents() {
      var self = this;
      EventBus.on('stateChanged', function() { self.render(); });
      EventBus.on('search', function(query) { self.handleSearch(query); });
    }

    render() {
      console.log('[CoreWard] 🎨 WardComponent rendering...');
      
      if (!this.container) {
        console.error('[CoreWard] ❌ WardComponent container not found');
        return;
      }

      try {
        var patients = window.stateManager.getPatients();
        var currentUser = window.stateManager.getCurrentUser();
        var filteredPatients = this.filterPatientsByRole(patients, currentUser.role);

        console.log('[CoreWard] 📊 Patients:', filteredPatients.length);

        if (filteredPatients.length === 0) {
          this.container.innerHTML = '<div class="empty-state">' +
            '<div class="empty-state-icon">🛏️</div>' +
            '<div class="empty-state-text">لا توجد مرضى حالياً</div>' +
            (hasPermission(currentUser.role, 'admit_patients') ?
              '<button class="btn btn-primary" onclick="window.app.components.ward.showAdmissionForm()">إضافة مريض جديد</button>' : '') +
            '</div>';
          console.log('[CoreWard] ✅ WardComponent rendered (empty state)');
          return;
        }

        var critical = filteredPatients.filter(function(p) { return p.status === 'critical'; });
        var followup = filteredPatients.filter(function(p) { return p.status === 'followup'; });
        var stable = filteredPatients.filter(function(p) { return p.status === 'stable'; });
        var discharged = filteredPatients.filter(function(p) { return p.status === 'discharged'; });

        var html = '';

        if (critical.length > 0) {
          html += '<h3 class="section-title">🚨 الحالات الحرجة (' + critical.length + ')</h3>';
          html += critical.map(function(p) { return this.renderPatientCard(p); }.bind(this)).join('');
        }

        if (followup.length > 0) {
          html += '<h3 class="section-title">👁️ تحت المراقبة (' + followup.length + ')</h3>';
          html += followup.map(function(p) { return this.renderPatientCard(p); }.bind(this)).join('');
        }

        if (stable.length > 0) {
          html += '<h3 class="section-title">✅ مستقر (' + stable.length + ')</h3>';
          html += stable.map(function(p) { return this.renderPatientCard(p); }.bind(this)).join('');
        }

        if (discharged.length > 0) {
          html += '<h3 class="section-title">📤 تم خروجهم (' + discharged.length + ')</h3>';
          html += discharged.slice(0, 5).map(function(p) { return this.renderPatientCard(p); }.bind(this)).join('');
        }

        this.container.innerHTML = html;
        console.log('[CoreWard] ✅ WardComponent rendered');
      } catch (err) {
        console.error('[CoreWard] ❌ WardComponent render error:', err);
        this.container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">خطأ في عرض البيانات</div></div>';
      }
    }

    filterPatientsByRole(patients, role) {
      if (role === 'intern') {
        var currentUser = window.stateManager.getCurrentUser();
        return patients.filter(function(p) { return p.assignedIntern === currentUser.id; });
      }
      return patients;
    }

    renderPatientCard(patient) {
      var status = PATIENT_STATUS[patient.status] || PATIENT_STATUS.stable;
      var age = patient.age ? patient.age + ' سنة' : '—';
      var bed = patient.bed ? 'سرير ' + patient.bed : '—';
      var vitals = patient.vitals || {};
      var latestVital = vitals.hr ? 'نبض: ' + vitals.hr : '—';

      return '<div class="card clickable ' + status.class + '" onclick="window.app.components.ward.viewPatient(\'' + patient.id + '\')">' +
        '<div class="card-header">' +
        '<div class="card-title">' + escapeHtml(patient.name) + '</div>' +
        '<div class="badge ' + status.class + '">' + status.label + '</div>' +
        '</div>' +
        '<div class="card-body">' +
        '<div>العمر: ' + age + '</div>' +
        '<div>التشخيص: ' + escapeHtml(patient.diagnosis || '—') + '</div>' +
        '<div>السرير: ' + bed + '</div>' +
        '<div>العلامات الحيوية: ' + latestVital + '</div>' +
        '</div>' +
        '<div class="card-footer">' +
        '<div>' + formatDate(patient.createdAt) + '</div>' +
        '<div>' + timeAgo(patient.updatedAt) + '</div>' +
        '</div></div>';
    }

    showAdmissionForm() {
      console.log('[CoreWard] 📝 Showing admission form');
      // TODO: Implement admission form
      window.app.showToast('نموذج الإدخال قيد التطوير', 'info');
    }

    viewPatient(id) {
      console.log('[CoreWard] 👁️ Viewing patient:', id);
      // TODO: Implement patient view
      window.app.showToast('عرض المريض قيد التطوير', 'info');
    }

    closeModal() {
      var container = document.getElementById('modalContainer');
      container.classList.remove('active');
      setTimeout(function() {
        container.innerHTML = '';
        this.currentPatientId = null;
      }.bind(this), 300);
    }

    handleSearch(query) {
      if (!query) return;
      console.log('[CoreWard] 🔍 WardComponent search:', query);
    }
  }

  window.WardComponent = WardComponent;
  console.log('[CoreWard] ✅ WardComponent class registered');
})();