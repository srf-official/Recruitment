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
 assert(document.querySelector('#score-distribution').innerHTML.includes('Score distribution'));
 assert(document.querySelector('#modal').innerHTML.includes('Shortlist filtered candidates'));
 assert(document.querySelector('#responseTable').innerHTML.includes('Shortlisted'));
 assert(!document.querySelector('#app').innerHTML.includes('Recruitment team'));
 const chartHtml=run("scoreDistribution({type:'language',attempts:[{submittedAt:1,importedScore:9},{submittedAt:1,importedScore:16},{submittedAt:1,importedScore:17}]})");
 assert(chartHtml.includes('33%'));
 assert(chartHtml.includes('&lt;10') || chartHtml.includes('<10'));

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
 assert.equal(run("gdSource('d1').type"),'language');
 assert.equal(run("gdShortlistedRoster('d1').length"),1);

 assert.equal(run("combinedDriveScores('d1')[0].aptitude.attempt.id"),'a1');
 assert.equal(run("combinedDriveScores('d1')[0].language.attempt.id"),'a4');
 assert.equal(run("finalScoreCell(undefined)"),'—');
 run("finalDriveFilter='College 2026';updateFinalDriveList()");
 assert(!document.querySelector('#finalDriveList').innerHTML.includes('Other college'));

 // Final-score filters combine status and inclusive numeric conditions.
 run(`finalDriveCurrent='d1';finalScoreFilters={d1:{aptitudeShortlisted:{values:['Yes']},gdScore:{op:'gte',value:'10.5'},languageScore:{op:'gte',value:'15'}}};
 globalThis.filterRows=[
 {name:'Included',studentId:'1',aptitude:{attempt:{shortlisted:true}},gdScore:10.5,languageScore:15},
 {name:'Higher',studentId:'2',aptitude:{attempt:{shortlisted:true}},gdScore:12,languageScore:18},
 {name:'Low GD',studentId:'3',aptitude:{attempt:{shortlisted:true}},gdScore:10,languageScore:18},
 {name:'Low language',studentId:'4',aptitude:{attempt:{shortlisted:true}},gdScore:12,languageScore:14.5},
 {name:'Not shortlisted',studentId:'5',aptitude:{attempt:{shortlisted:false}},gdScore:20,languageScore:25},
 {name:'Missing score',studentId:'6',aptitude:{attempt:{shortlisted:true}},gdScore:null,languageScore:20},
 {name:'Zero',studentId:'7',aptitude:{attempt:{shortlisted:true}},gdScore:0,languageScore:0}
 ];`);
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'1,2');
 run("finalScoreFilters.d1={gdScore:{op:'gte',value:'0'}}");
 assert.equal(run("finalRowsFiltered(filterRows).some(r=>r.studentId==='7')"),true);
 assert.equal(run("finalRowsFiltered(filterRows).some(r=>r.studentId==='6')"),false);
 run("finalScoreFilters.d1={gdScore:{op:'between',value:'10.5',upper:'12'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'1,2,4');
 run("finalScoreFilters.d1={gdScore:{op:'gt',value:'12'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'5');
 run("finalScoreFilters.d1={gdScore:{op:'lte',value:'10.5'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'1,3,7');
 run("finalScoreFilters.d1={gdScore:{op:'lt',value:'10.5'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'3,7');
 run("finalScoreFilters.d1={gdScore:{op:'eq',value:'10.5'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'1');
 run("finalScoreFilters.d1={gdScore:{op:'blank'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'6');
 run("finalScoreFilters.d1={gdScore:{op:'notblank'},name:{text:'HIGHER'}}");
 assert.equal(run("finalRowsFiltered(filterRows).map(r=>r.studentId).join(',')"),'2');
 run("finalScoreFilters.d1={aptitudeShortlisted:{values:[]}}");
 assert.equal(run("finalRowsFiltered(filterRows).length"),0);
 const emptyTable=run("finalTable(filterRows,'d1')");
 assert(emptyTable.includes('No candidates match these filters.'));
 assert(emptyTable.endsWith('</tbody></table></div>'));
 assert(run("FINAL_COLUMNS.findIndex(c=>c[0]==='interviewShortlisted') < FINAL_COLUMNS.findIndex(c=>c[0]==='promptScore')"));
 assert(!run("finalHeader()").includes('<select'));
 assert(run("finalHeader()").includes('aria-haspopup="dialog"'));
 // Export and bulk shortlist resolve the same filtered candidate IDs.
 let finalRequest;
 context.fetch=async(path,options={})=>{
   finalRequest={path,body:JSON.parse(options.body)};
   return {ok:true,json:async()=>({changed:2})};
 };
 run("state.drives=[{id:'d1',name:'Synthetic',finalDecisions:{}}];finalScoreFilters.d1={aptitudeShortlisted:{values:['Yes']},gdScore:{op:'gte',value:'10.5'},languageScore:{op:'gte',value:'15'}};combinedDriveScores=()=>filterRows;");
 await run("shortlistFilteredFinal()");
 assert.deepEqual(finalRequest.body.studentIds,['1','2']);
 assert.equal(finalRequest.body.value,true);
 run("postDownload=(path,body)=>{globalThis.lastExport={path,body}};exportFinalScores()");
 assert.equal(run("lastExport.body.studentIds.join(',')"),'1,2');
 await run("revertFilteredFinal()");
 assert.deepEqual(finalRequest.body.studentIds,['1','2']);
 assert.equal(finalRequest.body.value,false);

 console.log('PASS: production UI boots, persists admin changes through API, uses opaque links, starts candidates through server adapter, shows confirmation, and rejects stale polling updates.');
})().catch(e=>{console.error(e);process.exitCode=1});
