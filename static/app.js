let state = { drives: [], sessions: [], questionSets: { aptitude: [], language: [], prompt: [] }, banks: { aptitude: '', language: '', prompt: '' } };
'use strict';
const COMPANY_LOGO = `<img class="company-logo" alt="TurnB" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALkAAAA2CAMAAACslchjAAAAXVBMVEVHcEyVl5qUlpmTlJiVl5oChYMBhIGAj5GUlpiVl5qVl5uUlpmSlJWVl5sChoSWmJsChoSUlplZjI0CgH5/kpQChoQBhIKVl5oChYMChYMChYOVl5qTlZgChIIChYMvRbDiAAAAHHRSTlMA+V0i7uo/A0SW06gH37M1+HkOBhZbIr7RnXdv5t0AzAAAA7FJREFUaN7tmumSqyAQhVVQ3HAhREx0fP/HvIyO0hhwmVFvpSrnXwjLl1OtdEMc56OP9oh7G5RfBXN/VRAEFbsZOofYXVd5EXngFwb5df24V3N4EuJ2XdeRf5nVFf4jYHPP34H8G95/VG/oeY/e1cFbev7NDtHJO5F/dVn1Bp53vb46Hf0JPKdYyVWwLmjGzfXk/mNQVhea6XzqzHKgUqEnsJ1fTt5lN9KLVc8a+O4HxoHEU+QRbHf+B7kxhoq7eSQkvwx3ldx5dqZAt3p+ADnhnDNi+w7JMERsAzkBplvIzZ6n4ZR5hQADqYQMDU+MnqGRvEmEVNIgrXM+DI6EfDXQWEQhW/UckNuipTGRo3hMvNokhb9ykjf0o1M/OZiXdHxJhVpn+YZFZawWwkm+hzzY4TmK1QsnNfWdyMFglEwfYqRNXJJQuNpuQb3tcV5XO+J8IzmB5FyBu9+DILlH5xsdDRfJq6xTYU5O9hyEndvonYVh047RAnn16Iy7/5Y43+25UENanOuWLKUXkJzdpBir7mojmiWLZ3gObRV8A/mP6XD3z3rVfrEF/LA4h+onmpHjWAgKm7BnyRULa2VxjucTXoyHLzVyNwk5Y6ih89+3lOXKau62sOk1x3mOoxAxuU8O2xQkxxEb01T1Y0S6Ql5kz3kheo7n2EstE7fRCEBKEOh8vZrzs4CcHuduQ2yW0GnLJDmdPaIrNVHhP29ney6YdWIwBxf7yGW029CPinPXW7BEtaaJndyve/ngrbhQWRzmOUX2ictN5HK3HBTctZoIlnNnxPk8WH5DDvKWZ7FaFB3leZIeSe7cAHr3uJ0Z5y8F1d/InQrmLvzc/PxY8tUM/bj8/GByAsj96jeewyevbC/0/LFGvhbnMTKter7nvF6r54yec0WOw6lrTi/0HL5bMrY5zpnao9tkHMaS9jLP2d3/WjtwMZ+3RCAFLIdnlEdue7LnjIzlXFasb//GOIetfdotk27t3OEMz8ezXFnPaYmLOVhs54q5Vq1jGlO9NjvD8/H8vJsni8GO/FwLdJNO8dyW5e45b5HNeAO5cwF58WR76lBtBZXIJu7Vnnf2ksh6fo5e4oV65+Yt5jLU2Xfe0j+kifZQuiI8OW+ZX4Ua7qD1BdSl1mxx3qiDYywarvX98Ty2DdY6g9uyNJpaxUAuqzeD6sxw7z+7Rwgnodc/ZUQilhJl2GfIoC//uStbGGyeWI3I+x2OBSZVFfvrXVXKpdINk/x+GfKizx95Pvqj/gGC2ZDgwWZdtwAAAABJRU5ErkJggg==">`;
// Question wording is an illustrative adaptation for layout review, not the final approved assessment text.
let view = 'sessions', candidateSession = null, currentAttempt = null, answerFocus = false;
const app = document.querySelector('#app'), modal = document.querySelector('#modal');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(message) { let el = document.querySelector('#toast'); el.textContent = message; el.classList.remove('hidden'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add('hidden'), 5500); }
function clock(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
function date(t) { return new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function finalize(s, reason) { if (s.closedAt)
    return; expire(); s.closedAt = Date.now(); s.attempts.forEach(a => { if (!a.submittedAt) {
    a.submittedAt = s.closedAt;
    a.reason = reason;
} }); if (state.activeId === s.id)
    state.activeId = null; save(); }
function nav(page) { view = page; render(); }
function dialog(title, body, footer = '', wide = false) { modal.className = wide ? 'wide' : ''; modal.innerHTML = `<div class="modal-head"><h2>${title}</h2><button class="quiet small" onclick="modal.close()" aria-label="Close dialog">✕</button></div><div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}`; modal.showModal(); }
function confirmStop(id) { let s = state.sessions.find(x => x.id === id); dialog('End this test?', `<p><b>${esc(s.name)}</b></p><p class="sub">All active candidates will be submitted and locked, including those with partial or blank responses.</p><div class="notice">This closes the session for everyone. You cannot reopen it.</div>`, `<button onclick="modal.close()">Keep test running</button><button class="danger" onclick="stopSession('${id}')">Stop test for everyone</button>`); }
function stopSession(id) { let s = state.sessions.find(x => x.id === id); finalize(s, 'admin'); modal.close(); render(); toast('Test ended. All active attempts are saved and locked.'); }
function candidateHeader(s, a) { return `<header class="candidate-header"><div class="tool-name">Recruitment Platform</div>${a ? `<div class="timerbox"><div class="time-label">YOUR TIME REMAINING</div><div class="time" data-clock="${a.id}">${clock(timeLeft(a))}</div></div>` : ''}${COMPANY_LOGO}</header>`; }
function words(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }
function renderDone(s, a) { let title = a.reason === 'timeout' ? 'Time is over.' : a.reason === 'admin' ? 'The test has ended.' : 'You’re all done.'; app.innerHTML = candidateHeader(s, null) + `<main class="candidate-main"><section class="done card"><div class="card-body"><div class="done-icon">✓</div><div class="eyebrow">RESPONSE RECEIVED</div><h1 style="margin-top:12px">${title}</h1><p class="sub">Your response has been saved. Thank you.</p><p class="muted" style="font-size:12px;margin:22px 0">${esc(a.name)} · ${esc(a.studentId)}<br>${esc(s.name)}</p><div class="notice">Your response is submitted and can no longer be edited.</div></div></section></main>`; }
// Drive scheduler prototype. Tests are scoped to a drive, with immutable question snapshots per link.
const TYPES = [{ id: 'aptitude', name: 'Aptitude', icon: '∑', description: 'Numerical ability, quantitative thinking and problem solving.' }, { id: 'language', name: 'Language & Reasoning', icon: 'Aa', description: 'Language skills, comprehension and logical reasoning.' }, { id: 'prompt', name: 'Prompt Engineering', icon: '⌘', description: 'A long-form challenge to evaluate structured thinking and prompting.' }];
let filterName = '', filterStatus = 'all', filtersOpen = false, expandedDrive = null;
const typeInfo = id => TYPES.find(t => t.id === id);
function driveTests(id) { return state.sessions.filter(s => s.driveId === id); }
function driveStatus(d) { if (d.finishedAt)
    return 'Finished'; return driveTests(d.id).some(s => !s.closedAt) ? 'Live' : driveTests(d.id).length ? 'Finished' : 'Not started'; }
function badge(status) { return `<span class="chip status-${status === 'Live' ? 'live' : status === 'Finished' ? 'finished' : 'not'}">${status}</span>`; }
function shell(content) { let pages = [['sessions', '◷', 'Session scheduler'], ['question', '▤', 'Question overview'], ['final', '▦', 'Final scores']]; return `<header class="masthead"><div class="tool-name">Recruitment Platform</div>${COMPANY_LOGO}</header><div class="shell"><aside><div class="navlabel">WORKSPACE</div>${pages.map(([id, icon, label]) => `<button class="nav ${view === id ? 'active' : ''}" onclick="nav('${id}')"><span>${icon}</span>${label}</button>`).join('')}<div class="aside-foot"><div class="profile"><span class="avatar">TB</span><div>Recruitment team<small>Administrator</small></div></div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">Workspace &nbsp; / &nbsp; <b>${pages.find(p => p[0] === view)?.[2] || 'Session scheduler'}</b></div></header><main class="main">${content}<div class="footer-note">TurnB Recruitment Platform · Responses and question sets are stored securely on the server.</div></main></div></div>`; }
function heading(title, subtitle, action = '') { return `<div class="eyebrow">RECRUITMENT WORKSPACE</div><div class="heading"><div><h1>${title}</h1><p class="sub">${subtitle}</p></div>${action}</div>`; }
function scheduler() { return heading('Session scheduler', 'One drive. Three assessments. Everything kept together.', `<button class="primary" onclick="startDrive()">＋ Start a drive</button>`) + `<div class="filterbar"><div class="field"><label for="driveSearch">Find a drive</label><input id="driveSearch" type="search" value="${esc(filterName)}" placeholder="Search college, year or drive name" oninput="filterName=this.value;updateDriveList()"></div><button onclick="filtersOpen=!filtersOpen;render()">☷ Filter${filterStatus !== 'all' ? ' · 1' : ''}</button></div>${filtersOpen ? `<div class="filters-panel row"><label for="statusFilter">Drive status</label><select id="statusFilter" onchange="filterStatus=this.value;updateDriveList()">${['all', 'Not started', 'Live', 'Finished'].map(v => `<option value="${v}" ${filterStatus === v ? 'selected' : ''}>${v === 'all' ? 'All statuses' : v}</option>`).join('')}</select><button class="quiet small" onclick="filterName='';filterStatus='all';render()">Clear filters</button></div>` : ''}<div id="driveList">${driveList()}</div>`; }
function updateDriveList() { document.querySelector('#driveList').innerHTML = driveList(); }
function driveList() { let drives = state.drives.filter(d => d.name.toLowerCase().includes(filterName.toLowerCase()) && (filterStatus === 'all' || driveStatus(d) === filterStatus)); return drives.length ? drives.slice().sort((a, b) => b.createdAt - a.createdAt).map(d => `<details class="drive" ${expandedDrive === d.id ? 'open' : ''} ontoggle="if(this.open)expandedDrive='${d.id}'"><summary><span class="avatar">◷</span><div class="drive-summary"><b>${esc(d.name)}</b><small>Created ${date(d.createdAt)} · ${driveTests(d.id).length} of 3 test links generated</small></div>${badge(driveStatus(d))}</summary><div class="drive-tests">${TYPES.map(t => testRow(d, t)).join('')}${!d.finishedAt ? `<div class="drive-actions"><button class="danger small" onclick="confirmEndDrive('${d.id}')">End drive</button></div>` : ''}</div></details>`).join('') : '<div class="empty card"><strong>No matching drives</strong>Change your filters or start a new drive.</div>'; }
function startDrive() { dialog('Start a drive', `<p class="sub">Create a dedicated section for a college or recruitment round.</p><form id="driveForm"><div class="field"><label for="driveName">Drive name</label><input id="driveName" required maxlength="120" placeholder="e.g. ABC College · 2026" autofocus><small>Each drive has separate links and responses for all three tests.</small></div></form>`, `<button onclick="modal.close()">Cancel</button><button class="primary" type="submit" form="driveForm">Create drive</button>`); document.querySelector('#driveForm').onsubmit = e => { e.preventDefault(); let name = document.querySelector('#driveName').value.trim(); if (!name)
    return; if (state.drives.some(d => d.name.toLowerCase() === name.toLowerCase())) {
    toast('A drive with this name already exists. Choose a distinct name.');
    return;
} let d = { id: uuid(), name, createdAt: Date.now(), finishedAt: null }; state.drives.unshift(d); expandedDrive = d.id; filterName = ''; filterStatus = 'all'; view = 'sessions'; save(); modal.close(); render(); toast('Drive created. Expand it to generate assessment links.'); }; }
function confirmEndDrive(id) { dialog('End this drive?', `<p class="sub">All open tests for this drive will close. Active responses, including blank responses, will be submitted and locked. Other drives will remain open.</p>`, `<button onclick="modal.close()">Cancel</button><button class="danger" onclick="endDrive('${id}')">End drive</button>`); }
function endDrive(id) { let d = state.drives.find(d => d.id === id); driveTests(id).forEach(s => finalize(s, 'admin')); d.finishedAt = Date.now(); save(); modal.close(); render(); toast('Drive finished. All its tests are closed.'); }
function startSession() { startDrive(); }
function active() { return state.sessions.find(s => !s.closedAt && s.question.trim()); }
const FORMATS = { single: 'Multiple choice', multiple: 'Multiple select', boolean: 'True / False', ranking: 'Ranking', text: 'Text response', matching: 'Match the following' };
function bankText(type) { return state.questionSets[type].map((q, i) => `Question ${i + 1}\n${q.text}\n${(q.options || []).map((o, j) => String.fromCharCode(65 + j) + '. ' + o).join('\n')}`).join('\n\n'); }
let draftQuestion = null, draftBank = null, draftIndex = -1, quizIndex = 0;
function keyReady(q) { if (q.type === 'text')
    return false; if (['single', 'multiple', 'boolean'].includes(q.type))
    return q.key?.length > 0; if (q.type === 'ranking')
    return q.key?.length === q.options.length && Array.from(q.key).every(i => Number.isInteger(i) && i >= 0 && i < q.options.length) && new Set(q.key).size === q.options.length; return q.pairs?.length > 0 && q.pairs.every(p => p.left && p.right); }
function drawQuestionEditor() { let q = draftQuestion; mountQuestionEditor(draftIndex < 0 ? 'Add question' : 'Edit question', `<div class="field"><label for="questionType">Question type</label><select class="type-select" id="questionType" onchange="changeQuestionType(this.value)">${Object.entries(FORMATS).map(([id, name]) => `<option value="${id}" ${q.type === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="field"><label for="questionText">Question / instructions</label><textarea id="questionText" class="question-editor" oninput="draftQuestion.text=this.value">${esc(q.text)}</textarea></div>${draftBank === 'prompt' ? '' : editorFields(q)}${draftBank === 'prompt' ? '' : `<div class="score-grid"><div class="field"><label for="correctScore">Score for correct answer / maximum score</label><input id="correctScore" type="number" min="0" step="any" value="${q.correctScore}" oninput="draftQuestion.correctScore=Number(this.value)"></div><div class="field"><label for="wrongScore">Score for wrong answer</label><input id="wrongScore" type="number" max="0" step="any" value="${q.wrongScore}" oninput="draftQuestion.wrongScore=Number(this.value)"><small>Enter 0 for no penalty or a negative value.</small></div></div><p class="sub">Unanswered questions score 0. ${q.type === 'text' ? 'Text responses are marked manually.' : 'Automatic marking requires an answer key. You may save a draft without one.'}</p>`}${draftBank === 'prompt' ? '<div class="notice">Prompt Engineering is evaluated separately. No correct answer or automatic score is required.</div>' : ''}<div id="editorError" class="inline-error" role="alert"></div>`, `<button onclick="cancelInlineEdit()">Cancel</button><button class="primary" onclick="saveQuizQuestion()">Save question</button>`, true); }
function editorFields(q) { if (q.type === 'text')
    return '<div class="notice">Candidates receive a long-form response box. This question requires manual scoring.</div>'; if (q.type === 'matching')
    return `<div class="field"><label>Correct matching pairs</label><small>Each row defines a correct pair. The candidate’s right-hand choices appear in a different order.</small>${(q.pairs || []).map((p, i) => `<div class="match-row"><input aria-label="Left item ${i + 1}" value="${esc(p.left)}" oninput="draftQuestion.pairs[${i}].left=this.value"><input aria-label="Matching right item ${i + 1}" value="${esc(p.right)}" oninput="draftQuestion.pairs[${i}].right=this.value"></div>`).join('')}<button class="small" onclick="draftQuestion.pairs.push({left:'',right:''});drawQuestionEditor()">＋ Add pair</button><button class="quiet small" onclick="if(draftQuestion.pairs.length>2){draftQuestion.pairs.pop();drawQuestionEditor()}">Remove last pair</button></div>`; let ranking = q.type === 'ranking'; return `<div class="field"><label>${ranking ? 'Items to rank' : 'Answer options'}</label><small>${ranking ? 'Set the correct position for each item. Use each position once.' : q.type === 'multiple' ? 'Tick every correct option. Candidates must select the complete correct set.' : 'Select the radio button beside the correct answer.'}</small>${q.options.map((o, i) => `<div class="editor-options">${ranking ? `<span>${i + 1}</span>` : `<input aria-label="Mark option ${i + 1} correct" type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="correctOption" ${q.key.includes(i) ? 'checked' : ''} onchange="setCorrectOption(${i},this.checked)">`}<input aria-label="Option ${i + 1}" value="${esc(o)}" ${q.type === 'boolean' ? 'readonly' : ''} oninput="draftQuestion.options[${i}]=this.value">${ranking ? `<select class="type-select" aria-label="Correct position for item ${i + 1}" onchange="setRankKey(${i},this.value)"><option value="">—</option>${q.options.map((_, j) => `<option value="${j}" ${q.key[j] === i ? 'selected' : ''}>${j + 1}</option>`).join('')}</select>` : `<button class="quiet small" ${q.type === 'boolean' ? 'disabled' : ''} aria-label="Remove option ${i + 1}" onclick="removeOption(${i})">✕</button>`}</div>`).join('')}${q.type !== 'boolean' ? '<button class="small" onclick="draftQuestion.options.push(\'\');draftQuestion.key=[];drawQuestionEditor()">＋ Add option</button>' : ''}</div>`; }
function changeQuestionType(type) { draftQuestion.type = type; draftQuestion.key = []; if (type === 'boolean')
    draftQuestion.options = ['True', 'False'];
else if (type === 'matching')
    draftQuestion.pairs = draftQuestion.pairs || [{ left: '', right: '' }, { left: '', right: '' }];
else if (type !== 'text' && draftQuestion.options.length < 2)
    draftQuestion.options = ['', '']; drawQuestionEditor(); }
function setCorrectOption(i, checked) { let q = draftQuestion; if (q.type === 'multiple')
    q.key = checked ? [...new Set([...q.key, i])] : q.key.filter(k => k !== i);
else
    q.key = [i]; }
function setRankKey(item, position) { let q = draftQuestion; q.key = q.key.map(x => x === item ? null : x); if (position !== '')
    q.key[Number(position)] = item; }
function removeOption(i) { if (draftQuestion.options.length <= 2)
    return; draftQuestion.options.splice(i, 1); draftQuestion.key = []; drawQuestionEditor(); }
function saveQuizQuestion() { if (managerReadOnly || managerDrive && driveTests(managerDrive).some(s => s.type === managerType && (s.attempts.length || s.closedAt))) {
    toast('This test has started or finished. Questions are locked.');
    return;
} let q = draftQuestion, error = ''; q.text = q.text.trim(); if (!q.text)
    error = 'Enter a question.';
else if (!Number.isFinite(q.correctScore) || q.correctScore < 0 || !Number.isFinite(q.wrongScore) || q.wrongScore > 0)
    error = 'Correct score must be zero or positive; wrong score must be zero or negative.';
else if (q.type === 'matching' && (q.pairs.length < 2 || q.pairs.some(p => !p.left.trim() || !p.right.trim())))
    error = 'Add at least two complete matching pairs.';
else if (q.type === 'matching' && new Set(q.pairs.map(p => p.right.trim())).size !== q.pairs.length)
    error = 'Use distinct right-hand matching items.';
else if (!['text', 'matching'].includes(q.type) && (q.options.length < 2 || q.options.some(o => !o.trim())))
    error = 'Complete at least two answer options.';
else if (q.type === 'ranking' && q.key.some(x => x != null) && (!keyReady(q) || new Set(q.key).size !== q.options.length || q.key.some(x => x == null)))
    error = 'Choose each ranking position exactly once, or leave the whole key blank.'; if (error) {
    document.querySelector('#editorError').textContent = error;
    return;
} if (draftIndex < 0)
    managerQuestions().push(q);
else
    managerQuestions()[draftIndex] = q; commitManagerQuestions(); save(); draftIndex = -2; refreshQuestionManager(); renderAdmin(); toast('Question saved.'); }
function answerPresent(q, v) { return q.type === 'text' ? !!String(v || '').trim() : Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ''; }
function currentQuiz() { let s = state.sessions.find(s => s.id === candidateSession); return { s, a: s?.attempts.find(a => a.id === currentAttempt) }; }
function renderCandidate() { let { s, a } = currentQuiz(); if (!s) {
    app.innerHTML = candidateHeader({}, null) + '<div class="empty">This test link is unavailable. Contact the recruitment team.</div>';
    return;
} if (a?.submittedAt) {
    renderDone(s, a);
    return;
} if (s.closedAt) {
    app.innerHTML = candidateHeader(s, null) + '<div class="empty"><h1>This test has ended.</h1><p>No further responses can be entered.</p><button onclick="goAdmin()">Administrator</button></div>';
    return;
} let qs = s.questions || []; if (!qs.length && !s.questionCount) {
    app.innerHTML = candidateHeader(s, null) + '<div class="empty"><h1>Questions are not ready yet.</h1><p>Ask the recruitment team to configure questions and generate a new test link.</p><button onclick="goAdmin(\'question\')">Administrator</button></div>';
    return;
} if (!a) {
    app.innerHTML = candidateHeader(s, null) + `<main class="candidate-main"><section class="entry card"><div class="card-body"><span class="chip">${typeInfo(s.type).name}</span><h1>Ready to begin?</h1><p>${esc(s.name)}</p><div class="notice">${s.questionCount || qs.length} questions · ${durationMinutes(s)} minutes from your own start. The administrator can end the test at any time. ${s.type === 'prompt' ? 'Your response is evaluated separately.' : 'Unanswered questions score 0.'}</div><form id="entryForm"><div class="field"><label for="candidateName">Full name</label><input id="candidateName" required maxlength="100"></div><div class="field"><label for="studentId">Student ID</label><input id="studentId" required maxlength="60"></div><button class="primary" type="submit">Start test →</button></form></div></section></main>`;
    document.querySelector('#entryForm').onsubmit = startCandidate;
    return;
} quizIndex = Math.min(quizIndex, qs.length - 1); let q = qs[quizIndex]; app.innerHTML = candidateHeader(s, a) + `<main class="candidate-main"><div class="row between" style="margin-bottom:20px"><div><h1 style="font-size:24px">${typeInfo(s.type).name}</h1><p class="sub">${esc(s.name)}</p></div><div>${esc(a.name)} · ${esc(a.studentId)}</div></div><div class="quiz-layout"><section class="card"><div class="card-head"><h2>Question ${quizIndex + 1} of ${qs.length}</h2><span class="chip">${FORMATS[q.type]}</span></div><div class="card-body"><article class="question-item" style="margin:0">${questionContext(q)}<h3>${esc(q.text)}</h3>${s.type === 'prompt' ? '' : `<p class="sub">Correct +${q.correctScore} · Wrong ${q.wrongScore} · Unanswered 0${q.type === 'text' ? ' · Manually reviewed' : ''}</p>`}${candidateQuestion(q, a.responses?.[q.id])}</article><div class="row between" style="margin-top:20px"><button ${quizIndex === 0 ? 'disabled' : ''} onclick="quizIndex--;render()">← Previous</button><button ${quizIndex === qs.length - 1 ? 'disabled' : ''} onclick="quizIndex++;render()">Next →</button></div></div></section><section class="card quiz-side"><div class="card-body"><b>Question navigator</b><p class="sub" style="margin-top:8px">${qs.filter(q => answerPresent(q, a.responses?.[q.id])).length} of ${qs.length} answered</p><div class="quiz-nav">${qs.map((x, i) => `<button class="${i === quizIndex ? 'current' : answerPresent(x, a.responses?.[x.id]) ? 'answered' : ''}" onclick="quizIndex=${i};render()">${i + 1}</button>`).join('')}</div><button class="primary" style="width:100%;margin-top:20px" onclick="confirmSubmit()">Submit test</button></div></section></div></main>`; }
function setQuizResponse(value) { let { s, a } = currentQuiz(); if (!a || a.submittedAt || s.closedAt || serverNow() >= a.deadline) {
    render();
    return;
} let q = s.questions[quizIndex]; a.responses = a.responses || {}; if (value === undefined)
    delete a.responses[q.id];
else
    a.responses[q.id] = value; a.answer = s.questions.map((q, i) => `Question ${i + 1}: ${q.text}\nResponse: ${JSON.stringify(a.responses[q.id] ?? '')}`).join('\n\n'); save(); }
function selectQuizOption(i, checked) { let { s, a } = currentQuiz(), q = s.questions[quizIndex], v = a.responses?.[q.id] || []; setQuizResponse(q.type === 'multiple' ? (checked ? [...new Set([...v, i])] : v.filter(j => j !== i)) : [i]); render(); }
function moveRank(pos, dir) { let { s, a } = currentQuiz(), q = s.questions[quizIndex], v = [...(a.responses?.[q.id] || q.options.map((_, i) => i))]; [v[pos], v[pos + dir]] = [v[pos + dir], v[pos]]; setQuizResponse(v); render(); }
function confirmRank() { let { s, a } = currentQuiz(), q = s.questions[quizIndex]; setQuizResponse(a.responses?.[q.id] || q.options.map((_, i) => i)); render(); }
let managerType = null, managerDrive = null, managerReadOnly = false;
function questionContext(q) { if (!q.context && !q.table)
    return ''; return `<details class="shared-context" open><summary>Shared scenario & data table</summary><p>${esc(q.context || '')}</p>${q.table ? `<div class="data-table"><table><thead><tr>${q.table[0].map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${q.table.slice(1).map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</details>`; }
function driveQuestionSet(driveId, type) { let d = state.drives.find(d => d.id === driveId), s = driveTests(driveId).find(s => s.type === type); if (s?.questions)
    return s.questions; return d?.questionSets?.[type] || state.questionSets[type]; }
function managerQuestions() { return managerDrive ? driveQuestionSet(managerDrive, managerType) : state.questionSets[managerType]; }
function openQuestionManager(type, driveId = null) { managerType = type; managerDrive = driveId; draftIndex = -2; draftQuestion = null; let s = driveId ? driveTests(driveId).find(s => s.type === type) : null; let drive = state.drives.find(d => d.id === driveId); if (drive && !s?.questions) {
    drive.questionSets = drive.questionSets || {};
    if (!drive.questionSets[type])
        drive.questionSets[type] = JSON.parse(JSON.stringify(state.questionSets[type]));
} managerReadOnly = !!s && (s.attempts.length > 0 || !!s.closedAt) || !!drive?.finishedAt; modal.className = 'question-manager'; modal.innerHTML = `<header class="manager-header"><div class="row between"><div><h2>${typeInfo(type).name} · Questions</h2><p>${drive ? esc(drive.name) : 'Default question set for future drives'}</p></div><button class="quiet" aria-label="Close question manager" onclick="modal.close()">✕</button></div><div class="manager-toolbar"><span class="sub">${managerReadOnly ? 'Questions are locked because this test has started or finished.' : 'Edit questions inline below. Changes are saved per question.'}</span><button class="primary small" ${managerReadOnly ? 'disabled' : ''} onclick="editQuizQuestion('${type}',-1)">＋ Add question</button></div></header><div class="manager-scroll" id="questionManagerScroll"><div id="questionManagerList"></div></div><footer class="manager-footer">${drive ? 'Changes apply only to this drive and test.' : 'Default changes apply to future generated tests.'} Scroll inside this window to review all questions.</footer>`; refreshQuestionManager(); if (!modal.open)
    modal.showModal(); }
function refreshQuestionManager() { let el = document.querySelector('#questionManagerList'), scroller = document.querySelector('#questionManagerScroll'), top = scroller.scrollTop; el.innerHTML = `${managerType === 'language' ? '<div class="notice">20 Language Proficiency questions and 5 Data Interpretation questions. Supplied reference keys are admin-only. Data Interpretation reference inconsistencies are flagged below.</div>' : ''}${managerReadOnly ? '<div class="notice">Viewing the test snapshot. Return to Question overview to edit defaults for future tests.</div>' : ''}<div id="newQuestionEditor"></div>${managerQuestions().map((q, i) => adminQuestion(managerType, q, i)).join('') || '<div class="empty">No questions yet. Click Add question.</div>'}`; scroller.scrollTop = top; }
function adminQuestion(type, q, i) { let prompt = type === 'prompt', key = q.key || []; return `<article class="question-item" id="manager-question-${i}"><div class="row between"><div class="question-meta"><b>Q${i + 1}</b><span class="chip">${FORMATS[q.type]}</span><span class="source-label">${esc(q.source || typeInfo(type).name)}</span>${prompt ? '' : `<span class="chip ${keyReady(q) ? '' : 'review-required'}">${q.type === 'text' ? 'Manual review' : keyReady(q) ? 'Answer key set' : 'Answer key needed'}</span>`}</div><div class="row"><button class="small" ${managerReadOnly ? 'disabled' : ''} onclick="editQuizQuestion('${type}',${i})">Edit question</button><button class="danger small" ${managerReadOnly ? 'disabled' : ''} onclick="deleteQuizQuestion('${type}',${i})">Delete question</button></div></div>${questionContext(q)}<h3>${esc(q.text)}</h3>${q.type === 'matching' ? (q.pairs || []).map(p => `<div class="option-preview">${esc(p.left)} → ${esc(p.right)}</div>`).join('') : (q.options || []).map((o, j) => `<div class="option-preview ${!prompt && key.includes(j) ? 'correct' : ''}">${String.fromCharCode(65 + j)}. ${esc(o)} ${!prompt && key.includes(j) && q.type !== 'ranking' ? '✓' : ''}</div>`).join('')}${q.referenceAnswer && !prompt ? `<div class="reference-note"><b>Source reference answer (admin only)</b><br>${esc(q.referenceAnswer)}</div>` : ''}${q.reviewNote ? `<div class="notice">${esc(q.reviewNote)}</div>` : ''}<div class="question-foot">${prompt ? 'Separate evaluation · No answer key or automatic scoring' : `Correct: +${q.correctScore} · Wrong: ${q.wrongScore} · Unanswered: 0`}</div></article>`; }
function editQuizQuestion(type, index) { if (!modal.open || !modal.className.includes('question-manager') || managerType !== type)
    openQuestionManager(type); if (managerReadOnly)
    return; if (draftIndex !== -2 && draftIndex !== index) {
    document.querySelector('#inlineUnsavedNotice')?.remove();
    toast('Save or cancel your current edit before editing another question.');
    return;
} draftBank = type; draftIndex = index; draftQuestion = index < 0 ? { id: uuid(), type: type === 'prompt' ? 'text' : 'single', text: '', options: type === 'prompt' ? [] : ['', '', '', ''], key: [], correctScore: type === 'prompt' ? 0 : 1, wrongScore: 0 } : JSON.parse(JSON.stringify(managerQuestions()[index])); drawQuestionEditor(); }
function mountQuestionEditor(title, body, footer) { let target = draftIndex < 0 ? document.querySelector('#newQuestionEditor') : document.querySelector('#manager-question-' + draftIndex); if (draftBank === 'prompt') {
    body = body.replace(/<div class="field"><label for="questionType">[\s\S]*?<\/select><\/div>/, '<div class="notice">Long-form text response · Evaluated separately</div>');
} if (draftQuestion.context || draftQuestion.table)
    body = `<div class="field"><label for="contextEdit">Shared scenario</label><textarea id="contextEdit" class="question-editor" oninput="draftQuestion.context=this.value">${esc(draftQuestion.context || '')}</textarea></div><p class="sub">The shared table is retained with this question.</p>` + body; if (draftBank !== 'prompt')
    body += `<div class="field"><label for="referenceEdit">Reference answer / marking notes (admin only)</label><textarea id="referenceEdit" class="question-editor" oninput="draftQuestion.referenceAnswer=this.value">${esc(draftQuestion.referenceAnswer || '')}</textarea></div>`; target.innerHTML = `<div class="inline-question-editor"><h3>${title}${draftIndex >= 0 ? ' · Q' + (draftIndex + 1) : ''}</h3>${body}<div class="modal-foot">${footer}</div></div>`; if (draftIndex < 0)
    document.querySelector('#questionManagerScroll').scrollTop = 0; }
function cancelInlineEdit() { draftIndex = -2; draftQuestion = null; refreshQuestionManager(); }
function commitManagerQuestions() { if (managerDrive) {
    let d = state.drives.find(d => d.id === managerDrive), s = driveTests(managerDrive).find(s => s.type === managerType);
    if (s) {
        s.question = managerQuestions().map((q, i) => `Question ${i + 1}\n${q.text}`).join('\n\n');
    }
    else {
        d.questionSets = d.questionSets || {};
        d.questionSets[managerType] = managerQuestions();
    }
}
else
    state.banks[managerType] = bankText(managerType); }
function testRow(d, t) { let s = driveTests(d.id).find(s => s.type === t.id), qs = driveQuestionSet(d.id, t.id); return `<section class="test-row"><div class="row between"><div><h3>${t.name}</h3><p>${qs.length} questions · ${durationMinutes(t.id)} minutes${s ? ` · ${s.attempts.length} candidates · ${s.attempts.filter(a => a.submittedAt).length} submitted` : ''}</p></div><div class="row">${s ? badge(s.closedAt ? 'Finished' : 'Live') : badge('Not started')}<button class="small" onclick="openQuestionManager('${t.id}','${d.id}')">Update questions</button></div></div>${s ? `<div class="linkbox"><input aria-label="${t.name} test link" readonly value="${esc(testLink(s))}"><button class="small" onclick="copyLink('${s.id}')">Copy link</button></div><div class="row" style="margin-top:12px"><button class="small" onclick="openCandidate('${s.id}')">Candidate preview ↗</button><button class="small" onclick="showResponses('${s.id}')">View responses</button>${!s.closedAt ? `<button class="danger small" onclick="confirmStop('${s.id}')">Stop test</button>` : ''}</div>` : `<div class="row" style="margin-top:15px"><button class="primary small" ${d.finishedAt ? 'disabled' : ''} onclick="generateTest('${d.id}','${t.id}')">Generate link for ${t.name}</button>${!qs.length ? '<span class="sub">Add questions before candidates can start.</span>' : ''}</div>`}</section>`; }
function questionOverview() { return heading('Question overview', 'Manage the default question sets for your recruitment drives.') + `<div class="notice">Language & Reasoning now includes both uploaded question sets. Use Update questions to review or edit in one scrollable window. Prompt Engineering is evaluated separately, without an answer key or automatic score.</div><div class="ready-grid">${TYPES.map(t => { let qs = state.questionSets[t.id]; return `<section class="card"><div class="card-body"><span class="chip">${qs.length} questions</span><h3>${t.name}</h3><p>${t.id === 'language' ? '20 Language Proficiency + 5 Data Interpretation questions' : t.description}</p>${t.id === 'prompt' ? '<div class="bank-summary">Separate evaluation</div>' : `<div class="bank-summary">${qs.filter(keyReady).length} answer keys · ${qs.filter(q => q.type === 'text').length} written responses</div>`}<button class="primary small" onclick="openQuestionManager('${t.id}')">Update questions</button></div></section>`; }).join('')}</div>`; }
function createTest(driveId, type) { let d = state.drives.find(d => d.id === driveId); if (!d || d.finishedAt || driveTests(driveId).some(s => s.type === type))
    return; let qs = JSON.parse(JSON.stringify(driveQuestionSet(driveId, type))); let s = { id: uuid(), driveId, type, name: d.name + ' · ' + typeInfo(type).name, start: Date.now(), closedAt: null, question: qs.map(q => q.text).join('\n\n'), questions: qs, attempts: [] }; state.sessions.unshift(s); state.activeId = s.id; expandedDrive = d.id; save(); modal.close(); render(); toast('Test link generated with the drive’s current question set.'); }
function durationMinutes(value) { let type = typeof value === 'string' ? value : value?.type; return type === 'aptitude' ? 15 : type === 'language' ? 20 : 30; }
function elapsedMinutes(a) { return a.submittedAt ? Math.max(0, (a.submittedAt - a.startedAt) / 60000) : null; }
function gradeAttempt(s, a) { let total = 0, pending = 0; let results = (s.questions || []).map(q => { let v = a.responses?.[q.id], answered = answerPresent(q, v), manual = a.manualMarks?.[q.id]; if (manual !== undefined && Number.isFinite(manual)) {
    total += manual;
    return { id: q.id, score: manual, status: 'Manually marked' };
} if (!answered)
    return { id: q.id, score: 0, status: 'Unanswered' }; if (q.type === 'text' || !keyReady(q)) {
    pending++;
    return { id: q.id, score: null, status: 'Needs review' };
} let correct = false; if (q.type === 'matching')
    correct = q.pairs.every((p, i) => v[i] === i);
else if (q.type === 'ranking')
    correct = JSON.stringify(v) === JSON.stringify(q.key);
else
    correct = JSON.stringify([...v].sort()) === JSON.stringify([...q.key].sort()); let score = correct ? q.correctScore : q.wrongScore; total += score; return { id: q.id, score, status: correct ? 'Correct' : 'Wrong' }; }); return { total: Math.round(total * 1000000) / 1000000, pending, results }; }
let responseSession = null, responseFilters = { minMarks: '', minTime: '' }, reviewAttempt = null;
function updateResponseTable() { let s = state.sessions.find(s => s.id === responseSession), rows = responseRows(s), error = filterValidation(); document.querySelector('#response-filter-error').textContent = error; document.querySelector('#responseCount').textContent = `${rows.length} of ${s.attempts.length} candidates · ${s.attempts.filter(a => a.shortlisted).length} shortlisted`; let drive = state.drives.find(d => d.id === s.driveId)?.name || s.name; document.querySelector('#responseTable').innerHTML = error ? `<div class="results-empty">${esc(error)}</div>` : !rows.length ? '<div class="results-empty">No candidates match these filters.</div>' : `<table><thead><tr><th>Drive name</th><th>Student name</th><th>Student ID</th><th>Marks obtained</th><th>Time taken (min)</th><th>Next round</th><th></th></tr></thead><tbody>${rows.map(({ a, g, minutes }) => `<tr><td>${esc(drive)}</td><td>${esc(a.name)}${a.sample ? '<small>Sample candidate</small>' : ''}</td><td>${esc(a.studentId)}</td><td><span class="marks-total">${a.submittedAt ? g.total : '—'}</span>${g.pending && a.submittedAt ? `<small>${g.pending} pending · provisional</small>` : ''}</td><td>${minutes === null ? '—' : minutes.toFixed(2)}</td><td>${a.shortlisted ? 'Shortlisted' : 'Not shortlisted'}${g.pending && a.submittedAt ? '<small>Complete marking first</small>' : ''}</td><td><button class="small" ${!a.submittedAt ? 'disabled' : ''} onclick="reviewAttempt=reviewAttempt==='${a.id}'?null:'${a.id}';updateResponseTable()">${reviewAttempt === a.id ? 'Close review' : 'Review marks'}</button></td></tr>${reviewAttempt === a.id ? `<tr class="review-marks"><td colspan="7">${reviewMarks(s, a, g)}</td></tr>` : ''}`).join('')}</tbody></table>`; }
function readableAnswer(q, value) { if (value === undefined || value === null || Array.isArray(value) && !value.length)
    return '(No answer entered)'; if (q.type === 'text')
    return String(value); if (q.type === 'matching')
    return q.pairs.map((p, i) => `${p.left} → ${q.pairs[value[i]]?.right || '(unanswered)'}`).join('\n'); return value.map((idx, i) => `${q.type === 'ranking' ? i + 1 : String.fromCharCode(65 + idx)}. ${q.options[idx] || ''}`).join('\n'); }
function reviewMarks(s, a, g) { return `<p class="sub">Review answers and set individual marks. Manual marks replace automatic marks. Enter a value between each question’s wrong-answer score and maximum score.</p>${(s.questions || []).map((q, i) => { let result = g.results[i]; return `<section class="review-question"><div><h4>Q${i + 1} · ${esc(q.text)}</h4>${questionContext(q)}<p><b>Candidate answer</b><br>${esc(readableAnswer(q, a.responses?.[q.id]))}</p>${q.referenceAnswer ? `<p><b>Reference answer</b><br>${esc(q.referenceAnswer)}</p>` : ''}${q.reviewNote ? `<div class="notice">${esc(q.reviewNote)}</div>` : ''}<span class="chip">${result.status}</span></div><div><label for="mark-${a.id}-${q.id}">Marks (${q.wrongScore} to ${q.correctScore})</label><input id="mark-${a.id}-${q.id}" type="number" step="any" min="${q.wrongScore}" max="${q.correctScore}" value="${result.score ?? ''}" onchange="saveQuestionMark('${s.id}','${a.id}','${q.id}',this.value)"><small>Saved when changed</small>${a.manualMarks?.[q.id] !== undefined ? `<button class="quiet small" onclick="deleteManualMark('${s.id}','${a.id}','${q.id}')">Reset to automatic</button>` : ''}</div></section>`; }).join('')}`; }
function promptExportReady(s) { return !!s.closedAt || s.attempts.length > 0 && s.attempts.every(a => a.submittedAt); }
function showPromptResponses(s) { settlePromptSessions(); let ready = promptExportReady(s); modal.className = 'results-dialog'; modal.innerHTML = `<header class="results-header"><div class="row between"><div><h2>Prompt Engineering · Responses</h2><p class="sub">${esc(s.name)} · 30-minute test · Separate evaluation</p></div><button class="quiet" onclick="modal.close()" aria-label="Close responses">✕</button></div><p class="sub">${s.attempts.filter(a => a.submittedAt).length} of ${s.attempts.length} registered candidates submitted. ${ready ? 'Test is complete. Word export is ready.' : 'Word export unlocks when all registered candidates submit or the admin stops the test.'}</p></header><div class="prompt-result-list">${s.attempts.map(a => `<article class="question-item"><div class="row between"><div><b>${esc(a.name)}</b><p class="sub">${esc(a.studentId)} · ${a.submittedAt ? elapsedMinutes(a).toFixed(2) + ' minutes' : 'In progress'}</p></div><span class="chip">${a.submittedAt ? 'Submitted' : 'In progress'}</span></div>${a.submittedAt ? `<details><summary>Read response</summary><div class="detail-answer">${esc(promptAnswerText(s, a))}</div></details>` : ''}</article>`).join('') || '<div class="empty">No candidates yet.</div>'}</div><footer class="results-footer"><span class="sub">One studentname_studentid.docx per candidate, bundled in a ZIP.</span><button class="primary small" ${!ready || !s.attempts.length ? 'disabled' : ''} onclick="exportPromptDocuments('${s.id}')">↓ Export Word documents</button></footer>`; if (!modal.open)
    modal.showModal(); }
function promptAnswerText(s, a) { if (a.responses && s.questions?.length)
    return s.questions.map((q, i) => `Question ${i + 1}\n${q.text}\n\nResponse\n${String(a.responses[q.id] || '(No answer entered)')}`).join('\n\n'); return a.answer || '(No answer entered)'; }
// Clearly labelled sample rows make the response table and exports reviewable without taking tests.
// Offline OOXML exports: a small ZIP store writer avoids network dependencies.
function renderAdmin() { if (!['question', 'final'].includes(view)) view = 'sessions'; app.innerHTML = shell(view === 'question' ? questionOverview() : view === 'final' ? finalScoresPage() : scheduler()); }
function responseRows(s) { return s.attempts.map(a => ({ a, g: gradeAttempt(s, a), minutes: elapsedMinutes(a) })).filter(r => { let f = responseFilters; for (let [key, value] of [['minMarks', r.a.submittedAt ? r.g.total : null], ['minTime', r.minutes]])
    if (f[key] !== '' && (value === null || !Number.isFinite(Number(f[key])) || value < Number(f[key])))
        return false; return true; }).sort((x, y) => Number(!!y.a.submittedAt) - Number(!!x.a.submittedAt) || (y.g.total - x.g.total) || ((x.minutes ?? Infinity) - (y.minutes ?? Infinity))); }
function filterValidation() { let f = responseFilters; if ([f.minMarks, f.minTime].some(v => v !== '' && !Number.isFinite(Number(v))))
    return 'Enter valid numeric filter values.'; return f.minTime !== '' && Number(f.minTime) < 0 ? 'Minimum time must be zero or positive.' : ''; }
function clearResponseFilters() { responseFilters = { minMarks: '', minTime: '' }; ['minMarks', 'minTime'].forEach(k => document.querySelector('#filter-' + k).value = ''); updateResponseTable(); }
function deleteQuizQuestion(type, index) { if (!modal.open || !modal.className.includes('question-manager') || managerType !== type)
    openQuestionManager(type); if (managerReadOnly)
    return; if (draftIndex !== -2) {
    toast('Save or cancel your current edit before deleting a question.');
    return;
} let q = managerQuestions()[index]; if (!q)
    return; document.querySelector('#manager-question-' + index).innerHTML = `<div class="delete-question-confirm"><h3>Delete question ${index + 1}?</h3><p class="sub">${esc(q.text.slice(0, 200))}</p><p class="sub">${managerDrive ? 'This removes the question from this drive’s test.' : 'This removes the question from the default set. Existing generated tests retain their own copy.'}</p><div class="row"><button class="small" onclick="refreshQuestionManager()">Keep question</button><button class="danger small" onclick="confirmDeleteQuestion(${index})">Delete question</button></div></div>`; }
function confirmDeleteQuestion(index) { let s = managerDrive ? driveTests(managerDrive).find(s => s.type === managerType) : null; if (managerReadOnly || s && (s.attempts.length || s.closedAt)) {
    toast('This test has started or finished. Questions are locked.');
    return;
} managerQuestions().splice(index, 1); commitManagerQuestions(); save(); refreshQuestionManager(); renderAdmin(); toast('Question deleted.'); }
function confirmSubmit() { expire(); settlePromptSessions(); let { s, a } = currentQuiz(); if (!a || a.submittedAt || s.closedAt) {
    render();
    return;
} let answered = [], unanswered = []; s.questions.forEach((q, i) => (answerPresent(q, a.responses?.[q.id]) ? answered : unanswered).push({ q, number: i + 1 })); let section = (name, items, open) => `<details class="submission-group" ${open ? 'open' : ''}><summary>${name} · ${items.length} question${items.length === 1 ? '' : 's'}</summary><div class="submission-number-list">${items.length ? items.map(x => 'Q' + x.number).join(', ') : 'None'}</div><div class="submission-list">${items.map(({ q, number }) => `<p><b>Q${number}</b> · ${esc(q.text)}</p>`).join('')}</div></details>`; dialog('Are you sure you want to submit?', `<p class="sub">Review your progress before submitting. You cannot edit your answers afterwards.</p><div class="submit-summary"><div><strong>${answered.length}</strong><small>Answered</small></div><div><strong>${unanswered.length}</strong><small>Unanswered</small></div><div><strong class="time" data-clock="${a.id}">${clock(timeLeft(a))}</strong><small>Time remaining</small></div></div>${section('Answered', answered, false)}${section('Unanswered', unanswered, true)}<div class="notice">${s.type === 'prompt' ? 'Your response is evaluated separately.' : 'Unanswered questions score 0.'} Choose Continue test to keep working, or Submit test to finish.</div>`, `<button onclick="modal.close()">Continue test</button><button class="primary" onclick="submitAnswer()">Submit test</button>`, true); modal.classList.add('submission-review'); }
function openResultsTable(id) { expire(); settlePromptSessions(); let s = state.sessions.find(s => s.id === id); if (s.type === 'prompt') {
    showPromptResponses(s);
    return;
} responseSession = id; responseFilters = { minMarks: '', minTime: '' }; reviewAttempt = null; modal.className = 'results-dialog'; modal.innerHTML = `<header class="results-header"><div class="row between"><div><h2>${typeInfo(s.type).name} · Responses</h2><p class="sub">${esc(state.drives.find(d => d.id === s.driveId)?.name || s.name)} · ${durationMinutes(s)}-minute test</p></div><button class="quiet" onclick="modal.close()" aria-label="Close responses">✕</button></div><p class="sub">Filter by minimum marks and minimum time taken. Totals with pending questions are provisional.</p></header><section class="results-controls">${[['minMarks', 'Min marks (out of ' + (s.type === 'aptitude' ? 30 : 25) + ')'], ['minTime', 'Min time (minutes) (out of ' + durationMinutes(s) + ')']].map(([key, label]) => `<div><label for="filter-${key}">${label}</label><input id="filter-${key}" type="number" step="any" ${key === 'minTime' ? 'min="0"' : ''} oninput="responseFilters.${key}=this.value;updateResponseTable()"></div>`).join('')}<div class="shortlist-actions"><button class="primary small" onclick="shortlistFilteredCandidates()">Shortlist filtered candidates</button><button class="small" onclick="shortlistFilteredCandidates(true)">Revert shortlisting</button></div><div id="response-filter-error" class="filter-error" role="alert"></div></section><div class="results-scroll" id="responseTable"></div><footer class="results-footer"><div><span id="responseCount" class="sub"></span><div class="bulk-note">${typeInfo(s.type).name} shortlist applies to completed candidates with final marks. Revert clears shortlisting for this test, including candidates outside the current filters.</div></div><div class="export-actions"><button class="small" onclick="clearResponseFilters()">Clear filters</button><button class="small" onclick="exportResponsesExcel()">↓ Export filtered to Excel</button></div></footer>`; updateResponseTable(); if (!modal.open)
    modal.showModal(); }
// Server adapter for the approved two-page UI. No assessment keys or candidate records ship in JS.
let csrf = '', revision = 0, serverOffset = 0, adminPending = null, adminSaving = null, adminBlocked = false;
let candidateDirty = false, candidateSaving = null, saveDelay = null, lastPoll = 0, expiryRequest = false;
function serverNow() { return Date.now() + serverOffset; }
function uuid() { return crypto.randomUUID(); }
function timeLeft(a) { return Math.max(0, Math.ceil((a.deadline - serverNow()) / 1000)); }
function expire() { return false; } // The server alone expires and finalizes attempts.
function settlePromptSessions() { }
function render() { if (view === 'candidate')
    renderCandidate();
else
    renderAdmin(); }
function statusMessage(message, error = false) { let el = document.querySelector('#connectionStatus'); el.textContent = message; el.style.color = error ? '#af403c' : '#087e78'; }
async function api(path, method = 'GET', body) { let response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body === undefined ? undefined : JSON.stringify(body) }); let data = await response.json(); if (!response.ok) {
    let e = new Error(data.error || 'Request failed.');
    e.status = response.status;
    throw e;
} if (data.serverNow)
    serverOffset = data.serverNow - Date.now(); return data; }
function hydrate(value) { state = value; state.banks = {}; TYPES.forEach(t => state.banks[t.id] = bankText(t.id)); state.sessions.forEach(s => { s.question = s.questions?.map(q => q.text).join('\n\n') || ''; s.attempts = s.attempts || []; }); }
function editableState() { return { drives: state.drives, sessions: state.sessions, questionSets: state.questionSets }; }
function save() { if (view === 'candidate') {
    candidateDirty = true;
    statusMessage('Saving your response…');
    clearTimeout(saveDelay);
    saveDelay = setTimeout(() => flushCandidate().catch(handleError), 1000);
    return;
} if (adminBlocked) {
    statusMessage('Unsaved changes. Reload the page before editing further.', true);
    return;
} adminPending = JSON.parse(JSON.stringify(editableState())); flushAdmin().catch(handleError); }
async function flushAdmin() { if (adminSaving)
    return adminSaving; adminSaving = (async () => { while (adminPending) {
    let snapshot = adminPending;
    adminPending = null;
    statusMessage('Saving changes…');
    try {
        let result = await api('/api/admin/state', 'PUT', { revision, state: snapshot });
        revision = result.revision;
        if (!adminPending) {
            hydrate(result.state);
            if (!modal.open)
                renderAdmin();
            statusMessage('All changes saved');
        }
    }
    catch (e) {
        adminBlocked = true;
        adminPending = null;
        statusMessage('Changes were not saved. ' + e.message + ' Reload before continuing.', true);
        throw e;
    }
} })(); try {
    await adminSaving;
}
finally {
    adminSaving = null;
} }
function handleError(error) { statusMessage(error.message || 'Connection unavailable. Retry without closing this page.', true); toast(error.message || 'Connection unavailable. Please retry.'); }
async function reloadAdmin() { await flushAdmin(); if (adminBlocked)
    throw new Error('Reload this page before continuing.'); let data = await api('/api/admin/state'); revision = data.revision; hydrate(data.state); }
function goAdmin(page = 'sessions') { if (view === 'candidate') {
    location.href = '/';
    return;
} candidateSession = null; currentAttempt = null; view = page; history.replaceState(null, '', '/'); render(); }
function openCandidate(id) { if (!id) {
    toast('Open a generated test link from the session scheduler.');
    return;
} window.open('/test/' + encodeURIComponent(id), '_blank', 'noopener'); }
function testLink(s) { return location.origin + '/test/' + encodeURIComponent(s.id); }
async function copyLink(id) { try {
    await navigator.clipboard.writeText(testLink(state.sessions.find(s => s.id === id)));
    toast('Candidate link copied.');
}
catch {
    toast('Select the link and copy it manually.');
} }
function startCandidate(event) {
    event.preventDefault();
    let name = document.querySelector('#candidateName').value.trim(), studentId = document.querySelector('#studentId').value.trim();
    if (!name || !studentId || /[\u0000-\u001f]/.test(name + studentId)) return toast('Enter a valid full name and student ID.');
    modal.className = '';
    modal.innerHTML = `<header><h2>Confirm your details</h2></header><div class="modal-body"><p>Please check your details before starting the test.</p><p><strong>Full name:</strong> ${esc(name)}</p><p><strong>Student ID:</strong> ${esc(studentId)}</p><p>Your timer starts when you continue to the test.</p></div><footer><button id="editCandidateDetails">Edit details</button><button class="primary" id="confirmCandidateDetails">Continue to test</button></footer>`;
    document.querySelector('#editCandidateDetails').onclick = () => modal.close();
    document.querySelector('#confirmCandidateDetails').onclick = () => beginConfirmedCandidate({name, studentId});
    if (!modal.open) modal.showModal();
}
async function beginConfirmedCandidate(details) { let s = state.sessions[0], button = document.querySelector('#confirmCandidateDetails'); button.disabled = true; try {
    let result = await api('/api/candidate/' + s.id + '/start', 'POST', details);
    modal.close();
    absorbCandidate(result);
    quizIndex = 0;
    render();
    statusMessage('Connected · Responses save automatically');
}
catch (e) {
    handleError(e);
    button.disabled = false;
} }
function absorbCandidate(result) { let incoming = result.test, old = currentQuiz().a, next = incoming.attempts?.[0]; if (next && old && next.id === old.id && !next.submittedAt) {
    if ((next.sequence || 0) < (old.sequence || 0))
        return old;
    if (candidateDirty || candidateSaving) {
        next.responses = old.responses;
        next.answer = old.answer;
    }
} state.sessions = [incoming]; candidateSession = incoming.id; currentAttempt = next?.id || null; if (next?.submittedAt) {
    candidateDirty = false;
    if (modal.open)
        modal.close();
} return next; }
async function flushCandidate(submit = false) { clearTimeout(saveDelay); if (candidateSaving) {
    await candidateSaving;
    if (submit || candidateDirty)
        return flushCandidate(submit);
    return;
} let { s, a } = currentQuiz(); if (!a || a.submittedAt)
    return; if (!candidateDirty && !submit)
    return; candidateSaving = (async () => { let responses = JSON.parse(JSON.stringify(a.responses || {})); candidateDirty = false; try {
    let result = await api('/api/candidate/' + s.id + '/answer', 'POST', { responses, sequence: (a.sequence || 0) + 1, submit });
    let next = absorbCandidate(result);
    if (next?.submittedAt) {
        render();
        statusMessage('Response submitted and locked');
    }
    else
        statusMessage(candidateDirty ? 'Saving latest changes…' : 'Response saved');
}
catch (e) {
    candidateDirty = true;
    throw e;
} })(); try {
    await candidateSaving;
}
finally {
    candidateSaving = null;
} if (candidateDirty && !submit) {
    clearTimeout(saveDelay);
    saveDelay = setTimeout(() => flushCandidate().catch(handleError), 1000);
} }
async function submitAnswer() { let { a } = currentQuiz(); if (!a || a.submittedAt)
    return; try {
    statusMessage('Submitting your test…');
    await flushCandidate(true);
    if (modal.open)
        modal.close();
    render();
}
catch (e) {
    handleError(e);
} }
async function showResponses(id) { try {
    await reloadAdmin();
    let s = state.sessions.find(s => s.id === id);
    if (s.type === 'prompt') {
        showPromptResponses(s);
        return;
    }
    openResultsTable(id);
}
catch (e) {
    handleError(e);
} }
async function setShortlist(id, value) { try {
    await api('/api/admin/tests/' + responseSession + '/shortlist', 'POST', { attemptId: id, value });
    await reloadAdmin();
    updateResponseTable();
}
catch (e) {
    handleError(e);
} }
async function shortlistFilteredCandidates(revert = false) { if (!revert && filterValidation())
    return toast(filterValidation()); try {
    let result = await api('/api/admin/tests/' + responseSession + '/shortlist', 'POST', revert ? {value: false} : { ...responseFilters, value: true });
    await reloadAdmin();
    updateResponseTable();
    toast(revert ? 'Shortlisting reverted for this test.' : result.changed + ' filtered candidates shortlisted.' + (result.skipped ? ' ' + result.skipped + ' skipped while test or marking is incomplete.' : ''));
}
catch (e) {
    handleError(e);
} }
async function saveQuestionMark(sid, aid, qid, value) { if (value === '' || !Number.isFinite(Number(value)))
    return toast('Enter valid marks.'); try {
    await api('/api/admin/tests/' + sid + '/marks', 'POST', { attemptId: aid, questionId: qid, score: Number(value) });
    await reloadAdmin();
    updateResponseTable();
}
catch (e) {
    handleError(e);
} }
async function deleteManualMark(sid, aid, qid) { try {
    await api('/api/admin/tests/' + sid + '/marks', 'POST', { attemptId: aid, questionId: qid, score: null });
    await reloadAdmin();
    updateResponseTable();
}
catch (e) {
    handleError(e);
} }
async function serverDownload(path, fallback) { try {
    await flushAdmin();
    let response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok) {
        let data = await response.json();
        throw new Error(data.error || 'Export failed.');
    }
    let blob = await response.blob(), url = URL.createObjectURL(blob), a = document.createElement('a'), header = response.headers.get('Content-Disposition') || '', match = header.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    a.download = match ? decodeURIComponent(match[1] || match[2]) : fallback;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
catch (e) {
    handleError(e);
} }
function exportResponsesExcel() { if (filterValidation())
    return toast(filterValidation()); serverDownload('/api/admin/tests/' + responseSession + '/excel?' + new URLSearchParams(responseFilters), 'candidate-results.xlsx'); }
function exportPromptDocuments(id) { serverDownload('/api/admin/tests/' + id + '/word', 'prompt-responses.zip'); }
function generateTest(driveId, type) { let d = state.drives.find(d => d.id === driveId); if (!d || d.finishedAt || driveTests(driveId).some(s => s.type === type))
    return; if (!driveQuestionSet(driveId, type).length) {
    toast('Add questions using Update questions before generating a test link.');
    return;
} dialog('Generate ' + typeInfo(type).name + ' link', `<p><b>${esc(d.name)}</b></p><p class="sub">Each candidate receives ${durationMinutes(type)} minutes from their own start. Questions lock when the first candidate starts.</p>`, `<button onclick="modal.close()">Cancel</button><button class="primary" onclick="createTest('${driveId}','${type}')">Generate test link</button>`); }
function candidateQuestion(q, v) { if (q.type === 'text')
    return `<textarea aria-label="Your response" oninput="setQuizResponse(this.value)">${esc(v || '')}</textarea>`; if (q.type === 'matching')
    return q.leftItems.map((left, i) => `<div class="match-row"><span>${esc(left)}</span><select class="type-select" aria-label="Match for ${esc(left)}" onchange="setMatchResponse(${i},this.value)"><option value="">Choose a match</option>${q.rightChoices.map(choice => `<option value="${choice.id}" ${v?.[i] === choice.id ? 'selected' : ''}>${esc(choice.label)}</option>`).join('')}</select></div>`).join(''); if (q.type === 'ranking') {
    let order = v || q.options.map((_, i) => i);
    return '<p class="sub">Use the arrows to arrange the items, then confirm your order.</p>' + order.map((idx, pos) => `<div class="rank-row"><b>${pos + 1}</b><span>${esc(q.options[idx])}</span><button ${pos === 0 ? 'disabled' : ''} aria-label="Move item up" onclick="moveRank(${pos},-1)">↑</button><button ${pos === order.length - 1 ? 'disabled' : ''} aria-label="Move item down" onclick="moveRank(${pos},1)">↓</button></div>`).join('') + '<button class="small" onclick="confirmRank()">Confirm order</button>';
} return q.options.map((o, i) => `<label class="answer-option"><input type="${q.type === 'multiple' ? 'checkbox' : 'radio'}" name="responseOption" ${v?.includes(i) ? 'checked' : ''} onchange="selectQuizOption(${i},this.checked)"><span>${String.fromCharCode(65 + i)}. ${esc(o)}</span></label>`).join('') + '<button class="quiet small" onclick="setQuizResponse(undefined);render()">Clear answer</button>'; }
function setMatchResponse(i, value) { let { s, a } = currentQuiz(), q = s.questions[quizIndex], v = [...(a.responses?.[q.id] || [])]; v[i] = value || null; setQuizResponse(v); render(); }
function loginView() { app.innerHTML = `<header class="masthead"><div class="tool-name">Recruitment Platform</div>${COMPANY_LOGO}</header><main class="candidate-main"><section class="entry card"><div class="card-body"><div class="eyebrow">ADMINISTRATOR</div><h1>Sign in</h1><form id="loginForm"><div class="field"><label for="loginEmail">Email</label><input id="loginEmail" type="email" autocomplete="username" required value="turnbrecruitment@gmail.com"></div><div class="field"><label for="loginPassword">Password</label><input id="loginPassword" type="password" autocomplete="current-password" required></div><button class="primary" type="submit">Sign in</button><p class="inline-error" id="loginError" role="alert"></p></form></div></section></main>`; document.querySelector('#loginForm').onsubmit = async (event) => { event.preventDefault(); let button = event.target.querySelector('button'); button.disabled = true; try {
    let result = await api('/api/auth/login', 'POST', { email: document.querySelector('#loginEmail').value, password: document.querySelector('#loginPassword').value });
    csrf = result.csrf;
    await reloadAdmin();
    view = 'sessions';
    renderAdmin();
    document.querySelector('#adminActions').hidden = false;
    statusMessage('Signed in');
}
catch (e) {
    document.querySelector('#loginError').textContent = e.message;
    button.disabled = false;
} }; }
async function logout() { try {
    await flushAdmin();
    await api('/api/auth/logout', 'POST', {});
    location.reload();
}
catch (e) {
    handleError(e);
} }
async function importQuestionFile(input) { let file = input.files?.[0]; if (!file)
    return; try {
    if (file.size > 4000000)
        throw new Error('Question file is too large.');
    let value = JSON.parse(await file.text()), sets = value.questionSets;
    if (!sets || !TYPES.every(t => Array.isArray(sets[t.id])))
        throw new Error('Choose the private question import JSON prepared for this app.');
    if (!confirm('Replace the three default question sets? Existing tests keep their own questions.'))
        return;
    state.questionSets = sets;
    TYPES.forEach(t => state.banks[t.id] = bankText(t.id));
    save();
    await flushAdmin();
    renderAdmin();
    toast('Question sets imported into the database.');
}
catch (e) {
    handleError(e);
}
finally {
    input.value = '';
} }
async function bootstrap() { try {
    let auth = await api('/api/auth/session');
    csrf = auth.csrf;
    let match = location.pathname.match(/^\/test\/([a-zA-Z0-9_-]+)$/);
    if (match) {
        view = 'candidate';
        candidateSession = match[1];
        let data = await api('/api/candidate/' + candidateSession);
        absorbCandidate(data);
        render();
        statusMessage('Connected · Timer starts when you click Start test');
    }
    else if (auth.admin) {
        await reloadAdmin();
        view = 'sessions';
        render();
        document.querySelector('#adminActions').hidden = false;
        statusMessage('Connected');
    }
    else
        loginView();
}
catch (e) {
    app.innerHTML = '<main class="candidate-main"><section class="entry card"><div class="card-body"><h1>Application unavailable</h1><p id="startupError"></p><button onclick="location.reload()">Retry</button></div></section></main>';
    document.querySelector('#startupError').textContent = e.message;
    handleError(e);
} }
setInterval(async () => { if (view !== 'candidate')
    return; let { s, a } = currentQuiz(); document.querySelectorAll('[data-clock]').forEach(el => { if (a) {
    el.textContent = clock(timeLeft(a));
    el.classList.toggle('warning', timeLeft(a) < 300);
} }); if (!s || a?.submittedAt)
    return; try {
    if (a && timeLeft(a) === 0 && !expiryRequest) {
        expiryRequest = true;
        try {
            await flushCandidate(true);
        }
        finally {
            expiryRequest = false;
        }
    }
    if (Date.now() - lastPoll > 5000) {
        lastPoll = Date.now();
        let data = await api('/api/candidate/' + s.id), next = absorbCandidate(data);
        if (next?.submittedAt || data.test.closedAt)
            render();
        else if (!candidateDirty && !candidateSaving)
            statusMessage('Connected · Response saved');
    }
}
catch (e) {
    statusMessage('Connection interrupted. Keep this page open; retrying automatically.', true);
} }, 1000);
window.addEventListener('online', () => { if (view === 'candidate')
    flushCandidate().catch(handleError); });
window.addEventListener('beforeunload', event => { if (candidateDirty || adminPending || adminSaving) {
    event.preventDefault();
    event.returnValue = '';
} });
bootstrap();

let finalDriveFilter = '';
function finalScoresPage() {
    return heading('Final scores', 'Review candidate performance across the tests in each drive.', '') + `<div class="filterbar"><div class="field"><label for="finalDriveFilter">Find a drive</label><input id="finalDriveFilter" type="search" value="${esc(finalDriveFilter)}" placeholder="Search college, year or drive name" oninput="finalDriveFilter=this.value;updateFinalDriveList()"></div></div><div id="finalDriveList">${finalDriveList()}</div>`;
}
function finalDriveList() {
    let drives = state.drives.filter(d => d.name.toLocaleLowerCase().includes(finalDriveFilter.trim().toLocaleLowerCase()));
    return drives.map(d => `<button class="final-drive card" onclick="showFinalScores('${d.id}')"><span><strong>${esc(d.name)}</strong><small>${combinedDriveScores(d.id).length} candidates</small></span><span>View final scores →</span></button>`).join('') || '<div class="empty">No drives match your search.</div>';
}
function updateFinalDriveList() { document.querySelector('#finalDriveList').innerHTML = finalDriveList(); }
function combinedDriveScores(driveId) {
    let candidates = new Map();
    for (let test of state.sessions.filter(s => s.driveId === driveId)) {
        for (let attempt of test.attempts || []) {
            let key = attempt.studentId.normalize('NFKC').toLowerCase();
            let row = candidates.get(key);
            if (!row) { row = {name: attempt.name, studentId: attempt.studentId, latest: -1}; candidates.set(key, row); }
            if ((attempt.startedAt || 0) >= row.latest) { row.name = attempt.name; row.studentId = attempt.studentId; row.latest = attempt.startedAt || 0; }
            if (!['aptitude', 'language'].includes(test.type)) continue;
            let previous = row[test.type];
            if (!previous || (attempt.startedAt || 0) > (previous.attempt.startedAt || 0) || ((attempt.startedAt || 0) === (previous.attempt.startedAt || 0) && attempt.id > previous.attempt.id)) row[test.type] = {test, attempt};
        }
    }
    return [...candidates.values()].sort((a,b) => a.name.localeCompare(b.name) || a.studentId.localeCompare(b.studentId));
}
function finalScoreCell(result) {
    if (!result) return '—';
    if (!result.attempt.submittedAt) return 'In progress';
    let score = gradeAttempt(result.test, result.attempt);
    return `${score.total}${score.pending ? `<small>${score.pending} pending · provisional</small>` : ''}`;
}
async function showFinalScores(driveId) {
    try {
        await reloadAdmin();
        let drive = state.drives.find(d => d.id === driveId);
        if (!drive) return toast('Drive not found.');
        let rows = combinedDriveScores(driveId);
        modal.className = 'results-dialog';
        modal.innerHTML = `<header class="results-header"><div class="row between"><div><h2>Final scores · ${esc(drive.name)}</h2><p class="sub">Latest attempt per candidate and test type. Candidates are matched by student ID within this drive. — means no attempt.</p></div><button class="quiet" onclick="modal.close()" aria-label="Close final scores">✕</button></div></header><div class="results-scroll"><table><thead><tr><th>Candidate name</th><th>Student ID</th><th>Aptitude score</th><th>Shortlisted in Aptitude</th><th>Language &amp; Reasoning score</th><th>Shortlisted in Language &amp; Reasoning</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.name)}</td><td>${esc(row.studentId)}</td><td>${finalScoreCell(row.aptitude)}</td><td>${row.aptitude?.attempt.shortlisted ? 'Yes' : 'No'}</td><td>${finalScoreCell(row.language)}</td><td>${row.language?.attempt.shortlisted ? 'Yes' : 'No'}</td></tr>`).join('') || '<tr><td colspan="6">No candidates have started tests in this drive.</td></tr>'}</tbody></table></div><footer class="results-footer"><span class="sub">${rows.length} candidates · Prompt Engineering responses remain available as Word exports in Session scheduler.</span></footer>`;
        if (!modal.open) modal.showModal();
    } catch (error) { handleError(error); }
}
