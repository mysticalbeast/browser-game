const SAVE_KEY = "localTapMonsterGameSave_modular_v1";

const EQUIPMENT_SLOTS = [
  { key: "necklace", name: "Necklace", icon: "📿" },
  { key: "helmet", name: "Helmet", icon: "⛑" },
  { key: "weapon", name: "Weapon", icon: "⚔", displayOnly: true },
  { key: "armor", name: "Armor", icon: "🥋" },
  { key: "shield", name: "Shield", icon: "🛡" },
  { key: "ring", name: "Ring", icon: "💍" },
  { key: "legs", name: "Legs", icon: "👖" },
  { key: "shoes", name: "Shoes", icon: "🥾" }
];

const RESEARCH_MILESTONES = [
  { kills: 1000, bonus: { damage: 0.03 }, desc: "+3% total damage" },
  { kills: 5000, bonus: { gold: 0.03 }, desc: "+3% gold gain" },
  { kills: 10000, bonus: { exp: 0.03 }, desc: "+3% exp gain" },
  { kills: 50000, bonus: { materials: 0.05 }, desc: "+5% material drops" },
  { kills: 100000, bonus: { critDamage: 0.10 }, desc: "+10% crit damage" },
  { kills: 500000, bonus: { overkillSplash: 0.20 }, desc: "20% overkill damage splashes to another monster" },
  { kills: 1000000, bonus: { rareDrops: 0.10 }, desc: "+10% equipment and whetstone drop chance" }
];

const DEFAULT_EQUIPMENT = {
  necklace: null,
  helmet: null,
  armor: null,
  shield: null,
  ring: null,
  legs: null,
  shoes: null
};

const LOADOUT_SLOT_KEYS = ["necklace", "helmet", "armor", "shield", "ring", "legs", "shoes"];

const DEFAULT_LOADOUTS = {
  activeIndex: 0,
  stash: [],
  sets: [
    {
      name: "Loadout 1",
      slots: { necklace: null, helmet: null, armor: null, shield: null, ring: null, legs: null, shoes: null }
    },
    {
      name: "Loadout 2",
      slots: { necklace: null, helmet: null, armor: null, shield: null, ring: null, legs: null, shoes: null }
    },
    {
      name: "Loadout 3",
      slots: { necklace: null, helmet: null, armor: null, shield: null, ring: null, legs: null, shoes: null }
    }
  ]
};

const DEFAULT_DEPOT = {
  activeTab: 0,
  tabs: [
    Array(40).fill(null),
    Array(40).fill(null),
    Array(40).fill(null)
  ]
};

const DEFAULT_SKILLS = {
  sharpshooter: 0,
  powerBolt: 0,
  doubleStrike: 0,
  tripleStrike: 0,
  headshot: 0,
  strongerBullets: 0,

  unlockFireball: 0,
  fireballCooldown: 0,
  fireballDamage: 0,

  unlockLightMagic: 0,
  lightMagicDamage: 0,
  lightMagicCooldown: 0,

  unlockHeavyMagic: 0,
  heavyMagicDamage: 0,
  heavyMagicCooldown: 0,

  deepPockets: 0,
experiencedHunter: 0,
materialistic: 0,
gearingUp: 0,
likeABoss: 0,
lootHungry: 0,
uberDifficulty: 0,

darkNovaDamage: 0,
darkNovaTargets: 0,
decay: 0,
deathEcho: 0,
overchannel: 0,

graveCalling: 0,
skeletonReach: 0,
skeletonMastery: 0,
walkingDead: 0,
reanimation: 0,
eliteSkeleton: 0,
boneArmor: 0,

};

const DEFAULT_MATERIALS = {
  greenEssence: 0,
  blueEssence: 0,
  yellowEssence: 0,
  redEssence: 0,
  whetstones: 0
};

const DEFAULT_POTIONS = {
  wealthUntil: 0,
  wisdomUntil: 0,
  swiftnessUntil: 0
};

const DEFAULT_REWARDS = {
  showOdds: false,
  slotCoins: 0,
  lastCoinAt: Date.now(),
  slotSpinning: false,
  slotOptions: []
};

const POTIONS = [
  {
    key: "wealth",
    name: "Potion of Wealth",
    desc: "Increases gold gain by 25% for 5 minutes.",
    durationMs: 5 * 60 * 1000,
    costs: { greenEssence: 25, blueEssence: 10, yellowEssence: 3 },
    activeKey: "wealthUntil"
  },
  {
    key: "wisdom",
    name: "Potion of Wisdom",
    desc: "Increases experience gain by 25% for 5 minutes.",
    durationMs: 5 * 60 * 1000,
    costs: { greenEssence: 10, blueEssence: 15, yellowEssence: 4 },
    activeKey: "wisdomUntil"
  },
  {
    key: "swiftness",
    name: "Potion of Swiftness",
    desc: "Decreases cooldown of all spells and attacks by 10% for 5 minutes.",
    durationMs: 5 * 60 * 1000,
    costs: { greenEssence: 15, blueEssence: 15, yellowEssence: 10 },
    activeKey: "swiftnessUntil"
  }
];

const MATERIAL_NAMES = {
  greenEssence: "Green Essence",
  blueEssence: "Blue Essence",
  yellowEssence: "Yellow Essence",
  redEssence: "Red Essence"
};

const SLOT_REWARD_POOL = [
  {
    key: "goldSmall",
    icon: "🪙",
    name: "Small Gold Pouch",
    desc: "Gain gold based on your level.",
    type: "gold",
    amount: 500,
    weight: 100
  },
  {
    key: "goldBig",
    icon: "💰",
    name: "Large Gold Chest",
    desc: "Gain a larger gold reward.",
    type: "gold",
    amount: 2500,
    weight: 35
  },
  {
    key: "expSmall",
    icon: "📘",
    name: "Small EXP Tome",
    desc: "Gain experience based on your level.",
    type: "exp",
    amount: 300,
    weight: 90
  },
  {
    key: "expBig",
    icon: "📚",
    name: "Ancient EXP Tome",
    desc: "Gain a larger experience reward.",
    type: "exp",
    amount: 1500,
    weight: 30
  },

  {
    key: "greenEssence",
    icon: "🟢",
    name: "Green Essence Crate",
    desc: "Gain 50 Green Essence.",
    type: "material",
    materialKey: "greenEssence",
    amount: 50,
    weight: 75
  },
  {
    key: "blueEssence",
    icon: "🔵",
    name: "Blue Essence Crate",
    desc: "Gain 35 Blue Essence.",
    type: "material",
    materialKey: "blueEssence",
    amount: 35,
    weight: 55
  },
  {
    key: "yellowEssence",
    icon: "🟡",
    name: "Yellow Essence Crate",
    desc: "Gain 20 Yellow Essence.",
    type: "material",
    materialKey: "yellowEssence",
    amount: 20,
    weight: 35
  },
  {
    key: "redEssence",
    icon: "🔴",
    name: "Red Essence Crate",
    desc: "Gain 10 Red Essence.",
    type: "material",
    materialKey: "redEssence",
    amount: 10,
    weight: 18
  },
  {
    key: "whetstones",
    icon: "🪨",
    name: "Whetstone Bundle",
    desc: "Gain 5 Whetstones.",
    type: "material",
    materialKey: "whetstones",
    amount: 5,
    weight: 15
  },

  {
    key: "fish",
    icon: "🐟",
    name: "Fish Crate",
    desc: "Gain 250 Fish.",
    type: "fish",
    amount: 250,
    weight: 45
  },
  {
    key: "stars",
    icon: "⭐",
    name: "Star Cluster",
    desc: "Gain 150 Stars.",
    type: "stars",
    amount: 150,
    weight: 35
  },

  {
    key: "silverToken",
    icon: "⚪",
    name: "Silver Token",
    desc: "Gain 1 extra Silver Token.",
    type: "slotCoin",
    amount: 1,
    weight: 22
  },

  {
    key: "skillPoint",
    icon: "⚡",
    name: "Skill Point",
    desc: "Gain 1 Skill Point.",
    type: "skillPoint",
    amount: 1,
    weight: 8
  },

  {
    key: "skinShardSmall",
    icon: "🎨",
    name: "Skin Shard Pack",
    desc: "Gain 25 Skin Shards.",
    type: "skinShard",
    amount: 25,
    weight: 18
  },

  {
    key: "jackpotChest",
    icon: "💎",
    name: "Jackpot Chest",
    desc: "Massive mixed reward.",
    type: "jackpot",
    weight: 4
  }
];

const DEFAULT_SALVAGE_MATERIALS = {
  commonMaterial: 0,
  uncommonMaterial: 0,
  rareMaterial: 0,
  legendaryMaterial: 0
};

const state = {
  level: 1,
  exp: 0,
  gold: 0,

  unlockedNodes: ["center"],

  monsterResearch: {},

spawnRequestInProgress: false,

weaponStarLevel: 0,

dracoWeaponScaling: 0,

starsEarned: 0,
stars: 0,

observatory: {
  active: false,
  closesAt: 0,
  nextCheckAt: 0
},

starSystem: {
  activeZoneId: null,
  nextZoneSwapAt: 0,
  nextSpawnCheckAt: 0
},

starUpgrades: {
  starfall: 0,
  starShower: 0,
  astralShower: 0,
  supernovas: 0,
  supergiants: 0,
  novaYields: 0,
  giantYields: 0,
  cosmicWorth: 0,
  starHole: 0,
  stellarYield: 0
},

constellations: {
  gemini: 0,
  aries: 0,
  sagittarius: 0,
  aquarius: 0,
  phoenix: 0,
  draco: 0,
  taurus: 0,
  cancer: 0,
  orion: 0,
  cetus: 0
},

settings: {
  minotaurAttacks: true,
  necromancerAttacks: true,
  minotaurEffectDebug: false,
  followStars: false,
},

dpsSamples: {
  minotaur: [],
  necromancer: []
},

filters: {
  equipmentAction: "none",
  rarityLimit: "common"
},

  skeletons: [],

  rebirth: {
    count: 0,
    coins: 0
  },

  rebirthUpgrades: {},

  equipment: { ...DEFAULT_EQUIPMENT },
  equipmentInventory: [],
  
  salvageMaterials: { ...DEFAULT_SALVAGE_MATERIALS },

depot: {
  activeTab: 0,
  tabs: [
    Array(40).fill(null),
    Array(40).fill(null),
    Array(40).fill(null)
  ]
},

activeLogFilter: "all",
logMessages: [],

  zoneId: 1,
  visitedZones: [1],

  ownedWeapons: ["Sword"],
  equippedWeapon: "Sword",

  skillPoints: 0,
  skills: { ...DEFAULT_SKILLS },

  materials: { ...DEFAULT_MATERIALS },
  potions: { ...DEFAULT_POTIONS },
  rewards: { ...DEFAULT_REWARDS },

  minDamage: 5,
  maxDamage: 10,
  damageUpgradeLevel: 0,

  maxMonsters: 8,
  monsters: [],

  activeSkillTree: "summons",

  stats: {
    sessionStartedAt: Date.now(),
    goldEarned: 0,
    expEarned: 0,
    monstersKilled: 0,
    bossesKilled: 0,
    ubersKilled: 0,
    gearFound: 0
  },

  lastSpellCast: {
    fireball: 0,
    lightMagic: 0,
    heavyMagic: 0
  },

lastNecromancerAttack: 0

};

let arena = null;
let logEl = null;
let backpack = null;
let lastSummonAttack = 0;