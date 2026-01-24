/**
 * CRICKET SCORER PRO - FINAL PRINT-READY EDITION
 */

let team1, team2, battingFirst, battingSecond, modalCallback = null;
let matchHistory = []; 
let maxOvers = 5;
let isFreeHit = false;
let inningsOneData = { teamName: "", score: "", batters: [], bowlers: [] };

let match = {
    runs: 0, wickets: 0, balls: 0, striker: 0, target: 0, currentInnings: 1,
    batters: [
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, 
        { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }
    ],
    bowlers: {}, currentBowlerKey: "", history: [], recentBalls: []
};

// --- INITIALIZATION ---
window.onload = function() {
    const savedMatch = localStorage.getItem('cricketMatchState');
    if (savedMatch) {
        document.getElementById('setup-modal').innerHTML = `
            <div class="modal-content animation-pop">
                <h2 style="color:var(--accent)">MATCH IN PROGRESS</h2>
                <button onclick="resumeMatch()" class="btn-primary" style="background:var(--success); margin-bottom:10px;">RESUME MATCH</button>
                <button onclick="clearAndNew()" class="btn-primary" style="background:var(--danger)">START NEW MATCH</button>
            </div>`;
    }
};

function saveToDisk() {
    localStorage.setItem('cricketMatchState', JSON.stringify(match));
    localStorage.setItem('inningsOneData', JSON.stringify(inningsOneData));
    localStorage.setItem('teamMeta', JSON.stringify({ team1, team2, battingFirst, battingSecond, maxOvers }));
}

function resumeMatch() {
    try {
        const meta = JSON.parse(localStorage.getItem('teamMeta'));
        match = JSON.parse(localStorage.getItem('cricketMatchState'));
        inningsOneData = JSON.parse(localStorage.getItem('inningsOneData'));
        team1 = meta.team1; team2 = meta.team2;
        battingFirst = meta.battingFirst; battingSecond = meta.battingSecond;
        maxOvers = meta.maxOvers;
        document.getElementById('setup-modal').style.display = 'none';
        document.getElementById('innings-title').innerText = battingFirst;
        if (match.target > 0) {
            document.getElementById('target-display').style.display = 'inline';
            document.getElementById('target-display').innerText = `Target: ${match.target}`;
            document.getElementById('chase-tracker').style.display = 'block';
        }
        updateUI();
    } catch (e) { clearAndNew(); }
}

function clearAndNew() {
    if (confirm("Delete all match data and start fresh?")) {
        localStorage.clear();
        location.reload();
    }
}

// --- SETUP ---
function startMatch() {
    team1 = document.getElementById('t1-name').value.trim() || "Team 1";
    team2 = document.getElementById('t2-name').value.trim() || "Team 2";
    maxOvers = parseInt(document.getElementById('match-overs').value) || 5;
    const winner = document.getElementById('toss-winner').value;
    const choice = document.getElementById('toss-choice').value;

    battingFirst = (choice === "bat") ? (winner === "1" ? team1 : team2) : (winner === "1" ? team2 : team1);
    battingSecond = (battingFirst === team1) ? team2 : team1;

    document.getElementById('setup-modal').style.display = 'none';
    saveToDisk();
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
    const bowlerList = Object.values(match.bowlers).map(b => b.displayName);
    let html = `<p style="color:var(--text-dim)">Select or enter new bowler:</p>`;
    if (bowlerList.length > 0) {
        html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">`;
        bowlerList.forEach(name => {
            if (name !== (match.bowlers[match.currentBowlerKey]?.displayName)) {
                html += `<button onclick="setBowlerAndClose('${name}')" style="padding:12px; background:#475569; border-radius:8px;">${name}</button>`;
            }
        });
        html += `</div>`;
    }
    openEntryModal("SELECT BOWLER", html, (bowl) => { setBowler(bowl); updateUI(); });
}

function setBowlerAndClose(name) {
    setBowler(name);
    document.getElementById('entry-modal').style.display = 'none';
    updateUI();
}

// --- SCORING ---
function addRun(r) {
    if (match.balls >= maxOvers * 6 && match.target === 0) return;
    saveState();
    let b = match.batters[match.striker];
    let bowl = match.bowlers[match.currentBowlerKey];
    match.runs += r; b.runs += r; b.balls += 1;
    if (r === 4) { b.fours++; showToast("FOUR!", "boundary"); }
    if (r === 6) { b.sixes++; showToast("SIXER!", "sixer"); }
    bowl.r += r; bowl.balls += 1;
    match.balls += 1; match.recentBalls.push(r);
    if (r % 2 !== 0) swapStrike();
    isFreeHit = false;
    checkMatchLogic();
}

function out() {
    if (isFreeHit) { showToast("FREE HIT! No wicket.", "warning"); return; }
    saveState();
    let bowl = match.bowlers[match.currentBowlerKey];
    bowl.balls += 1; bowl.w += 1;
    match.balls += 1; match.wickets++;
    match.recentBalls.push('W');
    showToast("WICKET!", "wicket-toast");
    match.history.push({...match.batters[match.striker]});
    if (match.wickets >= 10 || (match.balls >= maxOvers * 6)) {
        updateUI(); setTimeout(handleInningsEnd, 1000);
    } else {
        updateUI();
        setTimeout(() => {
            openEntryModal("WICKET!", "New batter:", (n) => {
                match.batters[match.striker] = { name: n, runs: 0, balls: 0, fours: 0, sixes: 0 };
                checkMatchLogic();
            });
        }, 500);
    }
}

function addExtra() {
    const html = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <button onclick="promptExtraRuns('WD')" style="background:#d97706; padding:15px; border-radius:10px;">WIDE</button>
        <button onclick="promptExtraRuns('NB')" style="background:#ef4444; padding:15px; border-radius:10px;">NO BALL</button>
        <button onclick="promptExtraRuns('LB')" style="background:#3b82f6; padding:15px; border-radius:10px;">LEG BYE</button>
        <button onclick="promptExtraRuns('B')" style="background:#6366f1; padding:15px; border-radius:10px;">BYES</button>
    </div>`;
    openEntryModal("SELECT EXTRA TYPE", html, null);
    document.getElementById('modal-input').style.display = 'none';
    document.getElementById('modal-confirm-btn').style.display = 'none';
}

function promptExtraRuns(type) {
    let label = (type === 'WD' || type === 'NB') ? "Extra + Runs taken:" : "Runs taken:";
    const html = `<p style="color:var(--accent); margin-bottom:10px;">${type} - ${label}</p>
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
        ${[0, 1, 2, 3, 4].map(r => `<button onclick="processDetailedExtra('${type}', ${r})" style="padding:15px; background:#334155; border-radius:8px;">${r}</button>`).join('')}
    </div>`;
    document.getElementById('modal-desc').innerHTML = html;
}

function processDetailedExtra(type, runs) {
    saveState(); 
    let bowl = match.bowlers[match.currentBowlerKey];
    let batter = match.batters[match.striker];

    if (type === 'WD') {
        let total = 1 + runs;
        match.runs += total;
        bowl.r += total;
        match.recentBalls.push(`${runs > 0 ? runs : ''}WD`);
        if (runs % 2 !== 0) swapStrike();
    } 
    else if (type === 'NB') {
        let total = 1 + runs;
        match.runs += total;
        bowl.r += total;
        batter.runs += runs;
        batter.balls += 1;
        match.recentBalls.push(`${runs > 0 ? runs : ''}NB`);
        isFreeHit = true;
        showToast("FREE HIT!", "sixer");
        if (runs % 2 !== 0) swapStrike();
    } 
    else { // LB or B
        match.runs += runs;
        match.balls += 1;
        bowl.balls += 1;
        batter.balls += 1;
        match.recentBalls.push(`${runs}${type}`);
        if (runs % 2 !== 0) swapStrike();
        isFreeHit = false;
    }

    document.getElementById('entry-modal').style.display = 'none';
    checkMatchLogic();
}

function checkMatchLogic() {
    saveToDisk();
    if (match.target > 0 && match.runs >= match.target) {
        updateUI(); setTimeout(handleInningsEnd, 500); return;
    }
    const lastBall = match.recentBalls[match.recentBalls.length-1]?.toString() || "";
    const isIllegal = lastBall.includes("WD") || lastBall.includes("NB");

    if (match.balls > 0 && match.balls % 6 === 0 && !isIllegal) {
        match.recentBalls = [];
        updateUI();
        if (match.balls < maxOvers * 6) setTimeout(promptForBowler, 600);
        else setTimeout(handleInningsEnd, 1000);
    } else { updateUI(); }
}

// --- TRANSITIONS ---
function handleInningsEnd() {
    const isGameOver = (match.currentInnings === 2 || (match.target > 0 && match.runs >= match.target));
    if (isGameOver) { showFinalSummary(); return; }

    inningsOneData.teamName = battingFirst;
    inningsOneData.score = `${match.runs}/${match.wickets} (${Math.floor(match.balls/6)}.${match.balls%6})`;
    inningsOneData.batters = [...match.history, ...match.batters].filter(b => b.name);
    inningsOneData.bowlers = Object.values(match.bowlers);

    match.target = match.runs + 1;
    const totalBalls = maxOvers * 6;
    const reqRR = (match.target / maxOvers).toFixed(2);

    match.runs = 0; match.wickets = 0; match.balls = 0;
    match.history = []; match.bowlers = {}; match.recentBalls = [];
    match.currentInnings = 2;
    match.batters = [{ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }];

    let temp = battingFirst; battingFirst = battingSecond; battingSecond = temp;
    saveToDisk();

    const instruction = `${battingFirst} needs ${match.target} runs in ${totalBalls} balls at ${reqRR} RPO to win.`;
    openAnnouncement("INNINGS END", instruction, "START 2ND INNINGS", () => {
        document.getElementById('innings-title').innerText = battingFirst;
        document.getElementById('target-display').style.display = 'inline';
        document.getElementById('target-display').innerText = `Target: ${match.target}`;
        document.getElementById('chase-tracker').style.display = 'block';
        setupPlayers();
    });
}

function showFinalSummary() {
    let winnerText = "";
    let tieMatch = false;

    if (match.target > 0 && match.runs >= match.target) {
        let wicketsLeft = 10 - match.wickets;
        winnerText = `${battingFirst} WON by ${wicketsLeft} wicket${wicketsLeft > 1 ? 's' : ''}!`;
    } else {
        let diff = (match.target - 1) - match.runs;
        if (diff === 0) {
            winnerText = "MATCH TIED!";
            tieMatch = true;
        } else {
            winnerText = `${battingSecond} WON by ${diff} run${diff > 1 ? 's' : ''}!`;
        }
    }

    // Wrap ONLY the text/data in #printableSummary. Buttons are outside.
    let summaryHTML = `
        <div id="printableSummary" class="summary-report" style="color:var(--text); background:var(--card-bg); padding:15px; border-radius:10px;">
            <h2 style="color:var(--success); text-align:center;">${winnerText}</h2>
            
            <h4 style="border-bottom:1px solid #444; padding-bottom:5px;">${inningsOneData.teamName}: ${inningsOneData.score}</h4>
            ${inningsOneData.batters.map(b => `<div class="summary-line" style="display:flex; justify-content:space-between; font-size:14px; margin:4px 0;"><span>${b.name}</span><span>${b.runs}(${b.balls})</span></div>`).join('')}
            
            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px; margin-top:10px; opacity:0.7;"><span>Bowler</span><span>O-R-W</span></div>
            ${inningsOneData.bowlers.map(bw => `<div class="summary-line" style="display:flex; justify-content:space-between; font-size:14px;"><span>${bw.displayName}</span><span>${Math.floor(bw.balls/6)}.${bw.balls%6}-${bw.r}-${bw.w}</span></div>`).join('')}
            
            <hr style="margin:15px 0; border:none; border-top:1px dashed #666;">
            
            <h4 style="border-bottom:1px solid #444; padding-bottom:5px;">${battingFirst}: ${match.runs}/${match.wickets} (${Math.floor(match.balls/6)}.${match.balls%6})</h4>
            ${[...match.history, ...match.batters].filter(b => b.name).map(b => `<div class="summary-line" style="display:flex; justify-content:space-between; font-size:14px; margin:4px 0;"><span>${b.name}</span><span>${b.runs}(${b.balls})</span></div>`).join('')}
            
            <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:12px; margin-top:10px; opacity:0.7;"><span>Bowler</span><span>O-R-W</span></div>
            ${Object.values(match.bowlers).map(bw => `<div class="summary-line" style="display:flex; justify-content:space-between; font-size:14px;"><span>${bw.displayName}</span><span>${Math.floor(bw.balls/6)}.${bw.balls%6}-${bw.r}-${bw.w}</span></div>`).join('')}
        </div>
        
        <div class="no-print" style="display:flex; gap:10px; margin-top:15px;">
             <button onclick="preparePrint()" class="btn-primary" style="background:#7c3aed; flex:1;">PRINT SCORECARD</button>
             ${tieMatch ? `<button onclick="startSuperOver()" class="btn-primary" style="background:var(--accent); color:black; flex:1;">SUPER OVER</button>` : ''}
        </div>
    `;

    openAnnouncement("MATCH FINISHED", summaryHTML, tieMatch ? "CLOSE" : "NEW MATCH", () => {
        if(!tieMatch) { localStorage.clear(); location.reload(); }
    });
}

function preparePrint() {
    const printArea = document.getElementById('printableSummary');
    if (!printArea) return;

    // Create a hidden iframe or new window for clean printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Match Scorecard</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #000; background: #fff; }
                    .summary-report { width: 100%; max-width: 600px; margin: auto; }
                    h2 { color: #059669; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    h4 { margin-top: 20px; border-bottom: 1px solid #ccc; }
                    .summary-line { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
                    .footer { text-align: center; font-size: 10px; margin-top: 50px; color: #666; }
                </style>
            </head>
            <body>
                ${printArea.innerHTML}
                <div class="footer">Generated by Cricket Scorer Pro</div>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function startSuperOver() {
    maxOvers = 1;
    match = {
        runs: 0, wickets: 0, balls: 0, striker: 0, target: 0, currentInnings: 1,
        batters: [{ name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }, { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 }],
        bowlers: {}, currentBowlerKey: "", history: [], recentBalls: []
    };
    inningsOneData = { teamName: "", score: "", batters: [], bowlers: [] };
    document.getElementById('entry-modal').style.display = 'none';
    document.getElementById('target-display').style.display = 'none';
    document.getElementById('chase-tracker').style.display = 'none';
    showToast("SUPER OVER STARTED!", "boundary");
    saveToDisk();
    setupPlayers();
}

// --- UI UPDATES ---
function updateUI() {
    document.getElementById('total-score').innerText = `${match.runs} - ${match.wickets}`;
    document.getElementById('total-overs').innerText = `Overs: ${Math.floor(match.balls/6)}.${match.balls%6} / ${maxOvers}`;
    
    const totalOversPlayed = match.balls / 6;
    const crr = totalOversPlayed > 0 ? (match.runs / totalOversPlayed).toFixed(2) : "0.00";
    document.getElementById('run-rate').innerText = `CRR: ${crr}`;

    match.batters.forEach((b, i) => {
        document.getElementById(`name-${i}`).value = b.name + (isFreeHit && i === match.striker ? " (FH)" : "");
        document.getElementById(`stats-${i}`).innerText = `${b.runs} (${b.balls})`;
        document.getElementById(`bat${i}`).className = `player-card ${i === match.striker ? 'on-strike' : ''}`;
    });
    if (match.target > 0) {
        let r = match.target - match.runs;
        let b = (maxOvers * 6) - match.balls;
        let rrr = b > 0 ? ((r / b) * 6).toFixed(2) : "0.00";
        document.getElementById('chase-tracker').innerText = r > 0 ? `Need ${r} runs in ${b > 0 ? b : 0} balls (RRR: ${rrr})` : "Target Reached!";
    }
    let bwl = match.bowlers[match.currentBowlerKey] || {displayName: "Bowler", balls:0, r:0, w:0};
    document.getElementById('current-bowler-name').value = bwl.displayName;
    document.getElementById('bowler-live-stats').innerText = `${Math.floor(bwl.balls/6)}.${bwl.balls%6} - 0 - ${bwl.r} - ${bwl.w}`;
    document.getElementById('ball-log').innerHTML = match.recentBalls.map(b => `<div class="ball-circle">${b}</div>`).join('');
    renderTable();
}

function renderTable() {
    let html = `<tr><th colspan="6" class="section-header">BATTING</th></tr>`;
    [...match.history, ...match.batters].filter(b => b.name).forEach(b => {
        html += `<tr><td>${b.name}</td><td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${b.balls>0?((b.runs/b.balls)*100).toFixed(1):0}</td></tr>`;
    });
    html += `<tr><th colspan="6" class="section-header">BOWLING</th></tr>`;
    Object.values(match.bowlers).forEach(bw => {
        html += `<tr><td>${bw.displayName}</td><td>${Math.floor(bw.balls/6)}.${bw.balls%6}</td><td>0</td><td>${bw.r}</td><td>${bw.w}</td><td>${bw.balls>0?(bw.r/(bw.balls/6)).toFixed(2):0}</td></tr>`;
    });
    document.getElementById('history-body').innerHTML = html;
}

// --- UTILITIES ---
function openEntryModal(t, d, c) { resetModal(); document.getElementById('modal-title').innerText = t; document.getElementById('modal-desc').innerHTML = d; document.getElementById('entry-modal').style.display = 'flex'; modalCallback = c; }
function openAnnouncement(t, d, b, c) { resetModal(); document.getElementById('modal-title').innerText = t; document.getElementById('modal-desc').innerHTML = d; document.getElementById('modal-input').style.display = 'none'; document.getElementById('modal-confirm-btn').style.display = 'none'; const btn = document.getElementById('announcement-btn'); btn.style.display = 'block'; btn.innerText = b; btn.onclick = () => { document.getElementById('entry-modal').style.display = 'none'; if(c) c(); }; document.getElementById('entry-modal').style.display = 'flex'; }
function resetModal() { document.getElementById('modal-input').style.display = 'block'; document.getElementById('modal-input').value = ""; document.getElementById('modal-confirm-btn').style.display = 'block'; document.getElementById('announcement-btn').style.display = 'none'; }
function submitEntry() { const v = document.getElementById('modal-input').value.trim(); if (!v) return; document.getElementById('entry-modal').style.display = 'none'; modalCallback(v); }
function swapStrike() { match.striker = match.striker === 0 ? 1 : 0; }
function setBowler(n) { let k = n.toLowerCase().replace(/\s/g, ''); if (!match.bowlers[k]) match.bowlers[k] = { displayName: n, balls: 0, r: 0, w: 0 }; match.currentBowlerKey = k; }

function saveState() { 
    matchHistory.push(JSON.parse(JSON.stringify(match))); 
    if (matchHistory.length > 50) matchHistory.shift();
}

function undo() { 
    if(matchHistory.length > 0) { 
        match = matchHistory.pop(); 
        isFreeHit = match.recentBalls[match.recentBalls.length-1]?.toString().includes('NB') ? true : false;
        saveToDisk(); 
        updateUI(); 
        showToast("Undo Successful", "warning");
    } else { showToast("Nothing to Undo", "warning"); }
}

function showToast(m, type) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = `toast ${type}`; t.innerText = m; c.appendChild(t); setTimeout(() => t.remove(), 3000); }
function addPenalty() { saveState(); match.runs += 5; updateUI(); }
