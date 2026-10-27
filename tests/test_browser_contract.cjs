// UI-to-API contract checks; no browser-specific automation or real candidate data.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const script=fs.readFileSync('static/app.js','utf8');
assert(!script.includes('localStorage'));
assert(!script.includes('IMPORTED_QUESTIONS'));
assert(!script.includes('DEFAULT_QUESTION='));
const elements=new Map();
const node=()=>({innerHTML:'',textContent:'',value:'',style:{},hidden:true,className:'',open:false,scrollTop:0,
 classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true},close(){this.open=false},querySelector(){return {disabled:false}}});
const document={querySelector(s){if(!elements.has(s))elements.set(s,node());return elements.get(s)},querySelectorAll(){return[]}};
const initial={drives:[],sessions:[],questionSets:{aptitude:[],language:[],prompt:[]}};
let saved=structuredClone(initial),revision=0;
const fetch=async(path,options={})=>{
 let body=options.body?JSON.parse(options.body):null,data;
 if(path==='/api/auth/session')data={admin:true,csrf:'csrf-test'};
 else if(path==='/api/admin/state'&&options.method==='PUT'){assert.equal(body.revision,revision);saved=body.state;revision++;data={state:structuredClone(saved),revision}}
 else if(path==='/api/admin/state')data={state:structuredClone(saved),revision};
 else throw Error('Unexpected request '+path);
 return {ok:true,json:async()=>data};
};
const context=vm.createContext({document,fetch,crypto:crypto.webcrypto,location:{pathname:'/',origin:'https://test.example'},history:{replaceState(){}},window:{addEventListener(){},open(){}},setInterval(){},setTimeout(){},clearTimeout(){},navigator:{},console,Date,Math,URLSearchParams,confirm(){return true}});
const run=code=>vm.runInContext(code,context);
(async()=>{
 run(script);await run('bootstrap()');
 assert(document.querySelector('#app').innerHTML.includes('Session scheduler'));
 assert(!document.querySelector('#app').innerHTML.includes("nav('dashboard')"));
 run('startDrive()');document.querySelector('#driveName').value='Synthetic College';
 document.querySelector('#driveForm').onsubmit({preventDefault(){}});
 await run('flushAdmin()');assert.equal(saved.drives.length,1);
 assert.equal(saved.drives[0].name,'Synthetic College');
 assert.match(saved.drives[0].id,/^[0-9a-f-]{36}$/);
 run("view='candidate';state.sessions=[{id:'c1',type:'aptitude',name:'Synthetic test',questionCount:1,questions:[],attempts:[],closedAt:null}];candidateSession='c1';currentAttempt=null;render()");
 assert(document.querySelector('#app').innerHTML.includes('15 minutes'));
 assert.equal(typeof document.querySelector('#entryForm').onsubmit,'function');
 document.querySelector('#candidateName').value=' Synthetic Candidate ';
 document.querySelector('#studentId').value=' 0001 ';
 run('startCandidate({preventDefault(){}})');
 assert(document.querySelector('#modal').innerHTML.includes('Confirm your details'));
 assert(document.querySelector('#modal').innerHTML.includes('Synthetic Candidate'));
 assert(document.querySelector('#modal').innerHTML.includes('0001'));
 assert.equal(run('currentAttempt'),null); // No start request or timer until confirmation.
 document.querySelector('#editCandidateDetails').onclick();
 assert.equal(document.querySelector('#modal').open,false);
 assert.equal(document.querySelector('#studentId').value,' 0001 ');
 run("state.sessions[0].questions=[{id:'q1',type:'single',text:'Synthetic question',options:['A','B'],correctScore:1,wrongScore:0}];state.sessions[0].attempts=[{id:'a1',responses:{q1:[1]},deadline:Date.now()+900000,sequence:4,submittedAt:null,name:'Synthetic Candidate',studentId:'0001'}];currentAttempt='a1';render();confirmSubmit()");
 assert(document.querySelector('#modal').innerHTML.includes('Answered · 1 question'));
 assert(document.querySelector('#modal').innerHTML.includes('data-clock='));
 run("absorbCandidate({test:{id:'c1',type:'aptitude',questions:state.sessions[0].questions,attempts:[{id:'a1',responses:{q1:[0]},sequence:3,submittedAt:null}]}})");
 assert.equal(run('currentQuiz().a.sequence'),4);
 assert.equal(run('currentQuiz().a.responses.q1[0]'),1);
 run("view='sessions';responseSession='c1';openResultsTable('c1')");
 assert(document.querySelector('#modal').innerHTML.includes('Min marks (out of 30)'));
 assert(document.querySelector('#modal').innerHTML.includes('Min time (minutes) (out of 15)'));
 assert(document.querySelector('#modal').innerHTML.includes('Revert shortlisting'));
 assert(!document.querySelector('#responseTable').innerHTML.includes('shortlist-check'));
 run("state.sessions[0].type='language';openResultsTable('c1')");
 assert(document.querySelector('#modal').innerHTML.includes('Min marks (out of 25)'));
 assert(document.querySelector('#modal').innerHTML.includes('Min time (minutes) (out of 20)'));
 const resultsHtml=document.querySelector('#modal').innerHTML;
 assert(resultsHtml.indexOf('Shortlist filtered candidates') < resultsHtml.indexOf('results-scroll'));
 assert(!resultsHtml.slice(resultsHtml.indexOf('results-footer')).includes('Revert shortlisting'));
 run(`state.drives=[{id:'d1',name:'College 2026'},{id:'d2',name:'Other college'}];
 state.sessions=[
 {id:'s1',driveId:'d1',type:'aptitude',questions:[],attempts:[{id:'a1',name:'Candidate',studentId:'ID1',startedAt:1,submittedAt:2,shortlisted:true}]},
 {id:'s2',driveId:'d1',type:'language',questions:[],attempts:[{id:'a2',name:'Candidate',studentId:'id1',startedAt:3,submittedAt:4,shortlisted:false}]},
 {id:'s3',driveId:'d2',type:'aptitude',questions:[],attempts:[{id:'a3',name:'Other',studentId:'ID1',startedAt:9}]},
 {id:'s4',driveId:'d1',type:'language',questions:[],attempts:[{id:'a4',name:'Candidate',studentId:'ID1',startedAt:5,submittedAt:6,shortlisted:true}]}];
 view='final';renderAdmin();`);
 assert(document.querySelector('#app').innerHTML.includes('Final scores'));
 assert.equal(run("combinedDriveScores('d1').length"),1);
 assert.equal(run("combinedDriveScores('d1')[0].aptitude.attempt.id"),'a1');
 assert.equal(run("combinedDriveScores('d1')[0].language.attempt.id"),'a4');
 assert.equal(run("finalScoreCell(undefined)"),'—');
 run("finalDriveFilter='College 2026';updateFinalDriveList()");
 assert(!document.querySelector('#finalDriveList').innerHTML.includes('Other college'));
 console.log('PASS: production UI boots, persists admin changes through API, uses opaque links, starts candidates through server adapter, shows confirmation, and rejects stale polling updates.');
})().catch(e=>{console.error(e);process.exitCode=1});
