// ============================================
// الإعدادات الافتراضية
// ============================================
const DEFAULT_DEVICES = [
  { id: 'd1', name: 'الغرفة',   icon: '💡', mode: 'always',    duration: 5,  state: false },
  { id: 'd2', name: 'الصالة',   icon: '💡', mode: 'always',    duration: 5,  state: false },
  { id: 'd3', name: 'المطبخ',   icon: '💡', mode: 'always',    duration: 5,  state: false },
  { id: 'd4', name: 'الحمام',   icon: '🚿', mode: 'always',    duration: 5,  state: false },
  { id: 'd5', name: 'الحديقة',  icon: '🌿', mode: 'always',    duration: 5,  state: false },
  { id: 'd6', name: 'المدخل',   icon: '🚪', mode: 'always',    duration: 5,  state: false },
];

const DEFAULT_SLIDERS = [
  { id: 's1', name: 'مروحة 1', value: 50 },
  { id: 's2', name: 'مروحة 2', value: 50 },
  { id: 's3', name: 'الإضاءة', value: 80 },
];

// ============================================
// التخزين المحلي
// ============================================
function loadData() {
  const devices = JSON.parse(localStorage.getItem('devices')) || DEFAULT_DEVICES;
  const sliders = JSON.parse(localStorage.getItem('sliders')) || DEFAULT_SLIDERS;
  return { devices, sliders };
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================
// الحالة العامة
// ============================================
let { devices, sliders } = loadData();
let currentEditId = null;
const timers = {}; // مؤقتات الأنشطة

// ============================================
// رسم الأجهزة
// ============================================
function renderDevices() {
  const container = document.getElementById('devices');
  container.innerHTML = devices.map(d => `
    <div class="device-card ${d.state ? 'active' : ''}" id="card-${d.id}">
      <div class="device-header">
        <div class="device-name">
          <span class="icon">${d.icon}</span>
          <span>${d.name}</span>
        </div>
        <button class="settings-btn" onclick="openSettings('${d.id}')">⚙️</button>
      </div>
      <div class="device-mode">
        الوضع: <span class="mode-badge">${modeLabel(d.mode)}</span>
        ${d.mode === 'timer' ? ` — ${d.duration} دقيقة` : ''}
        ${d.mode === 'flash' ? ' — 5 ثوان' : ''}
      </div>
      <button class="toggle-btn" onclick="toggleDevice('${d.id}')">
        ${d.state ? '⏹️ إطفاء' : '▶️ تشغيل'}
      </button>
      ${d.countdownText ? `<div class="countdown">${d.countdownText}</div>` : ''}
    </div>
  `).join('');
}

function modeLabel(mode) {
  return {
    always: '🕐 دائم',
    momentary: '⏰ لحظي',
    timer: '⏱️ مؤقت',
    flash: '⚡ فلاش',
  }[mode] || mode;
}

// ============================================
// رسم السلايدرات
// ============================================
function renderSliders() {
  const container = document.getElementById('sliders');
  container.innerHTML = sliders.map(s => `
    <div class="slider-item">
      <div class="slider-label">
        <input type="text" value="${s.name}" 
               onchange="renameSlider('${s.id}', this.value)">
        <span class="slider-value" id="val-${s.id}">${s.value}%</span>
      </div>
      <input type="range" min="0" max="100" value="${s.value}"
             oninput="updateSlider('${s.id}', this.value)">
    </div>
  `).join('');
}

// ============================================
// التحكم بالأجهزة
// ============================================
function toggleDevice(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  const newState = !device.state;
  setDeviceState(id, newState);

  // تنظيف أي مؤقت سابق
  if (timers[id]) {
    clearTimeout(timers[id]);
    delete timers[id];
  }
  device.countdownText = '';

  // منطق كل وضع
  switch (device.mode) {
    case 'always':
      // لا شي إضافي
      break;

    case 'momentary':
      // شغّل ثانية ثم أطفئ
      if (newState) {
        setTimeout(() => {
          setDeviceState(id, false);
        }, 1000);
      }
      break;

    case 'timer':
      // شغّل لمدة d.duration دقيقة ثم أطفئ
      if (newState) {
        startCountdown(id, device.duration);
      }
      break;

    case 'flash':
      // وميض 5 ثوان (كل 0.5 ثانية)
      if (newState) {
        startFlash(id);
      }
      break;
  }

  renderDevices();
  saveData('devices', devices);
}

function setDeviceState(id, state) {
  const device = devices.find(d => d.id === id);
  if (device) device.state = state;
}

// ⏱️ العد التنازلي للمؤقت
function startCountdown(id, minutes) {
  const device = devices.find(d => d.id === id);
  let remaining = minutes * 60; // بالثواني

  const tick = () => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    device.countdownText = `⏱️ متبقي: ${m}:${s.toString().padStart(2, '0')}`;
    renderDevices();

    if (remaining <= 0) {
      setDeviceState(id, false);
      device.countdownText = '';
      renderDevices();
      saveData('devices', devices);
      return;
    }

    remaining--;
    timers[id] = setTimeout(tick, 1000);
  };

  tick();
}

// ⚡ الفلاش (5 ثوان - كل 0.5 ثانية)
function startFlash(id) {
  const device = devices.find(d => d.id === id);
  let elapsed = 0;
  const total = 5000; // 5 ثوان
  const interval = 500; // كل 0.5 ثانية

  const flash = setInterval(() => {
    device.state = !device.state;
    renderDevices();
    elapsed += interval;

    if (elapsed >= total) {
      clearInterval(flash);
      device.state = false;
      renderDevices();
      saveData('devices', devices);
    }
  }, interval);

  timers[id] = flash;
}

// ============================================
// السلايدرات
// ============================================
function updateSlider(id, value) {
  const s = sliders.find(s => s.id === id);
  if (!s) return;
  s.value = parseInt(value);
  document.getElementById(`val-${id}`).textContent = `${s.value}%`;
  saveData('sliders', sliders);
}

function renameSlider(id, name) {
  const s = sliders.find(s => s.id === id);
  if (!s) return;
  s.name = name;
  saveData('sliders', sliders);
}

// ============================================
// الإعدادات
// ============================================
function openSettings(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  currentEditId = id;
  document.getElementById('modal-title').textContent = `⚙️ ${device.name}`;
  document.getElementById('setting-name').value = device.name;
  document.getElementById('setting-duration').value = device.duration;

  // اختر الوضع الحالي
  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.checked = radio.value === device.mode;
  });

  updateDurationVisibility();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  currentEditId = null;
}

function updateDurationVisibility() {
  const selected = document.querySelector('input[name="mode"]:checked');
  const label = document.getElementById('duration-label');
  if (selected && selected.value === 'timer') {
    label.classList.remove('hidden');
  } else {
    label.classList.add('hidden');
  }
}

function setDuration(min) {
  document.getElementById('setting-duration').value = min;
}

function saveSettings() {
  if (!currentEditId) return;
  const device = devices.find(d => d.id === currentEditId);
  if (!device) return;

  const newName = document.getElementById('setting-name').value.trim() || device.name;
  const newMode = document.querySelector('input[name="mode"]:checked').value;
  const newDuration = parseInt(document.getElementById('setting-duration').value) || 5;

  device.name = newName;
  device.mode = newMode;
  device.duration = newDuration;

  saveData('devices', devices);
  renderDevices();
  closeSettings();
}

// راقب تغيير الأوضاع لإظهار/إخفاء المدة
document.addEventListener('change', (e) => {
  if (e.target.name === 'mode') updateDurationVisibility();
});

// ============================================
// فحص الاتصال (مؤقت)
// ============================================
function updateConnectionStatus(online) {
  const status = document.getElementById('status-connection');
  if (online) {
    status.textContent = '✅ التطبيق جاهز';
    status.className = 'status online';
  } else {
    status.textContent = '⚠️ غير متصل';
    status.className = 'status offline';
  }
}

// ============================================
// Service Worker
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.log('SW:', err));
  });
}

// ============================================
// التشغيل
// ============================================
renderDevices();
renderSliders();
updateConnectionStatus(true);
