// ============================================
// الإعدادات الافتراضية
// ============================================
const DEFAULT_DEVICES = [
  { id: 'd1', name: 'الغرفة',  icon: '💡', mode: 'always', duration: 300, flashSpeed: 700, state: false },
  { id: 'd2', name: 'الصالة',  icon: '💡', mode: 'always', duration: 300, flashSpeed: 700, state: false },
  { id: 'd3', name: 'المطبخ',  icon: '💡', mode: 'always', duration: 300, flashSpeed: 700, state: false },
  { id: 'd4', name: 'الحمام',  icon: '🚿', mode: 'always', duration: 300, flashSpeed: 700, state: false },
  { id: 'd5', name: 'الحديقة', icon: '🌿', mode: 'always', duration: 300, flashSpeed: 700, state: false },
  { id: 'd6', name: 'المدخل',  icon: '🚪', mode: 'always', duration: 300, flashSpeed: 700, state: false },
];

const DEFAULT_SLIDERS = [
  { id: 's1', name: 'مروحة 1', value: 50 },
  { id: 's2', name: 'مروحة 2', value: 50 },
  { id: 's3', name: 'الإضاءة', value: 80 },
];

const DEFAULT_SENSORS = {
  temperature: 24.5,
  gas: 320,
  tempThreshold: 40,
  gasThreshold: 500,
  soundAlert: false,
};

// ============================================
// التخزين المحلي
// ============================================
function loadData() {
  const devices = JSON.parse(localStorage.getItem('devices')) || DEFAULT_DEVICES;
  const sliders = JSON.parse(localStorage.getItem('sliders')) || DEFAULT_SLIDERS;
  const sensors = JSON.parse(localStorage.getItem('sensors')) || DEFAULT_SENSORS;
  return { devices, sliders, sensors };
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ============================================
// الحالة العامة
// ============================================
let { devices, sliders, sensors } = loadData();
let currentEditId = null;
const activeTimers = {};
const flashIntervals = {};
const flashStopTimeouts = {};

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
// رسم الحساسات
// ============================================
function renderSensors() {
  const tempEl = document.getElementById('temp-display');
  const gasEl = document.getElementById('gas-display');
  const tempCard = document.getElementById('sensor-temp');
  const gasCard = document.getElementById('sensor-gas');

  // عرض الحرارة
  tempEl.textContent = sensors.temperature.toFixed(1);
  if (sensors.temperature >= sensors.tempThreshold) {
    tempEl.classList.add('danger');
    tempCard.classList.add('danger');
  } else {
    tempEl.classList.remove('danger');
    tempCard.classList.remove('danger');
  }

  // عرض الغاز
  gasEl.textContent = sensors.gas.toString().padStart(3, '0');
  if (sensors.gas >= sensors.gasThreshold) {
    gasEl.classList.add('danger');
    gasCard.classList.add('danger');
  } else {
    gasEl.classList.remove('danger');
    gasCard.classList.remove('danger');
  }
}

// تحديث قيم الحساسات (محاكاة - لاحقاً من Firebase)
function updateSensorValues() {
  // 🚧 بيانات وهمية للتجربة
  sensors.temperature = 20 + Math.random() * 25; // 20-45°C
  sensors.gas = Math.floor(100 + Math.random() * 600); // 100-700 ppm
  renderSensors();
}

// ============================================
// التحكم بالأجهزة
// ============================================
function toggleDevice(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  if (device.isFlashing) {
    stopFlashing(id);
    return;
  }

  const newState = !device.state;
  clearDeviceTimers(id);
  device.countdownText = '';
  device.state = newState;

  switch (device.mode) {
    case 'always':
      break;

    case 'momentary':
      if (newState) {
        activeTimers[id] = setTimeout(() => {
          device.state = false;
          delete activeTimers[id];
          renderDevices();
          saveData('devices', devices);
        }, 1000);
      }
      break;

    case 'timer':
      if (newState) startCountdown(id, device.duration);
      break;

    case 'flash':
      if (newState) startFlashing(id);
      break;
  }

  renderDevices();
  saveData('devices', devices);
}

function clearDeviceTimers(id) {
  if (activeTimers[id]) {
    clearTimeout(activeTimers[id]);
    delete activeTimers[id];
  }
  if (flashIntervals[id]) {
    clearTimeout(flashIntervals[id]);
    delete flashIntervals[id];
  }
  if (flashStopTimeouts[id]) {
    clearTimeout(flashStopTimeouts[id]);
    delete flashStopTimeouts[id];
  }
  const device = devices.find(d => d.id === id);
  if (device) device.isFlashing = false;
}

// ⏱️ العد التنازلي
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

// ⚡ الفلاش
function startFlashing(id) {
  const device = devices.find(d => d.id === id);
  device.isFlashing = true;
  const speed = device.flashSpeed || 700;
  let currentSpeed = speed;

  const doFlash = () => {
    device.state = !device.state;
    renderDevices();
    if (currentSpeed > 100) currentSpeed -= 30;
    flashIntervals[id] = setTimeout(doFlash, currentSpeed);
  };

  doFlash();
  renderDevices();
}

// إيقاف الفلاش (سيناريو B)
function stopFlashing(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  if (flashIntervals[id]) {
    clearTimeout(flashIntervals[id]);
    delete flashIntervals[id];
  }

  device.isFlashing = false;

  let speed = 300;
  let elapsed = 0;
  const total = 3000;

  const quickFlash = () => {
    device.state = !device.state;
    renderDevices();
    elapsed += speed;
    speed = Math.max(50, speed - 30);

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
// إعدادات الجهاز
// ============================================
function openSettings(id) {
  const device = devices.find(d => d.id === id);
  if (!device) return;

  currentEditId = id;
  document.getElementById('modal-title').textContent = `⚙️ ${device.name}`;
  document.getElementById('setting-name').value = device.name;

  const h = Math.floor(device.duration / 3600);
  const m = Math.floor((device.duration % 3600) / 60);
  const s = device.duration % 60;
  document.getElementById('duration-h').value = h;
  document.getElementById('duration-m').value = m;
  document.getElementById('duration-s').value = s;

  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.checked = radio.value === device.mode;
  });

  document.querySelectorAll('input[name="flashSpeed"]').forEach(radio => {
    radio.checked = parseInt(radio.value) === (device.flashSpeed || 700);
  });

  updateModeVisibility();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
  currentEditId = null;
}

function updateModeVisibility() {
  const selected = document.querySelector('input[name="mode"]:checked');
  const durationLabel = document.getElementById('duration-label');
  const flashSpeedLabel = document.getElementById('flash-speed-label');

  if (!selected) return;

  durationLabel.classList.toggle('hidden', selected.value !== 'timer');
  flashSpeedLabel.classList.toggle('hidden', selected.value !== 'flash');
}

function saveSettings() {
  if (!currentEditId) return;
  const device = devices.find(d => d.id === currentEditId);
  if (!device) return;

  const newName = document.getElementById('setting-name').value.trim() || device.name;
  const newMode = document.querySelector('input[name="mode"]:checked').value;
  const newFlashSpeed = parseInt(document.querySelector('input[name="flashSpeed"]:checked').value);

  const h = parseInt(document.getElementById('duration-h').value) || 0;
  const m = parseInt(document.getElementById('duration-m').value) || 0;
  const s = parseInt(document.getElementById('duration-s').value) || 0;
  const totalSeconds = (h * 3600) + (m * 60) + s;

  device.name = newName;
  device.mode = newMode;
  device.flashSpeed = newFlashSpeed;
  if (totalSeconds > 0) device.duration = totalSeconds;

  clearDeviceTimers(device.id);

  saveData('devices', devices);
  renderDevices();
  closeSettings();
}

// راقب تغيير الأوضاع
document.addEventListener('change', (e) => {
  if (e.target.name === 'mode') updateModeVisibility();
});

// ============================================
// الإعدادات العامة
// ============================================
function openGeneralSettings() {
  document.getElementById('temp-threshold').value = sensors.tempThreshold;
  document.getElementById('gas-threshold').value = sensors.gasThreshold;
  document.getElementById('sound-alert').checked = sensors.soundAlert;
  document.getElementById('general-modal').classList.remove('hidden');
}

function closeGeneralSettings() {
  document.getElementById('general-modal').classList.add('hidden');
}

function saveGeneralSettings() {
  sensors.tempThreshold = parseInt(document.getElementById('temp-threshold').value) || 40;
  sensors.gasThreshold = parseInt(document.getElementById('gas-threshold').value) || 500;
  sensors.soundAlert = document.getElementById('sound-alert').checked;

  saveData('sensors', sensors);
  renderSensors();
  closeGeneralSettings();
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
renderSensors();

// محاكاة قراءات الحساسات (كل 3 ثوان)
setInterval(updateSensorValues, 3000);
