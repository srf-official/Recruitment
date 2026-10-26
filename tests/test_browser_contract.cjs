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
 run("state.sessions[0].questions=[{id:'q1',type:'single',text:'Synthetic question',options:['A','B'],correctScore:1,wrongScore:0}];state.sessions[0].attempts=[{id:'a1',responses:{q1:[1]},deadline:Date.now()+900000,sequence:4,submittedAt:null,name:'Synthetic Candidate',studentId:'0001'}];currentAttempt='a1';render();confirmSubmit()");
 assert(document.querySelector('#modal').innerHTML.includes('Answered · 1 question'));
 assert(document.querySelector('#modal').innerHTML.includes('data-clock='));
 run("absorbCandidate({test:{id:'c1',type:'aptitude',questions:state.sessions[0].questions,attempts:[{id:'a1',responses:{q1:[0]},sequence:3,submittedAt:null}]}})");
 assert.equal(run('currentQuiz().a.sequence'),4);
 assert.equal(run('currentQuiz().a.responses.q1[0]'),1);
 console.log('PASS: production UI boots, persists admin changes through API, uses opaque links, starts candidates through server adapter, shows confirmation, and rejects stale polling updates.');
})().catch(e=>{console.error(e);process.exitCode=1});
