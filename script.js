// --- CONFIG & STATE ---
let team1, team2, battingFirst, battingSecond, modalCallback = null;
let matchHistory = []; 
let maxOvers = 5;
let isFreeHit = false;

let match = {
    runs: 0, wickets: 0, balls: 0, striker: 0, target: 0, currentInnings: 1,
    batters: [
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, 
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }
    ],
    bowlers: {}, currentBowlerKey: "", history: [], recentBalls: []
};

// --- AUTH LOGIC (UI ONLY) ---
function toggleAuthUI() {
    const setup = document.getElementById('setup-section');
    const authUI = document.getElementById('auth-section');
    setup.style.display = setup.style.display === 'none' ? 'block' : 'none';
    authUI.style.display = authUI.style.display === 'none' ? 'block' : 'none';
}

// --- CORE MATCH LOGIC ---
function startMatch() {
    team1 = document.getElementById('t1-name').value || "Team 1";
    team2 = document.getElementById('t2-name').value || "Team 2";
    maxOvers = parseInt(document.getElementById('match-overs').value) || 5;
    const winner = document.getElementById('toss-winner').value;
    const choice = document.getElementById('toss-choice').value;

    battingFirst = (choice === "bat") ? (winner === "1" ? team1 : team2) : (winner === "1" ? team2 : team1);
    battingSecond = (battingFirst === team1) ? team2 : team1;

    document.getElementById('setup-modal').style.display = 'none';
    
    // BUG FIX: Set the initial team name in the header
    document.getElementById('innings-title').innerText = battingFirst;
    
    setupPlayers();
}

function setupPlayers() {
    openEntryModal("STRIKER", `Opening for ${battingFirst}:`, (n1) => {
        match.batters[0].name = n1;
        openEntryModal("NON-STRIKER", "Partner:", (n2) => {
            match.batters[1].name = n2;
            promptForBowler();
        });
    });
}

function promptForBowler() {
    openEntryModal("SELECT BOWLER", "Enter Bowler Name:", (bowl) => {
        setBowler(bowl);
        updateUI();
    });
}

function addRun(r) {
    saveState();
    let b = match.batters[match.striker];
    let bowl = match.bowlers[match.currentBowlerKey];
    
    match.runs += r; b.runs += r; b.balls += 1;
    bowl.r += r; bowl.balls += 1;
    match.balls += 1;
    match.recentBalls.push(r);

    if (r === 4) { b.fours++; showToast("FOUR!", "boundary"); }
    if (r === 6) { b.sixes++; showToast("SIXER!", "sixer"); }

    if (match.balls % 6 === 0) {
        if (r % 2 === 0) swapStrike(); 
    } else {
        if (r % 2 !== 0) swapStrike(); 
    }

    isFreeHit = false;
    checkMatchLogic();
}

function addExtra() {
    const type = prompt("Enter Extra Type (WD, NB, LB, B):").toUpperCase();
    if(!['WD','NB','LB','B'].includes(type)) return;
    const runs = parseInt(prompt("Additional runs taken?")) || 0;
    processExtra(type, runs);
}

function processExtra(type, runs) {
    saveState();
    let bowl = match.bowlers[match.currentBowlerKey];
    let b = match.batters[match.striker];

    if (type === 'WD') {
        match.runs += (1 + runs); bowl.r += (1 + runs);
        match.recentBalls.push(`${runs > 0 ? runs : ''}WD`);
        if (runs % 2 !== 0) swapStrike();
    } else if (type === 'NB') {
        match.runs += (1 + runs); bowl.r += (1 + runs);
        b.runs += runs; b.balls += 1;
        match.recentBalls.push(`${runs > 0 ? runs : ''}NB`);
        isFreeHit = true; showToast("FREE HIT!", "sixer");
        if (runs % 2 !== 0) swapStrike();
    } else {
        match.runs += runs; match.balls += 1; bowl.balls += 1; b.balls += 1;
        match.recentBalls.push(`${runs}${type}`);
        if (match.balls % 6 === 0) { if (runs % 2 === 0) swapStrike(); }
        else { if (runs % 2 !== 0) swapStrike(); }
    }
    checkMatchLogic();
}

function out() {
    const type = isFreeHit ? "Run Out" : prompt("Wicket Type (Bowled, Caught, LBW, etc):");
    processWicket(type || "Wicket");
}

function processWicket(type) {
    saveState();
    let bowl = match.bowlers[match.currentBowlerKey];
    if (type !== 'Run Out') bowl.w += 1;
    match.balls += 1; bowl.balls += 1; match.wickets++;
    match.recentBalls.push('W');
    match.history.push({...match.batters[match.striker], outAs: type});
    
    updateUI();
    if (match.wickets < 10 && match.balls < maxOvers * 6) {
        openEntryModal("NEW BATTER", "Enter name:", (n) => {
            match.batters[match.striker] = { name: n, runs: 0, balls: 0, fours: 0, sixes: 0 };
            updateUI();
        });
    } else { handleInningsEnd(); }
}

// --- UI UPDATES & BUG FIXES ---
function updateUI() {
    // BUG FIX: Ensure the correct team name shows above the scorecard based on innings
    document.getElementById('innings-title').innerText = (match.currentInnings === 1) ? battingFirst : battingSecond;
    
    document.getElementById('total-score').innerText = `${match.runs} - ${match.wickets}`;
    
    // FEATURE: Calculate and Display Live Run Rate
    const totalOversPlayed = (Math.floor(match.balls / 6)) + (match.balls % 6 / 6);
    const currentRR = totalOversPlayed > 0 ? (match.runs / totalOversPlayed).toFixed(2) : "0.00";
    
    document.getElementById('total-overs').innerText = `Overs: ${Math.floor(match.balls/6)}.${match.balls%6} / ${maxOvers} (RR: ${currentRR})`;
    
    match.batters.forEach((b, i) => {
        let displayName = b.name + (isFreeHit && i === match.striker ? " (FH)" : "");
        document.getElementById(`name-${i}`).value = displayName;
        document.getElementById(`stats-${i}`).innerText = `${b.runs}(${b.balls})`;
        document.getElementById(`bat${i}`).className = `player-card ${i === match.striker ? 'on-strike' : ''}`;
    });

    let bwl = match.bowlers[match.currentBowlerKey] || {displayName: "Bowler", balls:0, r:0, w:0};
    document.getElementById('current-bowler-name').value = bwl.displayName;
    document.getElementById('bowler-live-stats').innerText = `${Math.floor(bwl.balls/6)}.${bwl.balls%6} - R:${bwl.r} - W:${bwl.w}`;
    document.getElementById('ball-log').innerHTML = match.recentBalls.map(b => `<div class="ball-circle">${b}</div>`).join('');
    
    renderTable();
}

function renderTable() {
    let html = `<tr><th colspan="6" class="section-header">BATTING SUMMARY</th></tr>`;
    [...match.history, ...match.batters].filter(b => b.name).forEach(b => {
        html += `<tr><td>${b.name}</td><td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${b.balls>0?((b.runs/b.balls)*100).toFixed(1):'0'}</td></tr>`;
    });
    document.getElementById('history-body').innerHTML = html;
}

// --- UTILS ---
function swapStrike() { match.striker = match.striker === 0 ? 1 : 0; }
function setBowler(n) { 
    let k = n.toLowerCase().replace(/\s/g, ''); 
    if (!match.bowlers[k]) match.bowlers[k] = { displayName: n, balls: 0, r: 0, w: 0 }; 
    match.currentBowlerKey = k; 
}
function saveState() { matchHistory.push(JSON.parse(JSON.stringify(match))); }
function undo() { if (matchHistory.length > 0) { match = matchHistory.pop(); updateUI(); } }

function openEntryModal(t, d, c) { 
    document.getElementById('modal-title').innerText = t; 
    document.getElementById('modal-desc').innerText = d; 
    document.getElementById('entry-modal').style.display = 'flex'; 
    modalCallback = c; 
}
function submitEntry() { 
    const v = document.getElementById('modal-input').value.trim(); 
    document.getElementById('modal-input').value = "";
    document.getElementById('entry-modal').style.display = 'none'; 
    if(modalCallback) modalCallback(v); 
}

function showToast(m, type) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`; t.innerText = m;
    c.appendChild(t); setTimeout(() => t.remove(), 2000);
}

function checkMatchLogic() {
    if (match.target > 0 && match.runs >= match.target) { handleInningsEnd(); return; }
    if (match.balls > 0 && match.balls % 6 === 0) {
        const lastBall = match.recentBalls[match.recentBalls.length-1];
        if (typeof lastBall === 'string' && (lastBall.includes('WD') || lastBall.includes('NB'))) {
            updateUI();
        } else {
            match.recentBalls = []; 
            updateUI();
            if (match.balls < maxOvers * 6) setTimeout(promptForBowler, 600);
            else handleInningsEnd();
        }
    } else { updateUI(); }
}

async function handleInningsEnd() {
    alert("Innings Over!");
    location.reload();
}
