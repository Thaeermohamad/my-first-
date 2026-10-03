// ============================================
// الإعدادات الافتراضية
// ============================================
const DEFAULT_DEVICES = [
  { id: 'd1', name: 'الغرفة',   icon: '💡', mode: 'always',    duration: 300, state: false },
  { id: 'd2', name: 'الصالة',   icon: '💡', mode: 'always',    duration: 300, state: false },
  { id: 'd3', name: 'المطبخ',   icon: '💡', mode: 'always',    duration: 300, state: false },
  { id: 'd4', name: 'الحمام',   icon: '🚿', mode: 'always',    duration: 300, state: false },
  { id: 'd5', name: 'الحديقة',  icon: '🌿', mode: 'always',    duration: 300, state: false },
  { id: 'd6', name: 'المدخل',   icon: '🚪', mode: 'always',    duration: 300, state: false },
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
const activeTimers = {};   // مؤقتات العد التنازلي
const flashIntervals = {}; // مؤقتات الفلاش
const flashStopTimeouts = {}; // مؤقتات توقف الفلاش

// ============================================
// رسم الأجهزة
// ============================================
function renderDevices() {
  const container = document.getElementById('devices');
  container.innerHTML = devices.map(d => `
    <div class="device-card ${d.state ? 'active' : ''} ${d.isFlashing ? 'flashing' : ''}" id="card-${d.id}">
      <div class="device-header">
        <div class="device-name">
          <span class="icon">${d.icon}</span>
          <span>${d.name}</span>
        </div>
        <button class="settings-btn" onclick="openSettings('${d.id}')">⚙️</button>
      </div>
      <div class="device-mode">
        الوضع: <span class="mode-badge">${modeLabel(d.mode)}</span>
        ${d.mode === 'timer' ? ` — ${formatDuration(d.duration)}` : ''}
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

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

  // إذا كان يفلش حالياً → أوقفه (سيناريو B: يومض أسرع 3 ثوان ثم يتوقف)
  if (device.isFlashing) {
    stopFlashing(id);
    return;
  }

  const newState = !device.state;

  // نظّف كل المؤقتات السابقة لهذا الجهاز
  clearDeviceTimers(id);
  device.countdownText = '';

  device.state = newState;

  switch (device.mode) {
    case 'always':
      // لا شي إضافي
      break;

    case 'momentary':
      if (newState) {
        // شغّل ثانية ثم أطفئ
        activeTimers[id] = setTimeout(() => {
          device.state = false;
          delete activeTimers[id];
          renderDevices();
          saveData('devices', devices);
        }, 1000);
      }
      break;

    case 'timer':
      if (newState) {
        startCountdown(id, device.duration);
      }
      break;

    case 'flash':
      if (newState) {
        startFlashing(id);
      }
      break;
  }

  renderDevices();
  saveData('devices', devices);
}

// ============================================
// تنظيف مؤقتات الجهاز
// ============================================
function clearDeviceTimers(id) {
  if (activeTimers[id]) {
    clearTimeout(activeTimers[id]);
    delete activeTimers[id];
  }
  if (flashIntervals[id]) {
    clearInterval(flashIntervals[id]);
    delete flashIntervals[id];
  }
  if (flashStopTimeouts[id]) {
    clearTimeout(flashStopTimeouts[id]);
    delete flashStopTimeouts[id];
  }
  const device = devices.find(d => d.id === id);
  if (device) device.isFlashing = false;
}

// ============================================
// ⏱️ العد التنازلي للمؤقت
// ============================================
function startCountdown(id, totalSeconds) {
  const device = devices.find(d => d.id === id);
  let remaining = totalSeconds;

  const tick = () => {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    device.countdownText = `⏱️ متبقي: ${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    renderDevices();

    if (remaining <= 0) {
      device.state = false;
      device.countdownText = '';
      delete activeTimers[id];
      renderDevices();
      saveData('devices', devices);
      return;
    }

    remaining--;
    activeTimers[id] = setTimeout(tick, 1000);
  };

  tick();
}

// ============================================
// ⚡ الفلاش الدائم
// ============================================
function startFlashing(id) {
  const device = devices.find(d => d.id === id);
  device.isFlashing = true;
  let speed = 500; // يبدأ بـ 500ms

  const doFlash = () => {
    device.state = !device.state;
    renderDevices();

    // كل دورة، نسرّع شوي (سيناريو B عند الإيقاف)
    if (speed > 80) speed -= 20;

    flashIntervals[id] = setTimeout(doFlash, speed);
  };

  doFlash();
  renderDevices();
}

// توقف الفلاش — سيناريو B: يومض أسرع 3 ثوان ثم يتوقف
function stopFlashing(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  // نوقف المؤقت الحالي
  if (flashIntervals[id]) {
    clearTimeout(flashIntervals[id]);
    delete flashIntervals[id];
  }

  device.isFlashing = false;

  // نبدأ "النهاية السريعة" — يومض بسرعة متزايدة 3 ثوان
  let speed = 250;
  let elapsed = 0;
  const total = 3000;

  const quickFlash = () => {
    device.state = !device.state;
    renderDevices();

    elapsed += speed;
    speed = Math.max(40, speed - 25); // يسرّع أكثر وأكثر

    if (elapsed >= total) {
      device.state = false;
      delete flashStopTimeouts[id];
      renderDevices();
      saveData('devices', devices);
      return;
    }

    flashStopTimeouts[id] = setTimeout(quickFlash, speed);
  };

  quickFlash();
  saveData('devices', devices);
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

  // فك المدة إلى س/د/ث
  const h = Math.floor(device.duration / 3600);
  const m = Math.floor((device.duration % 3600) / 60);
  const s = device.duration % 60;
  document.getElementById('duration-h').value = h;
  document.getElementById('duration-m').value = m;
  document.getElementById('duration-s').value = s;

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

function saveSettings() {
  if (!currentEditId) return;
  const device = devices.find(d => d.id === currentEditId);
  if (!device) return;

  const newName = document.getElementById('setting-name').value.trim() || device.name;
  const newMode = document.querySelector('input[name="mode"]:checked').value;

  const h = parseInt(document.getElementById('duration-h').value) || 0;
  const m = parseInt(document.getElementById('duration-m').value) || 0;
  const s = parseInt(document.getElementById('duration-s').value) || 0;
  const totalSeconds = (h * 3600) + (m * 60) + s;

  device.name = newName;
  device.mode = newMode;
  if (totalSeconds > 0) device.duration = totalSeconds;

  // نظّف المؤقتات القديمة
  clearDeviceTimers(device.id);

  saveData('devices', devices);
  renderDevices();
  closeSettings();
}

// راقب تغيير الأوضاع
document.addEventListener('change', (e) => {
  if (e.target.name === 'mode') updateDurationVisibility();
});

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
