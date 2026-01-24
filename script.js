// --- CONFIG & STATE ---
let team1, team2, battingFirst, battingSecond, modalCallback = null;
let matchHistory = []; 
let maxOvers = 5;
let isFreeHit = false;
let firstInningsTotal = "";

let match = {
    runs: 0, wickets: 0, balls: 0, striker: 0, target: 0, currentInnings: 1,
    batters: [
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, 
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }
    ],
    bowlers: {}, currentBowlerKey: "", history: [], recentBalls: []
};

// --- PERSISTENCE LOGIC (LOCAL STORAGE) ---
window.onload = () => {
    const savedData = localStorage.getItem('cricketPro_saveData');
    if (savedData) {
        const parsed = JSON.parse(savedData);
        match = parsed.match;
        team1 = parsed.team1;
        team2 = parsed.team2;
        battingFirst = parsed.battingFirst;
        battingSecond = parsed.battingSecond;
        maxOvers = parsed.maxOvers;
        matchHistory = parsed.matchHistory || [];
        firstInningsTotal = parsed.firstInningsTotal || "";

        document.getElementById('setup-modal').style.display = 'none';
        
        // Restore 1st Innings Summary if it exists
        if (firstInningsTotal) {
            document.getElementById('first-innings-summary').style.display = 'block';
            document.getElementById('t1-final-score').innerText = firstInningsTotal;
        }

        if (match.currentInnings === 2) {
            document.getElementById('target-display').style.display = 'inline';
            document.getElementById('target-display').innerText = `Target: ${match.target}`;
            document.getElementById('chase-tracker').style.display = 'block';
        }
        updateUI();
        showToast("Match Resumed Successfully", "success");
    }
};

function saveState() {
    matchHistory.push(JSON.parse(JSON.stringify(match)));
    const dataToSave = {
        match, team1, team2, battingFirst, battingSecond, maxOvers, matchHistory, firstInningsTotal
    };
    localStorage.setItem('cricketPro_saveData', JSON.stringify(dataToSave));
}

// --- INITIALIZATION ---
function startMatch() {
    localStorage.removeItem('cricketPro_saveData');
    team1 = document.getElementById('t1-name').value || "Team 1";
    team2 = document.getElementById('t2-name').value || "Team 2";
    maxOvers = parseInt(document.getElementById('match-overs').value) || 5;
    const winner = document.getElementById('toss-winner').value;
    const choice = document.getElementById('toss-choice').value;

    battingFirst = (choice === "bat") ? (winner === "1" ? team1 : team2) : (winner === "1" ? team2 : team1);
    battingSecond = (battingFirst === team1) ? team2 : team1;

    document.getElementById('setup-modal').style.display = 'none';
    saveState();
    setupPlayers();
}

function setupPlayers() {
    const teamName = (match.currentInnings === 1) ? battingFirst : battingSecond;
    openEntryModal("STRIKER", `Who is taking strike for ${teamName}?`, (n1) => {
        match.batters[0].name = n1 || "Batter 1";
        openEntryModal("NON-STRIKER", "Who is at the other end?", (n2) => {
            match.batters[1].name = n2 || "Batter 2";
            promptForBowler();
        });
    });
}

function promptForBowler() {
    openEntryModal("NEW BOWLER", "Enter name of the bowler:", (bowl) => {
        setBowler(bowl || "Unknown Bowler");
        updateUI();
        saveState();
    });
}

// --- SCORING ---
function addRun(r) {
    if(!match.currentBowlerKey) return promptForBowler();
    saveState();
    let b = match.batters[match.striker];
    let bowl = match.bowlers[match.currentBowlerKey];
    match.runs += r; b.runs += r; b.balls += 1;
    bowl.r += r; bowl.balls += 1;
    match.balls += 1;
    match.recentBalls.push(r);
    
    if (r === 4) { b.fours++; showToast("FOUR!", "boundary"); }
    if (r === 6) { b.sixes++; showToast("SIXER!", "boundary"); }
    
    if (match.balls % 6 === 0) { if (r % 2 === 0) swapStrike(); } 
    else { if (r % 2 !== 0) swapStrike(); }
    
    isFreeHit = false; 
    checkMatchLogic();
}

function showExtraMenu() {
    openEntryModal("EXTRAS", "Choose Type:", (type) => {
        setTimeout(() => {
            openEntryModal(`${type} RUNS`, "Additional runs scored?", (runs) => {
                processExtra(type, parseInt(runs) || 0);
            }, ["0", "1", "2", "3", "4"]);
        }, 200);
    }, ["WD", "NB", "LB", "BYE"]);
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
        b.runs += runs; 
        match.recentBalls.push(`${runs > 0 ? runs : ''}NB`);
        isFreeHit = true; 
        showToast("FREE HIT!", "boundary");
        if (runs % 2 !== 0) swapStrike();
    } else {
        match.runs += runs; match.balls += 1; bowl.balls += 1; b.balls += 1;
        match.recentBalls.push(`${runs}${type[0]}`);
        if (match.balls % 6 === 0) { if (runs % 2 === 0) swapStrike(); }
        else { if (runs % 2 !== 0) swapStrike(); }
    }
    checkMatchLogic();
}

function showWicketMenu() {
    openEntryModal("WICKET", "How was the batter out?", (type) => {
        if (isFreeHit && type !== "Run Out") {
            showToast("FREE HIT: NOT OUT!", "boundary");
            return;
        }
        processWicket(type);
    }, ["Bowled", "Caught", "LBW", "Stumped", "Run Out"]);
}

function processWicket(type) {
    saveState();
    let bowl = match.bowlers[match.currentBowlerKey];
    if (type !== 'Run Out') bowl.w += 1;
    match.balls += 1; bowl.balls += 1; match.wickets++;
    match.recentBalls.push('W');
    match.history.push({...match.batters[match.striker], outAs: type});
    isFreeHit = false; 
    
    if (match.wickets < 10 && match.balls < maxOvers * 6) {
        updateUI();
        openEntryModal("NEW BATTER", "Next batter name:", (n) => {
            match.batters[match.striker] = { name: n || "New Batter", runs: 0, balls: 0, fours: 0, sixes: 0 };
            updateUI();
            saveState();
        });
    } else { handleInningsEnd(); }
}

function addPenalty() {
    openEntryModal("PENALTY", "Runs for the batting team:", (runs) => {
        saveState();
        match.runs += parseInt(runs);
        showToast(`+${runs} Penalty`, "boundary");
        updateUI();
    }, ["1", "5", "10"]);
}

// --- MATCH FLOW ---
function checkMatchLogic() {
    if (match.currentInnings === 2 && match.runs >= match.target) {
        handleInningsEnd();
        return;
    }
    if (match.balls > 0 && match.balls % 6 === 0) {
        const lastBall = match.recentBalls[match.recentBalls.length-1];
        if (typeof lastBall === 'string' && (lastBall.includes('WD') || lastBall.includes('NB'))) {
            updateUI();
            saveState();
        } else {
            match.recentBalls = []; 
            updateUI();
            saveState();
            if (match.balls < maxOvers * 6) setTimeout(promptForBowler, 600);
            else handleInningsEnd();
        }
    } else { 
        updateUI(); 
        saveState();
    }
}

function handleInningsEnd() {
    const isFirst = match.currentInnings === 1;
    
    if (isFirst) {
        match.target = match.runs + 1;
        firstInningsTotal = `${battingFirst}: ${match.runs}/${match.wickets} (${Math.floor(match.balls/6)}.${match.balls%6} Ov)`;
        
        document.getElementById('first-innings-summary').style.display = 'block';
        document.getElementById('t1-final-score').innerText = firstInningsTotal;
        
        const resultText = `INNINGS OVER\n${battingFirst} scored ${match.runs}.\nTarget for ${battingSecond}: ${match.target}`;
        
        openEntryModal("INNINGS COMPLETE", resultText, (choice) => {
            if (choice === "START 2ND INNINGS") startSecondInnings();
            else if (choice === "DOWNLOAD") downloadScorecard();
        }, ["DOWNLOAD", "START 2ND INNINGS"]);
        saveState();
        
    } else {
        const winnerText = getFinalResult();
        const resultStrip = document.getElementById('final-result-strip');
        resultStrip.style.display = 'block';
        resultStrip.innerText = winnerText;
        document.getElementById('match-status-title').innerText = "FINAL SCORECARD";

        openEntryModal("🏆 MATCH FINISHED", winnerText, (choice) => {
            if (choice === "DOWNLOAD SCORECARD") downloadScorecard();
            else if (choice === "NEW MATCH") confirmNewGame();
        }, ["DOWNLOAD SCORECARD", "NEW MATCH"]);
        saveState();
    }
}

function getFinalResult() {
    if (match.runs >= match.target) return `${battingSecond} WON BY ${10 - match.wickets} WICKETS`;
    if (match.runs === match.target - 1 && match.balls >= maxOvers * 6) return "MATCH TIED!";
    return `${battingFirst} WON BY ${match.target - 1 - match.runs} RUNS`;
}

function downloadScorecard() {
    const element = document.getElementById('printable-scorecard');
    html2canvas(element, { backgroundColor: '#0f172a' }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Scorecard_${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

function startSecondInnings() {
    match.currentInnings = 2; match.runs = 0; match.wickets = 0; match.balls = 0; 
    match.recentBalls = []; match.history = []; match.bowlers = {};
    match.batters = [{ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }];
    document.getElementById('target-display').style.display = 'inline';
    document.getElementById('target-display').innerText = `Target: ${match.target}`;
    document.getElementById('chase-tracker').style.display = 'block';
    setupPlayers();
    saveState();
}

// --- UI RENDERING ---
function updateUI() {
    document.getElementById('innings-title').innerText = (match.currentInnings === 1) ? battingFirst : battingSecond;
    document.getElementById('total-score').innerText = `${match.runs} - ${match.wickets}`;
    const crrOvers = (Math.floor(match.balls / 6)) + (match.balls % 6 / 6);
    document.getElementById('total-overs').innerText = `Overs: ${Math.floor(match.balls/6)}.${match.balls%6} / ${maxOvers}`;
    document.getElementById('run-rate').innerText = `CRR: ${crrOvers > 0 ? (match.runs / crrOvers).toFixed(2) : "0.00"}`;

    const tracker = document.getElementById('chase-tracker');
    if (match.currentInnings === 2 && tracker) {
        tracker.innerText = `Need ${match.target - match.runs} from ${(maxOvers * 6) - match.balls} balls`;
    }
    
    match.batters.forEach((b, i) => {
        document.getElementById(`name-${i}`).value = b.name + (isFreeHit && i === match.striker ? " (FH)" : "");
        document.getElementById(`stats-${i}`).innerText = `${b.runs}(${b.balls})`;
        document.getElementById(`bat${i}`).classList.toggle('on-strike', i === match.striker && b.name !== "");
    });

    let bwl = match.bowlers[match.currentBowlerKey] || {displayName: "", balls:0, r:0, w:0};
    document.getElementById('current-bowler-name').value = bwl.displayName;
    document.getElementById('bowler-live-stats').innerText = `${Math.floor(bwl.balls/6)}.${bwl.balls%6} - R:${bwl.r} - W:${bwl.w}`;
    document.getElementById('ball-log').innerHTML = match.recentBalls.map(b => `<div class="ball-circle">${b}</div>`).join('');
    renderTable();
}

function renderTable() {
    let html = `<thead><tr><th colspan="6" class="section-header">BATTING</th></tr>
        <tr style="font-size: 0.7rem; color: var(--text-dim);"><th>BATTER</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>`;
    const allBatters = [...match.history, ...match.batters].filter(b => b.name !== "");
    allBatters.forEach(b => {
        const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0';
        html += `<tr><td>${b.name} <small>${b.outAs ? '('+b.outAs+')' : '*'}</small></td><td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${sr}</td></tr>`;
    });
    html += `<tr><th colspan="6" class="section-header">BOWLING</th></tr>
        <tr style="font-size: 0.7rem; color: var(--text-dim);"><th>BOWLER</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ECON</th></tr>`;
    Object.values(match.bowlers).forEach(bwl => {
        const totalOvers = bwl.balls / 6;
        const econ = totalOvers > 0 ? (bwl.r / totalOvers).toFixed(2) : '0.00';
        html += `<tr><td>${bwl.displayName}</td><td>${Math.floor(bwl.balls/6)}.${bwl.balls%6}</td><td>0</td><td>${bwl.r}</td><td>${bwl.w}</td><td>${econ}</td></tr>`;
    });
    document.getElementById('history-body').innerHTML = html + "</tbody>";
}

// --- UTILS ---
function swapStrike() { match.striker = match.striker === 0 ? 1 : 0; }
function setBowler(n) { 
    let k = n.toLowerCase().replace(/\s/g, ''); 
    if (!match.bowlers[k]) match.bowlers[k] = { displayName: n, balls: 0, r: 0, w: 0 }; 
    match.currentBowlerKey = k; 
}
function undo() { 
    if (matchHistory.length > 0) { 
        match = matchHistory.pop(); 
        updateUI(); 
        const dataToSave = { match, team1, team2, battingFirst, battingSecond, maxOvers, matchHistory, firstInningsTotal };
        localStorage.setItem('cricketPro_saveData', JSON.stringify(dataToSave));
    } 
}
function preparePrint() { 
    const resultStrip = document.getElementById('final-result-strip');
    if (match.currentInnings === 2 && (match.runs >= match.target || match.balls >= maxOvers * 6 || match.wickets >= 10)) {
        resultStrip.style.display = 'block';
        resultStrip.innerText = getFinalResult();
    }
    window.print(); 
}

// --- MODAL SYSTEM ---
function openEntryModal(t, d, c, options = null) { 
    document.getElementById('modal-title').innerText = t; 
    document.getElementById('modal-desc').innerText = d; 
    const input = document.getElementById('modal-input');
    const grid = document.getElementById('modal-options-grid');
    if (options) { 
        input.style.display = 'none'; grid.style.display = 'grid';
        grid.innerHTML = options.map(opt => `<button onclick="submitOption('${opt}')">${opt}</button>`).join('');
    } else { input.style.display = 'block'; grid.style.display = 'none'; }
    document.getElementById('entry-modal').style.display = 'flex'; 
    modalCallback = c; 
}

function submitOption(val) { document.getElementById('entry-modal').style.display = 'none'; if(modalCallback) modalCallback(val); }
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

function confirmNewGame() {
    const title = "RESET MATCH SESSION";
    const message = "This action will permanently erase all current match data. \n\nAre you sure you want to start a new session?";
    
    openEntryModal(title, message, (choice) => {
        if (choice === "CONFIRM RESET") {
            showToast("Wiping session data...", "danger");
            localStorage.removeItem('cricketPro_saveData');
            setTimeout(() => location.reload(), 800);
        }
    }, ["CANCEL", "CONFIRM RESET"]);
}
