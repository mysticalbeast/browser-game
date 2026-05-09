const API_URL = "https://dashboard.render.com/web/srv-d7vlp8jeo5us73es5fi0"

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
	  setDisplayedPlayerName(data.user.username);

      await loadCloudSaveAfterLogin(data.user.id);

      document.getElementById("authScreen").style.display = "none";
	  window.gamePausedForAuth = false;

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

async function loadCloudSaveAfterLogin(userId) {
  try {
    const response = await fetch(`${API_URL}/save/${userId}`);
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

  window.gamePausedForAuth = false;

  setDisplayedPlayerName(savedUser.username);

  document.getElementById("authScreen").style.display = "none";
  window.gamePausedForAuth = false;
}
}

window.addEventListener("load", bindAuthUI);