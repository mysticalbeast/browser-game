let lastChatMessageId = null;

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
        <span class="chatUser">${escapeHtml(msg.username)}:</span>
        <span class="chatText">${escapeHtml(msg.text)}</span>
      </div>
    `).join("");

    box.scrollTop = box.scrollHeight;
  } catch (error) {
    console.warn("Failed to fetch global chat:", error);
  }
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
      console.warn("Chat send failed:", data.message || data.error);
      return;
    }

    fetchGlobalChat();
  } catch (error) {
    console.warn("Failed to send chat message:", error);
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

window.addEventListener("load", bindGlobalChat);