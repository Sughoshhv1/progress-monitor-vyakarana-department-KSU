const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz1rYXFcjlRuMupAVY0aKH_gX3Wub2kd7RhEXsMJDZtzbfI-wYAKQT8qHgtwsQmSidS/exec";

let popupTimer = null;
let countdown = 30;
let popupActive = false;

let trackingInterval = null;
let userData = null;
let lastActivityTime = Date.now();
let loginTime = null;
let timerInterval = null;

const TIME_LIMIT =  30 * 60 * 1000; // 30 mins

// LOGIN
async function login() {
const empId = document.getElementById("empId").value.trim();
const password = document.getElementById("password").value.trim();

// ✅ VALIDATION
if (!empId || !password) {
  alert("Please fill both fields ⚠️");
  return;
} 
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  loginBtn.disabled = true;
  loginBtn.innerText = "Processing...";
  logoutBtn.disabled = true;

  try {
    navigator.geolocation.getCurrentPosition(async function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      const geo = await res.json();

      const response = await fetch(WEB_APP_URL, {
        method: "POST",
        body: JSON.stringify({
          empId: empId,
          password: password,
          action: "LOGIN",
          latitude: lat,
          longitude: lon,
          address: geo.display_name
        })
      });

      const result = JSON.parse(await response.text());

      if (result.status === "INVALID") {
        alert("Invalid credentials ❌");
        loginBtn.disabled = false;
        loginBtn.innerText = "Login";
        return;
      }

      userData = {
        empId,
        password,
        name: result.name,
        email: result.email,
        latitude: lat,
        longitude: lon,
        address: geo.display_name
      };

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
    <div class="info-row"><span>📍</span><b>Location</b><p>${userData.address}</p></div>
    `;

      loginBtn.innerText = "Check-In";
      logoutBtn.innerText = "Check-Out";
      logoutBtn.disabled = false;

      loginTime = Date.now();
      lastActivityTime = Date.now();

      startTimer();
      startTracking();
    });
  } catch (err) {
    alert("Error occurred");
    loginBtn.disabled = false;
    loginBtn.innerText = "Check-In";
  }
}

// TIMER
function startTimer() {
  timerInterval = setInterval(() => {
    const diff = Date.now() - loginTime;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    document.getElementById("timer").innerText =
      `Active Time: ${minutes} min ${seconds} sec`;
  }, 1000);
}

// ACTIVITY TRACK
function updateActivity() {
  lastActivityTime = Date.now();
}
document.addEventListener("mousemove", updateActivity);
document.addEventListener("keydown", updateActivity);
document.addEventListener("click", updateActivity);

// TRACKING
function startTracking() {
  trackingInterval = setInterval(() => {
    if (!userData) return;

    const now = Date.now();

    if (!popupActive && now - lastActivityTime > TIME_LIMIT) {
      showPopup();
    }
  }, 5000);
}

// LOGOUT
async function logout() {
  clearInterval(timerInterval);
  clearInterval(trackingInterval);

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.disabled = true;
  logoutBtn.innerText = "Processing...";

  try {
  await fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify({
      empId: userData.empId,
      password: userData.password,
      action: "LOGOUT",
      latitude: userData.latitude,
      longitude: userData.longitude,
      address: userData.address
    })
  });
} catch (e) {
  console.log("Logout error");
}

  userData = null;

  document.getElementById("dashboard").style.display = "none";
  document.getElementById("loginDiv").style.display = "block";
  document.getElementById("pageTitle").style.display = "block";

  document.getElementById("empId").value = "";
  document.getElementById("password").value = "";

  document.getElementById("timer").innerText = "";
  document.getElementById("message").innerText = "";

  document.getElementById("loginBtn").disabled = false;
  document.getElementById("loginBtn").innerText = "Login";

  logoutBtn.innerText = "Check-Out";
  logoutBtn.disabled = true;
}

// POPUP
function showPopup() {
  clearInterval(popupTimer);

  popupActive = true;
  countdown = 30;

  document.getElementById("countdown").innerText = countdown;
  document.getElementById("overlay").style.display = "block";
  document.getElementById("popup").style.display = "block";

  popupTimer = setInterval(() => {
    countdown--;
    document.getElementById("countdown").innerText = countdown;

    if (countdown <= 0) {
      clearInterval(popupTimer);
      document.getElementById("overlay").style.display = "none";
      document.getElementById("popup").style.display = "none";
      popupActive = false;
      logout(true);
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