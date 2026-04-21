const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyslm1SDCXHokwpbp0MH9n96YQSrt8sefuVdp4AH7hOVtQP9jfhLgm1lhXTFcyrCtl9/exec";

let popupTimer = null;
let countdown = 30;
let popupActive = false;

let trackingInterval = null;
let userData = null;
let lastActivityTime = Date.now();
let loginTime = null;
let timerInterval = null;

const TIME_LIMIT = 10 * 1000; // 30 mins

// ─── HELPER: Get location as a Promise ───────────────────────────────────────
// Returns { lat, lon, address } on success.
// Returns null if user denies or location is unavailable.
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      alert("Your browser does not support location access. Please use a modern browser.");
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async function (position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const geo = await res.json();
          resolve({ lat, lon, address: geo.display_name });
        } catch (e) {
          // Reverse geocoding failed, still resolve with coordinates
          resolve({ lat, lon, address: `${lat.toFixed(5)}, ${lon.toFixed(5)}` });
        }
      },
      function (error) {
        // ── Error callback: runs when user denies or location fails ──
        if (error.code === error.PERMISSION_DENIED) {
          alert(
            "📍 Location access was denied.\n\n" +
            "This application requires your location to record check-in/check-out.\n\n" +
            "Please allow location access in your browser settings and try again."
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          alert("📍 Location information is unavailable. Please check your device's location/GPS settings and try again.");
        } else if (error.code === error.TIMEOUT) {
          alert("📍 Location request timed out. Please try again.");
        } else {
          alert("📍 An unknown location error occurred. Please try again.");
        }
        resolve(null); // Don't crash — just return null
      },
      { timeout: 15000 } // 15 second timeout
    );
  });
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function login() {
  const empId = document.getElementById("empId").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!empId || !password) {
    alert("Please fill both fields ⚠️");
    return;
  }

  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  loginBtn.disabled = true;
  loginBtn.innerText = "Getting location...";
  logoutBtn.disabled = true;

  // Step 1: Get location first
  const location = await getLocation();

  if (!location) {
    // User denied or error — reset button and stop
    loginBtn.disabled = false;
    loginBtn.innerText = "Check-In";
    return;
  }

  loginBtn.innerText = "Processing...";

  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({
        empId: empId,
        password: password,
        action: "LOGIN",
        latitude: location.lat,
        longitude: location.lon,
        address: location.address
      })
    });

    const result = JSON.parse(await response.text());

    if (result.status === "INVALID") {
      alert("Invalid credentials ❌");
      loginBtn.disabled = false;
      loginBtn.innerText = "Check-In";
      return;
    }

    userData = {
      empId,
      password,
      name: result.name,
      email: result.email,
      // Store check-in location (used as fallback for logout)
      latitude: location.lat,
      longitude: location.lon,
      address: location.address
    };

    document.querySelector(".guide-floating").style.display = "none";
    document.getElementById("pageTitle").style.display = "none";
    document.getElementById("loginDiv").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    document.getElementById("message").innerHTML =
      `👋 <b>Welcome, ${userData.name}</b><br>
       <span style="color:#e67e22;">⚠️ 30 mins inactivity → auto logout</span>`;

    document.getElementById("userDetails").innerHTML = `
      <div class="info-row"><span>🆔</span><b>Employee ID</b><p>${userData.empId}</p></div>
      <div class="info-row"><span>👤</span><b>Name</b><p>${userData.name}</p></div>
      <div class="info-row"><span>📧</span><b>Email</b><p>${userData.email}</p></div>
      <div class="info-row"><span>📍</span><b>Check-In Location</b><p>${userData.address}</p></div>
    `;

    loginBtn.innerText = "Check-In";
    logoutBtn.innerText = "Check-Out";
    logoutBtn.disabled = false;

    loginTime = Date.now();
    lastActivityTime = Date.now();

    startTimer();
    startTracking();

  } catch (err) {
    alert("Network error occurred. Please try again.");
    loginBtn.disabled = false;
    loginBtn.innerText = "Check-In";
  }
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    const diff = Date.now() - loginTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    document.getElementById("timer").innerText =
      `Active Time: ${minutes} min ${seconds} sec`;
  }, 1000);
}

// ─── ACTIVITY TRACKING ───────────────────────────────────────────────────────
function updateActivity() {
  lastActivityTime = Date.now();
}
document.addEventListener("mousemove", updateActivity);
document.addEventListener("keydown", updateActivity);
document.addEventListener("click", updateActivity);
document.addEventListener("visibilitychange", function() {
  if (document.visibilityState === "visible") {
    updateActivity(); // resets lastActivityTime when tab becomes active
  }
});

function startTracking() {
  trackingInterval = setInterval(() => {
    if (!userData) return;
    const now = Date.now();
    if (!popupActive && now - lastActivityTime > TIME_LIMIT) {
      showPopup();
    }
  }, 5000);
}

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
async function logout() {
  clearInterval(timerInterval);
  clearInterval(trackingInterval);

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.disabled = true;
  logoutBtn.innerText = "Getting location...";

  // Step 1: Try to get CURRENT location at checkout time
  const location = await getLocation();

  // Step 2: If denied, fall back to check-in location
  // (we still log out — we just use the saved location)
  const checkoutLat     = location ? location.lat     : userData.latitude;
  const checkoutLon     = location ? location.lon     : userData.longitude;
  const checkoutAddress = location ? location.address : userData.address;

  logoutBtn.innerText = "Processing...";

  try {
    await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({
        empId: userData.empId,
        password: userData.password,
        action: "LOGOUT",
        latitude: checkoutLat,
        longitude: checkoutLon,
        address: checkoutAddress
      })
    });
  } catch (e) {
    console.log("Logout error:", e);
  }

  // Reset everything
  userData = null;

  document.querySelector(".guide-floating").style.display = "block";
  document.getElementById("dashboard").style.display = "none";
  document.getElementById("loginDiv").style.display = "block";
  document.getElementById("pageTitle").style.display = "block";

  document.getElementById("empId").value = "";
  document.getElementById("password").value = "";
  document.getElementById("timer").innerText = "";
  document.getElementById("message").innerText = "";

  document.getElementById("loginBtn").disabled = false;
  document.getElementById("loginBtn").innerText = "Check-In";

  logoutBtn.innerText = "Check-Out";
  logoutBtn.disabled = true;
}

// ─── POPUP ────────────────────────────────────────────────────────────────────
function showPopup() {
  clearInterval(popupTimer);

  popupActive = true;
  countdown = 30;

  document.getElementById("countdown").innerText = countdown;
  document.getElementById("overlay").style.display = "block";
  document.getElementById("popup").style.display = "block";

  popupTimer = setInterval(() => {
    
    countdown--;
        if (countdown <= 10) {
  speakNumber(countdown);
}
    document.getElementById("countdown").innerText = countdown;

    if (countdown <= 0) {
      clearInterval(popupTimer);
      document.getElementById("overlay").style.display = "none";
      document.getElementById("popup").style.display = "none";
      popupActive = false;
      logout();
    }
  }, 1000);
}

function stayActive() {
  clearInterval(popupTimer);
  popupActive = false;
  lastActivityTime = Date.now();
  document.getElementById("overlay").style.display = "none";
  document.getElementById("popup").style.display = "none";
}

function openGuide() {
  window.open("UserGuide_ProgressMonitor.pdf", "_blank");
}

function speakNumber(num) {
  // Stop any previous speech immediately
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(String(num));
  utterance.volume = 1;
  utterance.rate = 1.5; // slightly faster

  window.speechSynthesis.speak(utterance);
}
