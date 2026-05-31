(() => {
  // ── Constants ──────────────────────────────────────────
  const WORD_LEN = 7;
  const MAX_ROWS = 6;
  const STATUS = { CORRECT: 'correct', PRESENT: 'present', ABSENT: 'absent' };
  const LACROIX_WORDS = ['lacroix', 'mbrodie', 'amandaa', 'aaronmc', 'spirits', 'useaftw', 'meitalm', 'whiskey'];

  // ── State ──────────────────────────────────────────────
  let answer, currentRow, currentCol, currentGuess, gameOver, hardMode, takeshiMode, lacroixMode;
  let guessHistory = [];     // array of {word, result[]}
  let keyStatus = {};        // letter -> best status

  // ── DOM ────────────────────────────────────────────────
  const board       = document.getElementById('board');
  const keyboard    = document.getElementById('keyboard');
  const resultModal = document.getElementById('result-modal');
  const settingsModal = document.getElementById('settings-modal');
  const hardToggle    = document.getElementById('hard-mode-toggle');
  const takeshiToggle = document.getElementById('takeshi-mode-toggle');
  const lacroixToggle = document.getElementById('lacroix-mode-toggle');
  const shareBtn    = document.getElementById('share-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const resultTitle = document.getElementById('result-title');
  const resultMsg   = document.getElementById('result-msg');
  const answerEl    = document.getElementById('result-answer');
  const toastContainer = document.getElementById('toast-container');

  // ── Init ───────────────────────────────────────────────
  function init() {
    hardMode = localStorage.getItem('hardMode') === 'true';
    hardToggle.checked = hardMode;
    takeshiMode = localStorage.getItem('takeshiMode') === 'true';
    takeshiToggle.checked = takeshiMode;
    lacroixMode = localStorage.getItem('lacroixMode') === 'true';
    lacroixToggle.checked = lacroixMode;
    applyLacroix(lacroixMode);

    if (takeshiMode) {
      answer = 'takeshi';
    } else if (lacroixMode) {
      answer = LACROIX_WORDS[Math.floor(Math.random() * LACROIX_WORDS.length)];
    } else {
      const day = Math.floor(Date.now() / 86400000);
      const pool = WORDS.filter(w => w.length === WORD_LEN);
      answer = pool[day % pool.length].toLowerCase();
    }

    currentRow = 0;
    currentCol = 0;
    currentGuess = '';
    gameOver = false;
    guessHistory = [];
    keyStatus = {};

    renderBoard();
    renderKeyboard();
  }

  function renderBoard() {
    board.innerHTML = '';
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < WORD_LEN; c++) {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        tile.id = `tile-${r}-${c}`;
        board.appendChild(tile);
      }
    }
  }

  function renderKeyboard() {
    keyboard.innerHTML = '';
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ENTERZXCVBNM⌫'];
    rows.forEach(rowStr => {
      const div = document.createElement('div');
      div.className = 'kb-row';
      const keys = rowStr === 'ENTERZXCVBNM⌫'
        ? ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
        : rowStr.split('');
      keys.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'key' + (k.length > 1 ? ' wide' : '');
        btn.textContent = k;
        btn.dataset.key = k;
        btn.addEventListener('click', () => handleKey(k));
        div.appendChild(btn);
      });
      keyboard.appendChild(div);
    });
  }

  // ── Input ──────────────────────────────────────────────
  function handleKey(key) {
    if (gameOver) return;
    const k = key.toUpperCase();
    if (k === 'ENTER') { submitGuess(); return; }
    if (k === '⌫' || k === 'BACKSPACE') { deleteLetter(); return; }
    if (/^[A-Z]$/.test(k) && currentCol < WORD_LEN) addLetter(k);
  }

  function addLetter(letter) {
    getTile(currentRow, currentCol).textContent = letter;
    getTile(currentRow, currentCol).dataset.letter = letter;
    currentGuess += letter.toLowerCase();
    currentCol++;
  }

  function deleteLetter() {
    if (currentCol === 0) return;
    currentCol--;
    currentGuess = currentGuess.slice(0, -1);
    const tile = getTile(currentRow, currentCol);
    tile.textContent = '';
    delete tile.dataset.letter;
  }

  // ── Submission ─────────────────────────────────────────
  function submitGuess() {
    if (currentGuess.length < WORD_LEN) {
      shakeRow(currentRow);
      toast('Not enough letters');
      return;
    }

    const allValid = ALL_VALID.map(w => w.toLowerCase());
    if (!allValid.includes(currentGuess) && !WORDS.map(w=>w.toLowerCase()).includes(currentGuess)) {
      shakeRow(currentRow);
      toast('Not in word list');
      return;
    }

    if (hardMode) {
      const violation = checkHardMode(currentGuess);
      if (violation) { shakeRow(currentRow); toast(violation); return; }
    }

    const result = score(currentGuess, answer);
    guessHistory.push({ word: currentGuess, result });

    const submittedGuess = currentGuess;
    const submittedRow = currentRow;

    revealRow(submittedRow, result, () => {
      updateKeyboard(submittedGuess, result);
      if (submittedGuess === answer) {
        gameOver = true;
        setTimeout(() => { launchConfetti(); showResult(true); }, 400);
      } else if (submittedRow === MAX_ROWS - 1) {
        gameOver = true;
        setTimeout(() => showResult(false), 400);
      }
    });

    currentRow++;
    currentCol = 0;
    currentGuess = '';
  }

  // Two-pass scoring to handle duplicate letters correctly
  function score(guess, target) {
    const result = Array(WORD_LEN).fill(STATUS.ABSENT);
    const targetArr = target.split('');
    const guessArr  = guess.split('');
    const targetUsed = Array(WORD_LEN).fill(false);

    // Pass 1: correct positions
    guessArr.forEach((ch, i) => {
      if (ch === targetArr[i]) {
        result[i] = STATUS.CORRECT;
        targetUsed[i] = true;
      }
    });

    // Pass 2: present elsewhere
    guessArr.forEach((ch, i) => {
      if (result[i] === STATUS.CORRECT) return;
      const j = targetArr.findIndex((t, ti) => t === ch && !targetUsed[ti]);
      if (j !== -1) {
        result[i] = STATUS.PRESENT;
        targetUsed[j] = true;
      }
    });

    return result;
  }

  // ── Hard mode check ────────────────────────────────────
  function checkHardMode(guess) {
    for (const { word, result } of guessHistory) {
      for (let i = 0; i < WORD_LEN; i++) {
        if (result[i] === STATUS.CORRECT && guess[i] !== word[i]) {
          return `Position ${i+1} must be ${word[i].toUpperCase()}`;
        }
      }
      for (let i = 0; i < WORD_LEN; i++) {
        if (result[i] === STATUS.PRESENT && !guess.includes(word[i])) {
          return `Guess must contain ${word[i].toUpperCase()}`;
        }
      }
    }
    return null;
  }

  // ── Reveal animation ───────────────────────────────────
  function revealRow(row, result, onDone) {
    result.forEach((status, col) => {
      const tile = getTile(row, col);
      setTimeout(() => {
        tile.classList.add('revealed', status);
        if (col === WORD_LEN - 1) setTimeout(onDone, 300);
      }, col * 120);
    });
  }

  function updateKeyboard(guess, result) {
    const priority = { [STATUS.CORRECT]: 3, [STATUS.PRESENT]: 2, [STATUS.ABSENT]: 1 };
    guess.split('').forEach((ch, i) => {
      const cur = keyStatus[ch];
      if (!cur || priority[result[i]] > priority[cur]) {
        keyStatus[ch] = result[i];
      }
    });
    keyboard.querySelectorAll('.key').forEach(btn => {
      const ch = btn.dataset.key?.toLowerCase();
      if (ch && keyStatus[ch]) {
        btn.className = 'key' + (btn.classList.contains('wide') ? ' wide' : '') + ` ${keyStatus[ch]}`;
      }
    });
  }

  // ── Result modal ───────────────────────────────────────
  function showResult(won) {
    const msgs = ['🏆 Genius!', '🌟 Magnificent!', '✨ Impressive!', '🎉 Splendid!', '👏 Great!', '😅 Phew!'];
    resultTitle.textContent = won ? msgs[currentRow - 1] || '🎊 Nice!' : 'Game Over';
    resultMsg.textContent = won
      ? `You got it in ${currentRow} ${currentRow===1?'guess':'guesses'}! 🎊`
      : 'The word was:';
    answerEl.textContent = won ? '' : answer.toUpperCase();
    resultModal.classList.add('open');
  }

  function launchConfetti() {
    const emojis = ['🎉', '🎊', '⭐', '🌟', '✨', '🎈', '🏆', '🥳'];
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      el.textContent = emojis[i % emojis.length];
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.fontSize = (18 + Math.random() * 14) + 'px';
      el.style.animationDuration = (1 + Math.random() * 0.8) + 's';
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }
  }

  shareBtn.addEventListener('click', () => {
    const emoji = lacroixMode
      ? { correct: '🫧', present: '🩷', absent: '🤍' }
      : { correct: '🟩', present: '🟨', absent: '⬛' };
    const grid = guessHistory.map(g => g.result.map(s => emoji[s]).join('')).join('\n');
    const text = `Wordle 7 — ${guessHistory.length}/${MAX_ROWS}\n\n${grid}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Copied!'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('Copied!');
    }
  });

  playAgainBtn.addEventListener('click', () => {
    resultModal.classList.remove('open');
    if (takeshiMode) {
      answer = 'takeshi';
    } else if (lacroixMode) {
      answer = LACROIX_WORDS[Math.floor(Math.random() * LACROIX_WORDS.length)];
    } else {
      answer = WORDS.filter(w => w.length === WORD_LEN)[
        (Math.floor(Date.now() / 86400000) + guessHistory.length) % WORDS.filter(w=>w.length===WORD_LEN).length
      ].toLowerCase();
    }
    currentRow = 0; currentCol = 0; currentGuess = ''; gameOver = false;
    guessHistory = []; keyStatus = {};
    renderBoard();
    renderKeyboard();
  });

  // ── Settings modal ─────────────────────────────────────
  document.getElementById('settings-btn').addEventListener('click', () => {
    settingsModal.classList.add('open');
  });

  document.getElementById('close-settings').addEventListener('click', () => {
    settingsModal.classList.remove('open');
  });

  hardToggle.addEventListener('change', () => {
    if (guessHistory.length > 0) {
      hardToggle.checked = hardMode;
      toast('Cannot change mode mid-game');
      return;
    }
    hardMode = hardToggle.checked;
    localStorage.setItem('hardMode', hardMode);
  });

  takeshiToggle.addEventListener('change', () => {
    if (guessHistory.length > 0) {
      takeshiToggle.checked = takeshiMode;
      toast('Cannot change mode mid-game');
      return;
    }
    takeshiMode = takeshiToggle.checked;
    localStorage.setItem('takeshiMode', takeshiMode);
    answer = takeshiMode ? 'takeshi' : WORDS.filter(w => w.length === WORD_LEN)[
      Math.floor(Date.now() / 86400000) % WORDS.filter(w=>w.length===WORD_LEN).length
    ].toLowerCase();
  });

  lacroixToggle.addEventListener('change', () => {
    if (guessHistory.length > 0) {
      lacroixToggle.checked = lacroixMode;
      toast('Cannot change mode mid-game');
      return;
    }
    lacroixMode = lacroixToggle.checked;
    localStorage.setItem('lacroixMode', lacroixMode);
    applyLacroix(lacroixMode);
    if (!takeshiMode) {
      const day = Math.floor(Date.now() / 86400000);
      if (lacroixMode) {
        answer = LACROIX_WORDS[Math.floor(Math.random() * LACROIX_WORDS.length)];
      } else {
        const pool = WORDS.filter(w => w.length === WORD_LEN);
        answer = pool[day % pool.length].toLowerCase();
      }
    }
  });

  // ── LaCroix mode ───────────────────────────────────────
  let bubbleInterval = null;

  function applyLacroix(on) {
    document.body.classList.toggle('lacroix', on);
    if (on) {
      if (!bubbleInterval) {
        spawnBubble();
        bubbleInterval = setInterval(spawnBubble, 700);
      }
    } else {
      clearInterval(bubbleInterval);
      bubbleInterval = null;
      document.querySelectorAll('.lacroix-bubble').forEach(b => b.remove());
    }
  }

  function spawnBubble() {
    const el = document.createElement('div');
    el.className = 'lacroix-bubble';
    const size = 6 + Math.random() * 18;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.style.left = (Math.random() * 98) + 'vw';
    el.style.bottom = '-24px';
    el.style.setProperty('--bubble-dur', (3.5 + Math.random() * 3.5) + 's');
    el.style.opacity = 0.25 + Math.random() * 0.45;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // ── Helpers ────────────────────────────────────────────
  function getTile(r, c) { return document.getElementById(`tile-${r}-${c}`); }

  function shakeRow(row) {
    const tiles = Array.from({ length: WORD_LEN }, (_, c) => getTile(row, c));
    tiles.forEach(t => {
      t.classList.remove('row-shake');
      void t.offsetWidth;
      t.classList.add('row-shake');
    });
    // Apply shake to the row visually by wrapping parent
    const parent = board;
    parent.style.setProperty('--shake-row', row);
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  // ── Keyboard events ────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (settingsModal.classList.contains('open') || resultModal.classList.contains('open')) return;
    handleKey(e.key);
  });

  // ── Service Worker ─────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  init();
})();
