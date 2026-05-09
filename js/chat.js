let lastChatMessageId = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setGlobalChatStatus(message, className = "") {
  const el = document.getElementById("globalChatStatus");
  if (!el) return;

  el.className = className;
  el.textContent = message;

  clearTimeout(window.globalChatStatusTimer);

  if (message) {
    window.globalChatStatusTimer = setTimeout(() => {
      el.textContent = "";
      el.className = "";
    }, 2500);
  }
}

async function fetchGlobalChat() {
  const box = document.getElementById("globalChatMessages");
  if (!box) return;

  try {
    const response = await fetch(`${API_URL}/chat`);
    const data = await response.json();

    if (!data.success || !Array.isArray(data.messages)) return;

    const newestId = data.messages[data.messages.length - 1]?.id || null;

    if (newestId === lastChatMessageId) return;

    lastChatMessageId = newestId;

    box.innerHTML = data.messages.map(msg => `
  <div class="chatMessage">
    <span class="chatTime">[${formatChatTime(msg.createdAt)}]</span>
    <span class="chatUser">${escapeHtml(msg.username)}:</span>
    <span class="chatText">${escapeHtml(msg.text)}</span>
  </div>
`).join("");

    box.scrollTop = box.scrollHeight;
  } catch (error) {
    console.warn("Failed to fetch global chat:", error);
  }
}

function initializeGlobalChatMinimize() {
  const button = document.getElementById("globalChatMinimizeBtn");
  const box = document.getElementById("globalChatBox");

  if (!button || !box) return;

  button.onclick = () => {
    const minimized = box.classList.toggle("minimized");

    button.textContent = minimized ? "+" : "—";
  };
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function sendGlobalChatMessage() {
  const input = document.getElementById("globalChatInput");
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const token = getAuthToken?.();

  if (!token) {
    console.warn("Cannot send chat message: missing auth token.");
    return;
  }

  input.value = "";

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    const data = await response.json();

    if (!data.success) {
  setGlobalChatStatus(data.message || data.error || "Message failed.", "error");
  return;
}

    fetchGlobalChat();
  } catch (error) {
  console.warn("Failed to send chat message:", error);
  setGlobalChatStatus("Could not send message.", "error");
}
}

function bindGlobalChat() {
  const input = document.getElementById("globalChatInput");
  const button = document.getElementById("globalChatSendBtn");

  if (button) {
    button.onclick = sendGlobalChatMessage;
  }

  if (input) {
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendGlobalChatMessage();
      }
    });
  }

  fetchGlobalChat();

  setInterval(() => {
    if (window.gamePausedForAuth) return;
    fetchGlobalChat();
  }, 3000);
}

window.addEventListener("load", () => {
  bindGlobalChat();
  initializeGlobalChatMinimize();
});