const API_URL = "https://browser-game-du31.onrender.com";

function getAuthToken() {
  return localStorage.getItem("authToken");
}

window.gamePausedForAuth = true;

async function authRequest(endpoint) {
  const username = document.getElementById("authUsername").value.trim();
  const password = document.getElementById("authPassword").value;

  const messageEl = document.getElementById("authMessage");

  messageEl.textContent = "Loading...";

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      messageEl.textContent = data.error || "Request failed.";
      return;
    }

    messageEl.textContent = data.message;

    if (endpoint === "/auth/login") {
      localStorage.setItem("loggedInUser", JSON.stringify(data.user));
	  localStorage.setItem("authToken", data.token);
	  setDisplayedPlayerName(data.user.username);

      await loadCloudSaveAfterLogin(data.user.id);

      document.getElementById("authScreen").style.display = "none";
	  window.gamePausedForAuth = false;
	  sendOnlineHeartbeat?.();
	  updateOnlinePlayersUI?.();
	  setCloudSaveStatus?.("Ready", "saved");

      updateUI?.();
      renderEquipmentSlots?.();
      renderDepotPanel?.();
      renderFishingPanel?.(state.activeFishingTab || "rod");
    }
  } catch (error) {
    console.error(error);
    messageEl.textContent = "Server connection failed.";
  }
}

async function sendOnlineHeartbeat() {
  const token = getAuthToken?.();
  if (!token || window.gamePausedForAuth) return;

  try {
    await fetch(`${API_URL}/online/heartbeat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
  } catch (error) {
    console.warn("Online heartbeat failed:", error);
  }
}

async function loadCloudSaveAfterLogin(userId) {
  try {
    const response = await fetch(`${API_URL}/save/${userId}`, {
  headers: {
    "Authorization": `Bearer ${getAuthToken()}`
  }
});
    const data = await response.json();

    if (!data.success || !data.save?.save) {
      return;
    }

    const cloudSave = data.save.save;

    Object.assign(state, cloudSave);

    if (typeof normalizeLoadedState === "function") {
      normalizeLoadedState();
    }

    localStorage.setItem(SAVE_KEY, JSON.stringify({
      ...state,
      monsters: []
    }));

    console.log("Cloud save loaded.");
  } catch (error) {
    console.warn("Cloud save load failed:", error);
  }
}

function setDisplayedPlayerName(username) {
  const el = document.getElementById("playerName");
  if (el && username) {
    el.textContent = username;
  }
}

function bindAuthUI() {
  document.getElementById("loginBtn").onclick = () => {
    authRequest("/auth/login");
  };

  document.getElementById("registerBtn").onclick = () => {
    authRequest("/auth/register");
  };

  const savedUserRaw = localStorage.getItem("loggedInUser");

if (savedUserRaw) {
  const savedUser = JSON.parse(savedUserRaw);

  setDisplayedPlayerName(savedUser.username);

  window.gamePausedForAuth = false;
  sendOnlineHeartbeat?.();
  updateOnlinePlayersUI?.();
  setCloudSaveStatus?.("Ready", "saved");
} else {
  document.getElementById("authScreen").style.display = "flex";
}
}

window.addEventListener("load", bindAuthUI);