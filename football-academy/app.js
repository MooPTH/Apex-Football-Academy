// GAME STATE OBJECT
const state = {
  turn: 1,
  money: 0,
  globalFatigue: 0,
  teamStats: {
    speed: 15,
    stamina: 15,
    power: 15,
    unity: 15,
    tactic: 15
  },
  facilities: {
    speed: 1,
    stamina: 1,
    power: 1,
    unity: 1,
    tactic: 1
  },
  boosters: {
    drink: 0,
    medkit: 0,
    sponsored: 0 // Count for sponsored consumable (drink/tape/kit)
  },
  players: [],
  selectedPlayerId: null,
  activeTab: 'training',
  activeSponsor: null, // 'volt', 'aegis', or 'unity'
  
  // Match state
  currentMatchIndex: 0,
  matchState: {
    active: false,
    half: 1, // 1 or 2
    time: 0, // 0 to 90
    homeScore: 0,
    awayScore: 0,
    possession: 'home', // 'home' or 'away'
    ballX: 50,
    ballY: 50,
    tactic: 'attack',
    homeStamina: 100,
    awayStamina: 100,
    commentary: [],
    timerId: null,
    opponent: null,
    tempFrontBoost: 0, // Free kick boost countdown (turns)
    activeSetPiece: null // null, 'freekick', 'penalty'
  },

  // Penalty shootout state
  penaltyState: {
    active: false,
    round: 0,
    turn: 'home', // 'home' or 'away'
    homePenalties: [],
    awayPenalties: [],
    homeScore: 0,
    awayScore: 0,
    selectedTarget: null
  }
};

// OPPONENTS DATA (Match 1, 2, 3) - Balanced overall weaker, concentrated playstyles
const OPPONENTS = [
  {
    name: 'Ironclad Athletic',
    avatar: 'I',
    playstyle: 'defense', // plays defensive style
    weakness: 'counter',  // weak to counter playstyle
    stats: { speed: 10, stamina: 14, power: 18, unity: 12, tactic: 10 },
    desc: 'Extremely physical and defensive, but lack speed and agility. Highly susceptible to rapid counter-attacks.'
  },
  {
    name: 'Metro United',
    avatar: 'M',
    playstyle: 'attack',
    weakness: 'defense',
    stats: { speed: 34, stamina: 26, power: 22, unity: 32, tactic: 28 },
    desc: 'An aggressive, high-pressing team focused entirely on attack. Leaves major defensive holes that a solid defense can stifle.'
  },
  {
    name: 'Apex Wanderers',
    avatar: 'W',
    playstyle: 'counter',
    weakness: 'attack',
    stats: { speed: 58, stamina: 52, power: 45, unity: 50, tactic: 55 },
    desc: 'A tactical side that waits in midfield to trigger fast breaks. Highly vulnerable to direct, overwhelming attacking strategies.'
  }
];

// PLAYER NAMES FOR SQUAD GENERATION
const FIRST_NAMES = ['Marcus', 'David', 'Lionel', 'Christian', 'Luka', 'Karim', 'Kylian', 'Erling', 'Mohamed', 'Kevin', 'Virgil', 'Robert', 'Harry', 'Bruno', 'Heung-min', 'Raheem', 'Alisson', 'Manuel', 'Ederson'];
const LAST_NAMES = ['Silva', 'Muller', 'Ramirez', 'Becker', 'Messi', 'Ronaldo', 'Modric', 'Mbappe', 'Haaland', 'Salah', 'De Bruyne', 'Van Dijk', 'Lewandowski', 'Kane', 'Fernandes', 'Son', 'Sterling', 'Grealish', 'Neuer'];
const POSITIONS = ['GK', 'Back', 'Back', 'Back', 'Back', 'Mid', 'Mid', 'Mid', 'Mid', 'Front', 'Front'];

// INITIALIZATION
function initGame() {
  state.turn = 1;
  state.money = 0;
  state.globalFatigue = 0;
  state.teamStats = { speed: 15, stamina: 15, power: 15, unity: 15, tactic: 15 };
  state.facilities = { speed: 1, stamina: 1, power: 1, unity: 1, tactic: 1 };
  state.boosters = { drink: 0, medkit: 0, sponsored: 0 };
  state.activeSponsor = null;
  state.currentMatchIndex = 0;
  state.selectedPlayerId = null;
  state.activeTab = 'training';
  
  // Generate squad with player-specific kicker modifiers (0.8 - 1.25)
  state.players = [];
  for (let i = 0; i < 11; i++) {
    const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    state.players.push({
      id: i,
      name: `${fName} ${lName}`,
      position: POSITIONS[i],
      stamina: 100,
      injured: false,
      matchPerformance: 0,
      tacticMod: Number((0.8 + Math.random() * 0.45).toFixed(2)), // Individual accuracy modifier
      powerMod: Number((0.8 + Math.random() * 0.45).toFixed(2))   // Individual power modifier
    });
  }

  state.matchState.active = false;
  state.penaltyState.active = false;

  updateUI();
  setupEventListeners();
  switchTab('training');
}

// RATINGS CALCULATION (Synergy and individual fatigue factored)
function getGKRating() {
  const s = state.teamStats;
  return Number((s.tactic * 1.0 + s.speed * 0.8 + s.power * 0.5).toFixed(1));
}

function getBackRating() {
  const s = state.teamStats;
  return Number((s.unity * 0.9 + s.tactic * 0.9 + s.power * 0.6 + s.speed * 0.6).toFixed(1));
}

function getMidRating() {
  const s = state.teamStats;
  return Number((s.unity * 1.0 + s.tactic * 1.0).toFixed(1));
}

function getFrontRating() {
  const s = state.teamStats;
  return Number((s.power * 0.9 + s.tactic * 0.9 + s.speed * 0.5 + s.stamina * 0.5).toFixed(1));
}

function getPlayerRating(player) {
  if (player.injured) return 1.0;
  
  let baseRating = 10.0;
  switch (player.position) {
    case 'GK': baseRating = getGKRating(); break;
    case 'Back': baseRating = getBackRating(); break;
    case 'Mid': baseRating = getMidRating(); break;
    case 'Front': baseRating = getFrontRating(); break;
  }
  
  const stamFactor = player.stamina / 100;
  let finalRating = baseRating * (0.55 + 0.45 * stamFactor);
  return Number(finalRating.toFixed(1));
}

// UI RENDERING ENGINE
function updateUI() {
  // Header turn and countdown
  document.querySelector('#stat-turn .stat-value').innerHTML = `${state.turn} <span class="stat-sub">/ 30</span>`;
  const nextMatchTurn = (state.currentMatchIndex + 1) * 10;
  const turnsLeft = nextMatchTurn - state.turn;
  document.querySelector('#stat-match-countdown .stat-value').innerHTML = `${turnsLeft} <span class="stat-sub">turns</span>`;
  document.getElementById('match-countdown-badge').innerText = `Next Match in ${turnsLeft} Turns`;
  
  // Money and global fatigue
  document.querySelector('#stat-money .stat-value').innerText = `$${state.money}`;
  const fatigueBar = document.querySelector('.fatigue-bar-fill');
  fatigueBar.style.width = `${state.globalFatigue}%`;
  document.querySelector('#stat-fatigue .stat-value-mini').innerText = `${state.globalFatigue}%`;
  
  if (state.globalFatigue >= 80) fatigueBar.style.background = 'var(--color-red)';
  else if (state.globalFatigue >= 50) fatigueBar.style.background = 'var(--color-yellow)';
  else fatigueBar.style.background = 'var(--color-green)';

  // Core Progress Bars
  updateProgressBar('speed', state.teamStats.speed);
  updateProgressBar('stamina', state.teamStats.stamina);
  updateProgressBar('power', state.teamStats.power);
  updateProgressBar('unity', state.teamStats.unity);
  updateProgressBar('tactic', state.teamStats.tactic);

  // Positional Ratings
  document.getElementById('rate-gk').innerText = getGKRating();
  document.getElementById('rate-back').innerText = getBackRating();
  document.getElementById('rate-mid').innerText = getMidRating();
  document.getElementById('rate-front').innerText = getFrontRating();

  // Sidebar Footer Progress Dots
  for (let m = 1; m <= 3; m++) {
    const dot = document.getElementById(`dot-match-${m}`);
    if (state.currentMatchIndex >= m) dot.className = 'dot completed';
    else if (state.currentMatchIndex + 1 === m) dot.className = 'dot current';
    else dot.className = 'dot';
  }

  // Facility Levels & Buy Costs
  const drillTypes = ['speed', 'stamina', 'power', 'unity', 'tactic'];
  drillTypes.forEach(t => {
    const lvl = state.facilities[t];
    const lvlLbl = document.getElementById(`lvl-lbl-${t}`);
    if (lvlLbl) lvlLbl.innerText = `Lvl ${lvl}`;
    
    const cost = lvl * 200;
    const btn = document.querySelector(`#item-facility-${t} .buy-btn`);
    if (btn) btn.innerText = `Upgrade - $${cost}`;

    // Drill cards in hub
    const drillCard = document.getElementById(`drill-${t}`);
    if (drillCard) {
      drillCard.querySelector('.drill-level').innerText = `Lvl ${lvl}`;
      
      let speedMult = 1.0;
      let tacticMult = 1.0;
      let unityMult = 1.0;
      
      // Apply Sponsor Buffs
      if (state.activeSponsor === 'volt') speedMult = 1.5;
      if (state.activeSponsor === 'aegis') tacticMult = 1.5;
      if (state.activeSponsor === 'unity') unityMult = 1.5;

      const lvlMultiplier = 1 + (lvl - 1) * 0.25;
      
      let drillTxt = '';
      if (t === 'speed') {
        const speedVal = 4.0 * lvlMultiplier * speedMult; // base stats increased to 4.0
        const stamVal = 1.0 * lvlMultiplier;
        const powVal = 0.5 * lvlMultiplier;
        const tacVal = 0.5 * lvlMultiplier;
        drillTxt = `
          <span class="effect-stat text-green">+${speedVal.toFixed(1)} Speed</span>
          <span class="effect-stat text-green">+${stamVal.toFixed(1)} Stamina</span>
          <span class="effect-stat text-green">+${powVal.toFixed(1)} Power</span>
          <span class="effect-stat text-green">+${tacVal.toFixed(1)} Tactic</span>
          <span class="effect-fatigue text-red">+16 Fatigue</span>
        `;
      } else if (t === 'stamina') {
        const stamVal = 4.0 * lvlMultiplier;
        const powVal = 1.5 * lvlMultiplier;
        drillTxt = `
          <span class="effect-stat text-green">+${stamVal.toFixed(1)} Stamina</span>
          <span class="effect-stat text-green">+${powVal.toFixed(1)} Power</span>
          <span class="effect-fatigue text-red">+20 Fatigue</span>
        `;
      } else if (t === 'power') {
        const powVal = 4.0 * lvlMultiplier;
        const stamVal = 1.5 * lvlMultiplier;
        drillTxt = `
          <span class="effect-stat text-green">+${powVal.toFixed(1)} Power</span>
          <span class="effect-stat text-green">+${stamVal.toFixed(1)} Stamina</span>
          <span class="effect-fatigue text-red">+22 Fatigue</span>
        `;
      } else if (t === 'unity') {
        const uniVal = 4.0 * lvlMultiplier * unityMult;
        const stamVal = 0.5 * lvlMultiplier;
        const powVal = 0.5 * lvlMultiplier;
        drillTxt = `
          <span class="effect-stat text-green">+${uniVal.toFixed(1)} Unity</span>
          <span class="effect-stat text-green">+${stamVal.toFixed(1)} Stamina</span>
          <span class="effect-stat text-green">+${powVal.toFixed(1)} Power</span>
          <span class="effect-fatigue text-red">+12 Fatigue</span>
        `;
      } else if (t === 'tactic') {
        const tacVal = 4.0 * lvlMultiplier * tacticMult;
        drillTxt = `
          <span class="effect-stat text-green">+${tacVal.toFixed(1)} Tactic</span>
          <span class="effect-fatigue text-red">+6 Fatigue</span>
        `;
      }
      drillCard.querySelector('.drill-effects').innerHTML = drillTxt;
    }
  });

  // Shop item counts
  document.getElementById('owned-drink').innerText = state.boosters.drink;
  document.getElementById('owned-medkit').innerText = state.boosters.medkit;
  document.getElementById('owned-sponsored').innerText = state.boosters.sponsored;

  // Apply sponsor adjustments to regular items in Shop
  const drinkNameNode = document.querySelector('#item-booster-drink .item-name');
  const drinkBenefitNode = document.querySelector('#item-booster-drink .item-benefit');
  const powerCostNode = document.querySelector('#item-booster-power .buy-btn');
  const powerBenefitNode = document.querySelector('#item-booster-power .item-benefit');
  const speedCostNode = document.querySelector('#item-booster-speed .buy-btn');

  if (state.activeSponsor === 'volt') {
    powerBenefitNode.innerHTML = 'Adds <span class="text-red">+3 Power</span> to team permanently. (Volt restriction)';
    drinkNameNode.innerText = 'Energy Recovery Drink';
    drinkBenefitNode.innerText = 'Removes 30 fatigue immediately.';
    powerCostNode.innerText = 'Buy - $150';
    speedCostNode.innerText = 'Buy - $150';
  } else if (state.activeSponsor === 'aegis') {
    drinkNameNode.innerText = 'Energy Drink (Regulated)';
    drinkBenefitNode.innerHTML = '<span class="text-red">Removes 21 fatigue</span> immediately. (Anti-stimulant policy)';
    powerBenefitNode.innerText = 'Adds +5 Power to team permanently.';
    powerCostNode.innerText = 'Buy - $150';
    speedCostNode.innerText = 'Buy - $150';
  } else if (state.activeSponsor === 'unity') {
    speedCostNode.innerHTML = 'Buy - <span class="text-red">$200</span> (Taxed)';
    drinkNameNode.innerText = 'Energy Recovery Drink';
    drinkBenefitNode.innerText = 'Removes 30 fatigue immediately.';
    powerBenefitNode.innerText = 'Adds +5 Power to team permanently.';
    powerCostNode.innerText = 'Buy - $150';
  } else {
    drinkNameNode.innerText = 'Energy Recovery Drink';
    drinkBenefitNode.innerText = 'Removes 30 fatigue immediately.';
    powerBenefitNode.innerText = 'Adds +5 Power to team permanently.';
    powerCostNode.innerText = 'Buy - $150';
    speedCostNode.innerText = 'Buy - $150';
  }

  // Render sponsored item if sponsor is active
  const sponsoredShopRow = document.getElementById('item-booster-sponsored');
  if (state.activeSponsor) {
    sponsoredShopRow.classList.remove('hidden');
    const nameLabel = document.getElementById('sponsored-item-name');
    const benefitLabel = document.getElementById('sponsored-item-benefit');
    const buyBtn = document.getElementById('btn-buy-sponsored');
    
    if (state.activeSponsor === 'volt') {
      nameLabel.innerText = 'Volt Supercharge Drink';
      benefitLabel.innerText = 'Instantly removes 65 global fatigue and recovers 40 player stamina.';
      buyBtn.innerText = 'Buy - $120';
    } else if (state.activeSponsor === 'aegis') {
      nameLabel.innerText = 'Nano Physio Tape';
      benefitLabel.innerText = 'Shields against one match injury when carried, or removes 25 fatigue.';
      buyBtn.innerText = 'Buy - $100';
    } else if (state.activeSponsor === 'unity') {
      nameLabel.innerText = 'Cohesion Retreat Kit';
      benefitLabel.innerText = 'Adds +10 Unity to the team permanently.';
      buyBtn.innerText = 'Buy - $150';
    }
  } else {
    sponsoredShopRow.classList.add('hidden');
  }

  // Shop affordability notification badge
  const minCost = 100;
  const shopBadge = document.querySelector('.shop-badge');
  if (state.money >= minCost) shopBadge.classList.remove('hidden');
  else shopBadge.classList.add('hidden');

  renderSquadField();
  renderSquadTable();
  renderPlayerEditor();

  // Match Centre & Scouting
  const opponent = OPPONENTS[state.currentMatchIndex];
  if (opponent) {
    document.getElementById('opp-name').innerText = opponent.name;
    document.getElementById('opp-avatar').innerText = opponent.avatar;
    
    const showScout = (turnsLeft <= 3);
    const scoutNotice = document.getElementById('scout-locked-notice');
    const scoutCard = document.getElementById('scout-report-card');
    
    if (showScout) {
      scoutNotice.classList.add('hidden');
      scoutCard.classList.remove('hidden');
      renderScoutingReport(opponent);
    } else {
      scoutNotice.classList.remove('hidden');
      scoutCard.classList.add('hidden');
    }

    const btnEnterMatch = document.getElementById('btn-enter-match');
    const matchBadge = document.querySelector('.match-badge');
    if (turnsLeft === 0) {
      btnEnterMatch.disabled = false;
      matchBadge.classList.remove('hidden');
    } else {
      btnEnterMatch.disabled = true;
      matchBadge.classList.add('hidden');
    }
  }
}

function updateProgressBar(id, value) {
  document.getElementById(`val-${id}`).innerText = Math.round(value);
  const percent = Math.min(100, (value / 100) * 100);
  document.querySelector(`.progress-bar-fill-glow.${id}`).style.width = `${percent}%`;
}

// SCOUTING DISPLAY WITH WEAKNESS (Based on Tactics check)
function renderScoutingReport(opponent) {
  const container = document.getElementById('scout-stats-list');
  container.innerHTML = '';
  
  // Tactical check to reveal the weakness
  let weaknessRevealHtml = '';
  if (state.teamStats.tactic >= 20) {
    weaknessRevealHtml = `
      <div style="margin-bottom:15px; padding:10px; border-radius: var(--border-radius-sm); border:1px solid var(--color-green); background:rgba(16,185,129,0.05);">
        <strong class="text-green">💡 SCOUT WEAKNESS DETECTED:</strong> This opponent plays <strong style="text-transform:uppercase;">${opponent.playstyle}</strong>. They are highly weak against <strong class="text-green" style="text-transform:uppercase;">${opponent.weakness}</strong>. Play it to apply massive stat penalties!
      </div>
    `;
  } else {
    weaknessRevealHtml = `
      <div style="margin-bottom:15px; padding:10px; border-radius: var(--border-radius-sm); border:1px solid var(--color-yellow); background:rgba(245,158,11,0.05); font-size:0.75rem;">
        <span class="text-yellow">⚠️ UNRESOLVED WEAKNESS:</span> The opponent has a clear playstyle weakness. We need at least <strong class="text-yellow">20 Tactics</strong> to scout and reveal it! (Current: ${Math.round(state.teamStats.tactic)})
      </div>
    `;
  }
  
  const descBlock = document.createElement('div');
  descBlock.innerHTML = `
    <p style="font-size:0.8rem; color:var(--color-text-secondary); margin-bottom:12px;">${opponent.desc}</p>
    ${weaknessRevealHtml}
  `;
  container.appendChild(descBlock);

  const statsList = [
    { key: 'speed', label: 'Speed' },
    { key: 'stamina', label: 'Stamina' },
    { key: 'power', label: 'Power' },
    { key: 'unity', label: 'Unity' },
    { key: 'tactic', label: 'Tactics' }
  ];

  statsList.forEach(st => {
    const ourVal = Math.round(state.teamStats[st.key]);
    const oppVal = opponent.stats[st.key];
    
    let compText = 'EQUAL';
    let compClass = 'equal';
    if (ourVal > oppVal + 5) {
      compText = 'WE HAVE ADVANTAGE';
      compClass = 'advantage';
    } else if (ourVal < oppVal - 5) {
      compText = 'OPPONENT ADVANTAGE';
      compClass = 'disadvantage';
    }
    
    const leftWidth = (ourVal / (ourVal + oppVal)) * 100;
    const rightWidth = 100 - leftWidth;

    const row = document.createElement('div');
    row.className = 'scout-stat-row';
    row.innerHTML = `
      <div class="scout-stat-meta">
        <span class="scout-stat-label">${st.label}</span>
        <span class="comparison-badge ${compClass}">${compText}</span>
      </div>
      <div class="scout-bar-container">
        <span class="scout-val text-green">${ourVal}</span>
        <div class="scout-double-bar">
          <div class="scout-fill-left">
            <div class="bar-fill-segment home" style="width: ${leftWidth}%"></div>
          </div>
          <div class="scout-fill-right">
            <div class="bar-fill-segment away" style="width: ${rightWidth}%"></div>
          </div>
        </div>
        <span class="scout-val text-red">${oppVal}</span>
      </div>
    `;
    container.appendChild(row);
  });
}

// SQUAD LISTS
function renderSquadField() {
  state.players.forEach(p => {
    const fieldNode = document.querySelector(`.field-player[data-pid="${p.id}"]`);
    if (fieldNode) {
      fieldNode.querySelector('.player-name-label').innerText = p.name.split(' ')[1] || p.name;
      if (p.injured) fieldNode.classList.add('injured');
      else fieldNode.classList.remove('injured');

      if (state.selectedPlayerId === p.id) fieldNode.classList.add('selected');
      else fieldNode.classList.remove('selected');
    }
  });
}

function renderSquadTable() {
  const tbody = document.getElementById('squad-list-tbody');
  tbody.innerHTML = '';
  
  state.players.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = state.selectedPlayerId === p.id ? 'selected' : '';
    if (p.injured) tr.classList.add('text-red');
    
    tr.innerHTML = `
      <td>${p.name} ${p.injured ? '🤕' : ''}</td>
      <td>${p.position}</td>
      <td>${getPlayerRating(p)}</td>
      <td>
        <div style="display:flex; align-items:center; gap:6px;">
          <div class="progress-bar-glow" style="width:50px; height:6px;">
            <div class="progress-bar-fill-glow stamina" style="width: ${p.stamina}%"></div>
          </div>
          <span>${Math.round(p.stamina)}%</span>
        </div>
      </td>
    `;
    tr.addEventListener('click', () => { selectPlayer(p.id); });
    tbody.appendChild(tr);
  });
}

function selectPlayer(id) {
  state.selectedPlayerId = id;
  updateUI();
}

function renderPlayerEditor() {
  const hint = document.querySelector('.select-hint');
  const form = document.getElementById('editor-form');
  
  if (state.selectedPlayerId === null) {
    hint.classList.remove('hidden');
    form.classList.add('hidden');
    return;
  }
  
  hint.classList.add('hidden');
  form.classList.remove('hidden');
  
  const player = state.players[state.selectedPlayerId];
  const nameInput = document.getElementById('edit-player-name');
  if (document.activeElement !== nameInput) {
    nameInput.value = player.name;
  }
  
  document.getElementById('player-view-pos').innerText = player.position;
  document.getElementById('player-view-rating').innerText = getPlayerRating(player);
  document.getElementById('player-view-stamina-val').innerText = `${Math.round(player.stamina)}%`;
  document.getElementById('player-view-stamina-bar').style.width = `${player.stamina}%`;
  
  const statusNode = document.getElementById('player-view-status');
  if (player.injured) {
    statusNode.innerText = 'Injured (Sacked rating)';
    statusNode.className = 'status-badge injured';
  } else if (player.stamina < 40) {
    statusNode.innerText = 'Fatigue Warning';
    statusNode.className = 'status-badge warning';
  } else {
    statusNode.innerText = 'Healthy & Fit';
    statusNode.className = 'status-badge healthy';
  }

  const btnDrink = document.getElementById('btn-use-drink-player');
  const btnMed = document.getElementById('btn-use-medkit-player');
  
  btnDrink.innerText = `Recover Stamina (Energy Drink: ${state.boosters.drink} left)`;
  btnDrink.disabled = state.boosters.drink <= 0 || player.stamina >= 100;
  
  btnMed.innerText = `Heal Injury (Medical Kit: ${state.boosters.medkit} left)`;
  btnMed.disabled = state.boosters.medkit <= 0 || !player.injured;
}

// HANDLERS
function setupEventListeners() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.matchState.active || state.penaltyState.active) return;
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  const nameInput = document.getElementById('edit-player-name');
  nameInput.addEventListener('input', (e) => {
    if (state.selectedPlayerId !== null) {
      state.players[state.selectedPlayerId].name = e.target.value;
      renderSquadField();
      const listRows = document.querySelectorAll('#squad-list-tbody tr');
      if (listRows[state.selectedPlayerId]) {
        listRows[state.selectedPlayerId].querySelector('td').innerHTML = `${e.target.value} ${state.players[state.selectedPlayerId].injured ? '🤕' : ''}`;
      }
    }
  });

  document.querySelectorAll('.field-player').forEach(node => {
    node.addEventListener('click', () => {
      const pid = parseInt(node.getAttribute('data-pid'));
      selectPlayer(pid);
    });
  });

  document.getElementById('btn-use-drink-player').onclick = () => {
    if (state.selectedPlayerId !== null && state.boosters.drink > 0) {
      state.boosters.drink--;
      const p = state.players[state.selectedPlayerId];
      
      // Energy drink details modified by Aegis debuff
      let drinkStam = 50;
      let globalRecovery = 15;
      if (state.activeSponsor === 'aegis') {
        drinkStam = 35;
        globalRecovery = 10.5;
      }
      p.stamina = Math.min(100, p.stamina + drinkStam);
      state.globalFatigue = Math.max(0, state.globalFatigue - globalRecovery);
      
      logAction(`Used drink. ${p.name} stamina +${drinkStam}. Team fatigue -${globalRecovery.toFixed(1)}.`);
      updateUI();
    }
  };

  document.getElementById('btn-use-medkit-player').onclick = () => {
    if (state.selectedPlayerId !== null && state.boosters.medkit > 0) {
      const p = state.players[state.selectedPlayerId];
      if (p.injured) {
        state.boosters.medkit--;
        p.injured = false;
        p.stamina = 100;
        logAction(`Applied medkit. ${p.name} fully healed.`);
        updateUI();
      }
    }
  };
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.getAttribute('data-tab') === tab) b.classList.add('active');
    else b.classList.remove('active');
  });

  document.querySelectorAll('.tab-panel').forEach(p => {
    if (p.id === `panel-${tab}`) p.classList.add('active');
    else p.classList.remove('active');
  });
  updateUI();
}

function logAction(msg) {
  console.log(`[Turn ${state.turn}] ${msg}`);
}

// TRAINING ACTIONS
function handleTrain(drill) {
  if (state.globalFatigue >= 100) {
    alert("CRITICAL FATIGUE: Your team is too exhausted to train! You must REST to lower fatigue.");
    return;
  }

  const lvl = state.facilities[drill];
  const lvlMultiplier = 1 + (lvl - 1) * 0.25;

  let speedMult = 1.0;
  let tacticMult = 1.0;
  let unityMult = 1.0;
  
  if (state.activeSponsor === 'volt') speedMult = 1.5;
  if (state.activeSponsor === 'aegis') tacticMult = 1.5;
  if (state.activeSponsor === 'unity') unityMult = 1.5;

  let fatigueGained = 0;
  
  // Base stats gained increased overall to 4.0 for balance
  switch (drill) {
    case 'speed':
      state.teamStats.speed += 4.0 * lvlMultiplier * speedMult;
      state.teamStats.stamina += 1.0 * lvlMultiplier;
      state.teamStats.power += 0.5 * lvlMultiplier;
      state.teamStats.tactic += 0.5 * lvlMultiplier;
      fatigueGained = 16;
      break;
    case 'stamina':
      state.teamStats.stamina += 4.0 * lvlMultiplier;
      state.teamStats.power += 1.5 * lvlMultiplier;
      fatigueGained = 20;
      break;
    case 'power':
      state.teamStats.power += 4.0 * lvlMultiplier;
      state.teamStats.stamina += 1.5 * lvlMultiplier;
      fatigueGained = 22;
      break;
    case 'unity':
      state.teamStats.unity += 4.0 * lvlMultiplier * unityMult;
      state.teamStats.stamina += 0.5 * lvlMultiplier;
      state.teamStats.power += 0.5 * lvlMultiplier;
      fatigueGained = 12;
      break;
    case 'tactic':
      state.teamStats.tactic += 4.0 * lvlMultiplier * tacticMult;
      fatigueGained = 6;
      break;
  }

  state.globalFatigue = Math.min(100, state.globalFatigue + fatigueGained);

  // Individual stamina drops and injuries
  state.players.forEach(p => {
    const individualFatigue = fatigueGained * (0.6 + Math.random() * 0.8);
    p.stamina = Math.max(0, p.stamina - individualFatigue);
    
    if (p.stamina < 30 && !p.injured) {
      let riskReduction = 1.0;
      // Aegis reduces overall injury rate
      if (state.activeSponsor === 'aegis') riskReduction = 0.5;

      const injuryChance = 0.15 * (1 - Math.min(0.8, state.teamStats.tactic / 120)) * riskReduction;
      if (Math.random() < injuryChance) {
        p.injured = true;
        p.stamina = Math.max(5, p.stamina - 20);
        alert(`INJURY WARNING: ${p.name} pulled a muscle during high-fatigue training!`);
      }
    }
  });

  logAction(`Trained ${drill} (Lvl ${lvl}). globalFatigue: ${state.globalFatigue}%`);
  advanceTurn();
}

function handleRest() {
  let restAmount = 45;
  // Unity Buff increases rest effectiveness
  if (state.activeSponsor === 'unity') restAmount = 60;

  state.globalFatigue = Math.max(0, state.globalFatigue - restAmount);
  
  state.players.forEach(p => {
    p.stamina = Math.min(100, p.stamina + 35);
    
    if (p.injured) {
      const recoveryChance = 0.2 + (state.teamStats.tactic / 100) * 0.15;
      if (Math.random() < recoveryChance) {
        p.injured = false;
        p.stamina = 50;
        alert(`GOOD NEWS: ${p.name} recovered from injury after rest!`);
      }
    }
  });

  logAction(`Rested team. Fatigue reduced to ${state.globalFatigue}%`);
  advanceTurn();
}

function advanceTurn() {
  state.turn++;
  checkTurnMilestones();
  updateUI();
}

// MONEY BALANCED: More early sponsor money, less late game
function checkTurnMilestones() {
  if (state.turn === 5 || state.turn === 15 || state.turn === 25) {
    let basePayout = 500;
    if (state.turn === 5) basePayout = 800; // Early buff
    if (state.turn === 15) basePayout = 500;
    if (state.turn === 25) basePayout = 300; // Late nerf
    
    // Add Sponsor bonus income
    let sponsorBonus = 0;
    if (state.activeSponsor === 'volt') sponsorBonus = 200;
    if (state.activeSponsor === 'aegis') sponsorBonus = 150;
    if (state.activeSponsor === 'unity') sponsorBonus = 250;
    
    state.money += (basePayout + sponsorBonus);
    
    // Display funding alert
    document.querySelector('#modal-sponsor .modal-cash-received').innerText = `+$${basePayout + sponsorBonus}`;
    document.querySelector('#modal-sponsor .modal-text').innerText = `Your sponsors deposited cash to help you prepare the team. Payout base: $${basePayout} + Sponsor bonus: $${sponsorBonus}`;
    showSponsorModal();
  }

  const matchTurn = (state.currentMatchIndex + 1) * 10;
  if (state.turn === matchTurn) {
    switchTab('match-centre');
    alert(`MATCH DAY! Apex Academy faces ${OPPONENTS[state.currentMatchIndex].name}. Head to Match Centre to play!`);
  }
}

function showSponsorModal() {
  document.getElementById('modal-sponsor').classList.remove('hidden');
}

function closeSponsorModal() {
  document.getElementById('modal-sponsor').classList.add('hidden');
  updateUI();
}

// SHOP FACILITY BUYS
function buyFacility(type) {
  const lvl = state.facilities[type];
  const cost = lvl * 200;
  
  if (state.money >= cost) {
    state.money -= cost;
    state.facilities[type]++;
    logAction(`Upgraded ${type} facility to level ${state.facilities[type]}`);
    updateUI();
  } else {
    alert("Insufficient funds!");
  }
}

function buyBooster(type) {
  const cost = type === 'drink' ? 100 : 250;
  if (state.money >= cost) {
    state.money -= cost;
    state.boosters[type]++;
    logAction(`Bought ${type}`);
    updateUI();
  } else {
    alert("Insufficient funds!");
  }
}

function buyStatBooster(type) {
  const costs = { speed: 150, stamina: 150, power: 150, unity: 200, tactic: 150 };
  let cost = costs[type];
  
  // Unity Sponsor debuffs Insoles
  if (state.activeSponsor === 'unity' && type === 'speed') cost = 200;

  if (state.money >= cost) {
    state.money -= cost;
    
    // Volt Sponsor debuffs Power stat booster
    let gain = 5;
    if (state.activeSponsor === 'volt' && type === 'power') gain = 3;

    state.teamStats[type] += gain;
    logAction(`Purchased Booster: +${gain} permanent ${type.toUpperCase()}`);
    updateUI();
  } else {
    alert("Insufficient funds!");
  }
}

// SPONSOR PICK MECHANICS
function buySponsoredItem() {
  let cost = 100;
  if (state.activeSponsor === 'volt') cost = 120;
  if (state.activeSponsor === 'aegis') cost = 100;
  if (state.activeSponsor === 'unity') cost = 150;

  if (state.money >= cost) {
    state.money -= cost;
    if (state.activeSponsor === 'unity') {
      // Cohesion retreat kit gives +10 unity directly
      state.teamStats.unity += 10;
      logAction("Purchased Cohesion Retreat: Team Unity increased by +10!");
    } else {
      // Consumables (Volt Drink, Physio Tape)
      state.boosters.sponsored++;
      logAction(`Purchased Sponsored Booster (${state.activeSponsor})`);
    }
    updateUI();
  } else {
    alert("Insufficient funds for sponsor item!");
  }
}

// Using sponsored consumables
function feedSponsoredConsumable(pid) {
  if (state.boosters.sponsored <= 0) return;

  const player = state.players[pid];
  if (state.activeSponsor === 'volt') {
    state.boosters.sponsored--;
    player.stamina = Math.min(100, player.stamina + 40);
    state.globalFatigue = Math.max(0, state.globalFatigue - 65);
    alert(`Fed Volt Drink to ${player.name}. Fatigue cleared by 65, stamina +40!`);
  } else if (state.activeSponsor === 'aegis') {
    state.boosters.sponsored--;
    state.globalFatigue = Math.max(0, state.globalFatigue - 25);
    // Physio tape protects from injury for 1 match (we will check state.boosters.sponsored when injury occurs)
    alert(`Applied Nano Physio Tape on ${player.name}. Team fatigue -25. Tape will shield against the next match injury!`);
  }
  updateUI();
}

// Override Squad Energy Drink shortcut to allow feed sponsored consumable
document.getElementById('btn-use-drink-player').onclick = () => {
  if (state.selectedPlayerId !== null) {
    if (state.activeSponsor && (state.activeSponsor === 'volt' || state.activeSponsor === 'aegis') && state.boosters.sponsored > 0) {
      feedSponsoredConsumable(state.selectedPlayerId);
    } else if (state.boosters.drink > 0) {
      state.boosters.drink--;
      const p = state.players[state.selectedPlayerId];
      let drinkStam = 50;
      let globalRecovery = 15;
      if (state.activeSponsor === 'aegis') {
        drinkStam = 35;
        globalRecovery = 10.5;
      }
      p.stamina = Math.min(100, p.stamina + drinkStam);
      state.globalFatigue = Math.max(0, state.globalFatigue - globalRecovery);
      alert(`Used Standard Drink. Stamina +${drinkStam}. Team fatigue -${globalRecovery.toFixed(1)}.`);
      updateUI();
    }
  }
};

// MATCH CENTRE MATCH STARTER
function enterMatchScreen() {
  const opponent = OPPONENTS[state.currentMatchIndex];
  state.matchState.active = true;
  state.matchState.resultHandled = false; // reset per-match result guard
  state.matchState.halfEnded = false;
  state.matchState.opponent = opponent;
  state.matchState.half = 1;
  state.matchState.time = 0;
  state.matchState.homeScore = 0;
  state.matchState.awayScore = 0;
  state.matchState.possession = 'home';
  state.matchState.homeStamina = 100;
  state.matchState.awayStamina = 100;
  state.matchState.tempFrontBoost = 0;
  state.matchState.activeSetPiece = null;
  
  document.getElementById('match-opp-name').innerText = opponent.name;
  document.getElementById('scoreboard-score').innerText = '0 - 0';
  document.getElementById('scoreboard-time').innerText = '00:00';
  
  const commentaryLog = document.getElementById('commentary-log');
  commentaryLog.innerHTML = `<div class="comment-line system-msg">Kickoff. Apex Academy vs ${opponent.name}. Choose Play Style Strategy...</div>`;
  
  document.getElementById('match-overlay').classList.remove('hidden');
  showTacticSelector(1);
}

function showTacticSelector(halfNum) {
  document.getElementById('half-label').innerText = halfNum === 1 ? 'First Half' : 'Second Half';
  document.getElementById('tactic-selection-panel').classList.remove('hidden');
}

function startHalf() {
  const radios = document.getElementsByName('tactic-choice');
  let selected = 'attack';
  for (let r of radios) {
    if (r.checked) selected = r.value;
  }
  state.matchState.tactic = selected;
  document.getElementById('tactic-selection-panel').classList.add('hidden');
  runMatchSimulation();
}

function runMatchSimulation() {
  // Clear any previously running timer (safety)
  if (state.matchState.timerId) {
    clearInterval(state.matchState.timerId);
    state.matchState.timerId = null;
  }

  const updateInterval = 1000;
  const startMins = state.matchState.half === 1 ? 0 : 45;
  const endMins = state.matchState.half === 1 ? 45 : 90;
  state.matchState.time = startMins;
  state.matchState.halfEnded = false; // reset per-half end guard

  addCommentary(`Start of the ${state.matchState.half === 1 ? 'First Half' : 'Second Half'} (${state.matchState.tactic.toUpperCase()} tactic).`, 'system-msg');

  state.matchState.timerId = setInterval(() => {
    // Discard stale ticks if the match/half has already ended
    if (!state.matchState.active || state.matchState.halfEnded) return;

    state.matchState.time += 5;

    // Skip simulation tick while a set piece is pending
    if (state.matchState.activeSetPiece === null) {
      simulateGameSegment();
      animatePitchElements();
    }

    document.getElementById('scoreboard-time').innerText = formatTime(state.matchState.time);
    document.getElementById('scoreboard-score').innerText = `${state.matchState.homeScore} - ${state.matchState.awayScore}`;
    document.getElementById('match-home-stamina').innerText = `${Math.round(state.matchState.homeStamina)}%`;
    document.getElementById('match-opp-stamina').innerText = `${Math.round(state.matchState.awayStamina)}%`;

    if (state.matchState.time >= endMins) {
      state.matchState.halfEnded = true;
      clearInterval(state.matchState.timerId);
      state.matchState.timerId = null;
      endHalf();
    }
  }, updateInterval);
}

function formatTime(minutes) {
  const mStr = minutes < 10 ? '0' + minutes : minutes;
  return `${mStr}:00`;
}

function addCommentary(msg, typeClass = '') {
  const commentaryLog = document.getElementById('commentary-log');
  const div = document.createElement('div');
  div.className = `comment-line ${typeClass}`;
  const timeFormatted = formatTime(state.matchState.time);
  div.innerHTML = `<span style="font-family:monospace; color:var(--color-text-muted)">[${timeFormatted}]</span> ${msg}`;
  commentaryLog.appendChild(div);
  commentaryLog.scrollTop = commentaryLog.scrollHeight;
}

// 2D ANIMATION
function animatePitchElements() {
  const ball = document.getElementById('pitch-ball');
  const pos = state.matchState.possession;
  
  let targetBallX = 50;
  let targetBallY = 50 + (Math.random() * 30 - 15);
  
  if (pos === 'home') {
    const progress = (state.matchState.time % 20) / 20;
    targetBallX = 55 + progress * 35;
  } else {
    const progress = (state.matchState.time % 20) / 20;
    targetBallX = 45 - progress * 35;
  }
  
  ball.style.left = `${targetBallX}%`;
  ball.style.top = `${targetBallY}%`;

  const playerGroups = ['h-gk', 'h-df1', 'h-df2', 'h-mf1', 'h-mf2', 'h-fw', 'a-gk', 'a-df1', 'a-df2', 'a-mf1', 'a-mf2', 'a-fw'];
  playerGroups.forEach(pId => {
    const node = document.getElementById(`player-${pId}`);
    if (node) {
      let baseLeft = 50;
      let baseTop = 50;
      
      if (pId.startsWith('h-')) {
        if (pId.includes('gk')) { baseLeft = 10; baseTop = 50; }
        else if (pId.includes('df')) { baseLeft = 30; baseTop = pId.includes('1') ? 30 : 70; }
        else if (pId.includes('mf')) { baseLeft = 55; baseTop = pId.includes('1') ? 30 : 70; }
        else if (pId.includes('fw')) { baseLeft = 78; baseTop = 50; }
      } else {
        if (pId.includes('gk')) { baseLeft = 90; baseTop = 50; }
        else if (pId.includes('df')) { baseLeft = 70; baseTop = pId.includes('1') ? 30 : 70; }
        else if (pId.includes('mf')) { baseLeft = 45; baseTop = pId.includes('1') ? 30 : 70; }
        else if (pId.includes('fw')) { baseLeft = 22; baseTop = 50; }
      }

      const driftX = (Math.random() * 10 - 5);
      const driftY = (Math.random() * 15 - 7.5);
      node.style.left = `${baseLeft + driftX}%`;
      node.style.top = `${baseTop + driftY}%`;
    }
  });
}

function showPitchPopup(text) {
  const popup = document.getElementById('action-popup');
  const ball = document.getElementById('pitch-ball');
  popup.innerText = text;
  popup.style.left = ball.style.left;
  popup.style.top = ball.style.top;
  popup.classList.remove('hidden');
  
  const newPopup = popup.cloneNode(true);
  popup.parentNode.replaceChild(newPopup, popup);
}

// DETAILED MATCH EVENT SIMULATOR (FAVORS STRATEGIC PLAY & SYNERGY)
function simulateGameSegment() {
  const opp = state.matchState.opponent;
  const tactics = state.matchState.tactic;
  
  // Decrement Free Kick Front Boost
  if (state.matchState.tempFrontBoost > 0) {
    state.matchState.tempFrontBoost--;
  }

  // Modifiers
  let modGK = 1.0;
  let modBack = 1.0;
  let modMid = 1.0;
  let modFront = 1.0;
  let stamCostMult = 1.0;
  let teamSpeedBonus = 1.0;

  if (tactics === 'attack') {
    modFront = 1.20;
    modBack = 0.85;
    stamCostMult = 1.20;
  } else if (tactics === 'defense') {
    modBack = 1.25;
    modGK = 1.20;
    modFront = 0.85;
    stamCostMult = 0.85;
  } else if (tactics === 'counter') {
    modMid = 1.20;
    teamSpeedBonus = 1.25; // Counter increases speed
  }

  // Apply Free Kick Boost
  if (state.matchState.tempFrontBoost > 0) {
    modFront *= 1.30;
  }

  // Kicker calculations
  let GKRating = getGKRating() * modGK;
  let BackRating = getBackRating() * modBack;
  let MidRating = getMidRating() * modMid;
  let FrontRating = getFrontRating() * modFront;

  // Simulate Opponent tactical modifiers
  let oppGK = opp.stats.tactic * 1.0 + opp.stats.speed * 0.8 + opp.stats.power * 0.5;
  let oppBack = opp.stats.unity * 0.9 + opp.stats.tactic * 0.9 + opp.stats.power * 0.6 + opp.stats.speed * 0.6;
  let oppMid = opp.stats.unity * 1.0 + opp.stats.tactic * 1.0;
  let oppFront = opp.stats.power * 0.9 + opp.stats.tactic * 0.9 + opp.stats.speed * 0.5 + opp.stats.stamina * 0.5;

  let oppModDF = 1.0;
  let oppModFW = 1.0;
  let oppModMF = 1.0;

  if (opp.playstyle === 'defense') { oppModDF = 1.20; oppModFW = 0.90; }
  else if (opp.playstyle === 'attack') { oppModFW = 1.20; oppModDF = 0.85; }
  else if (opp.playstyle === 'counter') { oppModMF = 1.20; }

  oppGK *= (opp.playstyle === 'defense' ? 1.20 : 1.0);
  oppBack *= oppModDF;
  oppMid *= oppModMF;
  oppFront *= oppModFW;

  // WEAKNESS PENALTY SCALING OFF TACTIC
  if (tactics === opp.weakness) {
    const tacticLevel = state.teamStats.tactic;
    const penaltyVal = (tacticLevel / 100) * 0.35; // Scales directly with tactic (up to 35%+)
    
    // Penalize opponent stats
    oppGK *= (1 - penaltyVal);
    oppBack *= (1 - penaltyVal);
    oppMid *= (1 - penaltyVal);
    oppFront *= (1 - penaltyVal);
    
    if (state.matchState.time % 15 === 0) {
      addCommentary(`<strong class="text-green">💡 STRATEGIC BREAKTHROUGH:</strong> Opponent is highly disoriented by our <strong style="text-transform:uppercase;">${tactics}</strong> playstyle. Opponent stats penalized by -${Math.round(penaltyVal*100)}% (scaled off our Tactics)!`, 'system-msg');
    }
  }

  // Stamina costs
  state.matchState.homeStamina = Math.max(10, state.matchState.homeStamina - (1.6 * stamCostMult));
  state.matchState.awayStamina = Math.max(10, state.matchState.awayStamina - 1.5);

  // Possession simulation (synergy & speed bonus)
  const homePoss = MidRating * 0.7 + state.teamStats.speed * teamSpeedBonus * 0.3;
  const awayPoss = oppMid * 0.7 + opp.stats.speed * 0.3;
  const totalPoss = homePoss + awayPoss;
  
  if (Math.random() < (homePoss / totalPoss)) state.matchState.possession = 'home';
  else state.matchState.possession = 'away';

  // NEW MATCH EVENTS ADDITIONS: Outs, Goal Openings, Corners, Fouls, Free Kicks & Penalties
  const eventRoll = Math.random();

  // 1. OUTS (15% Chance)
  if (eventRoll < 0.15) {
    showPitchPopup("OUT!");
    const outMessages = [
      "The ball drifts out of bounds for a throw-in.",
      "Clearance goes out. Goal kick for the opposing side.",
      "Apex midfielder plays it long but it runs out for a throw.",
      "Opponent clearing kick sends the ball deep into touch."
    ];
    addCommentary(outMessages[Math.floor(Math.random() * outMessages.length)]);
    // Swap possession
    state.matchState.possession = (state.matchState.possession === 'home' ? 'away' : 'home');
    return;
  }

  // 2. CORNER KICKS (10% Chance)
  if (eventRoll >= 0.15 && eventRoll < 0.25) {
    showPitchPopup("CORNER!");
    const cornerSide = Math.random() < 0.5 ? 'home' : 'away';
    if (cornerSide === 'home') {
      addCommentary(`Corner kick awarded to Apex Academy! Kicker swings a high cross into the opponent box...`);
      // Corner success depends on Unity (coordination) & Power (header) vs Opponent Back Rating
      const cornerPower = state.teamStats.unity * 0.5 + state.teamStats.power * 0.5;
      const cornerDef = oppBack;
      
      if (Math.random() < (cornerPower / (cornerPower + cornerDef * 1.2))) {
        state.matchState.homeScore++;
        addCommentary(`⚽ GOOOAL FROM CORNER! ${getRandomPlayer('Front')} rises highest and thumps a bullet header past the keeper!`, 'goal');
        showPitchPopup("GOAL!");
      } else {
        addCommentary(`Opponent center back leaps high to clear the corner away.`);
      }
    } else {
      addCommentary(`Dangerous corner kick for ${opp.name}. Cross floated into our penalty area...`);
      const oppCornerPower = opp.stats.unity * 0.5 + opp.stats.power * 0.5;
      const ourCornerDef = BackRating * 0.8 + GKRating * 0.2;
      
      if (Math.random() < (oppCornerPower / (oppCornerPower + ourCornerDef * 1.3))) {
        state.matchState.awayScore++;
        addCommentary(`❌ GOAL! Opponent striker beats our defense to the corner and nods it into the net.`, 'danger');
        showPitchPopup("GOAL!");
      } else {
        addCommentary(`Apex goalkeeper commands the area and punches the corner cross clear.`);
      }
    }
    return;
  }

  // 3. FOULS & SET PIECES (Interactive choice for player)
  if (eventRoll >= 0.25 && eventRoll < 0.38) {
    const foulSide = Math.random() < 0.5 ? 'home' : 'away'; // who committed the foul
    
    // Attacking playstyle increases foul risk. Defending tactics reduce it.
    let riskFactor = tactics === 'attack' ? 1.4 : 1.0;
    const defTactic = state.teamStats.tactic;
    const foulReduction = Math.min(0.6, defTactic / 150);

    if (foulSide === 'home' && Math.random() > foulReduction) {
      // Player committed a foul (Opponent gets set piece - simulated automatically)
      const penaltyRoll = Math.random() < 0.2; // 20% penalty
      if (penaltyRoll) {
        addCommentary(`⚠️ FOUL IN BOX! Our defender trips the attacker. PENALTY KICK for ${opp.name}!`, 'danger');
        showPitchPopup("PENALTY!");
        
        // Opponent penalty simulation
        const oppPenSkill = opp.stats.tactic * 0.5 + opp.stats.power * 0.5;
        const ourGKSkill = GKRating;
        if (Math.random() < (oppPenSkill / (oppPenSkill + ourGKSkill * 0.4))) {
          state.matchState.awayScore++;
          addCommentary(`❌ PENALTY CONVERTED! The opponent striker rolls it into the bottom corner.`, 'danger');
        } else {
          addCommentary(`🧤 SAVED! Our goalkeeper makes a spectacular dive to block the penalty! The crowd goes wild!`);
        }
      } else {
        addCommentary(`Foul called against us. Free kick in a dangerous area for ${opp.name}.`);
        showPitchPopup("FOUL!");
        const oppFkSkill = opp.stats.tactic;
        if (Math.random() < (oppFkSkill / (oppFkSkill + GKRating * 1.5))) {
          state.matchState.awayScore++;
          addCommentary(`❌ GOAL! Opponent midfielder curls the free kick over the wall and into the net.`, 'danger');
        } else {
          addCommentary(`The opponent's free kick sails over the crossbar.`);
        }
      }
    } else {
      // Opponent committed a foul. Player gets interactive kicker choice!
      const penaltyRoll = Math.random() < 0.2; // 20% penalty
      const setPieceType = penaltyRoll ? 'penalty' : 'freekick';
      
      clearInterval(state.matchState.timerId); // Pause simulation
      state.matchState.activeSetPiece = setPieceType;
      
      if (setPieceType === 'penalty') {
        addCommentary(`⚠️ PENALTY AWARDED! Opponent defender slide tackles our forward in the penalty area! Select your kicker...`, 'system-msg');
      } else {
        addCommentary(`💥 FOUL CALL! Opponent trips our winger just outside the penalty box. Free kick awarded! Select your kicker...`, 'system-msg');
      }
      
      showKickerSelection(setPieceType);
    }
    return;
  }

  // 4. GOAL OPENINGS (10% Chance)
  let openingModifier = 1.0;
  if (eventRoll >= 0.38 && eventRoll < 0.48) {
    openingModifier = 2.0; // Double success chance!
    if (state.matchState.possession === 'home') {
      addCommentary(`<strong class="text-green">🔥 DEFENSE CRACKED:</strong> A massive opening in the opponent's defensive line! Apex forwards flood the space!`);
    } else {
      addCommentary(`<strong class="text-red">⚠️ DEFENSIVE GAP:</strong> A major opening appears in our defense! Opponent forwards rush forward!`);
    }
  }

  // Standard Segment Actions (Possession based)
  const roll = Math.random();
  if (state.matchState.possession === 'home') {
    if (roll < 0.50) {
      addCommentary(`${getRandomPlayer('Mid')} passes cleanly to set up the attack.`);
    } else if (roll < 0.85) {
      // Shot chance (Modified by Goal opening)
      showPitchPopup("SHOT!");
      const attackForce = (FrontRating * 0.6 + state.teamStats.unity * 0.4) * openingModifier;
      const defendForce = oppBack * 0.85 + oppGK * 0.15;
      
      if (Math.random() < (attackForce / (attackForce + defendForce))) {
        const shootPrecision = state.teamStats.tactic * 0.5 + state.teamStats.power * 0.5;
        const gkSaveSkill = oppGK * 0.95;
        
        if (Math.random() < (shootPrecision / (shootPrecision + gkSaveSkill))) {
          state.matchState.homeScore++;
          addCommentary(`⚽ GOOOAL! ${getRandomPlayer('Front')} unleashes an unstoppable shot! Apex Academy scores!`, 'goal');
          showPitchPopup("GOAL!");
        } else {
          addCommentary(`Shot saved! The opponent goalkeeper parries it away.`);
        }
      } else {
        addCommentary(`Opponent defender steps in to clear the ball.`);
      }
    } else {
      checkForMatchInjury();
    }
  } else {
    // Opponent Attacks
    if (roll < 0.50) {
      addCommentary(`Opponent passes fluidly through the midfield channel.`);
    } else if (roll < 0.85) {
      const oppAttackForce = (oppFront * 0.6 + opp.stats.unity * 0.4) * openingModifier;
      const ourDefendForce = BackRating * 0.85 + GKRating * 0.15;
      
      if (Math.random() < (oppAttackForce / (oppAttackForce + ourDefendForce))) {
        const oppPrecision = opp.stats.tactic * 0.5 + opp.stats.power * 0.5;
        const ourGKSkill = GKRating * 0.95;
        
        if (Math.random() < (oppPrecision / (oppPrecision + ourGKSkill))) {
          state.matchState.awayScore++;
          addCommentary(`❌ GOAL! Opponent forward scores with a clinical finish.`, 'danger');
          showPitchPopup("GOAL!");
        } else {
          addCommentary(`Reflex save! ${getRandomPlayer('GK')} blocks the opponent's close-range effort.`);
        }
      } else {
        addCommentary(`Excellent interception! ${getRandomPlayer('Back')} dispossesses the opponent winger.`);
      }
    } else {
      addCommentary(`Opponent winger shoots wide of the target.`);
    }
  }
}

function getRandomPlayer(position) {
  const filtered = state.players.filter(p => p.position === position && !p.injured);
  if (filtered.length === 0) return 'A player';
  return filtered[Math.floor(Math.random() * filtered.length)].name;
}

function checkForMatchInjury() {
  const injuryTacticSave = state.teamStats.tactic;
  let riskMult = state.matchState.tactic === 'attack' ? 1.4 : (state.matchState.tactic === 'defense' ? 0.7 : 1.0);
  if (state.activeSponsor === 'aegis') riskMult *= 0.5; // Halve match injury chance

  const baseChance = 0.08 * riskMult;
  const saveRate = Math.min(0.85, injuryTacticSave / 140);
  
  if (Math.random() < baseChance * (1 - saveRate)) {
    // Check if Aegis Tape shields against injury
    if (state.activeSponsor === 'aegis' && state.boosters.sponsored > 0) {
      state.boosters.sponsored--;
      addCommentary(`🛡️ AEGIS SHIELD: Aegis Physio Tape protected our player from sustaining an injury! Physio Tape consumed.`, 'system-msg');
      return;
    }

    const healthy = state.players.filter(p => !p.injured);
    if (healthy.length > 0) {
      const injuredPlayer = healthy[Math.floor(Math.random() * healthy.length)];
      injuredPlayer.injured = true;
      const penFactor = 1 - Math.min(0.5, injuryTacticSave / 200);
      injuredPlayer.stamina = Math.max(10, injuredPlayer.stamina - (40 * penFactor));
      
      addCommentary(`⚠️ INJURY! ${injuredPlayer.name} takes a hard knock and leaves the pitch! Rating severely impacted!`, 'danger');
      showPitchPopup("INJURY!");
    }
  } else {
    addCommentary(`Aggressive slide challenge, but no injuries occurred.`);
  }
}

// FREE KICK / PENALTY KICKER SELECTION MODAL
function showKickerSelection(type) {
  const modal = document.getElementById('modal-choose-kicker');
  modal.classList.remove('hidden');
  
  const title = document.getElementById('kicker-modal-title');
  const desc = document.getElementById('kicker-modal-desc');
  const statHeader = document.getElementById('kicker-stat-header');
  
  if (type === 'freekick') {
    title.innerText = "Free Kick Awarded!";
    desc.innerText = "Select a player to take the free kick. Success chance scales off their Tactics (precision). Scored kick grants a +30% Forward rating boost for 3 turns.";
    statHeader.innerText = "Tactics (TAC)";
  } else {
    title.innerText = "Penalty Kick Awarded!";
    desc.innerText = "Select a player to shoot. Success chance scales off their Tactics & Power.";
    statHeader.innerText = "TAC + POW";
  }
  
  const tbody = document.getElementById('kicker-list-tbody');
  tbody.innerHTML = '';
  
  state.players.forEach(p => {
    if (p.injured) return;
    
    // Display individual stat based on team base + player modifier
    let kickerStat = 0;
    if (type === 'freekick') {
      kickerStat = Math.round(state.teamStats.tactic * p.tacticMod);
    } else {
      kickerStat = Math.round((state.teamStats.tactic * p.tacticMod * 0.5) + (state.teamStats.power * p.powerMod * 0.5));
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.position}</td>
      <td class="text-green">${kickerStat} <span style="font-size:0.7rem; color:var(--color-text-muted)">(${type === 'freekick' ? p.tacticMod : p.powerMod}x)</span></td>
      <td><button class="btn btn-primary buy-btn" style="padding:6px 12px; font-size:0.75rem;">Take Kick</button></td>
    `;
    
    tr.querySelector('button').onclick = () => {
      executeSetPiece(p.id, type);
    };
    
    tbody.appendChild(tr);
  });
}

function executeSetPiece(playerId, type) {
  // Hide modal
  document.getElementById('modal-choose-kicker').classList.add('hidden');
  state.matchState.activeSetPiece = null;

  const player = state.players[playerId];
  const opp = state.matchState.opponent;
  const oppGK = opp.stats.tactic * 1.0 + opp.stats.speed * 0.8 + opp.stats.power * 0.5;

  if (type === 'freekick') {
    const kTac = state.teamStats.tactic * player.tacticMod;
    // Success rate formula (Tactic dependent)
    const successChance = (kTac * 1.3) / (kTac * 1.3 + oppGK * 1.8);
    const finalRoll = Math.random();

    if (finalRoll < successChance) {
      state.matchState.homeScore++;
      addCommentary(`⚽ FREE KICK GOAL! ${player.name} curls a beautiful shot over the defensive wall and into the top corner!`, 'goal');
      showPitchPopup("GOAL!");
    } else if (finalRoll < successChance + 0.3) {
      addCommentary(`CLOSE! ${player.name}'s free kick is tipped over the bar by the keeper.`);
    } else {
      addCommentary(`The free kick by ${player.name} goes wide of the post.`);
    }
    
    // Scored or missed, free kick builds tactical momentum
    state.matchState.tempFrontBoost = 3;
    addCommentary(`Apex Academy gains tactical momentum! Forwards receive a +30% boost for the next 3 segments.`, 'system-msg');
  } else {
    // Penalty
    const kTac = state.teamStats.tactic * player.tacticMod;
    const kPow = state.teamStats.power * player.powerMod;
    const kScore = (kTac * 0.5) + (kPow * 0.5);
    
    // High base success rate (70%) modified by stats
    const successChance = Math.min(0.95, Math.max(0.4, 0.70 + (kScore - oppGK) * 0.005));
    
    if (Math.random() < successChance) {
      state.matchState.homeScore++;
      addCommentary(`⚽ PENALTY GOAL! ${player.name} sends the goalkeeper the wrong way and slots it home coolly!`, 'goal');
      showPitchPopup("GOAL!");
    } else {
      addCommentary(`SAVED! Opponent keeper guesses correctly and parries ${player.name}'s penalty!`);
    }
  }

  // Resume simulation only if the match is still active
  if (state.matchState.active) {
    runMatchSimulation();
  }
}

// HALF & FULL TIME TRANSITIONS
function endHalf() {
  // Stop the interval immediately to prevent any further ticks
  if (state.matchState.timerId) {
    clearInterval(state.matchState.timerId);
    state.matchState.timerId = null;
  }

  if (state.matchState.half === 1) {
    state.matchState.half = 2;
    state.matchState.halfEnded = false; // reset for 2nd half
    addCommentary(`HALF TIME. Current Score: Apex Academy ${state.matchState.homeScore} - ${state.matchState.awayScore} ${state.matchState.opponent.name}`, 'half-time');
    showTacticSelector(2);
  } else {
    state.matchState.active = false;
    
    // Stamina depletion transfers to state
    state.players.forEach(p => {
      const saveFactor = Math.min(0.3, state.teamStats.tactic / 300);
      p.stamina = Math.max(10, p.stamina - (20 * (1 - saveFactor)));
    });

    if (state.matchState.homeScore > state.matchState.awayScore) {
      handleMatchResult('win');
    } else if (state.matchState.homeScore < state.matchState.awayScore) {
      handleMatchResult('loss');
    } else {
      triggerPenaltyShootout();
    }
  }
}

function handleMatchResult(outcome) {
  // Guard: prevent double-invocation (e.g. from stale interval ticks)
  if (state.matchState.resultHandled) return;
  state.matchState.resultHandled = true;

  // Clear ALL match/shootout active flags so the nav guard is released
  state.matchState.active = false;
  state.penaltyState.active = false;
  if (state.matchState.timerId) {
    clearInterval(state.matchState.timerId);
    state.matchState.timerId = null;
  }

  document.getElementById('match-overlay').classList.add('hidden');

  // Switch back to training tab so nav buttons are usable again
  switchTab('training');

  if (outcome === 'win') {
    state.money += 1000;

    // Unlock Sponsor picking modal (Only for Match 1 and Match 2)
    if (state.currentMatchIndex < 2) {
      showSponsorChoiceModal();
    } else {
      state.currentMatchIndex++;
      showVictoryModal();
    }
  } else {
    showGameOverModal();
  }
}

// SPONSOR SELECTION MODAL
function showSponsorChoiceModal() {
  const modal = document.getElementById('modal-choose-sponsor');
  modal.classList.remove('hidden');
}

function selectSponsor(sponsorId) {
  state.activeSponsor = sponsorId;
  state.currentMatchIndex++; // Advance match index after sponsor is picked
  
  document.getElementById('modal-choose-sponsor').classList.add('hidden');
  alert(`SPONSOR CONTRACT SIGNED: Welcome to your new partnerships! Check the Shop and training hub for your buffs.`);
  
  updateUI();
}

// PENALTY SHOOTOUT
function triggerPenaltyShootout() {
  state.penaltyState.active = true;
  state.penaltyState.round = 1;
  state.penaltyState.turn = 'home';
  state.penaltyState.homePenalties = [];
  state.penaltyState.awayPenalties = [];
  state.penaltyState.homeScore = 0;
  state.penaltyState.awayScore = 0;
  
  document.getElementById('opp-penalty-team').innerText = state.matchState.opponent.name;
  document.getElementById('shootout-score-nums').innerText = '0 - 0';
  document.getElementById('shootout-commentary').innerText = `Round 1: Prepare to shoot!`;
  
  drawPenaltyDots();
  document.getElementById('modal-penalty').classList.remove('hidden');
  setupPenaltySelectors();
}

function drawPenaltyDots() {
  const hDots = document.getElementById('home-penalty-dots');
  const aDots = document.getElementById('away-penalty-dots');
  hDots.innerHTML = '';
  aDots.innerHTML = '';
  
  for (let i = 0; i < 5; i++) {
    const d1 = document.createElement('div');
    d1.className = 'shootout-dot';
    if (state.penaltyState.homePenalties[i] === true) d1.className += ' scored';
    if (state.penaltyState.homePenalties[i] === false) d1.className += ' missed';
    hDots.appendChild(d1);

    const d2 = document.createElement('div');
    d2.className = 'shootout-dot';
    if (state.penaltyState.awayPenalties[i] === true) d2.className += ' scored';
    if (state.penaltyState.awayPenalties[i] === false) d2.className += ' missed';
    aDots.appendChild(d2);
  }
}

function setupPenaltySelectors() {
  const buttons = document.querySelectorAll('.penalty-opt');
  const actionsWrap = document.getElementById('penalty-actions');
  
  if (state.penaltyState.turn === 'home') {
    actionsWrap.querySelector('p').innerText = "Choose where to KICK your penalty:";
  } else {
    actionsWrap.querySelector('p').innerText = "Choose where your Goalkeeper DIVES:";
  }

  buttons.forEach(btn => {
    btn.onclick = () => {
      const target = btn.getAttribute('data-dir');
      handlePenaltyChoice(target);
    };
  });
}

function handlePenaltyChoice(userTarget) {
  const opp = state.matchState.opponent;
  const oppGKSkill = opp.stats.tactic * 0.8 + opp.stats.speed * 0.8;
  const ourGKSkill = getGKRating();
  
  const ballNode = document.getElementById('penalty-ball');
  const keeperNode = document.getElementById('penalty-keeper');
  
  ballNode.classList.remove('hidden');
  ballNode.style.top = '85%';
  ballNode.style.left = '50%';
  ballNode.style.transform = 'scale(1)';
  keeperNode.style.left = '50%';
  keeperNode.style.bottom = '0';
  
  const directions = {
    'left': { x: '25%', y: '25%' },
    'center': { x: '50%', y: '25%' },
    'right': { x: '75%', y: '25%' },
    'bottom-left': { x: '25%', y: '70%' },
    'bottom-right': { x: '75%', y: '70%' }
  };
  
  setTimeout(() => {
    if (state.penaltyState.turn === 'home') {
      const gkChoice = ['left', 'center', 'right', 'bottom-left', 'bottom-right'][Math.floor(Math.random() * 5)];
      keeperNode.style.left = gkChoice.includes('left') ? '25%' : (gkChoice.includes('right') ? '75%' : '50%');
      keeperNode.style.bottom = gkChoice.includes('bottom') ? '0' : '20%';

      const ballDest = directions[userTarget];
      ballNode.style.left = ballDest.x;
      ballNode.style.top = ballDest.y;
      ballNode.style.transform = 'scale(0.5)';

      let scored = true;
      if (gkChoice === userTarget) {
        const kickAccuracy = state.teamStats.tactic * 0.6 + state.teamStats.power * 0.4;
        if (Math.random() < (oppGKSkill / (kickAccuracy + oppGKSkill))) scored = false;
      } else {
        if (Math.random() < 0.05) scored = false;
      }

      state.penaltyState.homePenalties.push(scored);
      if (scored) {
        state.penaltyState.homeScore++;
        document.getElementById('shootout-commentary').innerText = `⚽ GOAL! You fired it into the ${userTarget.toUpperCase()}!`;
      } else {
        document.getElementById('shootout-commentary').innerText = `❌ SAVED! The keeper blocked the shot!`;
      }
      state.penaltyState.turn = 'away';
    } else {
      const oppChoice = ['left', 'center', 'right', 'bottom-left', 'bottom-right'][Math.floor(Math.random() * 5)];
      keeperNode.style.left = userTarget.includes('left') ? '25%' : (userTarget.includes('right') ? '75%' : '50%');
      keeperNode.style.bottom = userTarget.includes('bottom') ? '0' : '20%';

      const ballDest = directions[oppChoice];
      ballNode.style.left = ballDest.x;
      ballNode.style.top = ballDest.y;
      ballNode.style.transform = 'scale(0.5)';

      let scored = true;
      if (oppChoice === userTarget) {
        const oppKickAccuracy = opp.stats.tactic * 0.6 + opp.stats.power * 0.4;
        if (Math.random() < (ourGKSkill / (oppKickAccuracy + ourGKSkill))) scored = false;
      } else {
        if (Math.random() < 0.05) scored = false;
      }

      state.penaltyState.awayPenalties.push(scored);
      if (scored) {
        state.penaltyState.awayScore++;
        document.getElementById('shootout-commentary').innerText = `❌ GOAL! Opponent scored in the ${oppChoice.toUpperCase()}!`;
      } else {
        document.getElementById('shootout-commentary').innerText = `🧤 SAVED! You punched it away!`;
      }
      
      state.penaltyState.round++;
      state.penaltyState.turn = 'home';
    }

    document.getElementById('shootout-score-nums').innerText = `${state.penaltyState.homeScore} - ${state.penaltyState.awayScore}`;
    drawPenaltyDots();
    
    setTimeout(() => {
      ballNode.classList.add('hidden');
      checkShootoutWinner();
    }, 1500);
  }, 100);
}

function checkShootoutWinner() {
  const hPens = state.penaltyState.homePenalties;
  const aPens = state.penaltyState.awayPenalties;
  const hScore = state.penaltyState.homeScore;
  const aScore = state.penaltyState.awayScore;
  const hRemaining = 5 - hPens.length;
  const aRemaining = 5 - aPens.length;
  
  const homeKickingFinished = hPens.length >= 5;
  const awayKickingFinished = aPens.length >= 5;
  
  let winner = null;
  if (!homeKickingFinished || !awayKickingFinished) {
    if (hScore > aScore + aRemaining) winner = 'home';
    else if (aScore > hScore + hRemaining) winner = 'away';
  } else {
    if (hPens.length === aPens.length) {
      if (hScore > aScore) winner = 'home';
      else if (aScore > hScore) winner = 'away';
    }
  }

  if (winner !== null) {
    setTimeout(() => {
      document.getElementById('modal-penalty').classList.add('hidden');
      // Clear shootout active flag BEFORE handleMatchResult so nav is released
      state.penaltyState.active = false;
      if (winner === 'home') {
        alert("SHOOTOUT VICTORY! Your team won the penalty shootout!");
        handleMatchResult('win');
      } else {
        alert("SHOOTOUT DEFEAT! Sacked after losing on penalties.");
        handleMatchResult('loss');
      }
    }, 1500);
  } else {
    setupPenaltySelectors();
  }
}

// GAME OVER SUMMARY
function showGameOverModal() {
  document.getElementById('modal-gameover').classList.remove('hidden');
  const summary = document.getElementById('gameover-summary');
  summary.innerHTML = `
    <div class="summary-row"><span class="summary-label">Turns Survived:</span><span class="summary-value">${state.turn}</span></div>
    <div class="summary-row"><span class="summary-label">Bracket Advanced:</span><span class="summary-value">Match ${state.currentMatchIndex + 1}</span></div>
    <div class="summary-row"><span class="summary-label">Final Team Speed:</span><span class="summary-value">${Math.round(state.teamStats.speed)}</span></div>
    <div class="summary-row"><span class="summary-label">Final Team Tactics:</span><span class="summary-value">${Math.round(state.teamStats.tactic)}</span></div>
    <div class="summary-row"><span class="summary-label">Sponsor Partner:</span><span class="summary-value" style="text-transform:uppercase;">${state.activeSponsor || 'None'}</span></div>
  `;
}

// VICTORY SUMMARY
function showVictoryModal() {
  document.getElementById('modal-victory').classList.remove('hidden');
  const summary = document.getElementById('victory-summary');
  summary.innerHTML = `
    <div class="summary-row"><span class="summary-label">Total Turns:</span><span class="summary-value">${state.turn}</span></div>
    <div class="summary-row"><span class="summary-label">Final Funds:</span><span class="summary-value">$${state.money}</span></div>
    <div class="summary-row"><span class="summary-label">Team Stats Average:</span><span class="summary-value">${Math.round((state.teamStats.speed + state.teamStats.stamina + state.teamStats.power + state.teamStats.unity + state.teamStats.tactic)/5)}</span></div>
    <div class="summary-row"><span class="summary-label">Sponsor Partner:</span><span class="summary-value" style="text-transform:uppercase;">${state.activeSponsor || 'None'}</span></div>
    <div class="summary-row"><span class="summary-label">Unbeaten Matches:</span><span class="summary-value">3 / 3</span></div>
  `;
}

function restartGame() {
  document.getElementById('modal-gameover').classList.add('hidden');
  document.getElementById('modal-victory').classList.add('hidden');
  initGame();
}

window.onload = () => {
  initGame();
};
