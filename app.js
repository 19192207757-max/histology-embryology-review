'use strict';
const C = window.COURSE;
const $ = (sel) => document.querySelector(sel);
const chapter = id => C.chapters.find(c => c.id === id);
const source = id => C.decks.find(s => s.id === id);
const pastPapers = C.pastPapers || [];
const pastQuestions = pastPapers.flatMap(paper=>paper.questions);
const emCases = C.lab.filter(item=>item.kind==='em');
const slideSections = [
 {id:'lm',route:'key',zh:'光镜',en:'Light microscopy',count:C.keySlides.length,countZh:'张关键图',countEn:'key figures',deck:'d19',image:C.keySlides.find(item=>item.page===29)?.image},
 {id:'em',route:'lab/em',zh:'电镜',en:'Electron microscopy',count:emCases.length,countZh:'页训练',countEn:'practice pages',deck:'d20',image:emCases[0]?.image},
 {id:'past',route:'lab/past',zh:'历年原题',en:'Past exams',count:pastQuestions.length,countZh:'道原题',countEn:'exam questions',deck:'past',image:pastQuestions[0]?.image},
];
const storageKey = 'huaxi-histology-review-v1';
const blank = () => ({ done:{}, saved:{}, wrong:{}, seen:{}, flash:{}, notes:{}, keySlides:{}, keyLast:'', last:'', english:false, attempts:[], quizDraft:null });
const state = Object.assign(blank(), load());
const chapterReaders=new Map();
const labels = (zh,en) => state.english ? en : zh;
const routeIcons = {home:'home',key:'scope',chapters:'book',lab:'scope',quiz:'check',review:'layers',files:'file'};
const svgs = {
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 book:'<path d="M4 19.5V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M8 7h8m-8 4h6"/>',
 scope:'<path d="M6 21h13M11 21v-4m-5-5a6 6 0 1 0 11 3M8 11l6-7 4 3-6 7m2-10 2-2 4 3-2 2M3 16h10"/>',
 check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
 file:'<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
 search:'<circle cx="10.5" cy="10.5" r="5.8"/><path d="m15 15 5 5"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(svgs[name]||'')+'</svg>';
const esc = value => String(value ?? '').replace(/[&<>"']/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const link = (route,label,cls='') => '<a class="'+cls+'" href="#'+esc(route)+'">'+label+'</a>';
const button = (action,label,value='',cls='') => '<button type="button" class="btn '+cls+'" data-action="'+esc(action)+'" data-value="'+esc(value)+'">'+label+'</button>';
const option = (v,l,selected) => '<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(l)+'</option>';
const imgPath = (did,name) => {
 const path='assets/'+did+'/'+name+'.webp';
 return C.assetAliases?.[path]||path;
};
const L = (zh,en) => esc(labels(zh,en));
const chinese = (text,cls='translation') => !state.english&&text?'<span lang="zh-CN" class="'+cls+'">'+esc(text)+'</span>':'';
const count = obj => Object.values(obj).filter(Boolean).length;
const textMatches = (str,q) => q.toLowerCase().trim().split(/\s+/).every(word=>String(str).toLowerCase().includes(word));
let filters={ chapter:'',source:'',lab:'all',labKind:'all',quiz:'all',length:'12',review:'saved',file:'all',keyChapter:'all' };
let currentSession=restoreQuiz(state.quizDraft), flash=null, labAnswer=null, keyPractice=null, timer=null, toastTimeout=null;

function load() {
 try { return JSON.parse(localStorage.getItem(storageKey)) || {}; }
 catch { return {}; }
}
function save() {
 try { localStorage.setItem(storageKey,JSON.stringify(state)); }
 catch { showToast(labels('浏览器无法保存进度','Browser storage is unavailable')); }
}
function showToast(message) {
 const toast=$('#toast');
 toast.textContent=message;
 toast.classList.add('show');
 clearTimeout(toastTimeout);
 toastTimeout=setTimeout(()=>toast.classList.remove('show'),2100);
}
function group(c) { return c.group; }
function route() {
 const [page='home',id='',sub=''] = location.hash.slice(1).split('/');
 return {page:page||'home',id,sub};
}
function idFromKey(key) { return key.split('.')[0]; }
function headings(k,title,desc) {
 return '<div class="subhead">'+(k?'<p class="overline">'+esc(k)+'</p>':'')+'<h1>'+esc(title)+'</h1>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</div>';
}
function section(title,body,summary='',id='') {
 return '<section class="section"'+(id?' id="'+id+'"':'')+'><div class="section-title"><h2>'+title+'</h2>'+(summary?'<span>'+summary+'</span>':'')+'</div>'+body+'</section>';
}
function groupLabel(id) {
 return {foundation:L('基础组织','Basic tissues'),system:L('器官系统','Organ systems'),embryo:L('胚胎发育','Embryology')}[id];
}
function chapterName(c) { return state.english?c.en:c.zh; }
function chapterSelect(value,cls='') {
 return '<select class="'+cls+'">'+option('all',labels('全部章节','All chapters'),value)+C.chapters.map(c=>option(c.id,chapterName(c),value)).join('')+'</select>';
}
function renderChrome(r) {
 document.documentElement.lang=state.english?'en':'zh-CN';
 const names={home:L('复习路线','Study plan'),lab:L('识图训练','Slide identification'),quiz:L('做题自测','Test yourself'),review:L('复练错题与图','Review weak spots'),chapters:L('按章重学','Study by chapter'),files:L('课件与大纲','Sources & syllabus')};
 const page={chapter:'chapters',source:'files',key:'lab'}[r.page]||r.page;
 const navLink=k=>'<a class="'+(page===k?'active':'')+'" '+(page===k?'aria-current="page"':'')+' href="#'+k+'">'+icon(routeIcons[k])+names[k]+'</a>';
 $('#sidebar').innerHTML = link('home','<span class="mark">'+icon('scope')+'</span><span><span class="brand-title">'+L('组胚复习室','Histology Review')+'</span><small>HISTOLOGY & EMBRYOLOGY</small></span>','brand')+
 '<nav class="nav" aria-label="'+L('复习路线','Study plan')+'">'+['home','lab','quiz','review'].map(navLink).join('')+'</nav>'+
 '<p class="chapter-group">'+L('查阅与重学','Reference & relearning')+'</p><nav class="nav" aria-label="'+L('查阅与重学','Reference & relearning')+'">'+['chapters','files'].map(navLink).join('')+'</nav>';
 const c=r.page==='chapter'?chapter(r.id):null;
 $('#top').innerHTML='<button class="mobile-menu" type="button" data-action="menu" aria-label="'+L('打开导航','Open navigation')+'">'+icon('menu')+'</button><div class="crumb">'+(c?esc(chapterName(c)):(names[page]||names.home))+'</div><div class="top-actions"><button class="search-btn" type="button" data-action="search" aria-label="'+L('全站搜索','Search')+'">'+icon('search')+'<span>'+L('搜索中英术语','Search terms')+'</span><kbd>/</kbd></button><button class="lang-btn" type="button" data-action="language">'+L('切换全英','显示中文')+'</button></div>';
 $('.foot').innerHTML='<span>'+L('华西 · 组织学与胚胎学 I','Huaxi · Histology and Embryology I')+'</span><span>'+L('课程资料索引与个人复习练习','Course sources and individual practice')+'</span>';
}
function render(scroll=false) {
 const r=route();
 clearInterval(timer);
 if(currentSession?.mode==='mock'&&!currentSession.done&&Date.now()>=currentSession.until)finishQuiz(false);
 renderChrome(r);
 const views = {home,key:keySlidesView,chapters,chapter:chapterView,lab,quiz,review,files,source:sourceView};
 $('#content').innerHTML=(views[r.page]||home)(r);
 if (r.page==='quiz' && !r.id && currentSession?.mode==='mock' && !currentSession.done) {
   updateClock();
   if(!currentSession.done)timer=setInterval(updateClock,1000);
 }
 if(scroll) window.scrollTo({top:0,behavior:'instant'});
 if(r.page==='chapter'&&r.sub) document.getElementById(r.sub)?.scrollIntoView({block:'start'});
}
function slideSectionCards() {
 return '<div class="slide-sections">'+slideSections.map(s=>link(s.route,
  (s.image?'<img src="'+imgPath(s.deck,s.image)+'" alt="">':'')+
  '<span class="slide-section-text"><strong>'+L(s.zh,s.en)+'</strong><small>'+L(s.count+' '+s.countZh,s.count+' '+s.countEn)+'</small></span>','slide-section tile')).join('')+'</div>';
}
function slideSectionNav(active='') {
 return '<nav class="slide-section-nav" aria-label="'+L('识图分类','Slide categories')+'">'+slideSections.map(s=>
  '<a href="#'+s.route+'"'+(s.id===active?' aria-current="location"':'')+'>'+L(s.zh,s.en)+'</a>').join('')+'</nav>';
}

function home() {
 const hero=C.hero;
 const again=C.keySlides.filter(x=>state.keySlides[x.id]==='again').length;
 const wrong=count(state.wrong);
 const quizRoute=currentSession&&!currentSession.done?L('继续上次答题','Resume last quiz'):L('做题自测','Test yourself');
 return '<section class="hero"><div class="hero-text"><p class="overline">'+L('四川大学华西 · 组胚 I','HUAXI · HISTOLOGY & EMBRYOLOGY I')+'</p><h1>'+L('组胚复习室','Histology Review')+'</h1><p class="hero-cn">'+L('先认结构，再做题，最后复练没掌握的。','Identify structures, test yourself, then revisit weak spots.')+'</p><div class="actions">'+link('lab',L('进入识图训练','Open slide identification'),'btn light')+link('chapters',L('按章复习 · 图和题在同一页','Study by chapter with slides and questions'),'btn ghost')+'</div></div>'+
 (hero?'<figure class="hero-image"><img src="'+imgPath(hero.deck,hero.image)+'" alt="'+esc(hero.label)+'"><figcaption>'+esc(hero.label)+'</figcaption></figure>':'')+'</section>'+
  section(L('识图训练','Slide identification'),slideSectionCards())+
 section(L('按这三步复习','Study in three steps'),'<ol class="grid study-steps">'+[
  ['lab',L('先练识图','Practise slide identification'),L('看图辨认器官、组织、细胞和结构。','Identify organs, tissues, cells and structures.'),count(state.seen)+' '+L('道识图题已核对','identification questions checked')],
  ['quiz',quizRoute,L('选一章做题，核对中文解析。准备模拟时可切换全英。','Choose a chapter, check explanations, then switch to English for exam practice.'),state.attempts.length+' '+L('轮自测已完成','quizzes completed')],
 ['review',L('复练错题与图','Review weak spots'),L('回到这轮答错的题和标记过的图。','Return to your mistakes and the figures you flagged.'),again+' '+L('张待复练图','figures to revisit')+' · '+wrong+' '+L('道错题','mistakes')]
 ].map(([r,t,d,n],i)=>'<li>'+link(r,'<span class="study-step">'+(i+1)+'</span><h3>'+t+'</h3><p>'+d+'</p><small>'+n+'</small>','tile')+'</li>').join('')+'</ol>')+
 '<div class="row reference-links">'+link('files/exam',L('考核方式与范围','Exam requirements'),'inline-link')+'</div>';
}
function chapters(r) {
 const filter=r.id;
 const groups=['foundation','system','embryo'].filter(g=>!filter||filter===g);
 return headings('Study notes',labels('章节重学','Study by chapter'),labels('按大纲目标查覆盖，按课件页码回看课堂材料。','Find syllabus objectives and jump back to source pages.'))+
 '<div class="row anchor-nav">'+link('chapters',L('全部','All'),'btn small '+(!filter?'':'ghost'))+['foundation','system','embryo'].map(g=>link('chapters/'+g,groupLabel(g),'btn small '+(filter===g?'':'ghost'))).join('')+'</div>'+
 groups.map(g=>section(groupLabel(g),'<div class="grid">'+C.chapters.filter(c=>c.group===g).map(c=>link('chapter/'+c.id,'<span class="kicker">'+(c.decks.length?L('课件 + 大纲','Slides + syllabus'):L('大纲导学','Syllabus guide'))+'</span><h3>'+esc(chapterName(c))+'</h3>'+(!state.english?'<p>'+esc(c.en)+'</p>':'')+'<p>'+c.notes.length+' '+L('张知识卡','study cards')+(state.done[c.id]?' · '+L('已学','Done'):'')+'</p>','tile')).join('')+'</div>')).join('');
}
function materialLabel(deckId) {
 if(deckId==='d19')return L('光镜','Light microscopy');
 if(deckId==='d20')return L('电镜','Electron microscopy');
 return L('课件','Course slide');
}
function materialContent(deckId,page,allImages=false) {
 const heading=page.text?.split('\n').find(line=>line.trim())||'';
 const files=allImages?page.images:page.images.slice(0,1);
 return (files.length?'<div class="material-images">'+files.map(image=>'<button type="button" class="material-image" data-action="image" data-value="'+imgPath(deckId,image)+'" aria-label="'+L('放大图像','Enlarge image')+'"><img loading="lazy" src="'+imgPath(deckId,image)+'" alt="'+materialLabel(deckId)+'"></button>').join('')+'</div>':'')+
 '<p class="material-caption"><strong>'+materialLabel(deckId)+' · '+L('第 '+page.n+' 页','p. '+page.n)+'</strong>'+
 (heading?'<span>'+esc(heading)+'</span>':'')+'</p>'+
 (allImages&&page.text?'<p class="source-text">'+esc(page.text)+'</p>':'');
}
function noteMaterials(c,n,i) {
 const inline=C.inlineRefs?.[c.id+'.'+i]||[];
 const refs=[...inline,...(n.refs||[])];
 const pages=new Map();
 for(const [deckId,pageNumber] of refs){
  const page=source(deckId)?.pages.find(p=>p.n===pageNumber);
  if(page)pages.set(deckId+'/'+pageNumber,[deckId,page]);
 }
 if(!pages.size)return '';
 const items=[...pages.values()];
 const firstKinds=new Set();
 const primary=[], more=[];
 for(const [deckId,page] of items){
  const kind=deckId==='d19'||deckId==='d20'?deckId:'course';
  if(!page.images.length||firstKinds.has(kind)){more.push([deckId,page]);continue;}
  firstKinds.add(kind);
  primary.push([deckId,page]);
 }
 return '<div class="note-materials">'+
 (primary.length?'<div class="material-strip">'+primary.map(([d,p])=>'<figure>'+materialContent(d,p)+'</figure>').join('')+'</div>':'')+
 (more.length?'<details><summary>'+L('展开相关页节选','Read related source pages')+'</summary>'+more.map(([d,p])=>'<div class="material-excerpt">'+materialContent(d,p,true)+link('source/'+d+'/'+p.n,L('查看原页','View source page'),'inline-link')+'</div>').join('')+'</details>':'')+'</div>';
}
function noteCard(c,n,i) {
 const key=c.id+'.'+i;
 return '<article class="card" id="n'+i+'"><div class="row push"><span class="note-id">'+esc(chapterName(c))+'</span>'+button('save-card',state.saved[key]?L('已收藏','Saved'):L('收藏','Save'),key,'ghost small')+'</div><h3>'+esc(labels(n.zh,n.en))+'</h3>'+
 (!state.english?'<span class="muted">'+esc(n.en)+'</span><p class="note-text">'+esc(n.detail)+'</p>':'')+
 '<div class="model"><strong>'+L('英文答题示例','English answer')+'</strong><p>'+esc(n.model)+'</p></div>'+
 (n.contrast?'<p class="contrast"><strong>'+L('容易混淆','Distinguish')+'</strong>'+esc(n.contrast)+'</p>':'')+
 noteMaterials(c,n,i)+'</article>';
}

function chapterMaterials(c) {
 const groups=c.decks.map(id=>({deck:source(id),pages:source(id).pages}));
 const matched=[...(c.supplementRefs||[]),...c.notes.flatMap((_,i)=>C.inlineRefs?.[c.id+'.'+i]||[])];
 for(const id of ['d19','d20']){
  const selected=new Set(matched.filter(([deck])=>deck===id).map(([,n])=>n));
  if(selected.size)groups.push({deck:source(id),pages:source(id).pages.filter(p=>selected.has(p.n))});
 }
 return groups;
}
function chapterMaterialReader(c,groups) {
 if(!groups.length)return '';
 const last=chapterReaders.get(c.id);
 const group=groups.find(g=>g.deck.id===last?.deck)||groups.find(g=>g.deck.id==='d20')||groups[0];
 const ref=c.notes.flatMap(n=>n.refs||[]).find(([id,n])=>id===group.deck.id&&group.pages.some(p=>p.n===n&&p.images.length));
 const page=group.pages.find(p=>p.n===last?.page)||group.pages.find(p=>p.n===ref?.[1])||group.pages.find(p=>p.images.length)||group.pages[0];
 const index=group.pages.indexOf(page);
 const em=group.deck.id==='d20'?C.lab.find(item=>item.kind==='em'&&item.page===page.n):null;
 return '<div class="panel" id="chapter-material-reader"><div class="fields">'+
 '<label class="field fill">'+L('图或课件','Figures or slides')+'<select data-material-deck>'+groups.map(g=>option(g.deck.id,g.deck.short+' · '+g.pages.length+labels(' 页',' pages'),group.deck.id)).join('')+'</select></label>'+
 '<label class="field">'+L('页码','Page')+'<select data-material-page data-deck="'+esc(group.deck.id)+'">'+group.pages.map(p=>option(String(p.n),labels('第 '+p.n+' 页','p. '+p.n),String(page.n))).join('')+'</select></label></div>'+
 '<div class="material-page">'+materialContent(group.deck.id,page,true)+'</div>'+
 '<div class="row material-nav">'+(index>0?button('material-page',L('上一页','Previous'),group.deck.id+'/'+group.pages[index-1].n,'small ghost'):'')+
 (index+1<group.pages.length?button('material-page',L('下一页','Next'),group.deck.id+'/'+group.pages[index+1].n,'small alt'):'')+
 (em?link('lab/'+em.id+'/'+c.id,L('练这张电镜图','Practise this electron micrograph'),'btn small'): '')+'</div></div>';
}
function refreshChapterReader(deckId,pageNumber,focus) {
 const current=chapter(route().id);
 if(route().page!=='chapter'||!current)return;
 const groups=chapterMaterials(current);
 if(!groups.some(g=>g.deck.id===deckId))return;
 chapterReaders.set(current.id,{deck:deckId,page:pageNumber});
 const reader=$('#chapter-material-reader');
 if(!reader)return;
 reader.outerHTML=chapterMaterialReader(current,groups);
 $(focus)?.focus({preventScroll:true});
}
function chapterPractice(c) {
 const questions=selectable(c.id);
 const discussion=c.discussion?C.discussionPractice?.[c.discussion]||[]:[];
 const labs=C.lab.filter(item=>item.chapter===c.id);
 const originals=pastQuestions.filter(item=>item.chapter===c.id);
 return (labs.length||originals.length?'<div class="row anchor-nav">'+
 (originals.length?link('lab/past-chapter/'+c.id,L('练本章 '+originals.length+' 道历年原题','Practise '+originals.length+' past exam questions'),'btn'):'')+
 (labs.length?link('lab/chapter/'+c.id,L('练本章 '+labs.length+' 道识图题','Practise '+labs.length+' figures from this chapter'),'btn ghost'):'')+'</div>':'')+
 '<div class="cards">'+questions.map(q=>'<article class="card"><h3>'+esc(labels(q.promptZh||q.prompt,q.prompt))+'</h3>'+(!state.english?'<p class="muted" lang="en">'+esc(q.prompt)+'</p>':'')+
 '<ol type="A">'+q.options.map((x,i)=>'<li>'+esc(x)+chinese(q.optionsZh?.[i])+'</li>').join('')+'</ol>'+
 '<details><summary>'+L('核对答案和解析','Check answer and explanation')+'</summary><p><strong>'+String.fromCharCode(65+q.answer)+'. '+esc(q.options[q.answer])+chinese(q.optionsZh?.[q.answer])+'</strong></p><p>'+esc(labels(q.explanationZh||q.explanation,q.explanation))+'</p></details></article>').join('')+'</div>'+
 (discussion.length?section(L('课堂讨论提纲自测','Class discussion self-check'),'<div class="cards">'+discussion.map(q=>'<article class="card"><h3>'+esc(labels(q.zh,q.en))+'</h3><p>'+esc(labels(q.promptZh,q.promptEn))+'</p>'+
 '<details><summary>'+L('看参考作答','See model answer')+'</summary><p>'+esc(labels(q.answerZh,q.answerEn))+'</p>'+(!state.english?'<p lang="en">'+esc(q.answerEn)+'</p>':'')+'</details>'+
 '<p class="material-caption">'+L('依据讨论提纲改编','Adapted from the class outline')+' · ¶ '+esc(q.paragraph.join(', '))+'</p></article>').join('')+'</div>'):'');
}

const flowMaps = {
 '08': [
  ['Blood vessel wall · lumen outward',['Tunica intima','Tunica media','Tunica adventitia'],'Use endothelium to orient the section. Compare the media with the lumen before naming the vessel.']
 ],
 '09': [
  ['Lymph flow through a node',['Afferent lymphatics','Subcapsular sinus','Trabecular sinuses','Medullary sinuses','Efferent lymphatic at hilum'],'Blood-borne lymphocytes mainly enter the node from HEVs. Trace lymph flow separately.']
 ],
 '10': [
  ['Gut wall · lumen outward',['Mucosa','Submucosa','Muscularis externa','Serosa / adventitia'],'The mucosa contains epithelium, lamina propria and muscularis mucosae. Then check where glands or lymphoid aggregates sit.']
 ],
 '11': [
  ['Sinusoidal blood',['Portal venule + hepatic arteriole','Hepatic sinusoids','Central vein','Hepatic veins'],'In a classic lobule, blood flows toward the central vein.'],
  ['Bile outflow',['Bile canaliculi','Canals of Hering','Interlobular bile duct','Larger intrahepatic bile ducts'],'Bile flows toward portal tracts. Canaliculi are channels between hepatocytes.'],
  ['Saliva outflow',['Secretory acinus','Intercalated duct','Striated duct','Excretory duct'],'Low cuboidal intercalated cells contrast with taller striated duct cells whose basal infoldings house mitochondria.']
 ],
 '12': [
  ['Airway to gas exchange',['Bronchus','Bronchiole','Terminal bronchiole','Respiratory bronchiole','Alveolar duct','Alveolar sac'],'Cartilage and glands disappear at bronchioles. Alveoli first interrupt the wall at respiratory bronchioles.']
 ],
 '13': [
  ['Filtration barrier · blood to urinary space',['Fenestrated endothelium','Glomerular basement membrane','Podocyte filtration slit','Bowman space'],'The slit diaphragm spans the gap between adjacent podocyte foot processes.'],
  ['Tubular flow',['Bowman space','Proximal tubule','Loop of Henle','Distal tubule','Connecting tubule','Collecting duct'],'Filtration occurs at the corpuscle, bulk reabsorption mainly in the PCT, and final regulation in distal segments and collecting ducts.']
 ],
 '14': [
  ['Adrenal cortex · capsule inward',['Zona glomerulosa','Zona fasciculata','Zona reticularis','Adrenal medulla'],'Glomerulosa → mineralocorticoids. Fasciculata → glucocorticoids. Reticularis → androgens. Medulla → catecholamines.']
 ],
 '15': [
  ['Germ cells · basal lamina toward lumen',['Spermatogonium','Primary spermatocyte','Secondary spermatocyte','Spermatid','Spermatozoon'],'Meiosis produces haploid spermatids. Spermiogenesis remodels them without an additional division.']
 ],
 '16': [
  ['Follicle development',['Primordial follicle','Primary follicle','Preantral follicle','Antral follicle','Preovulatory follicle'],'Use the antrum and surrounding cell layers as landmarks. After ovulation, the remaining follicular wall contributes to the corpus luteum.']
 ],
 '20': [
  ['Early development',['Fertilization','Cleavage','Morula','Blastocyst','Implantation','Bilaminar disc','Gastrulation'],'The blastocyst has embryoblast and trophoblast. Gastrulation generates the three germ layers.']
 ]
};
const flowChinese = {
 '08': [['血管壁 · 从管腔向外',['内膜','中膜','外膜'],'先找到内皮定位管腔，再看中膜与管腔的比例来判断血管。']],
 '09': [['淋巴在淋巴结内的流向',['输入淋巴管','被膜下窦','小梁周窦','髓窦','门部输出淋巴管'],'血里的淋巴细胞主要经高内皮微静脉入结。看图时把这条路和淋巴液的走向分开。']],
 '10': [['消化管壁 · 从管腔向外',['黏膜','黏膜下层','肌层','浆膜或外膜'],'黏膜内有上皮、固有层和黏膜肌层。再找腺体或淋巴组织落在哪一层。']],
 '11': [
  ['肝内血流',['小叶间门静脉支与小叶间动脉支','肝血窦','中央静脉','肝静脉'],'经典肝小叶内，血液从周边流向中央静脉。'],
  ['胆汁的流向',['胆小管','赫林管','小叶间胆管','较大的肝内胆管'],'胆汁向门管区流。胆小管是相邻肝细胞之间的通道。'],
  ['唾液的排出',['分泌腺泡','闰管','纹状管','排泄管'],'闰管多为低立方上皮。纹状管上皮较高，基底质膜内褶和线粒体形成基底纹。']
 ],
 '12': [['气道通向气体交换区',['支气管','细支气管','终末细支气管','呼吸性细支气管','肺泡管','肺泡囊'],'从细支气管起，管壁找不到软骨与腺体。到了呼吸性细支气管，管壁首次有肺泡开口。']],
 '13': [
  ['滤过屏障 · 从血液到肾小囊腔',['有窗内皮','肾小球基膜','足细胞足突间滤过裂隙','肾小囊腔'],'相邻足突之间的裂隙由裂孔隔膜跨越。'],
  ['小管内液体的流向',['肾小囊腔','近端小管','髓袢','远端小管','连接小管','集合管'],'肾小体滤过，近端曲小管回收大部分滤液，远端节段与集合管参与最后调节。']
 ],
 '14': [['肾上腺 · 从被膜往里',['球状带','束状带','网状带','肾上腺髓质'],'球状带主分泌盐皮质激素，束状带主分泌糖皮质激素，网状带主分泌雄激素，髓质分泌儿茶酚胺。']],
 '15': [['生精细胞 · 由基膜向管腔',['精原细胞','初级精母细胞','次级精母细胞','精子细胞','精子'],'减数分裂产生单倍体精子细胞。精子形成指随后的形态改造，这一步没有再分裂。']],
 '16': [['卵泡发育',['原始卵泡','初级卵泡','窦前卵泡','有腔卵泡','排卵前卵泡'],'识图先找卵泡腔和周围的细胞层。排卵后残留的卵泡壁参与形成黄体。']],
 '20': [['胚胎早期发育',['受精','卵裂','桑椹胚','囊胚','植入','二胚层胚盘','原肠胚形成'],'囊胚有内细胞团和滋养层。原肠胚形成时建立三个胚层。']]
};
function mapView(c) {
 const maps=flowMaps[c.id];
 if(!maps) return '';
 const translated=flowChinese[c.id];
 return section(L('结构和机制顺序','Structure and process maps'),'<div class="panel">'+maps.map(([title,steps,clue],i)=>{
  const [titleZh,stepsZh,clueZh]=translated[i];
  return '<div class="process"><h3>'+L(titleZh,title)+'</h3><ol>'+steps.map((s,j)=>'<li>'+esc(state.english?s:stepsZh[j]+' '+s)+'</li>').join('')+'</ol><p class="muted">'+L(clueZh,clue)+'</p></div>';
 }).join('')+'</div>');
}


function chapterView(r) {
 const c=chapter(r.id);
 if(!c) return chapters({id:''});
 if(state.last!==c.id){state.last=c.id;save();}
 const ns=c.notes;
 const objectives=c.outline || {master:[],know:[]};
 const practice=button('prepare-quiz',L('练本章英文题','Practice this chapter'),c.id);
 const material=chapterMaterialReader(c,chapterMaterials(c));
 const objectivesHtml=(title,items)=>'<div><h3>'+title+'</h3><ul>'+items.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></div>';
 return headings(groupLabel(c.group),chapterName(c),state.english?'':c.en)+
 '<div class="row anchor-nav">'+link('chapters',L('回章节列表','Chapter list'),'btn ghost')+
 button('jump',L('复习要点','Study notes'),'chapter-notes','ghost')+(material?button('jump',L('在本章读图','Read figures here'),'chapter-material','ghost'):'')+
 button('jump',L('在本章自测','Self-check here'),'chapter-practice','alt')+button('complete',state.done[c.id]?L('已学 ✓','Completed ✓'):L('标为已学','Mark as done'),c.id,'ghost')+'</div>'+
 (c.decks.length?'':'<p class="notice">'+L('原文件夹内此专题主要依据教学大纲、进度表或讨论提纲。讲解与练习为按大纲整理的补充内容。','This module is based on the course syllabus, schedule or discussion outline, with supplementary explanations and practice.')+'</p>')+
 section(L('课程要求','Course objectives'),'<div class="panel">'+(objectives.master.length||objectives.know.length?'<div class="split">'+objectivesHtml(L('应掌握（大纲原文）','Master'),objectives.master)+objectivesHtml(L('需了解（大纲原文）','Know'),objectives.know)+'</div>':'<p>'+L('参见相关讨论或自学安排。','See the related discussion or self-study entry.')+'</p>')+
 (c.scope?'<p class="muted">'+esc(c.scope)+'</p>':'')+'</div>','','objective')+
 mapView(c)+ section(L('知识点、英文答法和配图','Study notes, model answers and figures'),'<div class="cards">'+ns.map((n,i)=>noteCard(c,n,i)).join('')+'</div>',ns.length+' '+L('张知识卡','study cards'),'chapter-notes')+
 (material?section(L('本章读图与课件','Figures and slides in this chapter'),material,'','chapter-material'):'')+
 section(L('本章自测','Self-check for this chapter'),chapterPractice(c)+'<div class="row spaced">'+practice+button('prepare-flash',L('术语闪卡','Flashcards'),c.id,'ghost')+'</div>','','chapter-practice')+
 section(L('个人笔记与原件','My notes and source files'),'<div class="panel">'+(c.decks.length?'<details><summary>'+L('查看完整课件索引','View the full slide index')+'</summary><div class="list">'+c.decks.map(s=>link('source/'+s,esc(source(s).name)+'<small>'+source(s).pages.length+' '+L('页','pages')+'</small>','list-item')).join('')+'</div></details>':'')+
 '<label class="field spaced">'+L('本章笔记（自动保存）','My chapter notes (autosaved)')+'<textarea aria-label="'+L('本章笔记','Chapter notes')+'" data-note="'+c.id+'" placeholder="'+L('输入忘记的术语、英文答题句或识图线索','Write terms, answer phrases or recognition clues')+'">'+esc(state.notes[c.id]||'')+'</textarea></label></div>','','chapter-source');
}
function groupsTable(rows) {
 return '<div class="table-wrap"><table><thead><tr>'+rows[0].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(row=>'<tr>'+row.map(t=>'<td>'+t+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
function compareElectronImages() {
 const rows=[
  ['Rough ER / Smooth ER',
   L('粗面内质网看扁平膜囊和膜外的核糖体颗粒。滑面内质网看无附着颗粒的管网。','Look for flattened cisternae with surface ribosomes in rough ER and a ribosome-free tubular network in smooth ER.'),[[4,'RER'],[5,'SER']]],
  ['Motile cilia / Microvilli',
   L('纤毛横切看 9+2 微管，纵切可顺着纤毛找基体。微绒毛密集、较短，以肌动蛋白束作为骨架。','Find the 9+2 axoneme in transverse motile cilia. Microvilli are short, densely packed actin-based projections.'),[[8,'Cilia'],[10,'Microvilli']]],
  ['Unmyelinated / Myelinated axons',
   L('多个小轴突可陷在同一雪旺细胞的胞质凹槽内。单个有髓轴突外围可见多层同心的致密髓鞘。','Several small unmyelinated axons may occupy pockets in one Schwann cell. A myelinated axon shows compact concentric lamellae.'),[[33,'Unmyelinated'],[34,'Myelinated']]],
  ['Capillary / Glomerular filtration barrier',
   L('先找管腔和红细胞定位内皮。肾小球再沿管腔向外找有窗内皮、基膜和足细胞足突。','Start at the lumen and identify the endothelium. In a glomerulus, trace the fenestrated endothelium, basement membrane and podocyte foot processes.'),[[39,'Capillary'],[42,'Glomerulus']]]
 ];
 return section(L('先对比这四组电镜图','Compare four pairs of electron micrographs'),
  groupsTable([[L('结构','Structures'),L('辨认依据','Recognition clues'),L('查看原页','Source pages')],...rows.map(([title,clue,pages])=>[esc(title),clue,pages.map(([n,name])=>link('source/d20/'+n,esc(name)+' · p. '+n,'inline-link')).join('<br>')])]));
}
function files(r) {
 const selected=r.id||'index';
 const nav=[['index',L('文件索引','File index')],['scope',L('教学进度','Course schedule')],['exam',L('考核方案','Assessment')],['endocrine',L('内分泌讨论','Endocrine discussion')],['female',L('女性生殖讨论','Female reproductive discussion')]];
 if(C.supplements?.length)nav.splice(1,0,['supplements',L('期末补充','Final supplements')]);
 let html=headings('Sources',labels('资料与教学大纲','Sources & syllabus'),labels('按课程用途查找文件，课件可逐页查看提取出的正文与图像。','Find course materials. Indexed decks include extracted page text and images.'))+
 '<div class="row anchor-nav">'+nav.map(([id,title])=>link('files/'+id,title,'btn small '+(selected===id?'':'ghost'))).join('')+'</div>';
 if(selected==='supplements'&&C.supplements?.length) {
  return html+'<div class="grid">'+C.supplements.map(s=>{
   const d=source(s.deck);
   const isKey=s.kind==='lm';
   return '<article class="tile"><h3>'+esc(labels(s.zh,s.en))+'</h3><p>'+esc(d.name)+' · '+d.pages.length+' '+L('页','pages')+'</p><p>'+esc(labels(s.detail,s.detailEn))+'</p><div class="row">'+link(isKey?'key':'source/'+d.id,isKey?L('全套关键图','Complete key set'):L('逐页读图','Browse pages'),'btn small')+link('lab/'+s.kind,L('练裁图题','Practise cropped cases'),'btn ghost small')+'</div></article>';
  }).join('')+'</div>'+compareElectronImages()+'<p class="notice spaced">'+L('补充资料用于复习。考核规则以课程大纲和考核方案为准。','These materials support study. The course syllabus and assessment plan specify assessment rules.')+'</p>';
 }
 if(selected==='exam') {
  const e=C.exam;
  return html+section(L('期末与平时成绩','Final and continuous assessment'),'<div class="panel"><p><strong>'+L(e.languageCn,e.language)+'</strong></p><p>'+L('期末闭卷占 50%，平时占 50%。如期末卷面成绩低于 60 分，总评至多 59 分。','Closed-book final 50%, continuous assessment 50%. A final exam mark below 60 caps the overall grade at 59.')+'</p><p>'+L(e.format,'Question formats depend on the syllabus, teaching content and learning progress. The assessment plan gives no fixed test format.')+'</p><p>'+L(e.filenameDateNote,'The assessment plan body specifies semester 1 of 2026–27 and the 2025 entry cohort in eight-year clinical medicine.')+'</p></div>'+
  groupsTable([[L('平时成绩组成','Continuous assessment'),L('总评占比','Course grade share')],...e.continuousParts.map((p,i)=>[L(p.name,['Five online assignments','Two group discussions','One closed-book midterm','Attendance'][i]),p.weight+'%'])])+
  '<p class="contrast">'+esc(e.languageSource.file)+' ¶199 · '+esc(e.assessmentSource.file)+' ¶'+e.assessmentSource.paragraphs.join(', ')+'</p>');
 }
 if(selected==='scope') return html+groupsTable([[L('周次','Week'),L('教学内容','Topic'),L('出处','Source')],...C.schedule.map(r=>[r.week,esc(r.topic),esc(r.source.sheet+' · '+r.source.cells.join(', '))])])+'<p class="contrast">'+esc(C.numberingNote)+'</p>';
 if(selected==='endocrine'||selected==='female') {
  const d=C.discussions[selected];
  return html+'<p class="notice">'+esc(d.source.file)+(d.dateNote?' · '+esc(d.dateNote):'')+'</p>'+d.sections.map(s=>section(esc(s.title),'<div class="panel">'+(s.cn&&!state.english?'<p>'+esc(s.cn)+'</p>':'')+'<ul>'+s.points.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul><p class="contrast">¶ '+s.paragraphs.join(', ')+'</p></div>')).join('');
 }
 return html+section(L('资料逐页索引','Indexed sources'),'<div class="list">'+C.decks.map(s=>link('source/'+s.id,esc(s.name)+'<small>'+s.pages.length+' '+L('页','pages')+' · '+esc(s.short)+'</small>','list-item')).join('')+'</div>')+
 section(L('全部文件盘点','Complete folder inventory'),groupsTable([[L('文件名','File'),L('用途或状态','Role or status')],...C.inventory.map(r=>[r.id?link('source/'+r.id,esc(r.name),'inline-link'):esc(r.name),r.duplicateOf?L('内容重复','Duplicate content')+' · '+esc(r.duplicateOf):r.id?L('已建立逐页索引','Indexed by page'):esc(labels(r.zh||'资料索引',r.en||'Indexed'))])]),C.inventory.length+' '+L('个原文件','original files'))+
 '<p class="notice">'+L('课件索引保留页码及提取的文字和图像。动画、视频和部分矢量图需打开原课件查看。','The index preserves page numbers, extractable text and images. View original files for animations, video and some vector artwork.')+'</p>';
}
function sourceView(r) {
 const d=source(r.id);
 if(!d) return files({id:'index'});
 const p=d.pages.find(p=>p.n===Number(r.sub));
 let html=headings('Course source',d.short,d.name);
 const c=C.chapters.find(c=>c.decks.includes(d.id));
 html+='<div class="row source-nav">'+link('files',L('全部课件','All sources'),'btn ghost small')+(c?link('chapter/'+c.id,L('回章节讲解','Chapter notes'),'btn ghost small'):'')+(p?link('source/'+d.id,L('本课件页码','All pages in this deck'),'btn ghost small'):'')+'</div>';
 if(d.id==='d19'){
  const lastFigure=C.keySlides.find(x=>x.id===state.keyLast&&x.page===p?.n);
  const target=lastFigure?.id||p?.n;
  html+='<div class="row source-nav">'+link('key'+(target?'/'+target:''),lastFigure?L('回到刚才那张图','Return to the same figure'):L('进入考试关键图复习','Open key exam slide review'),'btn small')+'</div>';
 }
 if(p) {
  const next=d.pages.find(x=>x.n===p.n+1),prev=d.pages.find(x=>x.n===p.n-1);
  return html+'<article class="panel"><div class="row push"><h2>'+L('第','Page ')+p.n+(state.english?'':'页')+'</h2><div class="row">'+(prev?link('source/'+d.id+'/'+prev.n,L('上一页','Previous'),'btn small ghost'):'')+(next?link('source/'+d.id+'/'+next.n,L('下一页','Next'),'btn small ghost'):'')+'</div></div>'+
  (p.chapter&&chapter(p.chapter)?'<div class="spaced">'+link('chapter/'+p.chapter,esc(chapterName(chapter(p.chapter))),'chip')+'</div>':'')+
  (p.text?'<div class="source-text">'+esc(p.text)+'</div>':p.images.length?'<p class="muted">'+L('此页主要为图像。','This page is primarily visual.')+'</p>':'<p class="muted">'+L('此页没有可提取的文字或位图，请回原课件查看。','No extractable text or raster image. Consult the original deck.')+'</p>')+
  '<div class="image-grid">'+p.images.map(n=>'<button type="button" data-action="image" data-value="'+imgPath(d.id,n)+'" aria-label="'+L('放大课件图','Enlarge source image')+'"><img loading="lazy" src="'+imgPath(d.id,n)+'" alt="'+L('课件图','Source figure')+'"></button>').join('')+'</div></article>';
 }
 return html+'<div class="fields"><label class="field fill">'+L('查此课件中的词或页码','Search this deck or enter a page number')+'<input data-filter="source" value="'+esc(filters.source)+'" type="search"></label></div><div id="source-list" class="list">'+sourceItems(d)+'</div>';
}
function sourceItems(d) {
 const q=filters.source;
 const visible=d.pages.filter(p=>!q||textMatches(p.text+' '+p.n,q));
 return visible.map(p=>link('source/'+d.id+'/'+p.n,'<span><strong>'+L('页 ','Page ')+p.n+'</strong> <small>'+esc(p.text.split('\n').slice(0,2).join(' · ').slice(0,160)||labels('图像或无可提取文字','Image or no extractable text'))+'</small></span><span class="chip">'+p.images.length+' '+L('图','images')+'</span>','list-item')).join('')||'<p class="empty">'+L('此课件中没有找到匹配页。','No matching pages in this deck.')+'</p>';
}

function keyFigureTitle(item) {
 return L('第 '+item.page+' 页 · 图 '+item.panel,'p. '+item.page+' · Figure '+item.panel);
}
function keyFigureStatus(item) {
 const status=state.keySlides[item.id];
 if(status==='known')return L('已掌握','Mastered');
 if(status==='again')return L('待复练','Review again');
 return L('待看','New');
}
const keyQuestionKinds={
 organ:['器官','Organ'],tissue:['组织','Tissue'],structure:['结构','Structure'],cell:['细胞','Cell'],
 reason:['判断依据','Identification cue'],compare:['区别','Distinction'],orientation:['方位','Orientation']
};
function keyScope(r) {
 const reviewOnly=r.id==='again'||r.sub==='again';
 return {
  reviewOnly,
  indexRoute:reviewOnly?'key/again':'key',
  doneRoute:reviewOnly?'key/done/again':'key/done',
  itemRoute:x=>'key/'+x.id+(reviewOnly?'/again':''),
  items:C.keySlides.filter(x=>(!reviewOnly||state.keySlides[x.id]==='again')&&
   (filters.keyChapter==='all'||x.chapter===filters.keyChapter))
 };
}
function keySlidesView(r) {
 const data=C.keySlides;
 const deck=source('d19');
 const flagged=data.filter(x=>state.keySlides[x.id]==='again').length;
 const {reviewOnly,indexRoute,itemRoute,items:shown}=keyScope(r);
 const item=data.find(x=>x.id===r.id)||data.find(x=>x.page===Number(r.id));
 const title=labels('考试关键光镜图','Key light microscopy exam slides');
 if(r.id==='done') return headings(L('识图训练','Slide identification'),labels('这轮看图结束','End of this slide round'),'')+slideSectionNav('lm')+
  '<div class="panel"><p>'+L('目前标记了 '+count(state.keySlides)+' / '+data.length+' 张，其中 '+flagged+' 张待复练。','You have rated '+count(state.keySlides)+' / '+data.length+' figures. '+flagged+' are marked for review.')+'</p><div class="row spaced">'+
  link(reviewOnly?'review':'quiz',reviewOnly?L('回去复练其他内容','Return to flagged items'):L('下一步 · 做题自测','Next · Test yourself'),'btn')+
  link(indexRoute,L('返回图集','Back to the gallery'),'btn ghost')+'</div></div>';
 if(item) {
  if(state.keyLast!==item.id){state.keyLast=item.id;save();}
  const p=deck.pages[item.page-1];
  const firstIndex=data.indexOf(item);
  const prev=shown.findLast(x=>data.indexOf(x)<firstIndex);
  const next=shown.find(x=>data.indexOf(x)>firstIndex);
  const img=imgPath(deck.id,item.image);
  if(keyPractice?.id!==item.id)keyPractice={id:item.id,index:0,answers:item.questions.map(()=>({text:'',checked:false}))};
  const question=item.questions[keyPractice.index];
  const response=keyPractice.answers[keyPractice.index];
  const reviewed=keyPractice.answers.filter(a=>a.checked).length;
  const nextPrompt=keyPractice.answers.findIndex(a=>!a.checked);
  const guide=item.guide;
  const prompts=item.questions.map((q,i)=>{
   const family=keyQuestionKinds[q.kind];
   const suffix=item.questions.filter(x=>x.kind===q.kind).length>1?' '+(item.questions.slice(0,i+1).filter(x=>x.kind===q.kind).length):'';
   return '<button type="button" class="btn small '+(i===keyPractice.index?'alt':'ghost')+'" data-action="key-prompt" data-value="'+i+'" aria-pressed="'+(i===keyPractice.index)+'">'+L(...family)+suffix+'</button>';
  }).join('');
   return headings(L('识图训练','Slide identification'),title,'')+slideSectionNav('lm')+
   '<article class="panel question key-sheet"><div class="row push"><div><h2>'+keyFigureTitle(item)+'</h2><p class="muted">'+(firstIndex+1)+' / '+data.length+' · '+keyFigureStatus(item)+'</p></div>'+link(indexRoute,L('回图集','Gallery'),'btn small ghost')+'</div>'+
   '<button type="button" class="review-image" data-action="image" data-value="'+img+'" aria-label="'+L('放大本图','Enlarge this figure')+'"><img src="'+img+'" alt="'+keyFigureTitle(item)+'"></button>'+
   '<div class="row key-prompts" role="group" aria-label="'+L('切换同图问法','Choose a question about this slide')+'">'+prompts+
   '<small class="muted">'+L('已核对 '+reviewed+' / '+item.questions.length+' 问','Checked '+reviewed+' / '+item.questions.length)+'</small></div>'+
   '<div class="key-prompt"><h3>'+esc(labels(question.promptZh,question.promptEn))+'</h3>'+(!state.english?'<p class="muted" lang="en">'+esc(question.promptEn)+'</p>':'')+'</div>'+
   (!response.checked?'<label class="field">'+L('你的答案','Your answer')+'<textarea data-key-answer rows="2" placeholder="'+L('可以先口头回答，也可以写在这里','Say your answer aloud or write it here')+'">'+esc(response.text)+'</textarea></label>'+
    '<div class="row spaced">'+button('key-check',L('核对辨认线索','Check recognition cues'),item.id)+'</div>':
    (response.text?'<p class="contrast"><strong>'+L('你的判断','Your answer')+'</strong>'+esc(response.text)+'</p>':'')+
    '<div class="model" data-key-feedback tabindex="-1"><strong>'+L('参考答案','Model answer')+'</strong><p><b>'+L(question.answerZh,question.answerEn)+'</b></p>'+
    (!state.english?'<p lang="en">'+esc(question.answerEn)+'</p>':'')+
    '<p class="muted">'+L(question.cueZh,question.cueEn)+'</p></div>'+
    '<details class="spaced"><summary>'+L('整图导读','Read the complete figure guide')+'</summary>'+
    (guide?'<p>'+esc(labels(guide.zh+' · '+guide.en,guide.en))+'</p><p>'+L(guide.clueZh,guide.clueEn)+'</p>':'<p class="source-text">'+esc(p.text)+'</p>')+'</details>'+
    '<div class="row spaced">'+(nextPrompt>=0?button('key-prompt',L('换下一种问法','Try another question'),String(nextPrompt)):'')+
    button('key-rate',L('本图掌握，下一张','Mastered, next slide'),item.id+':known',nextPrompt>=0?'alt':'')+button('key-rate',L('本图待复练，下一张','Review later, next slide'),item.id+':again','ghost')+'</div>'
   )+
   '<div class="row push spaced">'+link('source/d19/'+p.n,L('查看完整原页','View full source page'),'inline-link')+
   '<div class="row">'+(prev?link(itemRoute(prev),L('上一张','Previous'),'btn small ghost'):'')+
   (next?link(itemRoute(next),L('跳到下一张','Skip to next'),'btn small ghost'):'')+'</div></div></article>';
 }
 const mastered=data.filter(x=>state.keySlides[x.id]==='known').length;
 const first=reviewOnly?shown[0]:shown.find(x=>!state.keySlides[x.id]&&x.id===state.keyLast)||shown.find(x=>!state.keySlides[x.id])||shown[0];
 const choices=C.chapters.filter(c=>data.some(x=>x.chapter===c.id));
 return headings(L('识图训练','Slide identification'),title,labels('同一张图会换着问组织、结构、细胞或辨认依据。','Switch between questions about the tissue, structure, cell or identification cues.'))+slideSectionNav('lm')+
  '<div class="panel key-summary"><div class="row push"><strong>'+data.length+' '+L('张图 · 原资料 ','figures · ')+deck.pages.length+L(' 页',' source pages')+'</strong><span class="chip">'+L('已掌握 ','Mastered ')+mastered+'/'+data.length+'</span></div>'+
  '<div class="progress" role="progressbar" aria-valuenow="'+mastered+'" aria-valuemin="0" aria-valuemax="'+data.length+'" aria-label="'+L('已掌握图数','Mastered figures')+'"><span style="width:'+(100*mastered/data.length)+'%"></span></div>'+
  '<div class="row">'+(first?link(itemRoute(first),L(reviewOnly?'开始复练':'开始或继续看图',reviewOnly?'Start review':'Start or resume'),'btn'):'')+
  link('key',L('全部图片','All figures'),'btn '+(reviewOnly?'ghost':'alt'))+link('key/again',L('待复练','Review again')+' · '+flagged,'btn '+(reviewOnly?'alt':'ghost'))+
   link('lab/lm',L('光镜裁图练习','Cropped light microscopy practice'),'btn ghost')+'</div></div>'+
  '<div class="row push spaced"><label class="field">'+L('只看某一章','Filter by chapter')+'<select data-select="keyChapter">'+option('all',labels('全部章节','All chapters'),filters.keyChapter)+choices.map(c=>option(c.id,chapterName(c),filters.keyChapter)).join('')+'</select></label><small class="muted">'+shown.length+' '+L('张图','figures')+'</small></div>'+
  (shown.length?'<div class="key-grid spaced">'+shown.map(x=>link(itemRoute(x),
   '<img loading="lazy" src="'+imgPath(deck.id,x.image)+'" alt="'+keyFigureTitle(x)+'"><span class="row push"><strong>'+keyFigureTitle(x)+'</strong><span class="chip alt">'+keyFigureStatus(x)+'</span></span>','tile key-tile')).join('')+'</div>':
   '<p class="empty spaced">'+L('当前范围没有图。标记为「待复练」的图会出现在复练列表。','No figures in this selection. Flag a figure to add it to the review list.')+'</p>');
}

const paperRoute = paper=>'lab/paper-'+paper.id;
const pastQuestionRoute = (question,scope='')=>'lab/'+question.id+(scope?'/'+scope:'');
const paperKind = kind=>kind==='lm'?L('光镜','Light microscopy'):L('电镜','Electron microscopy');
const paperTitle = paper=>L(paper.zh,paper.en);
const pastHeading = (title,desc='')=>headings(labels('识图训练','Slide identification'),title,desc)+slideSectionNav('past');
function paperPart(kind,questions,scope='') {
 const part=questions.filter(q=>q.kind===kind);
 if(!part.length)return '';
 const pending=part.find(q=>!state.seen[q.id]);
 const done=part.filter(q=>state.seen[q.id]).length;
 const title=paperKind(kind);
 const start=done===0?L('开始练','Start'):pending?L('继续练','Resume'):L('从头再练','Practise again');
 return '<section class="panel past-part"><div class="row push"><div><h2>'+title+'</h2><p class="muted">'+
 L('已核对 '+done+' / '+part.length,'Checked '+done+' / '+part.length)+'</p></div>'+
 link(pastQuestionRoute(pending||part[0],scope),start,'btn small')+'</div>'+
 '<div class="past-number-grid" aria-label="'+title+'">'+part.map(q=>'<a class="btn small '+(state.seen[q.id]?'alt':'ghost')+'" href="#'+pastQuestionRoute(q,scope)+'" aria-label="'+title+' · '+L('第 '+q.number+' 题','Question '+q.number)+(state.seen[q.id]?' · '+L('已核对','Checked'):'')+'">'+q.number+(state.seen[q.id]?' ✓':'')+'</a>').join('')+'</div></section>';
}
function pastPaperView(r) {
 const back=link('lab/past',L('回历年原题','All past exams'),'btn small ghost');
 const chapterScope=r.id==='past-chapter'||r.id.startsWith('past-')?chapter(r.sub):null;
 const paper=pastPapers.find(p=>'paper-'+p.id===r.id||p.questions.some(q=>q.id===r.id));
 const question=paper?.questions.find(q=>q.id===r.id);
 const showReturn=chapterScope?link('chapter/'+chapterScope.id+'/chapter-practice',L('回本章复习','Back to chapter'),'btn small ghost'):'';
 if(question){
  const questions=chapterScope?pastQuestions.filter(q=>q.chapter===chapterScope.id):paper.questions;
  const index=questions.indexOf(question);
  const origin=chapterScope?'lab/past-chapter/'+chapterScope.id:paperRoute(paper);
  const scope=chapterScope?.id||'';
  const photo=imgPath('past',question.image);
  const reveal=labAnswer?.id===question.id;
  const title=labels('历年识图原题','Past slide exam');
  return pastHeading(title)+
  '<article class="panel question"><div class="row push"><div class="row">'+link(origin,chapterScope?L('回本章原题','Chapter questions'):L('回整卷题号','Paper questions'),'btn small ghost')+showReturn+'</div>'+
  '<span class="chip">'+paperTitle(paper)+' · '+paperKind(question.kind)+' · '+L('第 '+question.number+' 题','Question '+question.number)+'</span></div>'+
  '<button type="button" class="review-image" data-action="image" data-value="'+photo+'" aria-label="'+L('放大原题图','Enlarge original slide')+'"><img src="'+photo+'" alt="'+L('历年考试原题和配图','Original exam question and figure')+'"></button>'+
  '<h2 class="past-prompt"><span lang="en">'+esc(question.promptEn)+'</span>'+chinese(question.promptZh)+'</h2>'+
  (reveal?'<div class="model" data-past-feedback tabindex="-1"><strong>'+L('随题资料参考答案','Answer supplied with the paper')+'</strong><p><b lang="en">'+esc(question.answerEn)+'</b>'+chinese(question.answerZh)+'</p></div>'+
   (labAnswer.text?'<p class="contrast"><strong>'+L('你的作答','Your answer')+'</strong>'+esc(labAnswer.text)+'</p>':'')+
   (question.noteZh?'<p class="contrast"><strong>'+L('答题辨析','Answer clarification')+'</strong>'+L(question.noteZh,question.noteEn)+(!state.english?'<span class="translation" lang="en">'+esc(question.noteEn)+'</span>':'')+'</p>':''):
   '<label class="field">'+L('用英文写下你的判断','Write your answer in English')+'<textarea data-lab-answer rows="2" placeholder="'+L('先写出图上所问的名称','Name the indicated feature')+'"></textarea></label>'+
   button('lab-reveal',L('核对参考答案','Check model answer'),question.id,''))+
  '<div class="row spaced">'+(index>0?link(pastQuestionRoute(questions[index-1],scope),L('上一题','Previous question'),'btn small ghost'):'')+
  (index>=0&&index+1<questions.length?link(pastQuestionRoute(questions[index+1],scope),L('下一题','Next question'),'btn small '+(reveal?'':'ghost')):link(origin,L('返回题目列表','Back to questions'),'btn small ghost'))+'</div></article>';
 }
 if(chapterScope){
  const questions=pastQuestions.filter(q=>q.chapter===chapterScope.id);
  const cards=pastPapers.map(p=>{
   const items=questions.filter(q=>p.questions.includes(q));
   return items.length?section(paperTitle(p),'<div class="past-parts">'+paperPart('lm',items,chapterScope.id)+paperPart('em',items,chapterScope.id)+'</div>'):'';
  }).join('');
  return pastHeading(labels(chapterScope.zh+' · 历年原题',chapterScope.en+' · Past exam questions'))+
   '<div class="row anchor-nav">'+showReturn+back+'</div>'+cards;
 }
 if(paper){
  const lang=paper.originalLanguage==='en'?labels('英文','English'):labels('中文','Chinese');
  return pastHeading(labels(paper.zh,paper.en),labels('原卷题干为'+lang+'。每道题都有中英对照，也可放大原图核对箭头位置。','Original prompts are in '+lang+'. Each question has a bilingual transcript and a zoomable original slide.'))+
   '<div class="row anchor-nav">'+back+'</div><div class="past-parts">'+paperPart('lm',paper.questions)+paperPart('em',paper.questions)+'</div>';
 }
 return pastHeading(labels('历年识图原题','Past slide exams'),labels('按原卷题序练光镜和电镜。题图保留原卷标记，核对时显示中英文答案。','Practise light and electron microscopy in paper order. Original figure markings are retained.'))+
  '<div class="cards">'+pastPapers.map(p=>{
   const lm=p.questions.filter(q=>q.kind==='lm').length;
   const done=p.questions.filter(q=>state.seen[q.id]).length;
   return '<article class="card past-paper"><h2>'+paperTitle(p)+'</h2><p class="muted">'+paperKind('lm')+' '+lm+' · '+paperKind('em')+' '+(p.questions.length-lm)+'</p><p class="muted">'+L('已核对 '+done+' / '+p.questions.length,'Checked '+done+' / '+p.questions.length)+'</p>'+link(paperRoute(p),L('打开试卷','Open paper'),'btn small')+'</article>';
  }).join('')+'</div>';
}

function lab(r) {
 if(!r.id)return headings('',labels('识图训练','Slide identification'),labels('选一类开始练习。','Choose a collection to practise.'))+slideSectionCards()+
  '<div class="row reference-links">'+link('lab/all',L('查看课件识图与裁图练习','Browse regular slide cases and crops'),'inline-link')+'</div>';
 if(r.id==='past'||r.id.startsWith('past-')||r.id.startsWith('paper-'))return pastPaperView(r);
 const kinds={all:L('全部题源','All sources'),course:L('原课件','Course slides'),lm:L('考试关键光镜图 · 裁图题','Key exam slides · crops'),em:L('电镜','Electron microscopy')};
 const item=C.lab.find(x=>x.id===r.id);
 const scoped=chapter(r.sub);
 if(['all','lm','em','course'].includes(r.id)) {
  filters.labKind=r.id;
  filters.lab='all';
 } else if(r.id==='chapter'&&scoped){
  filters.labKind='all';
  filters.lab=scoped.id;
 } else if(item&&scoped){
  filters.labKind='all';
  filters.lab=scoped.id;
 } else if(item&&['lm','em','course'].includes(r.sub)){
  filters.labKind=r.sub;
  filters.lab='all';
 }
 const sourceCases=C.lab.filter(x=>filters.labKind==='all'||(x.kind||'course')===filters.labKind);
 const casesRoute=filters.lab==='all'?'lab/'+filters.labKind:'lab/chapter/'+filters.lab;
 const caseRoute=id=>'lab/'+id+(filters.lab!=='all'?'/'+filters.lab:filters.labKind!=='all'?'/'+filters.labKind:'');
 const labs=sourceCases.filter(x=>filters.lab==='all'||x.chapter===filters.lab);
 if(filters.labKind==='em')labs.sort((a,b)=>a.page-b.page);
 const activeSlideSection={em:'em',lm:'lm'}[item?.kind||filters.labKind];
 if(item) {
  const reveal=labAnswer?.id===item.id;
  const seq=labs.includes(item)?labs:[item,...labs];
  const next=seq[(seq.indexOf(item)+1)%seq.length];
  const badge=item.kind==='em'?kinds.em+' · '+L('第 '+item.page+' 页','p. '+item.page):kinds[item.kind||'course']+' · '+(seq.indexOf(item)+1)+' / '+seq.length;
   return headings(L('识图训练','Slide identification'),labels('英文识图训练','English slide identification'),labels('先作答，再用范句检查你写的识别依据。','Commit to an identification and give two visible reasons.'))+slideSectionNav(activeSlideSection)+
  '<article class="panel question"><div class="row push">'+link(casesRoute,L('回识图库','Back to slide lab'),'btn ghost small')+
  (scoped?link('chapter/'+scoped.id+'/chapter-practice',L('回本章复习','Return to chapter'),'btn ghost small'):'')+'<span class="chip">'+badge+'</span></div>'+
  (item.originalPage?'<p class="muted">'+L('原页自测 · 保留课件标注','Source-page practice · original labels retained')+'</p>':'')+
  '<button type="button" class="review-image" data-action="image" data-value="'+imgPath(item.deck,item.image)+'" aria-label="'+L('放大图片','Enlarge slide')+'"><img src="'+imgPath(item.deck,item.image)+'" alt="'+L('识图练习图片','Slide identification practice image')+'"></button>'+
  '<h2>'+esc(item.prompt)+chinese(item.promptZh)+'</h2>'+
  (!reveal?'<label class="field">'+L('用英文写下你的判断','Your answer')+'<textarea data-lab-answer placeholder="I identify this as … because I can see …"></textarea></label>'+
  button('lab-reveal',L('查看答案和辨认依据','Show identification'),item.id,''):'<div class="model"><strong>'+L('英文范答与中文讲解','Model answer')+'</strong><p>'+esc(item.model)+chinese(item.modelZh)+'</p></div>'+
  (labAnswer.text?'<p class="contrast"><strong>'+L('你的作答','Your answer')+'</strong>'+esc(labAnswer.text)+'</p>':'')+
  '<ul class="checklist">'+item.clues.map((c,i)=>'<li>'+esc(c)+chinese(item.cluesZh?.[i])+'</li>').join('')+'</ul><p class="contrast"><strong>'+L('易混辨析','Distinguish')+'</strong>'+esc(item.contrast)+chinese(item.contrastZh)+'</p>'+
  '<div class="row">'+link((item.kind==='lm'?'key/'+item.page:'source/'+item.deck+'/'+item.page),(item.kind==='lm'?L('看同页其他问法','More questions from this page'):esc(source(item.deck).short))+' · '+L('页 ','p. ')+item.page,'btn ghost small')+(next.id!==item.id?link(caseRoute(next.id),L('下一图','Next slide'),'btn small'):'')+'</div>')+'</article>';
 }
 const deckChoices=C.chapters.filter(c=>sourceCases.some(x=>x.chapter===c.id));
 return headings(L('识图训练','Slide identification'),filters.labKind==='em'?labels('电镜识图训练','Electron microscopy practice'):filters.labKind==='lm'?labels('光镜裁图练习','Cropped light microscopy practice'):labels('课件识图与裁图练习','Course slides and cropped cases'),labels('用英文写出图中结构，再核对辨认依据。','Name each feature in English, then check the identification cues.'))+slideSectionNav(activeSlideSection)+
  (filters.labKind==='em'&&labs.length?'<div class="row anchor-nav">'+link(caseRoute(labs[0].id),L('从第 '+labs[0].page+' 页开始练','Start on p. '+labs[0].page),'btn small')+'</div>':'')+
 '<div class="fields"><label class="field">'+L('来源','Source')+'<select data-select="labKind">'+Object.entries(kinds).filter(([k])=>k==='all'||C.lab.some(x=>(x.kind||'course')===k)).map(([k,v])=>option(k,v,filters.labKind)).join('')+'</select></label><label class="field">'+L('范围','Scope')+'<select data-select="lab">'+option('all',labels('全部章节','All chapters'),filters.lab)+deckChoices.map(c=>option(c.id,chapterName(c),filters.lab)).join('')+'</select></label><span class="chip">'+labs.length+' '+L('道识图题','cases')+'</span>'+
  (labs.length?link(caseRoute(labs[Math.floor(Math.random()*labs.length)].id),L('随机抽图','Random slide'),'btn'):'')+'</div>'+
 '<div class="grid lab-index">'+labs.map((x,i)=>link(caseRoute(x.id),'<img loading="lazy" src="'+imgPath(x.deck,x.image)+'" alt="'+L('识图练习','Slide case')+'"><div class="row push"><h3>'+(x.kind==='em'?L('第 '+x.page+' 页','p. '+x.page):L('图 '+(i+1),'Slide '+(i+1)))+'</h3><span class="chip alt">'+(state.seen[x.id]?'✓ '+L('练过','Seen'):L('待练','New'))+'</span></div><p>'+kinds[x.kind||'course']+(x.originalPage?' · '+L('原页自测','Source page'):x.kind==='em'?' · '+L('裁图题','Cropped case'):'')+'</p>','tile')).join('')+'</div>';
}
function shuffled(values) {
 const arr=values.slice();
 for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
 return arr;
}
function selectable(scope) { return C.quiz.filter(q=>scope==='all'||q.chapter===scope); }
function restoreQuiz(draft) {
 if(!draft||!['practice','mock','wrong'].includes(draft.mode)||!Array.isArray(draft.ids)||!draft.ids.length) return null;
 const questions=draft.ids.map(id=>C.quiz.find(q=>q.id===id));
 if(questions.some(q=>!q)||new Set(draft.ids).size!==questions.length||!Array.isArray(draft.order)||draft.order.length!==questions.length) return null;
 if(!draft.order.every((order,i)=>Array.isArray(order)&&order.length===questions[i].options.length&&new Set(order).size===order.length&&order.every(n=>Number.isInteger(n)&&n>=0&&n<order.length)))return null;
 if(!Number.isInteger(draft.index)||draft.index<0||draft.index>=questions.length||!Number.isFinite(draft.until))return null;
 const answers={},checked={};
 for(const q of questions){
  const pick=draft.answers?.[q.id];
  if(Number.isInteger(pick)&&pick>=0&&pick<q.options.length){
   answers[q.id]=pick;
   if(draft.mode!=='mock'&&draft.checked?.[q.id]===true)checked[q.id]=true;
  }
 }
 return {mode:draft.mode,questions,order:draft.order,index:draft.index,answers,checked,until:draft.until,done:false,score:0};
}
function saveQuiz() {
 const s=currentSession;
 state.quizDraft=s&&!s.done?{mode:s.mode,ids:s.questions.map(q=>q.id),order:s.order,index:s.index,answers:s.answers,checked:s.checked,until:s.until}:null;
 save();
}
function beginQuiz(mode,replace=false) {
 const pool=mode==='wrong'?C.quiz.filter(q=>state.wrong[q.id]):selectable(filters.quiz);
 if(!pool.length){showToast(labels('此范围暂无题目','There are no questions in this selection'));return;}
 if(currentSession&&!currentSession.done&&!replace){
  showDialog(L('已有一轮未完成的答题','An unfinished quiz is saved'),
   '<p>'+L('开启新一轮会替换原答题进度。','Starting a new quiz will replace the saved session.')+'</p><div class="row spaced">'+
   link('quiz',L('继续原来的答题','Resume saved quiz'),'btn')+
   button('q-replace',L('结束原答题，开新一轮','End saved quiz and start a new one'),mode,'ghost')+'</div>');
  return;
 }
 const questions=shuffled(pool).slice(0,mode==='wrong'?pool.length:Number(filters.length));
 const order=questions.map(q=>shuffled(q.options.map((_,i)=>i)));
 currentSession={ mode, questions, order, index:0, answers:{}, checked:{}, until:Date.now()+questions.length*60000, done:false, score:0 };
 saveQuiz();
 go('quiz');
}
function mcqView(s) {
 const q=s.questions[s.index];
 const selected=s.answers[q.id];
 const checked=s.checked[q.id];
 const mock=s.mode==='mock';
 const countAnswered=Object.keys(s.answers).length;
 const btns=s.order[s.index].map((n,i)=>{
 const cl=checked?(n===q.answer?' correct':n===selected?' wrong':''):(selected===n?' selected':'');
 return '<button type="button" class="option'+cl+'" data-action="choose" data-value="'+n+'" aria-pressed="'+(selected===n)+'"'+(checked?' disabled':'')+'><span class="letter">'+String.fromCharCode(65+i)+'.</span><span>'+esc(q.options[n])+chinese(q.optionsZh?.[n])+'</span></button>';
 }).join('');
 return '<article class="panel question"><div class="row push"><span class="chip">'+(mock?L('限时模拟','Timed mock'):L('练习','Practice'))+' · '+(s.index+1)+' / '+s.questions.length+'</span>'+
 (mock?'<strong id="clock" aria-label="'+L('剩余时间','Time remaining')+'"></strong>':'<span class="muted">'+esc(chapterName(chapter(q.chapter)))+'</span>')+'</div>'+
 '<div class="progress" role="progressbar" aria-valuenow="'+countAnswered+'" aria-valuemin="0" aria-valuemax="'+s.questions.length+'" aria-label="'+L('已答题数','Questions answered')+'"><span style="width:'+(100*countAnswered/s.questions.length)+'%"></span></div>'+
 '<h2>'+esc(q.prompt)+chinese(q.promptZh)+'</h2><div class="options">'+btns+'</div>'+
 (checked?'<div class="feedback '+(selected===q.answer?'success':'error')+'"><strong>'+(selected===q.answer?L('答对了','Correct'):L('正确答案 · ','Correct answer: ')+esc(q.options[q.answer])+chinese(q.optionsZh?.[q.answer]))+'</strong><p>'+esc(q.explanation)+chinese(q.explanationZh)+'</p></div>':'')+
 '<div class="row spaced">'+(s.index>0?button('q-prev',L('上一题','Previous'),'','ghost'):'')+
 (!mock&&!checked?'<button type="button" class="btn" data-action="q-check"'+(selected===undefined?' disabled':'')+'>'+L('核对答案','Check answer')+'</button>':'')+
 (checked||mock?button(s.index+1<s.questions.length?'q-next':'q-finish',s.index+1<s.questions.length?L('下一题','Next question'):L('查看结果','See results')):'')+
 (mock&&s.index+1!==s.questions.length?button('q-finish',L('交卷','Submit mock'),'','ghost'):'')+
 link('quiz/setup',mock?L('稍后继续（计时持续）','Resume later (timer continues)'):L('稍后继续','Resume later'),'btn ghost small')+'</div>'+
 '<p class="muted keyboard-tip">'+(mock?L('数字 1–4 选答案。','Use 1–4 to select an answer.'):L('数字 1–4 选答案，Enter 核对或下一题。','Use 1–4 to select an answer. Press Enter to check or continue.'))+'</p></article>';
}
function finishQuiz(renderNow=true) {
 const s=currentSession;
 if(!s||s.done) return;
 for(const q of s.questions) {
   if(s.answers[q.id]===q.answer){s.score++;delete state.wrong[q.id];}
   else if(s.answers[q.id]!==undefined||s.mode==='mock') state.wrong[q.id]=true;
 }
 state.attempts.unshift({date:new Date().toISOString(),score:s.score,total:s.questions.length,mode:s.mode});
 state.attempts=state.attempts.slice(0,60);
 s.done=true; saveQuiz();
 if(renderNow)render(true);
}
function submitQuiz() {
 const s=currentSession;
 const unanswered=s.questions.length-Object.keys(s.answers).length;
 if(s.mode!=='mock'||!unanswered){finishQuiz();return;}
 showDialog(L('确认交卷','Submit this mock exam?'),'<p>'+
  L('还有 '+unanswered+' 道题未答。交卷后会计入本轮成绩。','You have '+unanswered+' unanswered questions. They count towards the result.')+
  '</p><div class="row spaced">'+button('close-dialog',L('返回答题','Keep answering'))+
  button('q-submit',L('确认交卷','Submit now'),'','ghost')+'</div>');
}
function updateClock() {
 const s=currentSession;
 if(!s||s.done) return;
 const seconds=Math.max(0,Math.ceil((s.until-Date.now())/1000));
 const clock=$('#clock');
 if(clock) clock.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 if(seconds<=0){
  if($('#dialog').open)$('#dialog').close();
  finishQuiz();
 }
}
function results(s) {
 return '<article class="panel question"><div class="row push"><h2>'+L('成绩','Result')+' · '+s.score+' / '+s.questions.length+'</h2><div class="row">'+link('review',L('下一步 · 去复练','Next · Review weak spots'),'btn')+button('q-exit',L('再练一轮','New session'),'','ghost')+'</div></div>'+
 '<div class="list">'+s.questions.map(q=>{
 const ans=s.answers[q.id];
 return '<details class="list-item"><summary>'+(ans===q.answer?'✓ ':'× ')+esc(labels(q.promptZh||q.prompt,q.prompt))+'</summary><p>'+L('正确答案 · ','Correct: ')+'<strong>'+esc(q.options[q.answer])+'</strong>'+chinese(q.optionsZh?.[q.answer])+'</p><p>'+L('你的答案 · ','Your answer: ')+esc(q.options[ans]||labels('未作答','Unanswered'))+chinese(q.optionsZh?.[ans])+'</p><p>'+esc(q.explanation)+chinese(q.explanationZh)+'</p>'+link('chapter/'+q.chapter,L('回本章复习','Review chapter'),'inline-link')+'</details>';
 }).join('')+'</div></article>';
}
function quiz(r) {
 if(r.id==='short') return shortAnswerView();
 const s=currentSession;
 if(s&&r.id!=='setup') return headings('English practice',labels('选择题练习','English practice'),'')+(s.done?results(s):mcqView(s));
 const num=selectable(filters.quiz).length;
 const resume=s?'<div class="panel spaced quiz-resume"><div><h2>'+(s.done?L('上轮成绩','Last result'):L('有一轮可以继续','An unfinished quiz is saved'))+'</h2><p class="muted">'+
  (s.done?s.score+' / '+s.questions.length:L('已答 '+Object.keys(s.answers).length+' / '+s.questions.length+' 题','Answered '+Object.keys(s.answers).length+' / '+s.questions.length)+
   (s.mode==='mock'?' · '+L('模拟计时会继续','The mock timer continues'):'') )+'</p></div>'+
   link('quiz',s.done?L('看上轮成绩','See last result'):L('继续答题','Resume quiz'),'btn')+'</div>':'';
 return headings(L('再做题','Test yourself'),labels('做题自测','Test yourself'),labels('选择一章做题。默认显示中文题意和解析。','Choose a chapter and test yourself.'))+
 resume+
 '<div class="panel"><h2>'+L('选择题','Multiple choice')+'</h2><div class="fields spaced"><label class="field">'+L('章节','Chapter')+chapterSelect(filters.quiz,'quiz-scope')+'</label><label class="field">'+L('题量上限','Question limit')+'<select data-select="length">'+['6','12','20','30'].map(n=>option(n,n,filters.length)).join('')+'</select></label><span class="chip">'+num+' '+L('道可选题','available questions')+'</span></div>'+
 '<div class="row">'+button('q-start',L('开始做选择题','Start practice'),'practice')+button('q-start',L('限时模拟','Timed mock'),'mock','alt')+'</div></div>'+
 '<div class="grid spaced">'+link('lab','<h3>'+L('练识图','Practice slide identification')+'</h3><p>'+L('光镜、电镜和历年原题。','Light microscopy, electron microscopy, and past exams.')+'</p>','tile')+
 link('quiz/short','<h3>'+L('练英文短答','Practice short answers')+'</h3><p>'+L('先写两三句，再对照英文范答和中文讲解。','Write a few sentences, then check the model answer.')+'</p>','tile')+'</div>';
}
let short=null;
function makeShort() {
 const scope=filters.quiz;
 const pool=C.chapters.filter(c=>scope==='all'||scope===c.id).flatMap(c=>c.notes.map((n,i)=>({c,n,i})));
 const candidates=short&&pool.length>1?pool.filter(x=>x.c.id!==short.c.id||x.i!==short.i):pool;
 if(candidates.length) short=candidates[Math.floor(Math.random()*candidates.length)];
}
function shortAnswerView() {
 if(!short) makeShort();
 if(!short) return quiz({id:''});
 const {c,n,i}=short;
 return headings('English short answer',labels('英文短答训练','English short answer'),labels('写两到三句，至少包含结构、特征和功能中的相关要点。','Write two or three sentences. Include relevant structure, features and function.'))+
 '<article class="panel question"><div class="row push">'+link('quiz',L('选择题','Multiple choice'),'btn ghost small')+'<label class="field">'+L('范围','Scope')+chapterSelect(filters.quiz,'short-scope')+'</label></div>'+
 '<h2>Explain '+esc(n.en)+'. Include its key features and biological significance where relevant.'+chinese('解释'+n.zh+'，根据题目写出关键特点与意义。')+'</h2>'+
 (short.reveal?'<p class="contrast"><strong>'+L('你的作答','Your answer')+'</strong>'+esc(short.text||'—')+'</p><div class="model"><strong>'+L('英文范答与中文讲解','Model answer')+'</strong><p>'+esc(n.model)+chinese(n.detail)+'</p></div><p class="contrast"><strong>'+L('自查','Self-check')+'</strong>'+L('有写对结构名吗？术语是否准确，结构和意义的关系有没有解释清楚？','Did you name the correct structure, use precise terminology, and explain the connection?')+'</p>':
 '<label class="field">'+L('你的英文作答','Your answer')+'<textarea data-short-answer placeholder="'+L('用英文作答…','Write in English…')+'"></textarea></label>')+
 '<div class="row">'+(short.reveal?button('short-next',L('下一题','Next prompt'))+link('chapter/'+c.id+'/n'+i,L('复习此知识点','Study this topic'),'btn ghost'):button('short-reveal',L('查看参考答案','Show model answer')))+'</div></article>';
}
function cardPool(scope) {
 return C.chapters.filter(c=>scope==='all'||scope===c.id).flatMap(c=>c.notes.map((n,i)=>({c,n,i,key:c.id+'.'+i})));
}
function setFlash(scope) {
 const pool=cardPool(scope);
 const now=Date.now();
 const due=pool.filter(x=>!state.flash[x.key]||state.flash[x.key].next<=now);
 flash={scope,deck:shuffled(due.length?due:pool).slice(0,30),index:0,flipped:false,completed:0};
}
function flashView() {
 if(!flash) setFlash('all');
 const f=flash;
 const item=f.deck[f.index];
 const today=Date.now();
 const due=cardPool(f.scope).filter(x=>!state.flash[x.key]||state.flash[x.key].next<=today).length;
 return '<div class="fields"><label class="field">'+L('闪卡范围','Flashcard scope')+chapterSelect(f.scope,'flash-scope')+'</label><span class="chip">'+due+' '+L('张待学或到期','new or due')+'</span></div>'+
 (!item?'<div class="panel"><h2>'+L('本轮结束','Session complete')+'</h2><p>'+f.completed+' '+L('张已标记','cards rated')+'</p>'+button('reset-flash',L('再开一轮','Start another round'),f.scope)+'</div>':
 '<article class="panel flash"><p class="muted">'+(f.index+1)+' / '+f.deck.length+' · '+esc(item.c.en)+'</p><h2>'+esc(state.english?item.n.en:item.n.zh)+'</h2>'+
 (f.flipped?'<p><strong>'+esc(item.n.en)+'</strong></p><p>'+esc(item.n.model)+'</p>':'<p>'+L('说出英文术语与一句定义','Recall the definition out loud')+'</p>')+'</article>'+
 '<div class="row" style="justify-content:center">'+(f.flipped?[['again',L('还不会 · 10 分钟','Again · 10 min')],['day',L('基本会 · 1 天','Good · 1 day')],['week',L('熟练 · 7 天','Easy · 7 days')]].map(([s,l])=>button('rate-flash',l,s,s==='day'?'':'alt')).join(''):button('flip-flash',L('翻开答案','Reveal answer')))+'</div>');
}
function review(r) {
 const tab=r.id||'today';
 const html=headings(L('最后复练','Review weak spots'),labels('复练错题与图','Review weak spots'),labels('把标记的图和做错的题再过一遍。','Revisit figures you flagged and questions you missed.'));
 const tools='<details class="panel spaced"><summary>'+L('收藏、闪卡和进度备份','Saved cards, flashcards and progress backup')+'</summary>'+
 '<div class="row spaced">'+link('review/saved',L('收藏','Saved'),'btn small ghost')+link('review/flash',L('术语闪卡','Flashcards'),'btn small ghost')+link('review/progress',L('学习记录与备份','History & backup'),'btn small ghost')+'</div></details>';
 if(tab==='today'){
  const again=C.keySlides.filter(x=>state.keySlides[x.id]==='again').length;
  const wrong=count(state.wrong);
  return html+'<div class="grid">'+link('key/again','<h3>'+L('复练光镜图','Review flagged figures')+'</h3><p>'+again+' '+L('张待复练','flagged')+'</p>','tile')+
  link('review/wrong','<h3>'+L('重做错题','Retry mistakes')+'</h3><p>'+wrong+' '+L('道错题','mistakes')+'</p>','tile')+'</div>'+tools;
 }
 const back='<p class="source-nav">'+link('review',L('回到复练首页','Back to review'),'btn small ghost')+'</p>';
 if(tab==='flash') return html+back+flashView();
 if(tab==='wrong') {
  const wrong=C.quiz.filter(q=>state.wrong[q.id]);
 return html+back+(wrong.length?'<div class="row anchor-nav">'+button('retry-wrong',L('开始错题重做','Retry mistakes'))+'</div><div class="list">'+wrong.map(q=>link('chapter/'+q.chapter,esc(labels(q.promptZh||q.prompt,q.prompt))+'<small>'+esc(chapterName(chapter(q.chapter)))+'</small>','list-item')).join('')+'</div>':'<div class="empty">'+L('做错的选择题会自动加入这里。','Incorrect multiple-choice answers appear here.')+'</div>');
 }
 if(tab==='progress') return html+back+
  section(L('学习进度','Completion'),'<div class="grid">'+C.chapters.map(c=>link('chapter/'+c.id,'<h3>'+esc(chapterName(c))+'</h3><p>'+(state.done[c.id]?L('✓ 已学','✓ Completed'):L('待学','To study'))+'</p>','tile')).join('')+'</div>')+
  section(L('答题记录','Practice history'),state.attempts.length?groupsTable([[L('日期','Date'),L('模式','Mode'),L('得分','Score')],...state.attempts.map(a=>[esc(new Date(a.date).toLocaleString()),esc(a.mode),esc(a.score)+' / '+esc(a.total)])]):'<p class="empty">'+L('完成一轮练习后显示记录。','Finish a session to see your history.')+'</p>')+
  '<div class="row">'+button('export',L('导出进度备份','Export backup'),'','alt')+'<label class="btn ghost">'+L('导入进度备份','Import backup')+'<input data-import type="file" accept="application/json,.json" hidden></label></div>';
 const cards=Object.keys(state.saved).filter(k=>state.saved[k]).map(k=>{const [id,i]=k.split('.');const c=chapter(id);return [c,c?.notes[i],Number(i)];}).filter(x=>x[1]);
 return html+back+(cards.length?'<div class="cards">'+cards.map(([c,n,i])=>noteCard(c,n,i)).join('')+'</div>':'<p class="empty">'+L('在章节知识卡上点「收藏」，即可在这里集中复习。','Save a study card to review it here.')+'</p>');
}


function searchItems(q) {
 if(!q.trim()) return '<p class="muted">'+L('例如：血睾屏障、Purkinje、glomerulus。','Try: blood-testis barrier, Purkinje, glomerulus.')+'</p>';
 const found=[];
 for(const c of C.chapters) {
  if(textMatches(c.en+' '+c.zh,q)) found.push([c.en,c.zh,'chapter/'+c.id]);
  c.notes.forEach((n,i)=>{
   if(textMatches(n.en+' '+n.zh+' '+n.detail+' '+n.model+' '+n.contrast,q))
    found.push([n.en,state.english?c.en:n.zh+' · '+c.en,'chapter/'+c.id+'/n'+i]);
  });
 }
 const pages = C.decks.flatMap(s=>s.pages.filter(p=>textMatches(p.text,q)).map(p=>[s.short+' · p. '+p.n,p.text.split('\n')[0].slice(0,125),'source/'+s.id+'/'+p.n]));
 const entries=[...found.slice(0,25),...pages.slice(0,18)];
 return (entries.length?'<p class="muted">'+(found.length+pages.length)+' '+L('处匹配','matches')+'</p>':'')+
 '<div class="list">'+entries.map(([a,b,id])=>link(id,'<span><strong>'+esc(a)+'</strong><small>'+esc(b)+'</small></span>','list-item')).join('')+'</div>'+
 (!entries.length?'<p class="empty">'+L('没有找到匹配。试试英文单词、中文简称或换一种写法。','No matches. Try a shorter word or another spelling.')+'</p>':'');
}
function showDialog(title,html,cls='') {
 const d=$('#dialog');
 if(d.open)d.close();
 d.className=cls;
 d.setAttribute('aria-labelledby','dialog-title');
 d.innerHTML='<div class="row push source-nav"><h2 id="dialog-title">'+title+'</h2>'+button('close-dialog',L('关闭','Close'),'','small ghost')+'</div>'+html;
 d.showModal();
}
function openSearch() {
 showDialog(L('搜索知识点与课件','Search notes and sources'),'<label class="field">'+L('输入中文或英文','Enter a Chinese or English term')+'<input id="site-search" type="search" autocomplete="off"></label><div id="search-results" class="spaced">'+searchItems('')+'</div>');
 $('#site-search').focus();
}
function exportBackup() {
 const a=document.createElement('a');
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,data:state},null,2)],{type:'application/json'}));
 a.href=url;a.download='histology-review-progress.json';
 a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importBackup(file) {
 if(!file) return;
 try {
  if(file.size>5e6) throw new Error();
  const parsed=JSON.parse(await file.text());
  const d=parsed.data;
  if(parsed.version!==1||!d||!['done','saved','wrong','seen','flash','notes'].every(k=>d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k]))||!Array.isArray(d.attempts)) throw new Error();
  const next=blank();
  for(const c of C.chapters){
   if(d.done[c.id]===true)next.done[c.id]=true;
   if(typeof d.notes[c.id]==='string')next.notes[c.id]=d.notes[c.id].slice(0,80000);
   c.notes.forEach((_,i)=>{
    const k=c.id+'.'+i;
    if(d.saved[k]===true)next.saved[k]=true;
    if(Number.isFinite(d.flash[k]?.next))next.flash[k]={next:d.flash[k].next};
   });
  }
  C.quiz.forEach(q=>{if(d.wrong[q.id]===true)next.wrong[q.id]=true;});
  [...C.lab,...pastQuestions].forEach(x=>{if(d.seen[x.id]===true)next.seen[x.id]=true;});
  C.keySlides.forEach(item=>{
   const status=d.keySlides?.[item.id];
   if(status==='known'||status==='again')next.keySlides[item.id]=status;
  });
  if(C.keySlides.some(item=>item.id===d.keyLast))next.keyLast=d.keyLast;
  next.last=chapter(d.last)?d.last:'';
  next.english=d.english===true;
  next.attempts=d.attempts.filter(a=>a&&['mock','wrong','practice'].includes(a.mode)&&Number.isFinite(Date.parse(a.date))&&Number.isInteger(a.score)&&Number.isInteger(a.total)&&a.score>=0&&a.total>=a.score).slice(0,60);
  Object.assign(state,next);
  currentSession=restoreQuiz(d.quizDraft);
  flash=null;saveQuiz();render();showToast(labels('进度已导入','Progress imported'));
 } catch { showToast(labels('无法读取此进度备份','Could not read this backup')); }
}
function go(hash) {
 if(location.hash==='#'+hash)render(true);
 else location.hash=hash;
}
function rerenderFocus(sel) {
 render();
 $(sel)?.focus({preventScroll:true});
}
const actions = {
 menu:()=>$('#sidebar').classList.toggle('open'),
 search:openSearch,
 'close-dialog':()=>$('#dialog').close(),
 language:()=>{
  const selector='[data-key-answer], [data-lab-answer], [data-short-answer]';
  const draft=$(selector)?.value;
  state.english=!state.english;
  save();render();
  if(draft!==undefined&&$(selector))$(selector).value=draft;
 },
 jump:id=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}),
 'material-page':value=>{
  const [deckId,page]=value.split('/');
  refreshChapterReader(deckId,Number(page),'[data-material-page]');
 },
 complete:id=>{state.done[id]=!state.done[id];save();rerenderFocus('[data-action="complete"]');},
 'save-card':key=>{
  const b='[data-action="save-card"][data-value="'+key+'"]';
  state.saved[key]=!state.saved[key];save();rerenderFocus(b);
 },
 image:src=>{
  if(!/^assets\/(?:d\d{2}|past)\/[a-z0-9-]+\.webp$/.test(src))return;
  showDialog(L('查看图片','View image'),'<div class="row image-actions">'+button('image-zoom',L('再放大 2 倍','Zoom 2×'),'','small alt')+
   '<small id="zoom-instruction" hidden>'+L('可滚动查看细节。','Scroll to inspect details.')+'</small></div>'+
   '<div class="image-viewport" tabindex="0" role="region" aria-label="'+L('图片细节','Image detail')+'"><img src="'+src+'" alt="'+L('放大的课件图','Enlarged course image')+'"></div>','image-dialog');
 },
 'image-zoom':()=>{
  const view=$('.image-viewport');
  const image=$('.image-viewport img');
  if(!image?.clientWidth)return;
  const zoomed=view.classList.contains('zoomed');
  image.style.width=zoomed?'':image.clientWidth*2+'px';
  view.classList.toggle('zoomed',!zoomed);
  $('[data-action="image-zoom"]').textContent=labels(zoomed?'再放大 2 倍':'适应窗口',zoomed?'Zoom 2×':'Fit to window');
  $('#zoom-instruction').hidden=zoomed;
 },
 'lab-reveal':id=>{labAnswer={id,text:$('[data-lab-answer]').value.trim()};state.seen[id]=true;save();rerenderFocus('[data-past-feedback]');},
 'key-prompt':index=>{
  const next=Number(index);
  if(!keyPractice?.answers[next]||next===keyPractice.index)return;
  keyPractice.index=next;
  rerenderFocus('[data-action="key-prompt"][data-value="'+next+'"]');
 },
 'key-check':id=>{
  if(keyPractice?.id!==id)return;
  keyPractice.answers[keyPractice.index]={checked:true,text:$('[data-key-answer]').value.trim()};
  rerenderFocus('[data-key-feedback]');
 },
 'key-rate':value=>{
  const [id,status]=value.split(':');
  const index=C.keySlides.findIndex(item=>item.id===id);
  if(index<0||!['known','again'].includes(status))return;
  const scope=keyScope(route());
  const next=scope.items.find(item=>C.keySlides.indexOf(item)>index);
  state.keySlides[id]=status;
  keyPractice=null;
  save();
  go(next?scope.itemRoute(next):scope.doneRoute);
 },
 'prepare-quiz':id=>{filters.quiz=id;short=null;go('quiz/setup');},
 'q-start':beginQuiz,
 'q-replace':mode=>{$('#dialog').close();beginQuiz(mode,true);},
 'q-exit':()=>{currentSession=null;saveQuiz();go('quiz/setup');},
 'q-next':()=>{currentSession.index++;saveQuiz();render(true);},
 'q-prev':()=>{currentSession.index--;saveQuiz();render(true);},
 'q-finish':submitQuiz,
 'q-submit':()=>{$('#dialog').close();finishQuiz();},
 'q-check':()=>{
  const s=currentSession,q=s.questions[s.index];
  if(s.answers[q.id]===undefined)return;
  s.checked[q.id]=true;
  if(s.answers[q.id]===q.answer)delete state.wrong[q.id];
  else state.wrong[q.id]=true;
  saveQuiz();rerenderFocus('[data-action="q-next"], [data-action="q-finish"]');
 },
 choose:n=>{
  const s=currentSession,q=s.questions[s.index];
  if(s.checked[q.id])return;
  s.answers[q.id]=Number(n);
  saveQuiz();
  rerenderFocus('[data-action="choose"][data-value="'+n+'"]');
 },
 'retry-wrong':()=>beginQuiz('wrong'),
 'short-reveal':()=>{short.text=$('[data-short-answer]').value.trim();short.reveal=true;render();},
 'short-next':()=>{makeShort();render(true);},
 'prepare-flash':id=>{setFlash(id);go('review/flash');},
 'reset-flash':id=>{setFlash(id);render();},
 'flip-flash':()=>{flash.flipped=true;render();},
 'rate-flash':type=>{
  const f=flash,i=f.deck[f.index];
  state.flash[i.key]={next:Date.now()+({again:600000,day:86400000,week:604800000}[type])};
  f.index++;f.completed++;f.flipped=false;save();render();
 },
 export:exportBackup
};
document.addEventListener('click',event=>{
 const btn=event.target.closest('button[data-action]');
 if(btn&&actions[btn.dataset.action])actions[btn.dataset.action](btn.dataset.value||'');
 if(event.target.closest('#dialog a[href^="#"]'))$('#dialog').close();
 if($('#sidebar').classList.contains('open')&&!event.target.closest('#sidebar')&&!event.target.closest('[data-action="menu"]'))$('#sidebar').classList.remove('open');
});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.matches('#site-search'))$('#search-results').innerHTML=searchItems(el.value);
 if(el.matches('[data-key-answer]')&&keyPractice)keyPractice.answers[keyPractice.index].text=el.value;
 if(el.matches('[data-note]')){state.notes[el.dataset.note]=el.value;save();}
 if(el.matches('[data-filter="source"]')){filters.source=el.value;$('#source-list').innerHTML=sourceItems(source(route().id));}
});
document.addEventListener('change',event=>{
 const el=event.target;
 if(el.matches('[data-material-deck]')){refreshChapterReader(el.value,undefined,'[data-material-deck]');return;}
 if(el.matches('[data-material-page]')){refreshChapterReader(el.dataset.deck,Number(el.value),'[data-material-page]');return;}
 if(el.matches('[data-select]')){
  const key=el.dataset.select;
  filters[key]=el.value;
  if(key==='labKind')filters.lab='all';
  if((key==='labKind'||key==='lab')&&route().page==='lab'&&route().id!=='list'){go('lab/list');return;}
  render();
 }
 if(el.matches('.quiz-scope')){filters.quiz=el.value;short=null;render();}
 if(el.matches('.short-scope')){filters.quiz=el.value;short=null;render();}
 if(el.matches('.flash-scope')){setFlash(el.value);render();}
 if(el.matches('[data-import]'))importBackup(el.files[0]);
});
window.addEventListener('hashchange',()=>{
 const r=route();
 if(r.page!=='lab'||labAnswer?.id!==r.id)labAnswer=null;
 const relatedSource=r.page==='source'&&r.id==='d19';
 const returningFigure=relatedSource&&C.keySlides.find(x=>x.id===keyPractice?.id)?.page===Number(r.sub);
 if(!returningFigure&&(r.page!=='key'||r.id!==keyPractice?.id))keyPractice=null;
 if(r.page!=='source')filters.source='';
 if(r.page!=='key'&&!relatedSource)filters.keyChapter='all';
 $('#sidebar').classList.remove('open');
 render(true);
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')$('#sidebar').classList.remove('open');
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||event.target.matches('input,textarea,select,[contenteditable]')||$('#dialog').open)return;
 if(event.key==='/'){event.preventDefault();openSearch();return;}
 const r=route(), s=currentSession;
 if(r.page!=='quiz'||r.id||!s||s.done||event.repeat)return;
 const q=s.questions[s.index];
 if(/^[1-4]$/.test(event.key)&&!s.checked[q.id]){
  const pick=s.order[s.index][Number(event.key)-1];
  if(pick!==undefined){event.preventDefault();actions.choose(pick);}
 }
 if(event.key==='Enter'&&s.mode!=='mock'&&!event.target.matches('a,button:not(.option)')){
  if(s.answers[q.id]===undefined)return;
  event.preventDefault();
  if(!s.checked[q.id])actions['q-check']();
  else if(s.index+1<s.questions.length)actions['q-next']();
  else actions['q-finish']();
 }
});
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#content').focus();});
render();

