let state = { drives: [], sessions: [], questionSets: { aptitude: [], language: [], prompt: [] }, banks: { aptitude: '', language: '', prompt: '' } };
'use strict';
const COMPANY_LOGO = `<img class="company-logo" alt="TurnB" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALkAAAA2CAMAAACslchjAAAAXVBMVEVHcEyVl5qUlpmTlJiVl5oChYMBhIGAj5GUlpiVl5qVl5uUlpmSlJWVl5sChoSWmJsChoSUlplZjI0CgH5/kpQChoQBhIKVl5oChYMChYMChYOVl5qTlZgChIIChYMvRbDiAAAAHHRSTlMA+V0i7uo/A0SW06gH37M1+HkOBhZbIr7RnXdv5t0AzAAAA7FJREFUaN7tmumSqyAQhVVQ3HAhREx0fP/HvIyO0hhwmVFvpSrnXwjLl1OtdEMc56OP9oh7G5RfBXN/VRAEFbsZOofYXVd5EXngFwb5df24V3N4EuJ2XdeRf5nVFf4jYHPP34H8G95/VG/oeY/e1cFbev7NDtHJO5F/dVn1Bp53vb46Hf0JPKdYyVWwLmjGzfXk/mNQVhea6XzqzHKgUqEnsJ1fTt5lN9KLVc8a+O4HxoHEU+QRbHf+B7kxhoq7eSQkvwx3ldx5dqZAt3p+ADnhnDNi+w7JMERsAzkBplvIzZ6n4ZR5hQADqYQMDU+MnqGRvEmEVNIgrXM+DI6EfDXQWEQhW/UckNuipTGRo3hMvNokhb9ykjf0o1M/OZiXdHxJhVpn+YZFZawWwkm+hzzY4TmK1QsnNfWdyMFglEwfYqRNXJJQuNpuQb3tcV5XO+J8IzmB5FyBu9+DILlH5xsdDRfJq6xTYU5O9hyEndvonYVh047RAnn16Iy7/5Y43+25UENanOuWLKUXkJzdpBir7mojmiWLZ3gObRV8A/mP6XD3z3rVfrEF/LA4h+onmpHjWAgKm7BnyRULa2VxjucTXoyHLzVyNwk5Y6ih89+3lOXKau62sOk1x3mOoxAxuU8O2xQkxxEb01T1Y0S6Ql5kz3kheo7n2EstE7fRCEBKEOh8vZrzs4CcHuduQ2yW0GnLJDmdPaIrNVHhP29ney6YdWIwBxf7yGW029CPinPXW7BEtaaJndyve/ngrbhQWRzmOUX2ictN5HK3HBTctZoIlnNnxPk8WH5DDvKWZ7FaFB3leZIeSe7cAHr3uJ0Z5y8F1d/InQrmLvzc/PxY8tUM/bj8/GByAsj96jeewyevbC/0/LFGvhbnMTKter7nvF6r54yec0WOw6lrTi/0HL5bMrY5zpnao9tkHMaS9jLP2d3/WjtwMZ+3RCAFLIdnlEdue7LnjIzlXFasb//GOIetfdotk27t3OEMz8ezXFnPaYmLOVhs54q5Vq1jGlO9NjvD8/H8vJsni8GO/FwLdJNO8dyW5e45b5HNeAO5cwF58WR76lBtBZXIJu7Vnnf2ksh6fo5e4oV65+Yt5jLU2Xfe0j+kifZQuiI8OW+ZX4Ua7qD1BdSl1mxx3qiDYywarvX98Ty2DdY6g9uyNJpaxUAuqzeD6sxw7z+7Rwgnodc/ZUQilhJl2GfIoC//uStbGGyeWI3I+x2OBSZVFfvrXVXKpdINk/x+GfKizx95Pvqj/gGC2ZDgwWZdtwAAAABJRU5ErkJggg==">`;
// Question wording is an illustrative adaptation for layout review, not the final approved assessment text.
let view = 'overview', candidateSession = null, currentAttempt = null, answerFocus = false;
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
function candidateHeader(s, a) { return `<header class="candidate-header"><div class="tool-name">Talent Hub</div>${a ? `<div class="timerbox"><div class="time-label">YOUR TIME REMAINING</div><div class="time" data-clock="${a.id}">${clock(timeLeft(a))}</div></div>` : ''}${COMPANY_LOGO}</header>`; }
function words(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }
function renderDone(s, a) { let title = a.reason === 'timeout' ? 'Time is over.' : a.reason === 'admin' ? 'The test has ended.' : 'You’re all done.'; app.innerHTML = candidateHeader(s, null) + `<main class="candidate-main"><section class="done card"><div class="card-body"><div class="done-icon">✓</div><div class="eyebrow">RESPONSE RECEIVED</div><h1 style="margin-top:12px">${title}</h1><p class="sub">Your response has been saved. Thank you.</p><p class="muted" style="font-size:12px;margin:22px 0">${esc(a.name)} · ${esc(a.studentId)}<br>${esc(s.name)}</p><div class="notice">Your response is submitted and can no longer be edited.</div></div></section></main>`; }
// Drive scheduler prototype. Tests are scoped to a drive, with immutable question snapshots per link.
const TYPES = [{ id: 'aptitude', name: 'Aptitude', icon: '∑', description: 'Numerical ability, quantitative thinking and problem solving.' }, { id: 'language', name: 'Language & Reasoning', icon: 'Aa', description: 'Language skills, comprehension and logical reasoning.' }, { id: 'prompt', name: 'Prompt Engineering', icon: '⌘', description: 'A long-form challenge to evaluate structured thinking and prompting.' }];
let filterName = '', filterStatus = 'all', filtersOpen = false, expandedDrive = null, editingGdEvaluator = null;
const typeInfo = id => TYPES.find(t => t.id === id);
function driveTests(id) { return state.sessions.filter(s => s.driveId === id); }
function driveStatus(d) { if (d.finishedAt) return 'Finished'; return driveTests(d.id).length || d.gd ? 'Live' : 'Not started'; }
function badge(status) { return `<span class="chip status-${status === 'Live' ? 'live' : status === 'Finished' ? 'finished' : 'not'}">${status}</span>`; }
// Shared decorative icons for the approved charcoal and teal interface.
function uiIcon(name) {
    const paths = {
        overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        sessions: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-13 6 3 3 5-5"/>',
        question: '<path d="M6 3h8l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h7m-7 4h7"/><path d="M20 9v11a3 3 0 0 1-3 3" opacity=".45"/>',
        final: '<rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" stroke="none"/><rect x="10" y="4" width="4" height="17" rx="1" fill="currentColor" stroke="none"/><rect x="17" y="9" width="4" height="12" rx="1" fill="currentColor" stroke="none"/>',
        college: '<path d="m2 9 10-6 10 6H2Z" fill="currentColor" fill-opacity=".16"/><path d="M4 10v10m5-10v10m6-10v10m5-10v10M2 21h20M2 9h20M12 3V1"/><circle cx="12" cy="6" r=".8" fill="currentColor" stroke="none"/>',
        attended: '<circle cx="9" cy="7" r="4" fill="currentColor" stroke="none"/><path d="M1.5 21v-2.5a7.5 7.5 0 0 1 15 0V21Z" fill="currentColor" stroke="none"/><path d="M16 3.5a4 4 0 0 1 0 7.5m3 3a6 6 0 0 1 3.5 5.5V21H19" opacity=".65"/>',
        aptitude: '<path d="M6 2h8l5 5v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill="currentColor" stroke="none"/><path d="M14 2v6h5" stroke="white" stroke-opacity=".6"/><path d="M8 11h6m-6 4h6m-6 3h4" stroke="white" stroke-width="1.5"/>',
        interview: '<circle cx="9" cy="6.5" r="4" fill="currentColor" stroke="none"/><path d="M2 21v-3a7 7 0 0 1 12-4.9" fill="currentColor" stroke="none"/><path d="m14 17 3 3 5-6" stroke-width="2.5"/>',
        selected: '<path d="m12 2 3 6.1 6.7 1-4.9 4.7 1.2 6.7-6-3.2-6 3.2 1.2-6.7-4.9-4.7 6.7-1Z" fill="currentColor" stroke="none"/>',
        hold: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M9 8v8m6-8v8" stroke="white" stroke-width="2"/>',
        arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>'
    };
    return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (paths[name] || paths.overview) + '</svg>';
}
function shell(content) {
    const pages = [['overview', 'Overview'], ['sessions', 'Session scheduler'], ['question', 'Question overview'], ['final', 'Final scores']];
    return `<header class="masthead"><div class="tool-name">Talent Hub</div>${COMPANY_LOGO}</header><div class="shell ${view === 'overview' ? 'overview-shell' : ''}"><aside class="app-sidebar"><div class="navlabel">WORKSPACE</div><nav class="workspace-nav" aria-label="Workspace">${pages.map(([id, label]) => `<button class="nav ${view === id ? 'active' : ''}" onclick="nav('${id}')" ${view === id ? 'aria-current="page"' : ''}><span class="nav-icon nav-icon-${id}">${uiIcon(id)}</span><span class="nav-text">${label}</span></button>`).join('')}</nav><div class="aside-foot"><div class="profile"><button class="profile-signout" onclick="logout()">Sign out</button></div></div></aside><div class="workspace"><header class="topbar"><div class="breadcrumb">Workspace &nbsp; / &nbsp; <b>${pages.find(p => p[0] === view)?.[1] || 'Session scheduler'}</b></div></header><main class="main">${content}<div class="footer-note">TurnB Talent Hub · Responses and question sets are stored securely on the server.</div></main></div></div>`;
}
function heading(title, subtitle, action = '') { return `<div class="eyebrow">RECRUITMENT WORKSPACE</div><div class="heading"><div><h1>${title}</h1><p class="sub">${subtitle}</p></div>${action}</div>`; }
function scheduler() { return heading('Session scheduler', 'One drive. Three assessments. Everything kept together.', `<button class="primary" onclick="startDrive()">＋ Start a drive</button>`) + `<div class="filterbar"><div class="field"><label for="driveSearch">Find a drive</label><input id="driveSearch" type="search" value="${esc(filterName)}" placeholder="Search college, year or drive name" oninput="filterName=this.value;updateDriveList()"></div><button onclick="filtersOpen=!filtersOpen;render()">☷ Filter${filterStatus !== 'all' ? ' · 1' : ''}</button></div>${filtersOpen ? `<div class="filters-panel row"><label for="statusFilter">Drive status</label><select id="statusFilter" onchange="filterStatus=this.value;updateDriveList()">${['all', 'Not started', 'Live', 'Finished'].map(v => `<option value="${v}" ${filterStatus === v ? 'selected' : ''}>${v === 'all' ? 'All statuses' : v}</option>`).join('')}</select><button class="quiet small" onclick="filterName='';filterStatus='all';render()">Clear filters</button></div>` : ''}<div id="driveList">${driveList()}</div>`; }
function updateDriveList() { document.querySelector('#driveList').innerHTML = driveList(); }
function driveList() { let drives = state.drives.filter(d => d.name.toLowerCase().includes(filterName.toLowerCase()) && (filterStatus === 'all' || driveStatus(d) === filterStatus)); return drives.length ? drives.slice().sort((a, b) => b.createdAt - a.createdAt).map(d => `<details class="drive" ${expandedDrive === d.id ? 'open' : ''} ontoggle="if(this.open)expandedDrive='${d.id}'"><summary><span class="drive-folder-icon">${uiIcon('college')}</span><div class="drive-summary"><b>${esc(d.name)}</b><small>Created ${date(d.createdAt)} · ${driveTests(d.id).length} of 3 test links generated</small></div>${badge(driveStatus(d))}</summary><div class="drive-tests">${TYPES.filter(t => t.id === 'aptitude').map(t => testRow(d, t)).join('')}${gdRow(d)}${TYPES.filter(t => t.id !== 'aptitude').map(t => testRow(d, t)).join('')}<div class="drive-actions">${!d.finishedAt ? `<button class="danger drive-action-end" onclick="confirmEndDrive('${d.id}')">End drive</button>` : ''}<button class="danger drive-action-delete" onclick="confirmDeleteDrive('${d.id}')">Delete drive</button></div></div></details>`).join('') : '<div class="empty card"><strong>No matching drives</strong>Change your filters or start a new drive.</div>'; }
async function importAptitudeResults(driveId, input) {
    let file = input.files?.[0];
    if (!file) return;
    try {
        if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Choose the Aptitude tracker in .xlsx format.');
        if (!confirm('Import the Shortlist sheet into this drive? Imported marks and times will be preserved, and each candidate on that sheet will be marked shortlisted for GD. This can only be done once for this drive.')) return;
        await flushAdmin();
        let body = new FormData();
        body.append('file', file);
        let response = await fetch('/api/admin/drives/' + encodeURIComponent(driveId) + '/aptitude/import', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf }, body });
        let data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Aptitude results could not be imported.');
        await reloadAdmin();
        renderAdmin();
        toast(`${data.imported} historical Aptitude results imported and shortlisted for GD.`);
    } catch (error) { handleError(error); }
    finally { input.value = ''; }
}
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
    app.innerHTML = candidateHeader(s, null) + `<main class="candidate-main"><section class="entry card"><div class="card-body"><span class="chip">${typeInfo(s.type).name}</span><h1>Ready to begin?</h1><p>${esc(s.name)}</p><div class="notice">${s.questionCount || qs.length} questions · ${durationMinutes(s)} minutes from your own start. The administrator can end the test at any time. ${s.type === 'prompt' ? 'Your response is evaluated separately.' : 'Unanswered questions score 0.'}</div><form id="entryForm">${s.type === 'aptitude' ? '<div class="field"><label for="candidateName">Full name</label><input id="candidateName" required maxlength="100"></div>' : ''}<div class="field"><label for="studentId">Student ID</label><input id="studentId" required maxlength="60"></div><button class="primary" type="submit">Start test →</button></form></div></section></main>`;
    document.querySelector('#entryForm').onsubmit = startCandidate;
    return;
} quizIndex = Math.min(quizIndex, qs.length - 1); let q = qs[quizIndex]; app.innerHTML = candidateHeader(s, a) + `<main class="candidate-main"><div class="row between" style="margin-bottom:20px"><div><h1 style="font-size:24px">${typeInfo(s.type).name}</h1><p class="sub">${esc(s.name)}</p></div><div>${esc(a.name)} · ${esc(a.studentId)}</div></div><div class="quiz-layout"><section class="card"><div class="card-head"><h2>Question ${quizIndex + 1} of ${qs.length}</h2><span class="chip">${FORMATS[q.type]}</span></div><div class="card-body"><article class="question-item" style="margin:0">${questionContext(q)}${formattedQuestion(q)}${s.type === 'prompt' ? '' : `<p class="sub">Correct +${q.correctScore} · Wrong ${q.wrongScore} · Unanswered 0${q.type === 'text' ? ' · Manually reviewed' : ''}</p>`}${candidateQuestion(q, a.responses?.[q.id])}</article><div class="row between" style="margin-top:20px"><button ${quizIndex === 0 ? 'disabled' : ''} onclick="quizIndex--;render()">← Previous</button><button ${quizIndex === qs.length - 1 ? 'disabled' : ''} onclick="quizIndex++;render()">Next →</button></div></div></section><section class="card quiz-side"><div class="card-body"><b>Question navigator</b><p class="sub" style="margin-top:8px">${qs.filter(q => answerPresent(q, a.responses?.[q.id])).length} of ${qs.length} answered</p><div class="quiz-nav">${qs.map((x, i) => `<button class="${i === quizIndex ? 'current' : answerPresent(x, a.responses?.[x.id]) ? 'answered' : ''}" onclick="quizIndex=${i};render()">${i + 1}</button>`).join('')}</div><button class="primary" style="width:100%;margin-top:20px" onclick="confirmSubmit()">Submit test</button></div></section></div></main>`; }
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
function formattedQuestion(q) {
    const text = String(q.text || '').trim();
    const sentenceStem = 'Choose the most coherent order of these sentences.';
    if (text.startsWith(sentenceStem)) {
        const remainder = text.slice(sentenceStem.length);
        const labels = ['P', 'Q', 'R', 'S'];
        const positions = labels.map(label => remainder.indexOf(label + '.'));
        if (positions.every((position, i) => position >= 0 && (i === 0 || position > positions[i - 1]))) {
            const sentences = labels.map((label, i) => {
                const start = positions[i] + 2;
                const end = i + 1 < positions.length ? positions[i + 1] : remainder.length;
                return `<p class="question-sentence"><strong>${label}.</strong> ${esc(remainder.slice(start, end).trim())}</p>`;
            }).join('');
            return `<div class="formatted-question"><p>${esc(sentenceStem)}</p>${sentences}</div>`;
        }
    }
    const passageStart = 'When the company piloted a four-day in-office schedule last spring';
    const inferenceQuestion = 'Which of the following can most reasonably be inferred from the passage?';
    const passageIndex = text.indexOf(passageStart);
    const inferenceIndex = text.indexOf(inferenceQuestion);
    if (passageIndex >= 0 && inferenceIndex > passageIndex) {
        const intro = 'Read the passage and answer the question.';
        let passage = text.slice(passageIndex, inferenceIndex).trim();
        passage = passage.replace(/purpose does[’'”"]?[.!?]?$/i, 'purpose does.');
        return `<div class="formatted-question"><p>${esc(intro)}</p><p>${esc(passage)}</p><h3>${esc(inferenceQuestion)}</h3></div>`;
    }
    return `<h3>${esc(text)}</h3>`;
}
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
function adminQuestion(type, q, i) { let prompt = type === 'prompt', key = q.key || []; return `<article class="question-item" id="manager-question-${i}"><div class="row between"><div class="question-meta"><b>Q${i + 1}</b><span class="chip">${FORMATS[q.type]}</span><span class="source-label">${esc(q.source || typeInfo(type).name)}</span>${prompt ? '' : `<span class="chip ${keyReady(q) ? '' : 'review-required'}">${q.type === 'text' ? 'Manual review' : keyReady(q) ? 'Answer key set' : 'Answer key needed'}</span>`}</div><div class="row"><button class="small" ${managerReadOnly ? 'disabled' : ''} onclick="editQuizQuestion('${type}',${i})">Edit question</button><button class="danger small" ${managerReadOnly ? 'disabled' : ''} onclick="deleteQuizQuestion('${type}',${i})">Delete question</button></div></div>${questionContext(q)}${formattedQuestion(q)}${q.type === 'matching' ? (q.pairs || []).map(p => `<div class="option-preview">${esc(p.left)} → ${esc(p.right)}</div>`).join('') : (q.options || []).map((o, j) => `<div class="option-preview ${!prompt && key.includes(j) ? 'correct' : ''}">${String.fromCharCode(65 + j)}. ${esc(o)} ${!prompt && key.includes(j) && q.type !== 'ranking' ? '✓' : ''}</div>`).join('')}${q.referenceAnswer && !prompt ? `<div class="reference-note"><b>Source reference answer (admin only)</b><br>${esc(q.referenceAnswer)}</div>` : ''}${q.reviewNote ? `<div class="notice">${esc(q.reviewNote)}</div>` : ''}<div class="question-foot">${prompt ? 'Separate evaluation · No answer key or automatic scoring' : `Correct: +${q.correctScore} · Wrong: ${q.wrongScore} · Unanswered: 0`}</div></article>`; }
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
function testRow(d, t) {
    let s = driveTests(d.id).find(s => s.type === t.id), qs = driveQuestionSet(d.id, t.id);
    let questionSummary = s?.historicalImport ? 'Historical results · 15 minutes' : `${qs.length} questions · ${durationMinutes(t.id)} minutes`;
    let header = `<section class="test-row"><div class="row between"><div><h3>${t.name}</h3><p>${questionSummary}${s ? ` · ${s.attempts.length} candidates · ${s.attempts.filter(a => a.submittedAt).length} submitted` : ''}</p></div><div class="row">${s ? badge(s.closedAt ? 'Finished' : 'Live') : badge('Not started')}${s?.historicalImport ? '' : `<button class="small" onclick="openQuestionManager('${t.id}','${d.id}')">Update questions</button>`}</div></div>`;
    if (s?.historicalImport) return header + `<div class="notice">Historical Aptitude results imported from the Shortlist sheet. Recorded marks and completion times are preserved; all imported candidates are shortlisted.</div><div class="row" style="margin-top:12px"><button class="small" onclick="showResponses('${s.id}')">View responses</button></div></section>`;
    if (s) return header + `<div class="linkbox"><input aria-label="${t.name} test link" readonly value="${esc(testLink(s))}"><button class="small" onclick="copyLink('${s.id}')">Copy link</button></div><div class="row" style="margin-top:12px"><button class="small" onclick="openCandidate('${s.id}')">Candidate preview ↗</button><button class="small" onclick="showResponses('${s.id}')">View responses</button>${!s.closedAt ? `<button class="danger small" onclick="confirmStop('${s.id}')">Stop test</button>` : ''}</div></section>`;
    let importOption = t.id === 'aptitude' ? `<button class="small" onclick="document.getElementById('aptitude-import-${d.id}').click()">Import previous results</button><input id="aptitude-import-${d.id}" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onchange="importAptitudeResults('${d.id}',this)">` : '';
    return header + `<div class="row" style="margin-top:15px">${importOption}<button class="primary small" ${d.finishedAt ? 'disabled' : ''} onclick="generateTest('${d.id}','${t.id}')">Generate link for ${t.name}</button>${!qs.length ? '<span class="sub">Add questions before candidates can start.</span>' : ''}</div></section>`;
}
function gdComplete(d) { let members = d.gd?.pools?.flatMap(p => p.members) || []; return !!d.gd && members.every(key => ['initiative','content','communication','bodyLanguage'].every(field => Number.isFinite(d.gd.scores?.[key]?.[field]))); }
function confirmDeleteDrive(id) { let d=state.drives.find(x=>x.id===id); if(!d)return; let tests=driveTests(id), people=new Set(tests.flatMap(t=>t.attempts.map(a=>a.studentId))).size; dialog('Delete this drive and all its data?', `<div class="delete-question-confirm"><p><strong>${esc(d.name)}</strong></p><p>This permanently deletes this drive, its ${tests.length} assessment sessions, ${people} candidate records, all answers, marks, shortlist decisions and GD scores from the database.</p><p>This cannot be undone.</p></div>`, `<button onclick="modal.close()">Cancel</button><button class="danger" onclick="deleteDrive('${id}')">Delete drive and all data</button>`); }
async function deleteDrive(id) { try { await api('/api/admin/drives/'+id+'/delete','POST',{confirm:true}); await reloadAdmin(); expandedDrive=null; modal.close(); renderAdmin(); toast('Drive and associated data deleted.'); } catch(e) { handleError(e); } }
function gdSource(driveId) {
    const tests = driveTests(driveId);
    const language = tests.find(s => s.type === 'language' && (s.shortlistAppliedAt || s.attempts?.some(a => a.shortlisted)));
    return language || tests.find(s => s.type === 'aptitude');
}
function gdShortlistedRoster(driveId) {
    const session = gdSource(driveId), selected = new Map();
    for (const a of session?.attempts || []) if (a.shortlisted) {
        const key = a.studentId.normalize('NFKC').toLowerCase(), prior = selected.get(key);
        if (!prior || (a.startedAt || 0) > (prior.startedAt || 0)) selected.set(key, { name: a.name, studentId: a.studentId, startedAt: a.startedAt || 0 });
    }
    return [...selected.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name) || a[1].studentId.localeCompare(b[1].studentId));
}
function gdRow(d) {
    let count = d.gd?.pools?.reduce((n, p) => n + p.members.length, 0), complete = gdComplete(d), source = gdSource(d.id);
    return `<section class="test-row gd-row"><div class="row between"><div><h3>Group Discussion (GD)</h3>${d.gd ? `<p>${count} shortlisted candidates · ${d.gd.pools.length} pools · requested pool size ${d.gd.poolSize} · ${complete ? 'Evaluations complete' : 'Evaluation in progress'}</p>` : ''}</div><div class="row">${badge(d.gd ? complete ? 'Finished' : 'Live' : 'Not started')}</div></div>${d.gd ? `<button class="primary small" onclick="openGdPools('${d.id}')">Open pools</button> <button class="small" onclick="askPoolSize('${d.id}')">Rebuild pools</button>` : `<button class="primary small" ${!source || d.finishedAt ? 'disabled' : ''} onclick="askPoolSize('${d.id}')">Generate pools</button>${!source ? '<small class="sub">Import Aptitude results or create an Aptitude test first.</small>' : ''}`}</section>`;
}
function poolSizes(candidateCount, requestedSize) {
    if (!candidateCount) return [];
    let poolCount = Math.max(1, Math.floor(candidateCount / requestedSize));
    while (Math.ceil(candidateCount / poolCount) > 10) poolCount++;
    const base = Math.floor(candidateCount / poolCount), remainder = candidateCount % poolCount;
    return Array.from({ length: poolCount }, (_, i) => base + (i < remainder ? 1 : 0));
}
function askPoolSize(id) {
    const drive = state.drives.find(d => d.id === id), source = gdSource(id), roster = gdShortlistedRoster(id);
    if (!source) return toast('Add Aptitude results or create an Aptitude test first.');
    if (!roster.length) return toast('No shortlisted candidates are available for GD pools.');
    const sourceName = source.type === 'language' ? 'Language & Reasoning' : 'Aptitude';
    dialog(drive?.gd ? 'Rebuild GD pools' : 'Generate GD pools', `<p class="sub">${roster.length} candidates shortlisted in ${sourceName}. A pool can never exceed 10 candidates.</p><div class="field"><label for="gdPoolSize">Target candidates per pool</label><input id="gdPoolSize" type="number" min="1" max="10" step="1" value="${drive?.gd?.poolSize || 7}"></div>`, `<button onclick="modal.close()">Cancel</button><button class="primary" onclick="previewGdPools('${id}')">Preview pools</button>`);
}
function previewGdPools(id) {
    const input = document.querySelector('#gdPoolSize'), poolSize = Number(input?.value), roster = gdShortlistedRoster(id), source = gdSource(id);
    if (!Number.isInteger(poolSize) || poolSize < 1 || poolSize > 10) return toast('Pool size must be between 1 and 10.');
    if (!roster.length) return toast('No shortlisted candidates are available for GD pools.');
    const sizes = poolSizes(roster.length, poolSize);
    const rows = sizes.map((size, i) => `<div class="pool-preview-row"><b>Pool ${i < 26 ? String.fromCharCode(65 + i) : i + 1}</b><span>${size} candidates</span></div>`).join('');
    dialog('Review GD pool allocation', `<p class="sub">${roster.length} candidates shortlisted in ${source.type === 'language' ? 'Language & Reasoning' : 'Aptitude'} will be distributed randomly and evenly. No pool exceeds 10 candidates.</p><div class="pool-preview-list">${rows}</div>`, `<button onclick="askPoolSize('${id}')">Edit pool size</button><button onclick="modal.close()">Cancel</button><button class="primary" onclick="confirmGdPools('${id}',${poolSize})">Confirm and open pools</button>`);
}
async function confirmGdPools(id, poolSize) {
    try { const result = await api('/api/admin/drives/' + id + '/gd/pools', 'POST', { poolSize }); await reloadAdmin(); modal.close(); openGdPools(id); toast(`${result.candidateCount} shortlisted candidates assigned to ${result.gd.pools.length} GD pools.`); }
    catch (e) { handleError(e); }
}
function gdMarkup(d) {
    const fields = [['initiative', 'Initiative'], ['content', 'Content'], ['communication', 'Communication'], ['bodyLanguage', 'Body Language']];
    const pools = d.gd.pools.map((pool, pi) => {
        const editing = editingGdEvaluator === `${d.id}:${pi}`;
        const evaluator = pool.evaluatorName || '';
        return `<section class="gd-pool"><div class="gd-pool-heading"><div><h3>${esc(pool.name)} <small>${pool.members.length} candidates</small></h3>${evaluator ? `<p class="evaluator-label">Evaluator: <b>${esc(evaluator)}</b></p>` : '<p class="evaluator-label">Assign an evaluator before scoring this pool.</p>'}</div><div class="gd-evaluator-controls"><input class="gd-evaluator-input" id="gd-evaluator-${pi}" maxlength="100" placeholder="Evaluator name" value="${esc(evaluator)}" ${evaluator && !editing ? 'disabled' : ''}><button class="small" onclick="${evaluator && !editing ? `editGdEvaluator('${d.id}',${pi})` : `saveGdEvaluator('${d.id}',${pi})`}">${evaluator && !editing ? 'Change name' : 'Save evaluator'}</button></div></div><table><thead><tr><th>#</th><th>Name</th>${fields.map(([, label]) => `<th>${label} (5)</th>`).join('')}<th>Total (20)</th><th>Recommend</th></tr></thead><tbody>${pool.members.map((key, i) => {
            const member = d.gd.candidates?.[key] || { name: key, studentId: key }, scores = d.gd.scores?.[key] || {};
            const keyArg = encodeURIComponent(key).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16));
            return `<tr><td>${i + 1}</td><td>${esc(member.name)}<small>${esc(member.studentId)}</small></td>${fields.map(([field]) => `<td><input class="gd-score" type="number" min="0" max="5" step="0.5" value="${scores[field] ?? ''}" ${!evaluator ? 'disabled' : ''} aria-label="${esc(field)} score for ${esc(member.name)}" onchange="saveGdScore('${d.id}',decodeURIComponent('${keyArg}'),'${field}',this.value,this)"></td>`).join('')}<td class="gd-total">${scores.total ?? 0}</td><td><label class="shortlist-check"><input type="checkbox" ${scores.shortlisted ? 'checked' : ''} ${!evaluator ? 'disabled' : ''} onchange="saveGdShortlist('${d.id}',decodeURIComponent('${keyArg}'),this.checked)"> Recommend</label></td></tr>`;
        }).join('') || '<tr><td colspan="8">No shortlisted candidates assigned to this pool.</td></tr>'}</tbody></table></section>`;
    }).join('');
    return `<header class="results-header"><div class="row between"><div><h2>GD Evaluation · ${esc(d.name)}</h2><p class="sub">Enter each area out of 5. The total is calculated out of 20 and saved as you score.</p></div><div class="row gd-export-actions"><button class="small" onclick="exportGd('${d.id}','roster')">Export pool list</button><button class="small" onclick="exportGd('${d.id}','scores')">Export pool scores</button><button class="small" onclick="refreshGdScores('${d.id}')">Refresh scores</button></div><button class="small danger" onclick="confirmClearGdPools('${d.id}')">Clear pools</button><button class="quiet" onclick="modal.close()" aria-label="Close GD evaluations">✕</button></div></header><div class="results-scroll gd-pools">${pools}</div><footer class="results-footer"><span class="sub">Scores and evaluator names are shared across administrator sessions. Closing this window only closes it on your device.</span></footer>`;
}
function openGdPools(id) { let d = state.drives.find(x => x.id === id); if (!d?.gd) return toast('Generate the GD pools first.'); stopGdRefresh(); editingGdEvaluator = null; gdDrive = id; modal.className = 'results-dialog gd-evaluation'; modal.innerHTML = gdMarkup(d); if (!modal.open) modal.showModal(); gdRefreshTimer = setInterval(() => { if (modal.open && modal.classList.contains('gd-evaluation') && gdDrive === id) refreshGdScores(id, true); else stopGdRefresh(); }, 10000); }
function confirmClearGdPools(id) {
    const d = state.drives.find(x => x.id === id);
    if (!d?.gd) return;
    dialog('Clear GD pools?', `<p>This will delete all ${d.gd.pools.length} pools, evaluator names and GD scores for <strong>${esc(d.name)}</strong>. You can generate new pools afterwards.</p>`, `<button onclick="openGdPools('${id}')">Keep pools</button><button class="danger" onclick="clearGdPools('${id}')">Clear pools and scores</button>`);
}
async function clearGdPools(id) {
    try {
        await api('/api/admin/drives/' + id + '/gd/clear', 'POST', {confirm:true});
        stopGdRefresh();
        gdDrive = null;
        await reloadAdmin();
        modal.close();
        renderAdmin();
        toast('GD pools and scores cleared. You can generate new pools.');
    } catch (e) { handleError(e); }
}
let gdDrive = null, gdRefreshTimer = null;
function stopGdRefresh() { if (gdRefreshTimer) clearInterval(gdRefreshTimer); gdRefreshTimer = null; }
async function refreshGdScores(id, quiet = false) {
    if (id !== gdDrive || !modal.open || !modal.classList.contains('gd-evaluation') || document.activeElement?.classList?.contains('gd-score') || document.activeElement?.classList?.contains('gd-evaluator-input')) return;
    const previousScroll = document.querySelector('.gd-evaluation .gd-pools')?.scrollTop || 0;
    try {
        await reloadAdmin();
        if (id !== gdDrive || !modal.open || !modal.classList.contains('gd-evaluation')) return;
        const d = state.drives.find(x => x.id === id);
        if (d?.gd) { modal.innerHTML = gdMarkup(d); const scroller = document.querySelector('.gd-evaluation .gd-pools'); if (scroller) scroller.scrollTop = previousScroll; }
    } catch (e) { if (!quiet) handleError(e); }
}
function editGdEvaluator(id, poolIndex) { editingGdEvaluator = `${id}:${poolIndex}`; const d = state.drives.find(x => x.id === id); if (modal.open && d?.gd) { modal.innerHTML = gdMarkup(d); document.querySelector(`#gd-evaluator-${poolIndex}`)?.focus(); } }
async function saveGdEvaluator(id, poolIndex) { const input = document.querySelector(`#gd-evaluator-${poolIndex}`), evaluatorName = input?.value.trim(); if (!evaluatorName) return toast('Enter the evaluator name before continuing.'); try { await api('/api/admin/drives/' + id + '/gd/evaluator', 'POST', { poolIndex, evaluatorName }); editingGdEvaluator = null; await reloadAdmin(); const d = state.drives.find(x => x.id === id); if (modal.open && d?.gd) modal.innerHTML = gdMarkup(d); toast(`Evaluator saved for Pool ${poolIndex < 26 ? String.fromCharCode(65 + poolIndex) : poolIndex + 1}.`); } catch (e) { handleError(e); } }
async function saveGdShortlist(id, key, value) {
    try {
        const result = await api('/api/admin/drives/' + id + '/gd/score', 'POST', { studentKey: key, field: 'shortlisted', value });
        const drive = state.drives.find(d => d.id === id);
        if (drive?.gd && result.score) { drive.gd.scores ||= {}; drive.gd.scores[key] = result.score; }
    } catch (e) { handleError(e); }
}
async function saveGdScore(id, key, field, raw, input) {
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 5)) return toast('Enter a score from 0 to 5.');
    try {
        const result = await api('/api/admin/drives/' + id + '/gd/score', 'POST', { studentKey: key, field, score: raw === '' ? null : Number(raw) });
        const drive = state.drives.find(d => d.id === id);
        if (drive?.gd && result.score) { drive.gd.scores ||= {}; drive.gd.scores[key] = result.score; }
        const total = input?.closest('tr')?.querySelector('.gd-total');
        if (total && result.score) total.textContent = result.score.total ?? 0;
    } catch (e) { handleError(e); }
}
function questionOverview() { const importAction = `<label class="import-question-action">Import question sets<input type="file" accept="application/json,.json" onchange="importQuestionFile(this)"></label>`; return heading('Question overview', 'Manage the default question sets for your recruitment drives.', importAction) + `<div class="notice">Language & Reasoning now includes both uploaded question sets. Use Update questions to review or edit in one scrollable window. Prompt Engineering is evaluated separately, without an answer key or automatic score.</div><div class="ready-grid">${TYPES.map(t => { let qs = state.questionSets[t.id], minutes = Number(state.durations?.[t.id] || durationMinutes(t.id)); return `<section class="card"><div class="card-body"><span class="chip">${qs.length} questions</span><h3>${t.name}</h3><p>${t.id === 'language' ? '20 Language Proficiency + 5 Data Interpretation questions' : t.description}</p><div class="duration-editor"><label for="duration-${t.id}">Test time (minutes)</label><div class="row"><input id="duration-${t.id}" type="number" min="1" max="180" step="1" value="${minutes}" aria-label="${t.name} timer in minutes"><button class="small" onclick="saveDuration('${t.id}')">Save time</button></div></div>${t.id === 'prompt' ? '<div class="bank-summary">Separate evaluation</div>' : `<div class="bank-summary">${qs.filter(keyReady).length} answer keys · ${qs.filter(q => q.type === 'text').length} written responses</div>`}<button class="primary small" onclick="openQuestionManager('${t.id}')">Update questions</button></div></section>`; }).join('')}</div>`; }
function saveDuration(type) { let input = document.getElementById('duration-' + type), minutes = Number(input?.value); if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) { toast('Enter a whole number from 1 to 180 minutes.'); return; } state.durations[type] = minutes; state.sessions.forEach(s => { if (s.type === type && !s.closedAt && !(s.attempts || []).length) s.durationMinutes = minutes; }); save(); render(); toast('Test time updated. It applies to candidates who start a test using this setting.'); }
function createTest(driveId, type) { let d = state.drives.find(d => d.id === driveId); if (!d || d.finishedAt || driveTests(driveId).some(s => s.type === type))
    return; let qs = JSON.parse(JSON.stringify(driveQuestionSet(driveId, type))); let s = { id: uuid(), driveId, type, name: d.name + ' · ' + typeInfo(type).name, start: Date.now(), closedAt: null, durationMinutes: Number(state.durations?.[type] || durationMinutes(type)), question: qs.map(q => q.text).join('\n\n'), questions: qs, attempts: [] }; state.sessions.unshift(s); state.activeId = s.id; expandedDrive = d.id; save(); modal.close(); render(); toast('Test link generated with the drive’s current question set.'); }
function durationMinutes(value) { if (value && typeof value === 'object' && Number.isInteger(value.durationMinutes)) return value.durationMinutes; let type = typeof value === 'string' ? value : value?.type; return type === 'aptitude' ? 15 : type === 'language' ? 20 : 30; }
function elapsedMinutes(a) { if (Number.isFinite(a.importedElapsedMinutes)) return Math.max(0, a.importedElapsedMinutes); return a.submittedAt ? Math.max(0, (a.submittedAt - a.startedAt) / 60000) : null; }
function gradeAttempt(s, a) { if (Number.isFinite(a.importedScore)) return { total: a.importedScore, pending: 0, results: [] }; let total = 0, pending = 0; let results = (s.questions || []).map(q => { let v = a.responses?.[q.id], answered = answerPresent(q, v), manual = a.manualMarks?.[q.id]; if (manual !== undefined && Number.isFinite(manual)) {
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
function scoreDistribution(test) {
    const thresholds = test.type === 'aptitude' ? [12, 18] : [10, 16];
    const labels = [`<${thresholds[0]}`, `${thresholds[0]}–${thresholds[1]}`, `>${thresholds[1]}`];
    const scores = test.attempts.filter(a => a.submittedAt).map(a => gradeAttempt(test, a).total);
    const counts = [scores.filter(n => n < thresholds[0]).length, scores.filter(n => n >= thresholds[0] && n <= thresholds[1]).length, scores.filter(n => n > thresholds[1]).length];
    const percents = counts.map(n => scores.length ? Math.round(100 * n / scores.length) : 0);
    return `<div class="score-distribution-title">Score distribution · ${scores.length} submitted</div><div class="score-distribution-bar" role="img" aria-label="Score distribution: ${labels.map((label, i) => label + ': ' + percents[i] + '% (' + counts[i] + ')').join(', ')}">${percents.map((pct, i) => `<span class="score-segment score-segment-${i}" style="width:${pct}%" title="${labels[i]}: ${pct}% (${counts[i]})"><b>${pct ? pct + '%' : ''}</b></span>`).join('')}</div><div class="score-distribution-labels">${labels.map((label, i) => `<span><i class="score-legend-swatch score-segment-${i}"></i><b>${label}</b><small>${percents[i]}% · ${counts[i]}</small></span>`).join('')}</div>`;
}
function languageScoreParts(test, grading) {
    const scores = new Map(grading.results.map(result => [result.id, result.score]));
    return [test.questions.slice(0,20), test.questions.slice(20,25)].map(group => {
        const values = group.map(q => scores.get(q.id));
        return values.some(v => v == null) ? null : Math.round(values.reduce((n,v) => n + v, 0) * 1000000) / 1000000;
    });
}
function updateResponseTable() {
    const test = state.sessions.find(x => x.id === responseSession), rows = responseRows(test), error = filterValidation();
    document.querySelector('#response-filter-error').textContent = error;
    document.querySelector('#responseCount').textContent = rows.length + ' of ' + test.attempts.length + ' candidates · ' + test.attempts.filter(a => a.shortlisted).length + ' shortlisted';
    const drive = state.drives.find(x => x.id === test.driveId)?.name || test.name;
    const chart = document.querySelector('#score-distribution'); if (chart) chart.innerHTML = scoreDistribution(test);
    const target = document.querySelector('#responseTable');
    if (error || !rows.length) { target.innerHTML = '<div class="results-empty">' + esc(error || 'No candidates match these filters.') + '</div>'; return; }
    const aptitude = test.type === 'aptitude', language = test.type === 'language';
    const head = '<th>Drive name</th><th>Student name</th><th>Student ID</th><th>' + (language ? 'Total marks' : 'Marks obtained') + '</th>' + (language ? '<th>Language score (out of 20)</th><th>Reasoning score (out of 5)</th>' : '') + '<th>Time taken (min)</th><th>Shortlisted</th><th>' + (aptitude ? 'Remarks' : '') + '</th>';
    const body = rows.map(({a,g,minutes}) => {
        const parts = languageScoreParts(test,g);
        const review = !aptitude && !a.importedSource ? '<button class="small" ' + (!a.submittedAt?'disabled':'') + ' onclick="reviewAttempt=reviewAttempt===\'' + a.id + '\'?null:\'' + a.id + '\';updateResponseTable()">' + (reviewAttempt===a.id?'Close review':'Review marks') + '</button>' : '';
        return '<tr><td>' + esc(drive) + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.studentId) + '</td><td><span class="marks-total">' + (a.submittedAt ? g.total : '—') + '</span>' + (g.pending && a.submittedAt ? '<small>' + g.pending + ' pending · provisional</small>' : '') + '</td>' + (language ? parts.map(value => '<td>' + (a.submittedAt ? value ?? '—' : '—') + '</td>').join('') : '') + '<td>' + (minutes === null ? '—' : minutes.toFixed(2)) + '</td><td>' + (a.shortlisted ? 'Shortlisted' : 'Not shortlisted') + '</td><td class="shortlist-remarks">' + (aptitude ? esc(a.shortlistRemarks || '') : review) + '</td></tr>' + (!aptitude && reviewAttempt === a.id ? '<tr class="review-marks"><td colspan="9">' + reviewMarks(test,a,g) + '</td></tr>' : '');
    }).join('');
    target.innerHTML = '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
}
function reviewMarks(s, a, g) { return `<p class="sub">Review answers and set individual marks. Manual marks replace automatic marks. Enter a value between each question’s wrong-answer score and maximum score.</p>${(s.questions || []).map((q, i) => { let result = g.results[i]; return `<section class="review-question"><div><h4>Q${i + 1} · ${esc(q.text)}</h4>${questionContext(q)}<p><b>Candidate answer</b><br>${esc(readableAnswer(q, a.responses?.[q.id]))}</p>${q.referenceAnswer ? `<p><b>Reference answer</b><br>${esc(q.referenceAnswer)}</p>` : ''}${q.reviewNote ? `<div class="notice">${esc(q.reviewNote)}</div>` : ''}<span class="chip">${result.status}</span></div><div><label for="mark-${a.id}-${q.id}">Marks (${q.wrongScore} to ${q.correctScore})</label><input id="mark-${a.id}-${q.id}" type="number" step="any" min="${q.wrongScore}" max="${q.correctScore}" value="${result.score ?? ''}" onchange="saveQuestionMark('${s.id}','${a.id}','${q.id}',this.value)"><small>Saved when changed</small>${a.manualMarks?.[q.id] !== undefined ? `<button class="quiet small" onclick="deleteManualMark('${s.id}','${a.id}','${q.id}')">Reset to automatic</button>` : ''}</div></section>`; }).join('')}`; }
function promptExportReady(s) { return !!s.closedAt || s.attempts.length > 0 && s.attempts.every(a => a.submittedAt); }
function showPromptResponses(s) {
 settlePromptSessions(); let ready=promptExportReady(s);
 modal.className='results-dialog';
 let candidates=s.attempts.map(a=>'<article class="question-item"><div class="row between"><div><b>'+esc(a.name)+'</b><p class="sub">'+esc(a.studentId)+' · '+(a.submittedAt?elapsedMinutes(a).toFixed(2)+' minutes':'In progress')+'</p></div><div class="row"><label class="prompt-score-control">Score / 10 <input type="number" min="0" max="10" step="0.5" value="'+(a.promptScore??'')+'" '+(!a.submittedAt?'disabled':'')+' onchange="savePromptScore(\''+s.id+'\',\''+a.id+'\',this.value)"></label><span class="chip">'+(a.submittedAt?'Submitted':'In progress')+'</span></div></div>'+(a.submittedAt?'<details><summary>Read response</summary><div class="detail-answer">'+esc(promptAnswerText(s,a))+'</div></details>':'')+'</article>').join('')||'<div class="empty">No candidates yet.</div>';
 modal.innerHTML='<header class="results-header"><div class="row between"><div><h2>Prompt Engineering · Responses</h2><p class="sub">'+esc(s.name)+' · 30-minute test · Separate evaluation</p></div><button class="quiet" onclick="modal.close()" aria-label="Close responses">✕</button></div><p class="sub">'+s.attempts.filter(a=>a.submittedAt).length+' of '+s.attempts.length+' registered candidates submitted. '+(ready?'Test is complete. Word export is ready.':'Word export unlocks when all registered candidates submit or the admin stops the test.')+'</p></header><div class="prompt-result-list">'+candidates+'</div><footer class="results-footer"><span class="sub">Scores are saved per candidate out of 10. Word export remains available.</span><button class="primary small" '+(!ready||!s.attempts.length?'disabled':'')+' onclick="exportPromptDocuments(\''+s.id+'\')">↓ Export Word documents</button></footer>';
 if(!modal.open)modal.showModal();
}
function promptAnswerText(s, a) { if (a.responses && s.questions?.length)
    return s.questions.map((q, i) => `Question ${i + 1}\n${q.text}\n\nResponse\n${String(a.responses[q.id] || '(No answer entered)')}`).join('\n\n'); return a.answer || '(No answer entered)'; }
// Clearly labelled sample rows make the response table and exports reviewable without taking tests.
// Offline OOXML exports: a small ZIP store writer avoids network dependencies.
function overviewCounts(drive) {
 const tests=driveTests(drive.id), all=tests.flatMap(t=>t.attempts||[]), attended=new Set(all.filter(a=>a.startedAt||a.submittedAt).map(a=>a.studentId.normalize('NFKC').toLowerCase())).size;
 const aptitude=new Set(tests.filter(t=>t.type==='aptitude').flatMap(t=>(t.attempts||[]).filter(a=>a.shortlisted).map(a=>a.studentId.normalize('NFKC').toLowerCase()))).size, decisions=Object.values(drive.finalDecisions||{});
 return {attended,aptitude,interview:decisions.filter(d=>d.interviewShortlisted).length,selected:decisions.filter(d=>d.outcome==='selected').length,onHold:decisions.filter(d=>d.outcome==='on-hold').length};
}
function overviewCard(drive) {
    const count = overviewCounts(drive), status = driveStatus(drive);
    const metrics = [
        ['attended', count.attended, 'Attended'],
        ['aptitude', count.aptitude, 'Aptitude shortlist'],
        ['interview', count.interview, 'Interview shortlisted'],
        ['selected', count.selected, 'Selected'],
        ['hold', count.onHold, 'On hold']
    ];
    const metricRows = metrics.map(([icon, value, label]) => {
        const undecided = !drive.finishedAt && (icon === 'selected' || icon === 'hold') && value === 0;
        return `<div class="overview-metric-row"><span class="overview-metric-icon metric-${icon}">${uiIcon(icon)}</span><div class="overview-metric-copy"><span>${label}</span><strong>${undecided ? '' : value}</strong></div></div>`;
    }).join('');
    return `<button class="overview-drive-card card" onclick="openDriveScheduler('${drive.id}')"><div class="overview-card-head"><span class="overview-drive-icon">${uiIcon('college')}</span><div><strong>${esc(drive.name)}</strong><small>${drive.finishedAt ? `Finished ${date(drive.finishedAt)}` : `Created ${date(drive.createdAt)}`}</small></div>${badge(status)}</div><div class="overview-metrics">${metricRows}</div><span class="overview-open"><span>Open drive</span><span class="overview-open-arrow">${uiIcon('arrow')}</span></span></button>`;
}
function overviewPage() {
    const live = state.drives.filter(d => !d.finishedAt).sort((a, b) => b.createdAt - a.createdAt), finished = state.drives.filter(d => d.finishedAt).sort((a, b) => b.finishedAt - a.finishedAt);
    const liveCards = live.map(overviewCard).join('') || '<div class="empty card">No live or upcoming drives yet. Start a drive to begin.</div>';
    const finishedCards = finished.map(overviewCard).join('') || '<div class="empty card">No finished drives yet.</div>';
    return `<div class="heading overview-heading"><div><h1>Overview</h1></div><button class="primary" onclick="startDrive()">＋ Start a drive</button></div><section class="overview-section"><div class="overview-section-heading"><h2>Live Drives</h2><span class="chip status-live">${live.length} drives</span></div><div class="overview-drive-grid">${liveCards}</div></section><section class="overview-section"><div class="overview-section-heading"><div><h2>Finished drives</h2><p class="sub">Drives ended by an administrator.</p></div><span class="chip status-finished">${finished.length} drives</span></div><div class="overview-drive-grid">${finishedCards}</div></section>`;
}
function openDriveScheduler(id) { expandedDrive = id; filterName = ''; filterStatus = 'all'; view = 'sessions'; renderAdmin(); }
function renderAdmin() { if (!['overview', 'sessions', 'question', 'final'].includes(view)) view = 'overview'; const content = view === 'overview' ? overviewPage() : view === 'question' ? questionOverview() : view === 'final' ? finalScoresPage() : scheduler(); app.innerHTML = shell(content); }
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
} responseSession = id; responseFilters = { minMarks: '', minTime: '' }; reviewAttempt = null; modal.className = 'results-dialog'; modal.innerHTML = `<header class="results-header"><div class="row between"><div><h2>${typeInfo(s.type).name} · Responses</h2><p class="sub">${esc(state.drives.find(d => d.id === s.driveId)?.name || s.name)} · ${durationMinutes(s)}-minute test</p></div><button class="quiet" onclick="modal.close()" aria-label="Close responses">✕</button></div><p class="sub">Filter by minimum marks and minimum time taken. Totals with pending questions are provisional.</p></header><section class="results-controls">${[['minMarks', 'Min marks (out of ' + (s.type === 'aptitude' ? 30 : 25) + ')'], ['minTime', 'Min time (minutes) (out of ' + durationMinutes(s) + ')']].map(([key, label]) => `<div><label for="filter-${key}">${label}</label><input id="filter-${key}" type="number" step="any" ${key === 'minTime' ? 'min="0"' : ''} oninput="responseFilters.${key}=this.value;updateResponseTable()"></div>`).join('')}<div id="score-distribution" class="score-distribution"></div>${['aptitude','language'].includes(s.type) ? '<div class="shortlist-actions"><button class="primary small" onclick="shortlistFilteredCandidates()">Shortlist filtered candidates</button><button class="small" onclick="shortlistFilteredCandidates(true)">Revert shortlisting</button></div>' : ''}<div id="response-filter-error" class="filter-error" role="alert"></div></section><div class="results-scroll" id="responseTable"></div><footer class="results-footer"><div><span id="responseCount" class="sub"></span><div class="bulk-note">Shortlisting applies to completed candidates with final marks. Revert clears shortlisting for this test, including candidates outside the current filters.</div></div><div class="export-actions">${s.type === 'aptitude' ? `<button class="small" onclick="openAptitudeReview('${s.id}')">View candidate responses</button>` : ''}<button class="small" onclick="clearResponseFilters()">Clear filters</button><button class="small" onclick="exportResponsesExcel()">↓ Export filtered to Excel</button></div></footer>`; updateResponseTable(); if (!modal.open)
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
function statusMessage(message, error = false) { let el = document.querySelector('#connectionStatus'); if (el) { el.textContent = message; el.style.color = error ? '#af403c' : '#087e78'; } }
async function api(path, method = 'GET', body) { let response = await fetch(path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: body === undefined ? undefined : JSON.stringify(body) }); let data = await response.json(); if (!response.ok) {
    let e = new Error(data.error || 'Request failed.');
    e.status = response.status;
    throw e;
} if (data.serverNow)
    serverOffset = data.serverNow - Date.now(); return data; }
function hydrate(value) { state = value; state.durations = { aptitude: 15, language: 20, prompt: 30, ...(value.durations || {}) }; state.banks = {}; TYPES.forEach(t => state.banks[t.id] = bankText(t.id)); state.sessions.forEach(s => { s.question = s.questions?.map(q => q.text).join('\n\n') || ''; s.attempts = s.attempts || []; }); }
function editableState() { return { drives: state.drives, sessions: state.sessions, questionSets: state.questionSets, durations: state.durations }; }
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
async function lookupCandidateIdentity() {
    const s = state.sessions[0], input = document.querySelector('#studentId');
    if (!s || s.type === 'aptitude' || !input?.value.trim()) return null;
    const requestedId = input.value.trim();
    try {
        const result = await api('/api/candidate/' + s.id + '/identity', 'POST', {studentId: requestedId});
        if (input.value.trim() !== requestedId) return null;
        input.value = result.studentId;
        return result;
    } catch (e) { return null; }
}
async function startCandidate(event) {
    event.preventDefault();
    const s = state.sessions[0], nameInput = document.querySelector('#candidateName'), idInput = document.querySelector('#studentId');
    let name = nameInput?.value.trim() || '', studentId = idInput?.value.trim() || '';
    if (!studentId || /[\u0000-\u001f]/.test(name + studentId)) return toast('Enter a valid Student ID.');
    if (s.type === 'aptitude' && !name) return toast('Enter your full name.');
    if (s.type !== 'aptitude') {
        const identity = await lookupCandidateIdentity();
        if (!identity) return toast('Student ID not found. Please enter the correct student ID used for Aptitude.');
        name = identity.name; studentId = identity.studentId;
    }
    modal.className = 'candidate-confirm';
    modal.innerHTML = `<div class="modal-head"><h2>Confirm your details</h2><button class="quiet small" onclick="modal.close()" aria-label="Close dialog">✕</button></div><div class="modal-body"><p>Please check your details before starting the test.</p><div class="candidate-detail"><span>Full name</span><strong>${esc(name)}</strong></div><div class="candidate-detail"><span>Student ID</span><strong>${esc(studentId)}</strong></div><p class="sub">Your timer starts when you continue to the test.</p></div><div class="modal-foot"><button id="editCandidateDetails">Edit details</button><button class="primary" id="confirmCandidateDetails">Continue to test</button></div>`;
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
async function savePromptScore(testId, attemptId, value) { let score=value===''?null:Number(value); if(score!==null&&(!Number.isFinite(score)||score<0||score>10))return toast('Enter a Prompt Engineering score from 0 to 10.'); try { await api('/api/admin/tests/'+testId+'/prompt-score','POST',{attemptId,score}); let test=state.sessions.find(x=>x.id===testId), attempt=test?.attempts.find(x=>x.id===attemptId); if(attempt)attempt.promptScore=score; toast('Prompt Engineering score saved.'); } catch(e) { handleError(e); } }
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
async function postDownload(path, body, fallback) { try { await flushAdmin(); let response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)}); if(!response.ok){let data=await response.json();throw new Error(data.error||'Export failed.');} let blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a'); a.download=fallback;a.href=url;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch(e){handleError(e);} }
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
function loginView() { app.innerHTML = `<header class="masthead"><div class="tool-name">Talent Hub</div>${COMPANY_LOGO}</header><main class="candidate-main"><section class="entry card"><div class="card-body"><div class="eyebrow">ADMINISTRATOR</div><h1>Sign in</h1><form id="loginForm"><div class="field"><label for="loginEmail">Email</label><input id="loginEmail" type="email" autocomplete="username" required value="turnbrecruitment@gmail.com"></div><div class="field"><label for="loginPassword">Password</label><input id="loginPassword" type="password" autocomplete="current-password" required></div><button class="primary" type="submit">Sign in</button><p class="inline-error" id="loginError" role="alert"></p></form></div></section></main>`; document.querySelector('#loginForm').onsubmit = async (event) => { event.preventDefault(); let button = event.target.querySelector('button'); button.disabled = true; try {
    let result = await api('/api/auth/login', 'POST', { email: document.querySelector('#loginEmail').value, password: document.querySelector('#loginPassword').value });
    csrf = result.csrf;
    await reloadAdmin();
    view = 'sessions';
    renderAdmin();    statusMessage('Signed in');
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
        view = 'overview';
        render();        statusMessage('Connected');
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

let finalDriveFilter = '', finalScoreFilters = {}, finalDriveCurrent = '';
const FINAL_COLUMNS = [
 ['name','Candidate name'],['studentId','Student ID'],['aptitudeScore','Aptitude score'],['aptitudeShortlisted','Shortlisted in Aptitude'],
 ['gdScore','GD score (20)'],['gdRecommended','GD recommend'],['gdEvaluator','GD evaluator'],['languageScore','Language & Reasoning score'],['interviewShortlisted','Interview shortlisted'],
 ['interviewRemarks','Remarks'],['promptScore','Prompt Engineering (10)'],['interviewer','Interviewer'],['outcome','Final status']
];
function finalScoresPage() { return heading('Final scores','Review scores, shortlist interview candidates and record final decisions.','')+'<div class="filterbar"><div class="field"><label for="finalDriveFilter">Find a drive</label><input id="finalDriveFilter" type="search" value="'+esc(finalDriveFilter)+'" placeholder="Search college, year or drive name" oninput="finalDriveFilter=this.value;updateFinalDriveList()"></div></div><div id="finalDriveList">'+finalDriveList()+'</div>'; }
function finalDriveList() { let drives=state.drives.filter(d=>d.name.toLocaleLowerCase().includes(finalDriveFilter.trim().toLocaleLowerCase())); return drives.map(d=>'<button class="final-drive card" onclick="showFinalScores(\''+d.id+'\')"><span><strong>'+esc(d.name)+'</strong><small>'+combinedDriveScores(d.id).length+' candidates</small></span><span>View final scores →</span></button>').join('')||'<div class="empty">No drives match your search.</div>'; }
function updateFinalDriveList() { document.querySelector('#finalDriveList').innerHTML=finalDriveList(); }
function combinedDriveScores(driveId) {
 let candidates=new Map(),drive=state.drives.find(d=>d.id===driveId);
 for(const [key,member] of Object.entries(drive?.gd?.candidates||{})){const scores=drive.gd.scores?.[key]||{};candidates.set(key,{name:member.name,studentId:member.studentId,latest:-1,gdScore:Number.isFinite(scores.total)?scores.total:null,gdRecommended:scores.shortlisted===true});}
 for(let test of state.sessions.filter(x=>x.driveId===driveId))for(let attempt of test.attempts||[]){let key=attempt.studentId.normalize('NFKC').toLowerCase(),row=candidates.get(key);if(!row){row={name:attempt.name,studentId:attempt.studentId,latest:-1,gdScore:null,gdRecommended:false};candidates.set(key,row);}if((attempt.startedAt||0)>=row.latest){row.name=attempt.name;row.studentId=attempt.studentId;row.latest=attempt.startedAt||0;}if(!['aptitude','language','prompt'].includes(test.type))continue;let old=row[test.type];if(!old||(attempt.startedAt||0)>(old.attempt.startedAt||0)||((attempt.startedAt||0)===(old.attempt.startedAt||0)&&attempt.id>old.attempt.id))row[test.type]={test,attempt};}
 return [...candidates.values()].map(row=>{let d=drive?.finalDecisions?.[row.studentId.normalize('NFKC').toLowerCase()]||{};return {...row,aptitudeScore:finalScoreValue(row.aptitude),languageScore:finalScoreValue(row.language),promptScore:row.prompt?.attempt.promptScore??null,interviewShortlisted:d.interviewShortlisted===true,interviewRemarks:d.interviewRemarks||'',interviewer:d.interviewer||'',gdEvaluator:drive?.gd?.pools?.find(p=>p.members.includes(row.studentId.normalize('NFKC').toLowerCase()))?.evaluatorName||'',outcome:d.outcome||'none'};}).sort((a,b)=>a.name.localeCompare(b.name)||a.studentId.localeCompare(b.studentId));
}
function finalScoreValue(result) { return result?.attempt.submittedAt?gradeAttempt(result.test,result.attempt).total:null; }
function finalScoreCell(result) { if(!result)return '—';if(!result.attempt.submittedAt)return 'In progress';let score=gradeAttempt(result.test,result.attempt);return score.total+(score.pending?'<small>'+score.pending+' pending · provisional</small>':'');}
function finalValue(row,key) { if(key==='aptitudeShortlisted')return row.aptitude?.attempt.shortlisted?'Yes':'No';if(key==='gdRecommended')return row.gdRecommended?'Yes':'No';if(key==='interviewShortlisted')return row.interviewShortlisted?'Yes':'No';if(key==='outcome')return ({none:'None',selected:'Selected','on-hold':'On hold',rejected:'Rejected'}[row.outcome]||'None');return row[key]==null?'—':String(row[key]); }
const FINAL_NUMBER_KEYS = new Set(['aptitudeScore', 'gdScore', 'languageScore', 'promptScore']);
const FINAL_OPERATORS = {gte: 'Greater than or equal to', gt: 'Greater than', lte: 'Less than or equal to', lt: 'Less than', eq: 'Equal to', between: 'Between', blank: 'Is blank', notblank: 'Is not blank'};
function finalRowsFiltered(rows) {
    const filters = finalScoreFilters[finalDriveCurrent] || {};
    return rows.filter(row => FINAL_COLUMNS.every(([key]) => {
        const filter = filters[key];
        if (!filter) return true;
        if (typeof filter === 'string') return finalValue(row, key) === filter;
        if (FINAL_NUMBER_KEYS.has(key)) {
            const value = row[key], present = typeof value === 'number' && Number.isFinite(value);
            if (filter.op === 'blank') return !present;
            if (filter.op === 'notblank') return present;
            if (!present) return false;
            const target = Number(filter.value);
            switch (filter.op) {
                case 'gte': return value >= target;
                case 'gt': return value > target;
                case 'lte': return value <= target;
                case 'lt': return value < target;
                case 'eq': return value === target;
                case 'between': return value >= target && value <= Number(filter.upper);
                default: return false;
            }
        }
        if (filter.values) return filter.values.includes(finalValue(row, key));
        return finalValue(row, key).toLocaleLowerCase().includes((filter.text || '').toLocaleLowerCase());
    }));
}
function finalFilterDescription(key, filter) {
    if (typeof filter === 'string') return filter;
    if (filter.values) return filter.values.length ? filter.values.join(', ') : 'No values selected';
    if (filter.text) return 'Contains “' + filter.text + '”';
    if (filter.op === 'blank' || filter.op === 'notblank') return FINAL_OPERATORS[filter.op];
    if (filter.op === 'between') return filter.value + ' – ' + filter.upper;
    return ({gte:'≥',gt:'>',lte:'≤',lt:'<',eq:'='}[filter.op] || '') + ' ' + filter.value;
}
function finalHeader() {
    const filters = finalScoreFilters[finalDriveCurrent] || {};
    return '<thead><tr>' + FINAL_COLUMNS.map(([key, label]) => `<th scope="col"><button type="button" class="final-header-filter ${filters[key] ? 'is-filtered' : ''}" aria-label="Filter ${esc(label)}" aria-haspopup="dialog" aria-expanded="false" onclick="openFinalColumnFilter('${key}',this)"><span>${esc(label)}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12L9.5 8v4l-3 1V8z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button></th>`).join('') + '</tr></thead>';
}
function finalFilterOutside(event) {
    if (!event.target.closest('#final-column-filter, .final-header-filter')) closeFinalColumnFilter();
}
function closeFinalColumnFilter() {
    document.removeEventListener?.('pointerdown', finalFilterOutside);
    modal.removeEventListener?.('close', closeFinalColumnFilter);
    document.querySelector('#final-column-filter')?.remove();
    document.querySelectorAll('.final-header-filter[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
}
function finalFilterInputMode() {
    const op = document.querySelector('#final-filter-operator').value;
    const noValue = op === 'blank' || op === 'notblank';
    document.querySelector('#final-filter-number-field').hidden = noValue;
    document.querySelector('#final-filter-number').required = !noValue;
    document.querySelector('#final-filter-upper-field').hidden = op !== 'between';
    document.querySelector('#final-filter-upper').required = op === 'between';
}
function openFinalColumnFilter(key, button, scope = 'final') {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    closeFinalColumnFilter();
    if (wasOpen) return;
    const columns = scope === 'aptitude' ? APTITUDE_REVIEW_COLUMNS : FINAL_COLUMNS;
    const numeric = scope === 'aptitude' ? APTITUDE_REVIEW_NUMBERS.has(key) : FINAL_NUMBER_KEYS.has(key);
    const setFilter = scope === 'aptitude' ? 'setAptitudeReviewFilter' : 'setFinalScoreFilter';
    const label = columns.find(column => column[0] === key)?.[1];
    if (!label) return;
    const filter = (scope === 'aptitude' ? aptitudeReviewFilters[key] : finalScoreFilters[finalDriveCurrent]?.[key]) || {};
    const panel = document.createElement('section');
    panel.id = 'final-column-filter';
    panel.className = 'final-column-filter';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Filter ' + label);
    let fields;
    if (numeric) {
        fields = `<label for="final-filter-operator">Number filter</label><select id="final-filter-operator" onchange="finalFilterInputMode()">${Object.entries(FINAL_OPERATORS).map(([op, name]) => `<option value="${op}" ${(filter.op || 'gte') === op ? 'selected' : ''}>${name}</option>`).join('')}</select><div id="final-filter-number-field"><label for="final-filter-number">${key === 'minutes' ? 'Minutes' : 'Score'}</label><input id="final-filter-number" type="number" step="any" required placeholder="${key === 'minutes' ? 'Enter minutes' : 'Enter score'}" value="${esc(filter.value ?? '')}"></div><div id="final-filter-upper-field" hidden><label for="final-filter-upper">${key === 'minutes' ? 'Maximum minutes' : 'Maximum score'}</label><input id="final-filter-upper" type="number" step="any" value="${esc(filter.upper ?? '')}"></div>`;
    } else if (['name','studentId','gdEvaluator','interviewRemarks','interviewer'].includes(key)) {
        fields = `<label for="final-filter-text">Contains</label><input id="final-filter-text" type="search" placeholder="Search ${esc(label.toLowerCase())}" value="${esc(filter.text || '')}">`;
    } else {
        const choices = key === 'outcome' ? ['None', 'Selected', 'On hold', 'Rejected'] : ['Yes', 'No'];
        const selected = filter.values || choices;
        fields = '<div class="final-filter-values">' + choices.map(value => `<label><input type="checkbox" name="final-filter-value" value="${esc(value)}" ${selected.includes(value) ? 'checked' : ''}>${esc(value)}</label>`).join('') + '</div>';
    }
    panel.innerHTML = `<div class="final-filter-heading"><strong>${esc(label)}</strong><button type="button" class="quiet small" aria-label="Close filter" onclick="closeFinalColumnFilter()">✕</button></div><form id="final-column-filter-form">${fields}<p id="final-filter-error" class="inline-error" role="alert"></p><div class="final-filter-actions"><button type="button" class="small" onclick="${setFilter}('${key}',null)">Clear</button><button type="submit" class="primary small">Apply filter</button></div></form>`;
    modal.appendChild(panel);
    document.addEventListener('pointerdown', finalFilterOutside);
    modal.addEventListener('close', closeFinalColumnFilter);
    panel.onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeFinalColumnFilter(); button.focus(); } };
    button.setAttribute('aria-expanded', 'true');
    const anchor = button.getBoundingClientRect(), bounds = modal.getBoundingClientRect();
    const width = Math.min(290, bounds.width - 24);
    panel.style.width = width + 'px';
    panel.style.left = Math.max(12, Math.min(anchor.left - bounds.left, bounds.width - width - 12)) + 'px';
    panel.style.top = Math.max(12, Math.min(anchor.bottom - bounds.top + 6, bounds.height - panel.offsetHeight - 12)) + 'px';
    if (numeric) finalFilterInputMode();
    panel.querySelector('form').onsubmit = event => {
        event.preventDefault();
        let value;
        if (numeric) {
            const op = document.querySelector('#final-filter-operator').value;
            const number = document.querySelector('#final-filter-number').value;
            const upper = document.querySelector('#final-filter-upper').value;
            if (!['blank','notblank'].includes(op) && (number.trim() === '' || !Number.isFinite(Number(number)) || op === 'between' && (upper.trim() === '' || !Number.isFinite(Number(upper)) || Number(upper) < Number(number)))) {
                document.querySelector('#final-filter-error').textContent = 'Enter a valid score range. The maximum must be at least the minimum.';
                return;
            }
            value = {op, value: number, upper};
        } else if (['name','studentId','gdEvaluator','interviewRemarks','interviewer'].includes(key)) {
            const text = document.querySelector('#final-filter-text').value.trim();
            value = text ? {text} : null;
        } else {
            const options = [...panel.querySelectorAll('input[name="final-filter-value"]')];
            const selected = options.filter(input => input.checked).map(input => input.value);
            value = selected.length === options.length ? null : {values: selected};
        }
        if (scope === 'aptitude') setAptitudeReviewFilter(key, value); else setFinalScoreFilter(key, value);
    };
    panel.querySelector('input,select')?.focus();
}
function finalTable(rows, driveId) {
    const visible = finalRowsFiltered(rows), filters = finalScoreFilters[driveId] || {};
    const chips = FINAL_COLUMNS.filter(([key]) => filters[key]).map(([key, label]) => `<button class="final-filter-chip" onclick="setFinalScoreFilter('${key}',null)" aria-label="Remove ${esc(label)} filter">${esc(label)}: <b>${esc(finalFilterDescription(key, filters[key]))}</b><span aria-hidden="true">×</span></button>`).join('');
    const body = visible.map(row => {
        const student = encodeURIComponent(row.studentId).replace(/'/g, '%27');
        const status = ['none','selected','on-hold','rejected'].includes(row.outcome) ? row.outcome : 'none';
        const draft = finalInterviewDrafts[row.studentId.normalize('NFKC').toLowerCase()] || {value:row.interviewShortlisted,remarks:row.interviewRemarks};
        return `<tr><td class="final-candidate-name">${esc(row.name)}</td><td class="final-student-id">${esc(row.studentId)}</td><td class="final-number">${finalScoreCell(row.aptitude)}</td><td>${finalBooleanBadge(row.aptitude?.attempt.shortlisted)}</td><td class="final-number">${row.gdScore ?? '—'}</td><td>${finalBooleanBadge(row.gdRecommended)}</td><td>${esc(row.gdEvaluator)}</td><td class="final-number">${finalScoreCell(row.language)}</td><td><select class="final-status-select" aria-label="Interview shortlisted for ${esc(row.name)}" onchange="draftFinalInterview('${student}','value',this.value==='yes')"><option value="no" ${!draft.value?'selected':''}>No</option><option value="yes" ${draft.value?'selected':''}>Yes</option></select></td><td class="interview-remarks"><textarea maxlength="2000" aria-label="Interview shortlist remarks for ${esc(row.name)}" placeholder="Required for manual shortlist" oninput="draftFinalInterview('${student}','remarks',this.value)">${esc(draft.remarks)}</textarea><button class="small" onclick="saveManualInterview('${driveId}','${student}',this)">Save</button></td><td><label class="final-prompt-score"><input aria-label="Prompt Engineering score for ${esc(row.name)}" type="number" min="0" max="10" step="0.5" value="${row.promptScore ?? ''}" onchange="savePromptScoreForDrive('${driveId}','${student}',this.value)"><span>/ 10</span></label></td><td><input class="interviewer-input" maxlength="100" aria-label="Interviewer for ${esc(row.name)}" value="${esc(row.interviewer)}" onchange="saveInterviewer('${driveId}','${student}',this.value)"></td><td><select class="final-status-select outcome-${status}" aria-label="Final status for ${esc(row.name)}" onchange="saveFinalDecision('${driveId}','${student}',this.value)">${Object.entries({none:'None',selected:'Selected','on-hold':'On hold',rejected:'Rejected'}).map(([value,label])=>`<option value="${value}" ${status===value?'selected':''}>${label}</option>`).join('')}</select></td></tr>`;
    }).join('');
    return `<div class="final-score-toolbar"><span class="sub"><strong>${visible.length}</strong> of ${rows.length} candidates shown</span><div class="row"><button class="primary small" onclick="shortlistFilteredFinal()" ${visible.length ? '' : 'disabled'}>Shortlist filtered for interview</button><button class="small" onclick="revertFilteredFinal()" ${visible.length ? '' : 'disabled'}>Revert interview shortlist</button><button class="small" onclick="clearFinalScoreFilters()">Clear filters</button><button class="small" onclick="exportFinalScores()" ${visible.length ? '' : 'disabled'}>↓ Export shown to Excel</button></div></div>${chips ? '<div class="final-active-filters">'+chips+'</div>' : ''}<div class="results-scroll" onscroll="closeFinalColumnFilter()"><table class="final-scores-table">${finalHeader()}<tbody>${body || '<tr><td colspan="'+FINAL_COLUMNS.length+'" class="results-empty">No candidates match these filters.</td></tr>'}</tbody></table></div>`;
}
function finalBooleanBadge(value) { return '<span class="final-boolean '+(value?'is-yes':'is-no')+'">'+(value?'Yes':'No')+'</span>'; }
function setFinalScoreFilter(key, value) {
    const filters = finalScoreFilters[finalDriveCurrent] ||= {};
    if (value) filters[key] = value; else delete filters[key];
    rerenderFinalTable();
}
function clearFinalScoreFilters() { finalScoreFilters[finalDriveCurrent]={};rerenderFinalTable(); }
function rerenderFinalTable() { closeFinalColumnFilter(); let d=state.drives.find(x=>x.id===finalDriveCurrent),rows=combinedDriveScores(finalDriveCurrent),el=document.querySelector('#final-score-content');if(d&&el)el.innerHTML=finalTable(rows,d.id); }
async function savePromptScoreForDrive(driveId,encodedStudentId,value) { let studentId=decodeURIComponent(encodedStudentId),test=state.sessions.find(x=>x.driveId===driveId&&x.type==='prompt'),attempt=test?.attempts.filter(a=>a.studentId.normalize('NFKC').toLowerCase()===studentId.normalize('NFKC').toLowerCase()).sort((a,b)=>(b.startedAt||0)-(a.startedAt||0))[0];if(!attempt)return toast('No Prompt Engineering response found for this candidate.');await savePromptScore(test.id,attempt.id,value);rerenderFinalTable(); }
async function saveFinalDecision(driveId,encodedStudentId,outcome) { try { let studentId=decodeURIComponent(encodedStudentId);await api('/api/admin/drives/'+driveId+'/candidate-decision','POST',{studentId,outcome});let d=state.drives.find(x=>x.id===driveId);d.finalDecisions||={};let entry=d.finalDecisions[studentId.normalize('NFKC').toLowerCase()]||={};entry.outcome=outcome==='none'?null:outcome;rerenderFinalTable(); }catch(e){handleError(e);} }
async function shortlistFilteredFinal() { try { if(!await flushFinalInterviewDrafts())return; } catch(e){return handleError(e);} let id=finalDriveCurrent,rows=finalRowsFiltered(combinedDriveScores(id));if(!rows.length)return toast('No candidates match the current filters.');try{let result=await api('/api/admin/drives/'+id+'/final-shortlist','POST',{studentIds:rows.map(r=>r.studentId),value:true}),d=state.drives.find(x=>x.id===id);d.finalDecisions||={};rows.forEach(r=>{let entry=d.finalDecisions[r.studentId.normalize('NFKC').toLowerCase()]||={};entry.interviewShortlisted=true;entry.interviewRemarks='';entry.interviewManual=false;});rerenderFinalTable();toast(result.changed+' candidates shortlisted for interview.');}catch(e){handleError(e);} }
async function revertFilteredFinal() { try { if(!await flushFinalInterviewDrafts())return; } catch(e){return handleError(e);} let id=finalDriveCurrent,rows=finalRowsFiltered(combinedDriveScores(id));if(!rows.length)return toast('No candidates match the current filters.');try{let result=await api('/api/admin/drives/'+id+'/final-shortlist','POST',{studentIds:rows.map(r=>r.studentId),value:false}),d=state.drives.find(x=>x.id===id);rows.forEach(r=>{let entry=d.finalDecisions?.[r.studentId.normalize('NFKC').toLowerCase()];if(entry){entry.interviewShortlisted=false;entry.interviewRemarks='';entry.interviewManual=false;}});rerenderFinalTable();toast(result.changed+' interview shortlist statuses reverted.');}catch(e){handleError(e);} }
async function exportFinalScores() { try { if(!await flushFinalInterviewDrafts())return; } catch(e){return handleError(e);} let rows=finalRowsFiltered(combinedDriveScores(finalDriveCurrent));if(!rows.length)return toast('No candidates match the current filters.');postDownload('/api/admin/drives/'+finalDriveCurrent+'/final/export',{studentIds:rows.map(r=>r.studentId)},'final-scores.xlsx');}
async function showFinalScores(driveId) { stopGdRefresh();try{await reloadAdmin();let d=state.drives.find(x=>x.id===driveId);if(!d)return toast('Drive not found.');finalDriveCurrent=driveId;finalScoreFilters[driveId]={aptitudeShortlisted:{values:['Yes']}};finalInterviewDrafts={};let rows=combinedDriveScores(driveId);modal.className='results-dialog final-scores-dialog';modal.innerHTML='<header class="results-header"><div class="row between"><h2>Final scores · '+esc(d.name)+'</h2><button class="quiet" onclick="modal.close()" aria-label="Close final scores">✕</button></div></header><div id="final-score-content">'+finalTable(rows,driveId)+'</div><footer class="results-footer"><span class="sub">'+rows.length+' candidates · Prompt Engineering scores can also be entered in Prompt Engineering responses.</span></footer>';if(!modal.open)modal.showModal();}catch(e){handleError(e);} }

function exportGd(id, mode) {
    serverDownload('/api/admin/drives/' + id + '/gd/export?mode=' + mode, 'gd-' + mode + '.xlsx');
}
let finalInterviewDrafts = {};
function draftFinalInterview(encodedId, field, value) {
    const studentId = decodeURIComponent(encodedId), key = studentId.normalize('NFKC').toLowerCase();
    const row = combinedDriveScores(finalDriveCurrent).find(r => r.studentId.normalize('NFKC').toLowerCase() === key);
    if (!row) return;
    const draft = finalInterviewDrafts[key] ||= {value:row.interviewShortlisted, remarks:row.interviewRemarks || ''};
    draft[field] = value;
}
async function saveManualInterview(driveId, encodedId, button) {
    const studentId = decodeURIComponent(encodedId), key = studentId.normalize('NFKC').toLowerCase(), draft = finalInterviewDrafts[key];
    if (!draft) return toast('No interview shortlist changes to save.');
    if (draft.value && !draft.remarks.trim()) return toast('Enter remarks explaining the manual interview shortlist.');
    button.disabled = true;
    try {
        const result = await api('/api/admin/drives/' + driveId + '/candidate-decision', 'POST', {studentId, interviewShortlisted:draft.value, interviewRemarks:draft.remarks});
        const drive = state.drives.find(d => d.id === driveId);
        drive.finalDecisions ||= {};
        drive.finalDecisions[key] = result.decision;
        delete finalInterviewDrafts[key];
        rerenderFinalTable();
        toast('Interview shortlist saved.');
    } catch(e) { handleError(e); button.disabled = false; }
}
async function saveInterviewer(driveId, encodedId, interviewer) {
    const studentId = decodeURIComponent(encodedId), key = studentId.normalize('NFKC').toLowerCase();
    try {
        const result = await api('/api/admin/drives/' + driveId + '/candidate-decision', 'POST', {studentId,interviewer});
        const drive = state.drives.find(d => d.id === driveId);
        drive.finalDecisions ||= {};
        drive.finalDecisions[key] = result.decision;
        toast('Interviewer saved.');
    } catch(e) { handleError(e); }
}

const APTITUDE_REVIEW_COLUMNS = [['name','Student name'],['studentId','Student ID'],['marks','Marks obtained'],['minutes','Time taken (minutes)'],['aptitudeShortlisted','Aptitude shortlisted']];
const APTITUDE_REVIEW_NUMBERS = new Set(['marks','minutes']);
let aptitudeReviewId = '', aptitudeReviewFilters = {}, aptitudeReviewDrafts = {};
function aptitudeReviewRows() {
    const test = state.sessions.find(s => s.id === aptitudeReviewId);
    return (test?.attempts || []).map(a => ({a, name:a.name, studentId:a.studentId, marks:a.submittedAt ? gradeAttempt(test,a).total : null, minutes:elapsedMinutes(a), aptitudeShortlisted:a.shortlisted?'Yes':'No', grading:gradeAttempt(test,a)})).filter(row => APTITUDE_REVIEW_COLUMNS.every(([key]) => {
        const filter = aptitudeReviewFilters[key], value = row[key];
        if (!filter) return true;
        if (filter.values) return filter.values.includes(value);
        if (APTITUDE_REVIEW_NUMBERS.has(key)) {
            const present = Number.isFinite(value);
            if (filter.op === 'blank') return !present;
            if (filter.op === 'notblank') return present;
            if (!present) return false;
            const n = Number(filter.value);
            return ({gte:()=>value>=n,gt:()=>value>n,lte:()=>value<=n,lt:()=>value<n,eq:()=>value===n,between:()=>value>=n&&value<=Number(filter.upper)}[filter.op] || (()=>false))();
        }
        return String(value).toLocaleLowerCase().includes((filter.text || '').toLocaleLowerCase());
    }));
}
async function openAptitudeReview(id) {
    try {
        stopGdRefresh(); await reloadAdmin();
        aptitudeReviewId = id; aptitudeReviewFilters = {}; aptitudeReviewDrafts = {};
        modal.className = 'results-dialog aptitude-review-dialog';
        modal.innerHTML = '<header class="results-header"><div class="row between"><div><h2>Aptitude · Candidate responses</h2><p class="sub">Review question marks. A manual shortlist requires remarks and is saved only with Save updates.</p></div><div class="row"><button class="primary small" id="save-aptitude-review" onclick="saveAptitudeReview()" disabled>Save updates</button><button class="small" onclick="closeAptitudeReview()">Back to responses</button></div></div><p id="aptitude-review-validation" class="inline-error" role="alert"></p></header><div class="final-score-toolbar"><span id="aptitude-review-count" class="sub"></span><button class="small" onclick="aptitudeReviewFilters={};renderAptitudeReview()">Clear filters</button></div><div class="results-scroll" id="aptitude-review-content" onscroll="closeFinalColumnFilter()"></div>';
        renderAptitudeReview(); if (!modal.open) modal.showModal();
    } catch(e) { handleError(e); }
}
function renderAptitudeReview() {
    closeFinalColumnFilter();
    const test = state.sessions.find(s => s.id === aptitudeReviewId), rows = aptitudeReviewRows();
    const headers = APTITUDE_REVIEW_COLUMNS.map(([key,label]) => '<th><button class="final-header-filter '+(aptitudeReviewFilters[key]?'is-filtered':'')+'" aria-haspopup="dialog" aria-label="Filter '+esc(label)+'" onclick="openFinalColumnFilter(\''+key+'\',this,\'aptitude\')"><span>'+esc(label)+'</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12L9.5 8v4l-3 1V8z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button></th>').join('') + test.questions.map((q,i)=>'<th class="aptitude-question-heading"><span>Q'+(i+1)+'</span><div>'+esc(q.text)+'</div></th>').join('') + '<th>Manual shortlist</th><th>Remarks</th>';
    const body = rows.map(row => {
        const a=row.a, draft=aptitudeReviewDrafts[a.id] || {shortlisted:!!a.manualShortlisted,remarks:a.shortlistRemarks||''};
        const editable=!!a.submittedAt&&!row.grading.pending, marks=new Map(row.grading.results.map(r=>[r.id,r.score]));
        return '<tr><td>'+esc(row.name)+'</td><td>'+esc(row.studentId)+'</td><td>'+ (row.marks??'—')+'</td><td>'+(row.minutes==null?'—':row.minutes.toFixed(2))+'</td><td>'+row.aptitudeShortlisted+'</td>'+test.questions.map(q=>'<td class="final-number">'+(a.submittedAt?marks.get(q.id)??'—':'—')+'</td>').join('')+'<td><label class="shortlist-check"><input type="checkbox" '+(draft.shortlisted?'checked':'')+' '+(!editable?'disabled':'')+' onchange="draftAptitudeReview(\''+a.id+'\',\'shortlisted\',this.checked)"> Shortlist</label></td><td><textarea class="aptitude-review-remarks" maxlength="2000" aria-label="Manual shortlist remarks for '+esc(a.name)+'" '+(!editable?'disabled':'')+' oninput="draftAptitudeReview(\''+a.id+'\',\'remarks\',this.value)">'+esc(draft.remarks)+'</textarea></td></tr>';
    }).join('');
    document.querySelector('#aptitude-review-count').textContent = rows.length + ' of ' + test.attempts.length + ' candidates';
    document.querySelector('#aptitude-review-content').innerHTML='<table class="aptitude-review-table"><thead><tr>'+headers+'</tr></thead><tbody>'+(body||'<tr><td colspan="'+(test.questions.length+7)+'" class="results-empty">No candidates match these filters.</td></tr>')+'</tbody></table>';
    validateAptitudeReview();
}
function setAptitudeReviewFilter(key, filter) {
    if(filter) aptitudeReviewFilters[key]=filter; else delete aptitudeReviewFilters[key];
    renderAptitudeReview();
}
function draftAptitudeReview(id, field, value) {
    const test=state.sessions.find(s=>s.id===aptitudeReviewId), a=test.attempts.find(a=>a.id===id);
    const draft=aptitudeReviewDrafts[id] ||= {shortlisted:!!a.manualShortlisted,remarks:a.shortlistRemarks||''};
    draft[field]=value; validateAptitudeReview();
}
function validateAptitudeReview() {
    const drafts=Object.values(aptitudeReviewDrafts);
    const invalid=drafts.some(d=>d.shortlisted&&!d.remarks.trim());
    const button=document.querySelector('#save-aptitude-review');
    if(button)button.disabled=!drafts.length||invalid;
    const error=document.querySelector('#aptitude-review-validation');
    if(error)error.textContent=invalid?'Enter remarks for every manually shortlisted candidate before saving.':'';
    return !invalid;
}
async function saveAptitudeReview() {
    if(!validateAptitudeReview())return;
    const changes=Object.entries(aptitudeReviewDrafts).map(([attemptId,d])=>({attemptId,...d}));
    if(!changes.length)return;
    const button=document.querySelector('#save-aptitude-review'); button.disabled=true;
    try {
        await api('/api/admin/tests/'+aptitudeReviewId+'/manual-shortlist','POST',{changes});
        aptitudeReviewDrafts={}; await reloadAdmin(); renderAptitudeReview(); toast('Manual shortlist updates saved.');
    } catch(e) { handleError(e); validateAptitudeReview(); }
}
function closeAptitudeReview() {
    if(Object.keys(aptitudeReviewDrafts).length&&!confirm('Discard unsaved manual shortlist changes?'))return;
    closeFinalColumnFilter(); aptitudeReviewDrafts={}; openResultsTable(aptitudeReviewId);
}
modal.addEventListener?.('cancel',event=>{
    if(modal.classList.contains('aptitude-review-dialog')&&Object.keys(aptitudeReviewDrafts).length&&!confirm('Discard unsaved manual shortlist changes?'))event.preventDefault();
});

async function flushFinalInterviewDrafts() {
    const entries = Object.entries(finalInterviewDrafts);
    if (entries.some(([,d])=>d.value&&!d.remarks.trim())) {
        toast('Save a remark for every manual interview shortlist before continuing.');
        return false;
    }
    const drive = state.drives.find(d=>d.id===finalDriveCurrent);
    for (const [key,draft] of entries) {
        const row=combinedDriveScores(finalDriveCurrent).find(r=>r.studentId.normalize('NFKC').toLowerCase()===key);
        if(!row)continue;
        const result=await api('/api/admin/drives/'+finalDriveCurrent+'/candidate-decision','POST',{studentId:row.studentId,interviewShortlisted:draft.value,interviewRemarks:draft.remarks});
        drive.finalDecisions ||= {};
        drive.finalDecisions[key]=result.decision;
        delete finalInterviewDrafts[key];
    }
    if(entries.length)rerenderFinalTable();
    return true;
}
