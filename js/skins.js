function getSkinShards() {
  initializeSkins();
  return state.skins.shards || 0;
}

function addSkinShards(amount) {
  initializeSkins();

  const gained = Math.max(0, Math.floor(amount));
  if (gained <= 0) return;

  state.skins.shards = (state.skins.shards || 0) + gained;

  showFilterNotification(
    "system",
    `🎨 +${fmt(gained)} Skin Shards.`
  );

  if (document.getElementById("skinsPanel")?.style.display === "block") {
    renderSkinsPanel(state.activeSkinsTab || "select");
  }

  updateUI();
  saveGame();
}

function unlockSkin(skinKey) {
  initializeSkins();

  const skin = getSkinDef(skinKey);
  if (!skin) return;

  const data = getSkinState(skinKey);
  if (!data) return;

  if (data.unlocked) {
    showFilterNotification("system", `${skin.icon} ${skin.name} is already unlocked.`);
    return;
  }

  const cost = skin.unlockCost || 0;

  if ((state.skins.shards || 0) < cost) {
    showFilterNotification(
      "system",
      `Not enough Skin Shards. Need ${fmt(cost)}.`
    );
    return;
  }

  state.skins.shards -= cost;
  data.unlocked = true;

  showFilterNotification(
    "system",
    `${skin.icon} ${skin.name} unlocked.`
  );

  renderSkinsPanel("select");
  updateUI();
  saveGame();
}


function renderSkinsPanel(tab = "select") {
  initializeSkins();
  state.activeSkinsTab = tab;

  const panel = document.getElementById("skinsPanel");
  if (!panel) return;

  const skins = SKINS.minotaur;
  const activeSkin = getActiveSkinKey("minotaur");

  panel.innerHTML = `
    <div class="rebirthHero ready">
      <div class="rebirthHeroTop">
        <div>
          <div class="rebirthTitle">🎨 Summon Skins</div>
          <div class="rebirthSub">
            Select and level specialized skins for your summons.
          </div>
        </div>

        <div class="rebirthCoinBox">
          <div class="rebirthCoinAmount">${fmt(getSkinShards())}</div>
          <div class="rebirthCoinLabel">Skin Shards</div>
        </div>
      </div>
    </div>

    <div class="starTabs">
  <button
    class="starTab ${tab === "select" ? "active" : ""}"
    onclick="renderSkinsPanel('select')"
  >
    Select Skin
  </button>

  <button
    class="starTab ${tab === "leveling" ? "active" : ""}"
    onclick="renderSkinsPanel('leveling')"
  >
    Leveling
  </button>
</div>

    <div class="starSection">
      <div class="starSectionTitle">
        ${tab === "select" ? "Minotaur Skins" : "Skin Progress"}
      </div>

      <div class="uiGrid">
        ${
          tab === "select"
            ? renderSkinSelectTab(skins, activeSkin)
            : renderSkinLevelingTab(skins)
        }
      </div>
    </div>
  `;
}

function ascendSkin(skinKey) {
  initializeSkins();

  const skin = getSkinDef(skinKey);
  const data = getSkinState(skinKey);

  if (!skin || !data) return;

  if (!data.unlocked) {
    showFilterNotification("system", "Skin is not unlocked.");
    return;
  }

  if (data.level < skin.maxLevel) {
    showFilterNotification(
      "system",
      `${skin.name} must be level ${skin.maxLevel} before it can ascend.`
    );
    return;
  }

  if (data.ascended) {
    showFilterNotification("system", `${skin.name} is already ascended.`);
    return;
  }

  if ((getInventoryAmount?.("skinAscender") || 0) <= 0) {
    showFilterNotification("system", "You need a Skin Ascender.");
    return;
  }

  removeInventoryItem?.("skinAscender", 1);

  data.ascended = true;

  showFilterNotification(
    "system",
    `🔮 ${skin.name} has ascended!`
  );

  renderSkinsPanel?.(state.activeSkinsTab || "leveling");
  renderBackpack?.();
  updateUI();
  saveGame();
}

function renderSkinSelectTab(skins, activeSkin) {
  return skins.map(skin => {
    const data = getSkinState(skin.key);
    const unlocked = data?.unlocked === true;
    const level = data?.level || 0;
    const cost = skin.unlockCost || 0;
    const affordable = getSkinShards() >= cost;

    return `
      <div class="uiListCard ${activeSkin === skin.key ? "active" : ""}">
        <div class="uiListCardInner">

          <div class="uiListIcon">
            ${skin.icon}
          </div>

          <div class="uiListText">
            <div class="uiListTitle">
              ${skin.name}
            </div>

            <div class="uiListSub">
              ${skin.desc}
            </div>

            <div class="uiListSub">
              Level ${level}/${skin.maxLevel}
            </div>

            <div class="uiListSub">
              ${skin.bonusText(level)}
            </div>

            ${
              !unlocked
                ? `
                  <div class="uiListSub">
                    Unlock cost: ${fmt(cost)} Skin Shards
                  </div>
                `
                : ""
            }
          </div>

          <div class="uiListAction rightAligned">
            ${
              unlocked
                ? `
                  <button
                    class="rebirthBuyBtn"
                    ${activeSkin === skin.key ? "disabled" : ""}
                    onclick="selectSkin('${skin.key}')"
                  >
                    ${activeSkin === skin.key ? "Active" : "Select"}
                  </button>
                `
                : `
                  <button
                    class="rebirthBuyBtn"
                    ${!affordable ? "disabled" : ""}
                    onclick="unlockSkin('${skin.key}')"
                  >
                    Unlock ${fmt(cost)} 🎨
                  </button>
                `
            }
          </div>

        </div>
      </div>
    `;
  }).join("");
}

function getSkinProgressDescription(skin) {
  switch (skin.progressType) {
    case "manualStars":
      return "Collect stars manually while this skin is equipped.";

    case "fishingCatches":
      return "Successfully catch fish while this skin is equipped.";

    case "bossKills":
      return "Kill bosses while this skin is equipped.";

    default:
      return "Complete related activities while using this skin.";
  }
}

function renderSkinLevelingTab(skins) {
  return skins.map(skin => {
    const data = getSkinState(skin.key);

    const progressNeeded = getSkinRequiredProgress(skin.key);
    const percent = data.level >= skin.maxLevel
      ? 100
      : Math.min(100, (data.progress / progressNeeded) * 100);

    const ascendedMaxLevel = 20;
    const ascendedNeeded = getAscendedSkinRequiredProgress?.(skin.key) || 100;
    const ascendedPercent = data.ascendedLevel >= ascendedMaxLevel
      ? 100
      : Math.min(100, ((data.ascendedProgress || 0) / ascendedNeeded) * 100);

    const ascendedBonusText =
      skin.key === "minotaurFisherman"
        ? `Ascended bonus: -${((data.ascendedLevel || 0) * 0.45).toFixed(2)}s Fishing Golem cooldown`
        : `Ascended bonus level ${data.ascendedLevel || 0}`;

    return `
      <div class="uiListCard ${data.ascended ? "active" : ""}">
        <div class="uiListCardInner">

          <div class="uiListIcon">
            ${data.ascended ? "🔮" : skin.icon}
          </div>

          <div class="uiListText">

            <div class="uiListTitle">
              ${skin.name}${data.ascended ? " — Ascended" : ""}
            </div>

            <div class="uiListSub">
              ${getSkinProgressDescription(skin)}
            </div>

            <div class="uiListSub">
              ${skin.bonusText(data.level)}
            </div>

            <div class="uiListSub">
              Level ${data.level}/${skin.maxLevel}
            </div>

            <div class="skinProgressBar">
              <div
                class="skinProgressFill"
                style="width:${percent}%"
              ></div>
            </div>

            <div class="uiListSub">
              ${
                data.level >= skin.maxLevel
                  ? "Max level reached"
                  : `${fmt(data.progress)}/${fmt(progressNeeded)}`
              }
            </div>

            ${
              data.level >= skin.maxLevel
                ? `
                  <button
                    class="rebirthBuyBtn"
                    ${data.ascended ? "disabled" : ""}
                    onclick="ascendSkin('${skin.key}')"
                  >
                    ${data.ascended ? "Ascended" : "Ascend Skin 🔮"}
                  </button>
                `
                : ""
            }

            ${
              data.ascended
                ? `
                  <div class="uiListSub" style="margin-top:8px;color:#c084fc;">
                    ${ascendedBonusText}
                  </div>

                  <div class="uiListSub">
                    Ascended Level ${data.ascendedLevel || 0}/${ascendedMaxLevel}
                  </div>

                  <div class="skinProgressBar">
                    <div
                      class="skinProgressFill"
                      style="width:${ascendedPercent}%"
                    ></div>
                  </div>

                  <div class="uiListSub">
                    ${
                      (data.ascendedLevel || 0) >= ascendedMaxLevel
                        ? "Ascended max level reached"
                        : `${fmt(data.ascendedProgress || 0)}/${fmt(ascendedNeeded)}`
                    }
                  </div>
                `
                : ""
            }

          </div>

        </div>
      </div>
    `;
  }).join("");
}

function selectSkin(skinKey) {
  const skin = getSkinDef(skinKey);
  if (!skin) return;

  const data = getSkinState(skinKey);
  if (!data?.unlocked) return;

  state.skins.active[skin.summon] = skinKey;

  showFilterNotification(
    "system",
    `${skin.icon} ${skin.name} is now active.`
  );

  renderSkinsPanel("select");

  updateUI();
  saveGame();
}

const SKINS = {
  minotaur: [
    {
  key: "stargazerArcher",
  summon: "minotaur",
  name: "Stargazer Archer",
  desc: "A celestial archer empowered by manually collected stars.",
  maxLevel: 10,
  progressType: "manualStars",
  progressPerLevel: 100,
  unlockCost: 0,
  bonusText: level => `+${level}% star value`,
  icon: "⭐"
},
{
  key: "minotaurFisherman",
  summon: "minotaur",
  name: "Minotaur Fisherman",
  desc: "A patient fisherman who improves your fishing rod cooldown.",
  maxLevel: 20,
  progressType: "fishingCatches",
  progressPerLevel: 50,
  unlockCost: 25,
  bonusText: level => `-${(level * 0.45).toFixed(2)}s fishing cooldown`,
  icon: "🎣"
},
{
  key: "royalHunter",
  summon: "minotaur",
  name: "Royal Hunter",
  desc: "A disciplined hunter specialized in boss rewards.",
  maxLevel: 10,
  progressType: "bossKills",
  progressPerLevel: 25,
  unlockCost: 50,
  bonusText: level => `+${level}% boss rewards`,
  icon: "👑"
}
  ]
};

function initializeSkins() {
  if (!state.skins) {
    state.skins = {
      shards: 0,
      active: {
        minotaur: "stargazerArcher"
      },
      owned: {}
    };
  }

  if (typeof state.skins.shards !== "number") {
    state.skins.shards = 0;
  }

  if (!state.skins.active) {
    state.skins.active = {};
  }

  if (!state.skins.owned) {
    state.skins.owned = {};
  }

  Object.values(SKINS).flat().forEach(skin => {
    if (!state.skins.owned[skin.key]) {
      state.skins.owned[skin.key] = {
        level: 0,
        progress: 0,

        ascended: false,
        ascendedLevel: 0,
        ascendedProgress: 0,

        unlocked: (skin.unlockCost || 0) <= 0
      };
    }

    const data = state.skins.owned[skin.key];

    // Old-save migration
    if (typeof data.level !== "number") {
      data.level = 0;
    }

    if (typeof data.progress !== "number") {
      data.progress = 0;
    }

    if (typeof data.unlocked !== "boolean") {
      data.unlocked = (skin.unlockCost || 0) <= 0;
    }

    if (typeof data.ascended !== "boolean") {
      data.ascended = false;
    }

    if (typeof data.ascendedLevel !== "number") {
      data.ascendedLevel = 0;
    }

    if (typeof data.ascendedProgress !== "number") {
      data.ascendedProgress = 0;
    }
  });

  if (!state.skins.active.minotaur) {
    state.skins.active.minotaur = "stargazerArcher";
  }
}

function getSkinDef(skinKey) {
  return Object.values(SKINS).flat().find(skin => skin.key === skinKey);
}

function getSkinState(skinKey) {
  initializeSkins();
  return state.skins.owned[skinKey];
}

function getActiveSkinKey(summon) {
  initializeSkins();
  return state.skins.active?.[summon] || null;
}

function getActiveSkinLevel(summon, skinKey = null) {
  initializeSkins();

  const activeKey = skinKey || getActiveSkinKey(summon);
  if (!activeKey) return 0;

  return state.skins.owned?.[activeKey]?.level || 0;
}

function getSkinRequiredProgress(skinKey) {
  initializeSkins();

  const skin = getSkinDef(skinKey);
  if (!skin) return 999999;

  const data = getSkinState(skinKey);
  const level = data?.level || 0;

  const base = skin.progressPerLevel || 50;
  const growth = skin.progressGrowth || 1.35;

  return Math.floor(base * Math.pow(growth, level));
}

function getAscendedSkinRequiredProgress(skinKey) {
  const data = getSkinState(skinKey);
  const level = data?.ascendedLevel || 0;

  const base = 100;
  const growth = 1.35;

  return Math.floor(base * Math.pow(growth, level));
}

function addSkinProgress(progressType, amount = 1) {
  initializeSkins();

  Object.values(SKINS).flat().forEach(skin => {
    if (skin.progressType !== progressType) return;

    const data = state.skins.owned[skin.key];
    if (!data?.unlocked) return;
    if (data.level >= skin.maxLevel) return;

    data.progress += amount;

    while (data.level < skin.maxLevel) {
  const required = getSkinRequiredProgress(skin.key);

  if (data.progress < required) break;

  data.progress -= required;
  data.level++;

      showFilterNotification(
        "system",
        `${skin.icon} ${skin.name} reached level ${data.level}.`
      );
    }

    if (data.level >= skin.maxLevel) {
      data.progress = 0;
    }
  });

  saveGame();
}

function addAscendedSkinProgress(skinKey, amount = 1) {
  initializeSkins();

  const skin = getSkinDef(skinKey);
  const data = getSkinState(skinKey);

  if (!skin || !data) return;
  if (!data.unlocked) return;
  if (!data.ascended) return;
  if (data.ascendedLevel >= 20) return;

  data.ascendedProgress += amount;

  while (data.ascendedLevel < 20) {
    const required = getAscendedSkinRequiredProgress(skinKey);

    if (data.ascendedProgress < required) break;

    data.ascendedProgress -= required;
    data.ascendedLevel++;

    showFilterNotification(
      "system",
      `🔮 ${skin.name} ascended level ${data.ascendedLevel}.`
    );
  }

  if (data.ascendedLevel >= 20) {
    data.ascendedProgress = 0;
  }

  saveGame();
}

function getActiveMinotaurSkinBonus(type) {
  initializeSkins();

  const activeKey = getActiveSkinKey("minotaur");
  const level = getActiveSkinLevel("minotaur");

  if (activeKey === "stargazerArcher" && type === "starValue") {
    return level * 0.01;
  }

  if (activeKey === "minotaurFisherman" && type === "fishingCooldown") {
  return level * 0.45;
}

  if (activeKey === "royalHunter" && type === "bossRewards") {
    return level * 0.01;
  }

  return 0;
}