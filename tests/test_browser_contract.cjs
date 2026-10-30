// UI-to-API contract checks; no browser-specific automation or real candidate data.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const script=fs.readFileSync('static/app.js','utf8');
assert(!script.includes('localStorage'));
assert(!script.includes('IMPORTED_QUESTIONS'));
assert(!script.includes('DEFAULT_QUESTION='));
const elements=new Map();
const node=()=>({innerHTML:'',textContent:'',value:'',style:{},hidden:true,className:'',open:false,scrollTop:0,
 classList:{add(){},remove(){},toggle(){}},remove(){},addEventListener(){},removeEventListener(){},querySelectorAll(){return[]},setAttribute(){},matches(){return false},showPopover(){this.popoverVisible=true},hidePopover(){this.popoverVisible=false},showModal(){this.open=true},close(){this.open=false},querySelector(){return {disabled:false}}});
const document={addEventListener(){},removeEventListener(){},querySelector(s){if(!elements.has(s))elements.set(s,node());return elements.get(s)},querySelectorAll(){return[]}};
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
 assert(document.querySelector('#responseTable').innerHTML.includes('Filter Marks obtained'));
 assert(!document.querySelector('#modal').innerHTML.includes('filter-minMarks'));
 assert(document.querySelector('#modal').innerHTML.indexOf('Revert shortlisting')<document.querySelector('#modal').innerHTML.indexOf('View candidate responses'));
 assert(!document.querySelector('#modal').innerHTML.split('results-footer')[1].includes('View candidate responses'));
 assert(document.querySelector('#responseTable').innerHTML.includes('Filter Time taken (min)'));
 assert(document.querySelector('#modal').innerHTML.includes('Revert shortlisting'));
 assert(!document.querySelector('#responseTable').innerHTML.includes('shortlist-check'));
 run("state.sessions[0].type='language';openResultsTable('c1')");
 assert(document.querySelector('#responseTable').innerHTML.includes('Filter Language score (20)'));
 assert(document.querySelector('#responseTable').innerHTML.includes('Filter Reasoning score (5)'));
 assert(document.querySelector('#score-distribution').innerHTML.includes('Score distribution'));
 assert(document.querySelector('#modal').innerHTML.includes('Shortlist filtered candidates'));
 assert(document.querySelector('#responseTable').innerHTML.includes('Shortlisted'));
 assert(!document.querySelector('#app').innerHTML.includes('Recruitment team'));
 const chartHtml=run("scoreDistribution({type:'language',attempts:[{submittedAt:1,importedScore:9},{submittedAt:1,importedScore:16},{submittedAt:1,importedScore:17}]})");
 assert(chartHtml.includes('33%'));
 assert(chartHtml.includes('&lt;10') || chartHtml.includes('<10'));

 assert(!document.querySelector('#modal').innerHTML.includes('filter-minTime'));
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

 // The aptitude matrix filters marks and stages manual decisions until Save updates.
 run("globalThis.savedReloadAdmin=reloadAdmin;reloadAdmin=async()=>{};state.drives=[{id:'review-drive',name:'Review drive',gd:{pools:[{members:['review-id'],evaluatorName:'Pool Evaluator'}]}}];state.sessions=[{id:'review-test',driveId:'review-drive',type:'aptitude',questions:[{id:'hard',type:'single',text:'A difficult question?',options:['Correct','Wrong'],key:[0],correctScore:2,wrongScore:0}],attempts:[{id:'review-attempt',name:'Review Candidate',studentId:'REVIEW-ID',submittedAt:60001,startedAt:1,responses:{hard:[0]},shortlisted:false}]}]");
 await run("openAptitudeReview('review-test')");
 assert(document.querySelector('#aptitude-review-content').innerHTML.includes('A difficult question?'));
 run("draftAptitudeReview('review-attempt','shortlisted',true)");
 assert.equal(run('validateAptitudeReview()'),false);
 assert.equal(document.querySelector('#save-aptitude-review').disabled,true);
 run("draftAptitudeReview('review-attempt','remarks','Solved the hardest question.')");
 assert.equal(run('validateAptitudeReview()'),true);
 assert.equal(run("state.sessions[0].attempts[0].shortlisted"),false);
 let manualRequest;
 context.fetch=async(path,options={})=>{manualRequest={path,body:JSON.parse(options.body)};return {ok:true,json:async()=>({changed:1})};};
 await run("saveAptitudeReview()");
 assert.equal(manualRequest.body.changes[0].remarks,'Solved the hardest question.');
 assert.equal(manualRequest.body.changes[0].shortlisted,true);
 run("aptitudeReviewFilters={marks:{op:'gte',value:2},minutes:{op:'lte',value:1}}");
 assert.equal(run('aptitudeReviewRows().length'),1);
 run("aptitudeReviewFilters.marks.value=3");
 assert.equal(run('aptitudeReviewRows().length'),0);
 run("state.sessions[0].attempts[0].shortlisted=true");
 await run("showFinalScores('review-drive')");
 assert.equal(run("finalScoreFilters['review-drive'].aptitudeShortlisted.values[0]"),'Yes');
 assert(document.querySelector('#modal').innerHTML.includes('Pool Evaluator'));
 assert(document.querySelector('#modal').innerHTML.includes('Interview shortlist remarks'));
 run("finalScoreFilters['review-drive']={};rerenderFinalTable()");
 assert.equal(run("Object.keys(finalScoreFilters['review-drive']).length"),0);
 run("globalThis.partsQuestions=Array.from({length:25},(_,i)=>({id:'part-'+i}));globalThis.partsResults=partsQuestions.map((q,i)=>({id:q.id,score:i<20?1:0.5})).reverse()");
 assert.equal(run("languageScoreParts({questions:partsQuestions},{results:partsResults}).join(',')"),'20,2.5');
 run("reloadAdmin=savedReloadAdmin;finalDriveCurrent='d1';");

 // Response comparisons, front-layer alerts, report content and return navigation.
 assert.equal(run("responseNumberMatches(12,'lt','15','')"),true);
 assert.equal(run("responseNumberMatches(15,'lt','15','')"),false);
 assert.equal(run("responseNumberMatches(12,'between','10','12')"),true);
 assert.equal(run("responseNumberMatches(null,'blank','','')"),true);
 assert.equal(run("responseNumberMatches(0,'notblank','','')"),true);
 const controls=run("responseFilterControl('minMarks','Marks',true)");
 assert(controls.includes('Less than or equal to')&&controls.includes('Between'));
 assert(controls.includes('changeResponseOperator(this.dataset.filterKey,this.value)'));
 run("showCandidateInstructions({name:'Candidate',studentId:'ID'})");
 assert(!document.querySelector('#modal').innerHTML.includes('does not record tab changes'));
 assert(!document.querySelector('#modal').innerHTML.includes('administrator stop'));
 assert(document.querySelector('#modal').innerHTML.includes('all filled responses will be saved'));
 run("toast('Duplicate student ID')");
 assert.equal(document.querySelector('#toast').popoverVisible,true);
 for (const type of ['aptitude','language']) {
   const renderChoices = choices => run(`renderCandidateResponseSection(${JSON.stringify({type,hasAttempt:true,title:type,maxScore:30,score:0,questions:[{text:'Question',choices}]})})`);
   const unanswered = renderChoices([{text:'Correct',correct:true,selected:false},{text:'Wrong',correct:false,selected:false}]);
   assert(unanswered.includes('✓')&&!unanswered.includes('is-correct')&&!unanswered.includes('is-selected'));
   const correct = renderChoices([{text:'Correct',correct:true,selected:true},{text:'Wrong',correct:false,selected:false}]);
   assert(correct.includes('is-correct')&&correct.includes('is-selected'));
   const incorrect = renderChoices([{text:'Correct',correct:true,selected:false},{text:'Wrong',correct:false,selected:true}]);
   assert(incorrect.includes('is-correct')&&incorrect.includes('is-incorrect')&&incorrect.includes('×'));
 }
 const tableReport=run("renderCandidateResponseSection({type:'language',hasAttempt:true,title:'Language',maxScore:25,score:1,questions:[{text:'Question',table:[['Stall','Cost'],['<Momos>',50]],choices:[]}]})");
 assert(tableReport.includes('<table>')&&tableReport.includes('<th scope="col">Stall</th>'));
 assert(tableReport.includes('&lt;Momos&gt;')&&!tableReport.includes('<pre'));
 assert(run("renderCandidateResponseSection({type:'prompt',hasAttempt:true,title:'Prompt',maxScore:10,score:9,response:'My full prompt'})").includes('My full prompt'));
 context.fetch=async()=>({ok:true,json:async()=>({name:'Report Candidate',driveName:'Review drive',sections:[{type:'aptitude',title:'Aptitude',maxScore:30,score:2,hasAttempt:true,questions:[]}]})});
 run("finalInterviewDrafts={};modal.innerHTML='ORIGINAL FINAL SCORES';modal.className='results-dialog final-scores-dialog';modal.open=true;finalScoreFilters['review-drive']={gdScore:{op:'gte',value:10}};");
 await run("openCandidateResponses('review-drive','REVIEW-ID')");
 assert(document.querySelector('#modal').innerHTML.includes('Candidate performance report'));
 run("closeCandidateReport()");
 assert.equal(document.querySelector('#modal').innerHTML,'ORIGINAL FINAL SCORES');
 assert.equal(run("finalScoreFilters['review-drive'].gdScore.value"),10);
 assert.equal(document.querySelector('#modal').open,true);

 // Every response data column uses the same filter popover, including no-result views.
 run("state.drives=[{id:'columns',name:'Demo drive'}];state.sessions=[{id:'columns-test',driveId:'columns',type:'language',questions:partsQuestions,attempts:[{id:'col-a',name:'Alice',studentId:'ID-A',submittedAt:60001,startedAt:1,responses:{},shortlisted:true},{id:'col-b',name:'Bob',studentId:'ID-B',submittedAt:120001,startedAt:1,responses:{},shortlisted:false}]}];responseSession='columns-test';responseColumnFilters={name:{text:'ALI'},shortlisted:{values:['Yes']}};");
 assert.equal(run("responseRows(state.sessions[0]).map(r=>r.a.name).join(',')"),'Alice');
 run("responseColumnFilters.name={text:'nobody'};updateResponseTable()");
 assert(document.querySelector('#responseTable').innerHTML.includes('No candidates match'));
 assert(document.querySelector('#responseTable').innerHTML.includes('Filter Student name'));
 run("responseColumnFilters={};updateResponseTable()");
 assert.equal(run("responseRows(state.sessions[0]).length"),2);
 run("modal.close();showPromptResponses({id:'p',name:'Demo prompt',type:'prompt',closedAt:1,questions:[],attempts:[{id:'p1',name:'Alice',studentId:'ID-A',submittedAt:60001,startedAt:1,responses:{}}]})");
 assert(document.querySelector('#modal').innerHTML.includes('Export prompt responses to Excel'));
 assert(!document.querySelector('#modal').innerHTML.includes('Word export'));
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
 await run("postDownload=(path,body)=>{globalThis.lastExport={path,body}};exportFinalScores()");
 assert.equal(run("lastExport.body.studentIds.join(',')"),'1,2');
 await run("revertFilteredFinal()");
 assert.deepEqual(finalRequest.body.studentIds,['1','2']);
 assert.equal(finalRequest.body.value,false);

 console.log('PASS: production UI boots, persists admin changes through API, uses opaque links, starts candidates through server adapter, shows confirmation, and rejects stale polling updates.');
})().catch(e=>{console.error(e);process.exitCode=1});
