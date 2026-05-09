const ZONES = [
  {
    id: 1,
    name: "Rookgaard Sewers",
    levelReq: 1,
    background: "assets/backgrounds/Rookgaard_Sewers.PNG",
    hp: 25,
    gold: [2, 5],
    exp: [4, 8],
    monsters: [
      { name: "Rat", sprite: "assets/monsters/rat.gif", weight: 100 },
      { name: "Cave Rat", sprite: "assets/monsters/cave_rat.gif", weight: 40 }
    ]
  },

  {
    id: 2,
    name: "Rotworm Cave",
    levelReq: 14,
    background: "assets/backgrounds/rotworm_cave.PNG",
    hp: 75,
    gold: [6, 12],
    exp: [10, 18],
    monsters: [
      { name: "Rotworm", sprite: "assets/monsters/rotworm.gif", weight: 100 },
      { name: "Carrion Worm", sprite: "assets/monsters/carrion_worm.gif", weight: 30 }
    ]
  },

  {
    id: 3,
    name: "Tarantula Cave",
    levelReq: 33,
    background: "assets/backgrounds/tarantula_cave.PNG",
    hp: 140,
    gold: [12, 22],
    exp: [18, 32],
    monsters: [
      { name: "Poison Spider", sprite: "assets/monsters/poison_spider.gif", weight: 100 },
	  { name: "Tarantula", sprite: "assets/monsters/tarantula.gif", weight: 45 }
    ]
  },

  {
    id: 4,
    name: "Cyclops Camp",
    levelReq: 57,
    background: "assets/backgrounds/cyclops_camp.PNG",
    hp: 300,
    gold: [25, 45],
    exp: [40, 70],
    monsters: [
      { name: "Cyclops", sprite: "assets/monsters/cyclops.gif", weight: 100 },
      { name: "Cyclops Drone", sprite: "assets/monsters/cyclops_drone.gif", weight: 40 },
      { name: "Cyclops Smith", sprite: "assets/monsters/cyclops_smith.gif", weight: 15 }
    ]
  },

  {
    id: 5,
    name: "Dark Cathedral",
    levelReq: 84,
    background: "assets/backgrounds/dark_cathedral.PNG",
    hp: 520,
    gold: [45, 80],
    exp: [75, 120],
    monsters: [
      { name: "Dark Monk", sprite: "assets/monsters/dark_monk.gif", weight: 100 },
      { name: "Assassin", sprite: "assets/monsters/assassin.gif", weight: 35 },
      { name: "Witch", sprite: "assets/monsters/witch.gif", weight: 20 }
    ]
  },

  {
    id: 6,
    name: "Ancient Scarab Tomb",
    levelReq: 113,
    background: "assets/backgrounds/ancient_scarab_tomb.PNG",
    hp: 850,
    gold: [75, 130],
    exp: [120, 190],
    monsters: [
      { name: "Ancient Scarab", sprite: "assets/monsters/ancient_scarab.gif", weight: 100 },
      { name: "Scarab", sprite: "assets/monsters/scarab.gif", weight: 50 },
      { name: "Bonebeast", sprite: "assets/monsters/bonebeast.gif", weight: 20 }
    ]
  },

  {
    id: 7,
    name: "Meriana Gargoyle Cave",
    levelReq: 144,
    background: "assets/backgrounds/meriana_gargoyle_cave.PNG",
    hp: 1150,
    gold: [100, 170],
    exp: [165, 260],
    monsters: [
      { name: "Gargoyle", sprite: "assets/monsters/gargoyle.gif", weight: 100 },
      { name: "Stone Golem", sprite: "assets/monsters/stone_golem.gif", weight: 45 },
      { name: "Thornback Tortoise", sprite: "assets/monsters/thornback_tortoise.gif", weight: 25 }
    ]
  },

  {
    id: 8,
    name: "Banuta Apes",
    levelReq: 177,
    background: "assets/backgrounds/banuta_apes.PNG",
    hp: 1500,
    gold: [135, 230],
    exp: [220, 340],
    monsters: [
      { name: "Sibang", sprite: "assets/monsters/sibang.gif", weight: 100 },
      { name: "Merlkin", sprite: "assets/monsters/merlkin.gif", weight: 60 },
      { name: "Kongra", sprite: "assets/monsters/kongra.gif", weight: 35 }
    ]
  },

  {
    id: 9,
    name: "Vampire Crypt",
    levelReq: 212,
    background: "assets/backgrounds/vampire_crypt.PNG",
    hp: 2100,
    gold: [190, 320],
    exp: [310, 480],
    monsters: [
      { name: "Vampire", sprite: "assets/monsters/vampire.gif", weight: 100 },
      { name: "Vampire Bride", sprite: "assets/monsters/vampire_bride.gif", weight: 35 },
      { name: "Necromancer", sprite: "assets/monsters/necromancer.gif", weight: 25 }
    ]
  },

  {
    id: 10,
    name: "Hero Fortress",
    levelReq: 248,
    background: "assets/backgrounds/hero_fortress.PNG",
    hp: 2900,
    gold: [270, 450],
    exp: [430, 680],
    monsters: [
      { name: "Hero", sprite: "assets/monsters/hero.gif", weight: 100 },
      { name: "Vile Grandmaster", sprite: "assets/monsters/vile_grandmaster.gif", weight: 35 },
      { name: "Monk", sprite: "assets/monsters/monk.gif", weight: 30 }
    ]
  },

  {
    id: 11,
    name: "Lizard City",
    levelReq: 286,
    background: "assets/backgrounds/lizard_city.PNG",
    hp: 3900,
    gold: [380, 620],
    exp: [600, 920],
    monsters: [
      { name: "Lizard Chosen", sprite: "assets/monsters/lizard_chosen.gif", weight: 100 },
      { name: "Lizard Dragon Priest", sprite: "assets/monsters/lizard_dragon_priest.gif", weight: 45 },
      { name: "Lizard High Guard", sprite: "assets/monsters/lizard_high_guard.gif", weight: 35 }
    ]
  },

  {
    id: 12,
    name: "Frost Dragon Lair",
    levelReq: 325,
    background: "assets/backgrounds/frost_dragon_lair.PNG",
    hp: 5200,
    gold: [520, 850],
    exp: [820, 1250],
    monsters: [
      { name: "Frost Dragon", sprite: "assets/monsters/frost_dragon.gif", weight: 100 },
      { name: "Frost Dragon Hatchling", sprite: "assets/monsters/frost_dragon_hatchling.gif", weight: 45 },
      { name: "Crystal Spider", sprite: "assets/monsters/crystal_spider.gif", weight: 30 }
    ]
  },

  {
    id: 13,
    name: "Hydra Mountain",
    levelReq: 365,
    background: "assets/backgrounds/hydra_mountain.PNG",
    hp: 6800,
    gold: [690, 1120],
    exp: [1100, 1650],
    monsters: [
      { name: "Hydra", sprite: "assets/monsters/hydra.gif", weight: 100 },
      { name: "Serpent Spawn", sprite: "assets/monsters/serpent_spawn.gif", weight: 35 },
      { name: "Giant Spider", sprite: "assets/monsters/giant_spider.gif", weight: 30 }
    ]
  },

  {
    id: 14,
    name: "Serpent Spawn Pit",
    levelReq: 407,
    background: "assets/backgrounds/serpent_spawn_pit.PNG",
    hp: 8800,
    gold: [900, 1450],
    exp: [1450, 2150],
    monsters: [
      { name: "Serpent Spawn", sprite: "assets/monsters/serpent_spawn.gif", weight: 100 },
      { name: "Medusa", sprite: "assets/monsters/medusa.gif", weight: 35 },
      { name: "Hydra", sprite: "assets/monsters/hydra.gif", weight: 35 }
    ]
  },

  {
    id: 15,
    name: "Medusa Tower",
    levelReq: 450,
    background: "assets/backgrounds/medusa_tower.PNG",
    hp: 11300,
    gold: [1180, 1900],
    exp: [1850, 2800],
    monsters: [
      { name: "Medusa", sprite: "assets/monsters/medusa.gif", weight: 100 },
      { name: "Serpent Spawn", sprite: "assets/monsters/serpent_spawn.gif", weight: 45 },
      { name: "Behemoth", sprite: "assets/monsters/behemoth.gif", weight: 20 }
    ]
  },

  {
    id: 16,
    name: "Deeper Banuta",
    levelReq: 493,
    background: "assets/backgrounds/deeper_banuta.PNG",
    hp: 15000,
    gold: [1550, 2500],
    exp: [2400, 3600],
    monsters: [
      { name: "Medusa", sprite: "assets/monsters/medusa.gif", weight: 100 },
      { name: "Hydra", sprite: "assets/monsters/hydra.gif", weight: 85 },
      { name: "Serpent Spawn", sprite: "assets/monsters/serpent_spawn.gif", weight: 70 },
      { name: "Souleater", sprite: "assets/monsters/souleater.gif", weight: 25 }
    ]
  },

  {
    id: 17,
    name: "Draken Walls",
    levelReq: 538,
    background: "assets/backgrounds/draken_walls.PNG",
    hp: 19500,
    gold: [2050, 3300],
    exp: [3100, 4600],
    monsters: [
      { name: "Draken Elite", sprite: "assets/monsters/draken_elite.gif", weight: 100 },
      { name: "Draken Spellweaver", sprite: "assets/monsters/draken_spellweaver.gif", weight: 70 },
      { name: "Draken Warmaster", sprite: "assets/monsters/draken_warmaster.gif", weight: 40 }
    ]
  },

  {
    id: 18,
    name: "Asura Palace",
    levelReq: 584,
    background: "assets/backgrounds/asura_palace.PNG",
    hp: 25000,
    gold: [2700, 4300],
    exp: [4000, 6000],
    monsters: [
      { name: "Midnight Asura", sprite: "assets/monsters/midnight_asura.gif", weight: 100 },
      { name: "Dawnfire Asura", sprite: "assets/monsters/dawnfire_asura.gif", weight: 100 },
      { name: "Hellspawn", sprite: "assets/monsters/hellspawn.gif", weight: 35 }
    ]
  },

  {
    id: 19,
    name: "Carnivora Rocks",
    levelReq: 631,
    background: "assets/backgrounds/carnivora_rocks.PNG",
    hp: 32000,
    gold: [3500, 5600],
    exp: [5200, 7800],
    monsters: [
      { name: "Spiky Carnivor", sprite: "assets/monsters/spiky_carnivor.gif", weight: 100 },
      { name: "Menacing Carnivor", sprite: "assets/monsters/menacing_carnivor.gif", weight: 70 },
      { name: "Lumbering Carnivor", sprite: "assets/monsters/lumbering_carnivor.gif", weight: 45 }
    ]
  },

  {
    id: 20,
    name: "Oramond Fury Dungeon",
    levelReq: 678,
    background: "assets/backgrounds/oramond_fury_dungeon.PNG",
    hp: 41000,
    gold: [4500, 7200],
    exp: [6800, 10000],
    monsters: [
      { name: "Fury", sprite: "assets/monsters/fury.gif", weight: 100 },
      { name: "Hellhound", sprite: "assets/monsters/hellhound.gif", weight: 35 },
      { name: "Hellfire Fighter", sprite: "assets/monsters/hellfire_fighter.gif", weight: 45 }
    ]
  },

  {
    id: 21,
    name: "Roshamuul Prison",
    levelReq: 727,
    background: "assets/backgrounds/roshamuul_prison.PNG",
    hp: 52000,
    gold: [5900, 9300],
    exp: [8600, 12800],
    monsters: [
      { name: "Silencer", sprite: "assets/monsters/silencer.gif", weight: 100 },
      { name: "Frazzlemaw", sprite: "assets/monsters/frazzlemaw.gif", weight: 85 },
      { name: "Guzzlemaw", sprite: "assets/monsters/guzzlemaw.gif", weight: 45 }
    ]
  },

  {
    id: 22,
    name: "Winter Court",
    levelReq: 776,
    background: "assets/backgrounds/winter_court.PNG",
    hp: 66000,
    gold: [7600, 12000],
    exp: [11000, 16500],
    monsters: [
      { name: "Arachnophobica", sprite: "assets/monsters/arachnophobica.gif", weight: 100 },
      { name: "Crazed Winter Rearguard", sprite: "assets/monsters/crazed_winter_rearguard.gif", weight: 80 },
      { name: "Crazed Winter Vanguard", sprite: "assets/monsters/crazed_winter_vanguard.gif", weight: 60 }
    ]
  },

  {
    id: 23,
    name: "Summer Court",
    levelReq: 827,
    background: "assets/backgrounds/summer_court.PNG",
    hp: 83000,
    gold: [9700, 15300],
    exp: [14000, 21000],
    monsters: [
      { name: "Thanatursus", sprite: "assets/monsters/thanatursus.gif", weight: 100 },
      { name: "Crazed Summer Rearguard", sprite: "assets/monsters/crazed_summer_rearguard.gif", weight: 80 },
      { name: "Crazed Summer Vanguard", sprite: "assets/monsters/crazed_summer_vanguard.gif", weight: 60 }
    ]
  },

  {
    id: 24,
    name: "Gazer Spectre Cave",
    levelReq: 878,
    background: "assets/backgrounds/gazer_spectre_cave.PNG",
    hp: 104000,
    gold: [12500, 19500],
    exp: [18000, 27000],
    monsters: [
      { name: "Gazer Spectre", sprite: "assets/monsters/gazer_spectre.gif", weight: 100 },
      { name: "Thanatursus", sprite: "assets/monsters/thanatursus.gif", weight: 35 },
      { name: "Arachnophobica", sprite: "assets/monsters/arachnophobica.gif", weight: 25 }
    ]
  },

  {
    id: 25,
    name: "Burster Spectre Cave",
    levelReq: 930,
    background: "assets/backgrounds/burster_spectre_cave.PNG",
    hp: 130000,
    gold: [16000, 25000],
    exp: [23000, 34500],
    monsters: [
      { name: "Burster Spectre", sprite: "assets/monsters/burster_spectre.gif", weight: 100 },
      { name: "Ripper Spectre", sprite: "assets/monsters/ripper_spectre.gif", weight: 45 },
      { name: "Gazer Spectre", sprite: "assets/monsters/gazer_spectre.gif", weight: 30 }
    ]
  },

  {
    id: 26,
    name: "Werelion Temple",
    levelReq: 982,
    background: "assets/backgrounds/werelion_temple.PNG",
    hp: 162000,
    gold: [20500, 32000],
    exp: [29500, 44000],
    monsters: [
      { name: "Werelion", sprite: "assets/monsters/werelion.gif", weight: 100 },
      { name: "Werelioness", sprite: "assets/monsters/werelioness.gif", weight: 80 },
      { name: "White Lion", sprite: "assets/monsters/white_lion.gif", weight: 30 }
    ]
  },

  {
    id: 27,
    name: "Cobra Bastion",
    levelReq: 1036,
    background: "assets/backgrounds/cobra_bastion.PNG",
    hp: 205000,
    gold: [26500, 41000],
    exp: [38000, 57000],
    monsters: [
      { name: "Cobra Assassin", sprite: "assets/monsters/cobra_assassin.gif", weight: 100 },
      { name: "Cobra Scout", sprite: "assets/monsters/cobra_scout.gif", weight: 85 },
      { name: "Cobra Vizier", sprite: "assets/monsters/cobra_vizier.gif", weight: 55 }
    ]
  },

  {
    id: 28,
    name: "Falcon Bastion",
    levelReq: 1090,
    background: "assets/backgrounds/falcon_bastion.PNG",
    hp: 260000,
    gold: [34000, 53000],
    exp: [49000, 73000],
    monsters: [
      { name: "Falcon Knight", sprite: "assets/monsters/falcon_knight.gif", weight: 100 },
      { name: "Falcon Paladin", sprite: "assets/monsters/falcon_paladin.gif", weight: 85 }
    ]
  },

  {
    id: 29,
    name: "Catacombs",
    levelReq: 1145,
    background: "assets/backgrounds/catacombs.PNG",
    hp: 330000,
    gold: [44000, 68000],
    exp: [63000, 94000],
    monsters: [
      { name: "Juggernaut", sprite: "assets/monsters/juggernaut.gif", weight: 100 },
      { name: "Hellhound", sprite: "assets/monsters/hellhound.gif", weight: 80 },
      { name: "Destroyer", sprite: "assets/monsters/destroyer.gif", weight: 55 },
      { name: "Dark Torturer", sprite: "assets/monsters/dark_torturer.gif", weight: 45 }
    ]
  },

  {
    id: 30,
    name: "Soul War",
    levelReq: 1200,
    background: "assets/backgrounds/soul_war.PNG",
    hp: 420000,
    gold: [57000, 88000],
    exp: [82000, 123000],
    monsters: [
      { name: "Cloak of Terror", sprite: "assets/monsters/cloak_of_terror.gif", weight: 100 },
      { name: "Vibrant Phantom", sprite: "assets/monsters/vibrant_phantom.gif", weight: 80 },
      { name: "Courage Leech", sprite: "assets/monsters/courage_leech.gif", weight: 65 },
      { name: "Brachiodemon", sprite: "assets/monsters/brachiodemon.gif", weight: 20 }
    ]
  },
  {
  id: 9999,
  name: "The Observatory",
  levelReq: 1,
  background: "assets/backgrounds/observatory.png",
  gold: [0, 0],
  exp: [0, 0],
  monsters: [
    {
      name: "Rat",
      sprite: "assets/monsters/rat.gif",
      weight: 100
    }
  ],
  noMonsters: true
},
{
  id: 9998,
  name: "Siege Battlefield",
  levelReq: 1,
  background: "assets/backgrounds/siege_battlefield.png",
  monsters: [],
  noMonsters: true,
  isEventZone: true,
  isSiegeZone: true
}
];

function getZoneHpMultiplier(zone) {
  if (!zone || zone.isEventZone || zone.noMonsters) return 1;

  if (zone.id <= 5) return 1;
  if (zone.id <= 10) return 2.5;
  if (zone.id <= 15) return 5;
  if (zone.id <= 20) return 10;
  if (zone.id <= 25) return 25;
  if (zone.id <= 30) return 50;

  return 1;
}

function updateObservatoryNotification() {
  let box = document.getElementById("observatoryNotification");

  if (!box) {
    box = document.createElement("div");
    box.id = "observatoryNotification";
    getEventNotificationRow()?.appendChild(box);
  }

  if (!isObservatoryActive()) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.innerHTML = `
    🔭 <b>The Observatory is open!</b><br>
    Stars collected there are worth x3.<br>
    Closes in: <b>${getObservatoryTimeLeftText()}</b>
  `;
}

function updateObservatoryEvent(now = Date.now()) {
  if (!state.observatory) {
    state.observatory = {
      active: false,
      closesAt: 0,
      nextCheckAt: now + OBSERVATORY_CHECK_MS
    };
  }

  if (state.observatory.active) {
    if (now >= state.observatory.closesAt) {
      closeObservatory(now);
    }
    return;
  }

  if (now < state.observatory.nextCheckAt) return;

  state.observatory.nextCheckAt = now + OBSERVATORY_CHECK_MS;

  if (Math.random() < OBSERVATORY_OPEN_CHANCE) {
    openObservatory(now);
  }
}

function openObservatory(now = Date.now()) {
  if (!state.observatory) state.observatory = {};

  rememberEventReturnZone();

  state.observatory.active = true;
  state.observatory.closesAt = now + OBSERVATORY_DURATION_MS;
  state.observatory.nextCheckAt = state.observatory.closesAt + OBSERVATORY_CHECK_MS;

  state.starSystem.activeZoneId = OBSERVATORY_ZONE_ID;
  state.starSystem.nextZoneSwapAt = state.observatory.closesAt;
  state.starSystem.nextSpawnCheckAt = now + STAR_SPAWN_CHECK_MS;

  addLog("🔭 The Observatory has opened for 15 minutes. Stars collected there are worth x3.");

  if (document.getElementById("travelPanel")?.style.display === "block") {
    renderZoneList();
  }

  updateStarZoneVisual();
  queueSaveGame();
}

function closeObservatory(now = Date.now()) {
  if (!state.observatory) return;

  state.observatory.active = false;
  state.observatory.closesAt = 0;
  state.observatory.nextCheckAt = now + OBSERVATORY_CHECK_MS;

  addLog("🔭 The Observatory has closed.");

  if (getCurrentZoneId() === OBSERVATORY_ZONE_ID) {
    returnFromEventZone();
  }

  rotateStarZone(now);
  updateStarZoneVisual();

  if (document.getElementById("travelPanel")?.style.display === "block") {
    renderZoneList();
  }

  queueSaveGame();
}

function isObservatoryActive() {
  return state.observatory?.active === true && Date.now() < state.observatory.closesAt;
}

function isInObservatory() {
  return getCurrentZoneId() === OBSERVATORY_ZONE_ID;
}

function getObservatoryTimeLeftText() {
  const msLeft = Math.max(0, (state.observatory?.closesAt || 0) - Date.now());
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}