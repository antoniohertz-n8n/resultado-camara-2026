/* Relatório em PDF do painel Eleições 2026.
   O recorte é o dos filtros da tela (Brasil, estado, cidade, partido/federação, candidato); aqui se escolhe o cargo e o que entra.
   O PDF é montado no próprio aparelho (jsPDF + AutoTable, em vendor/), em A4, com capa, quadros de números e tabelas.
   O núcleo (montaPDF) não depende da página: os testes rodam em Node com os mesmos JSON. */
(function(raiz){'use strict';
var R={};

/* ---------- formatos */
function fmt(x){return String(x).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function pc(v,den,casas){if(casas==null)casas=2;if(!den)return '0';var m=Math.pow(10,casas),r=Math.floor(v*100*m/den+0.5);if(!r&&v>0&&casas<4)return pc(v,den,casas+1);
 return (r/m).toFixed(casas).replace('.',',')}
function razao(a,b,casas){var m=Math.pow(10,casas);return (Math.floor((2*a*m+b)/(2*b))/m).toFixed(casas).replace('.',',')}
function precisaV(v,den,mil){return Math.max(0,Math.ceil(mil*den/1000)-v)}
function plural(n,um,varios){return n===1?um:varios}
/* nome de urna em caixa-título, igual ao nomeProprio() da tela */
function nomeProprio(s){var mi={de:1,da:1,do:1,das:1,dos:1,e:1},ab={dr:1,drs:1,sr:1,jr:1,sgt:1,cb:1,pr:1,sd:1},s2=String(s).toLowerCase(),re=/[a-zà-öø-ÿ]+/g,m,o='',fim=0,i=0;
 while((m=re.exec(s2))){var w=m[0],a=m.index,b=a+w.length,r;
  if(i&&mi[w]&&s2.charAt(a-1)===' '&&(b===s2.length||s2.charAt(b)===' '))r=w;
  else if(w.length>1&&/^x{0,3}(ix|iv|v?i{0,3})$/.test(w))r=w.toUpperCase();
  else if(!/[aeiouyáéíóúâêôãõàü]/.test(w))r=ab[w]?w.charAt(0).toUpperCase()+w.slice(1):w.toUpperCase();
  else r=w.charAt(0).toUpperCase()+w.slice(1);
  o+=s2.slice(fim,a)+r;fim=b;i++}
 return o+s2.slice(fim)}
var ST_TXT={Q:'Eleito pelo quociente',M:'Eleito nas sobras',S:'Suplente',N:'Não eleito'};
function stTxt(st,sj){return sj?'Em julgamento (sub judice)':ST_TXT[st]}
function eleito(st){return st==='Q'||st==='M'}
var PREP={ac:'do',al:'de',ap:'do',am:'do',ba:'da',ce:'do',df:'do',es:'do',go:'de',ma:'do',mt:'de',ms:'de',mg:'de',pa:'do',pb:'da',pr:'do',pe:'de',pi:'do',rj:'do',rn:'do',rs:'do',ro:'de',rr:'de',sc:'de',sp:'de',se:'de',to:'do'};
function deUF(uf,nome){return (PREP[uf]||'de')+' '+nome}
function cargoNome(cg,uf){return cg==='e'?(uf==='df'?'deputado distrital':'deputado estadual'):'deputado federal'}
function cargoTitulo(cg){return cg==='e'?'Deputado estadual e distrital':'Deputado federal'}
function casaNome(cg,uf){return cg==='e'?(uf==='df'?'Câmara Legislativa do DF':'Assembleia Legislativa'):'Câmara dos Deputados'}

/* ---------- o que existe em cada recorte */
function tipoDe(S){return S.c?(S.cid?'candCidade':'cand'):S.cid&&S.uf?'cidade':S.uf&&(S.p||S.f)?'grupoUF':S.uf?'estado':(S.p||S.f)?'grupo':'brasil'}
var SECOES={
 brasil:[['resumo','Resumo do país','totais, comparecimento, brancos e nulos'],['clausula','Cláusula de barreira','só deputado federal: quem passou e onde não alcançou'],
  ['bancadas','Bancadas por partido','eleitos, votos e candidatos de cada partido'],['federacoes','Federações','partidos de cada federação e eleitos'],
  ['estados','Estados e quociente eleitoral','cadeiras, quociente, comparecimento e o mais votado'],['candidatos','Mais votados do país','na quantidade escolhida em Candidatos']],
 grupo:[['resumo','Resumo','eleitos, votos, candidatos e estados com bancada'],['clausula','Cláusula de barreira','só deputado federal: resultado e onde não alcançou'],
  ['estados','Estado por estado','votos, quociente eleitoral, eleitos e os 1,5% da cláusula'],['candidatos','Candidatos','com o filtro e a quantidade escolhidos'],
  ['cidades','Cidades onde mais votou','as 10 do país, com eleitores']],
 estado:[['resumo','Resumo do estado','cadeiras, quociente, comparecimento, votação mínima'],['cadeiras','Divisão das cadeiras','votos, quocientes e cadeiras de cada partido ou federação'],
  ['eleitos','Eleitos','todos os eleitos, com a forma de eleição'],['candidatos','Candidatos','com o filtro e a quantidade escolhidos'],
  ['cidades','Cidades','eleitores, comparecimento, votos válidos e o mais votado']],
 grupoUF:[['resumo','Resumo no estado','eleitos, votos, quociente partidário e cadeiras'],['candidatos','Candidatos','com o filtro e a quantidade escolhidos'],
  ['cidades','Votos em cada cidade','votos do grupo, parte dos válidos e eleitores']],
 cidade:[['resumo','Resumo da cidade','eleitores, comparecimento, válidos, brancos, nulos e quociente'],['partidos','Votos por partido','votos e parte dos válidos de cada partido'],
  ['candidatos','Candidatos votados na cidade','com o filtro e a quantidade escolhidos']],
 candCidade:[['resumo','Resumo do candidato na cidade','votos, parte do total, posição e situação'],['zonas','Votos por zona','todas as zonas da cidade, com e sem voto'],
  ['locais','Votos por local de votação','todos os locais do recorte, com e sem voto'],['secoes','Votos por seção','todas as seções do recorte, com e sem voto']],
 cand:[['resumo','Resumo do candidato','votos, posição, situação e onde mais votou'],['cidades','Votos em cada cidade','na quantidade escolhida em Cidades']]
};
function temOpcCand(t){return t!=='cand'&&t!=='candCidade'}
function temOpcCid(t){return t==='estado'||t==='grupoUF'||t==='cand'}

/* ---------- carregamento de dados (o mesmo formato da tela) */
function prepBR(b){if(!b.U){b.U={};b.uf.forEach(function(r){b.U[r[0]]={uf:r[0],nome:r[1],vagas:r[2],qe:r[3],vv:r[4],vvc:r[5],te:r[6],c:r[7],a:r[8],vb:r[9],tvn:r[10],ncand:r[11],ncid:r[12]}})}return b}
function sgDe(b,p){p=String(p);return b.par[p]?b.par[p].sg:p}
function grupoDe(b,S){var g;if(S.f&&b.fed[S.f]){g=b.fed[S.f];return {tipo:'fed',id:S.f,g:g,membros:g.par,ent:'F'+S.f,rot:'Federação'}}
 if(S.p&&b.par[S.p]){g=b.par[S.p];return {tipo:'par',id:S.p,g:g,membros:[S.p],ent:g.fed?'F'+g.fed:'P'+S.p,rot:'Partido'}}return null}

/* ---------- desenho do PDF */
var COR={navy:[14,58,107],ink:[12,26,41],ink2:[70,86,106],ink3:[107,122,141],line:[214,220,228],soft:[238,242,246],zebra:[247,249,251],
 ok:[29,122,76],no:[179,38,30],claro:[169,200,239],claro2:[219,231,246]};
function Papel(jsPDF,meta){
 var doc=new jsPDF({unit:'mm',format:'a4',compress:true}),W=210,H=297,M=14,TOP=19,BOT=17,y=0,P={doc:doc},pend=null,usado=false;
 if(doc.setLanguage)doc.setLanguage('pt-BR');doc.setProperties({title:meta.titulo,subject:'Eleições 2026 - resultado oficial do TSE',creator:'Painel Eleições 2026'});
 function cor(c){doc.setTextColor(c[0],c[1],c[2])}
 function cabe(txt,maxW,fs,min){doc.setFontSize(fs);while(doc.getTextWidth(txt)>maxW&&fs>min){fs-=0.5;doc.setFontSize(fs)}}
 function corta(txt,maxW){if(doc.getTextWidth(txt)<=maxW)return txt;while(txt.length>1&&doc.getTextWidth(txt+'...')>maxW)txt=txt.slice(0,-1);return txt+'...'}
 function linhas(txt,fs,larg){doc.setFont('helvetica','normal');doc.setFontSize(fs);return doc.splitTextToSize(txt,larg||W-2*M)}
 P.nova=function(){doc.addPage();y=TOP+2};
 function precisa(h){if(y+h>H-BOT)P.nova()}
 /* o título espera o bloco seguinte: os dois ficam na mesma página */
 function linhasTitulo(txt){doc.setFont('helvetica','bold');cabe(txt,W-2*M,12,10);return doc.splitTextToSize(txt,W-2*M)}
 function altTitulo(){return pend?10.5+(linhasTitulo(pend.txt).length-1)*5+(pend.sub?linhas(pend.sub,8.3).length*3.57+2.5:0):0}
 function desenhaTitulo(){var t=pend;pend=null;var tl=linhasTitulo(t.txt);cor(COR.ink);tl.forEach(function(l,i){doc.text(l,M,y+4.5+i*5)});y+=7+(tl.length-1)*5;
  doc.setDrawColor(COR.navy[0],COR.navy[1],COR.navy[2]);doc.setLineWidth(0.5);doc.line(M,y,M+18,y);y+=3.5;
  if(t.sub){var s=linhas(t.sub,8.3);cor(COR.ink2);s.forEach(function(l,i){doc.text(l,M,y+3+i*3.57)});y+=s.length*3.57+2.5}}
 function reserva(h){precisa(altTitulo()+h);if(pend)desenhaTitulo()}
 P.titulo=function(txt,sub){pend={txt:txt,sub:sub}};
 P.capa=function(){doc.setFont('helvetica','bold');cabe(meta.titulo,W-2*M,17,14);var tl=doc.splitTextToSize(meta.titulo,W-2*M);
  if(tl.length>2)tl=[tl[0],corta(tl.slice(1).join(' '),W-2*M)];var ex=(tl.length-1)*6.5,fsT=doc.getFontSize();
  doc.setFillColor(COR.navy[0],COR.navy[1],COR.navy[2]);doc.rect(0,0,W,40+ex,'F');
  doc.setFont('helvetica','bold');doc.setFontSize(8);cor(COR.claro);doc.text('ELEIÇÕES 2026 · RESULTADO OFICIAL DO TSE',M,11);
  doc.setFontSize(fsT);doc.setTextColor(255,255,255);tl.forEach(function(l,i){doc.text(l,M,21+i*6.5)});
  doc.setFont('helvetica','normal');cabe(meta.sub,W-2*M,10.5,8);cor(COR.claro2);doc.text(corta(meta.sub,W-2*M),M,28.5+ex);
  doc.setFontSize(7.8);cor(COR.claro);doc.text('1º turno, 4/10/2026 · 100% das seções · dados do TSE até '+(meta.dados||'-')+' · PDF gerado em '+meta.quando,M,35+ex);y=48+ex};
 P.caixa=function(ls){doc.setFontSize(8.4);var tx=[],h=4;
  ls.forEach(function(l){doc.setFont('helvetica','bold');var wl=doc.getTextWidth(l[0]+' ');var s=linhas(l[1],8.4,W-2*M-8-wl);tx.push([l[0],s,wl]);h+=s.length*3.9+1.2});
  reserva(h+4);doc.setFillColor(COR.soft[0],COR.soft[1],COR.soft[2]);doc.roundedRect(M,y,W-2*M,h,1.5,1.5,'F');var yy=y+5.2;
  tx.forEach(function(l){doc.setFont('helvetica','bold');cor(COR.ink);doc.text(l[0],M+4,yy);doc.setFont('helvetica','normal');cor(COR.ink2);
   l[1].forEach(function(s,i){doc.text(s,M+4+l[2],yy+i*3.9)});yy+=l[1].length*3.9+1.2});y+=h+5};
 P.cargo=function(txt){pend=null;if(usado)P.nova();usado=true;doc.setFillColor(COR.navy[0],COR.navy[1],COR.navy[2]);doc.rect(M,y,3,9,'F');doc.setFont('helvetica','bold');doc.setFontSize(13.5);cor(COR.navy);
  doc.text(txt.toUpperCase(),M+6,y+6.6);y+=14};
 P.texto=function(txt,fs,c){fs=fs||8.6;var s=linhas(txt,fs),lh=fs*0.43;reserva(Math.min(s.length*lh+2.5,40));doc.setFont('helvetica','normal');doc.setFontSize(fs);cor(c||COR.ink2);
  s.forEach(function(l){precisa(lh+1);doc.text(l,M,y+3);y+=lh});y+=2.5};
 P.nota=function(txt,tom){var s=linhas(txt,8.4,W-2*M-8),h=s.length*3.9+5;reserva(h+2);
  var c=tom==='no'?[251,233,231]:tom==='ok'?[230,244,236]:COR.soft;doc.setFillColor(c[0],c[1],c[2]);doc.roundedRect(M,y,W-2*M,h,1.5,1.5,'F');
  doc.setFont('helvetica','normal');doc.setFontSize(8.4);cor(tom==='no'?COR.no:tom==='ok'?COR.ok:COR.ink2);s.forEach(function(l,i){doc.text(l,M+4,y+5+i*3.9)});y+=h+4};
 P.kpis=function(itens){var por=itens.length>=4?4:itens.length,gap=3.5,w=(W-2*M-gap*(por-1))/por,h=23;
  for(var i=0;i<itens.length;i+=por){reserva(h+3);itens.slice(i,i+por).forEach(function(k,j){var x=M+j*(w+gap);doc.setFillColor(COR.soft[0],COR.soft[1],COR.soft[2]);doc.roundedRect(x,y,w,h,1.5,1.5,'F');
    doc.setFont('helvetica','normal');doc.setFontSize(7.4);cor(COR.ink2);doc.text(corta(k.r,w-5),x+3,y+5);
    doc.setFont('helvetica','bold');cabe(k.v,w-6,13.5,8);cor(COR.ink);doc.text(corta(k.v,w-6),x+3,y+12.2);
    if(k.d){doc.setFont('helvetica','normal');doc.setFontSize(7.8);cor(COR.ink2);var dd=doc.splitTextToSize(k.d,w-5);doc.text(dd[0],x+3,y+16.8);if(dd[1])doc.text(corta(dd[1],w-5),x+3,y+20.2)}});y+=h+3.5}y+=1.5};
 /* tabela: a que cabe numa página não se parte (vai inteira para a próxima, com o título); a longa repete o cabeçalho */
 function opcoes(head,body,opt,y0){var fs=opt.fs||8.2,cols=opt.cols||{};
  head.forEach(function(h,i){var c=cols[i]||(cols[i]={});if(c.cellWidth==null&&h.length<=14){if(/^%|% /.test(h))c.cellWidth=18;else if(/^Votos/.test(h))c.cellWidth=22}});
  return {startY:y0,head:[head],body:body,margin:{left:M,right:M,top:TOP+2,bottom:BOT+3},theme:'plain',
   styles:{font:'helvetica',fontSize:fs,cellPadding:{top:opt.pad||1.25,bottom:opt.pad||1.25,left:1.6,right:1.6},textColor:COR.ink,lineColor:COR.line,lineWidth:{bottom:0.1},overflow:'linebreak',valign:'middle'},
   headStyles:{fillColor:COR.navy,textColor:[255,255,255],fontStyle:'bold',fontSize:Math.max(8,fs-0.4),valign:'bottom'},alternateRowStyles:opt.zebra===false?{}:{fillColor:COR.zebra},
   columnStyles:cols,pageBreak:'auto',rowPageBreak:'avoid',showHead:'everyPage',
   didParseCell:function(d){if(d.section==='head'){var cs=cols[d.column.index];if(cs&&cs.halign)d.cell.styles.halign=cs.halign;return}if(d.section!=='body')return;var t=String(d.cell.raw==null?'':d.cell.raw);if(t.length>32)return;
    if(/^(Eleito|Passou|alcançou)/.test(t)){d.cell.styles.textColor=COR.ok;d.cell.styles.fontStyle='bold'}
    else if(/^(Não passou|faltaram|Em julgamento)/.test(t)){d.cell.styles.textColor=COR.no;d.cell.styles.fontStyle='bold'}}}}
 function mede(head,body,opt){var r=new jsPDF({unit:'mm',format:'a4'});r.autoTable(opcoes(head,body,opt,TOP+2));return r.getNumberOfPages()>1?Infinity:r.lastAutoTable.finalY-(TOP+2)+6}
 P.tabela=function(head,body,opt){opt=opt||{};if(!body.length){P.texto(opt.vazio||'Nada neste recorte.',8.6,COR.ink3);return}
  var hTab=body.length<=60?mede(head,body,opt):Infinity,util=H-BOT-(TOP+2);
  if(hTab!==Infinity&&altTitulo()+hTab<=util)reserva(hTab);else{reserva(26);if(orfas(head,body,opt,y)){var op2=Object.assign({},opt,{pad:0.8});if(!orfas(head,body,op2,y))opt=op2}}
  doc.autoTable(opcoes(head,body,opt,y));y=doc.lastAutoTable.finalY+6};
 /* linha órfã: a tabela, desenhada a partir de y0, deixaria só 1 ou 2 linhas na última página? */
 function orfas(head,body,opt,y0){var r=new jsPDF({unit:'mm',format:'a4'}),pg=[],o=opcoes(head,body,opt,y0);
  o.didDrawCell=function(d){if(d.section==='body')pg[d.row.index]=d.pageNumber};r.autoTable(o);
  var ult=Math.max.apply(null,pg),n=pg.filter(function(p){return p===ult}).length;return ult>1&&n<=2}
 P.secao=function(titulo,sub,head,body,opt){P.titulo(titulo,sub);P.tabela(head,body,opt)};
 P.fechar=function(){var n=doc.getNumberOfPages();for(var i=1;i<=n;i++){doc.setPage(i);doc.setDrawColor(COR.line[0],COR.line[1],COR.line[2]);doc.setLineWidth(0.2);
   doc.line(M,H-11.5,W-M,H-11.5);doc.setFont('helvetica','normal');doc.setFontSize(7.5);cor(COR.ink2);
   doc.text('Fonte: TSE, resultados.tse.jus.br · eleição de 4/10/2026, 1º turno, 100% das seções apuradas',M,H-7.5);doc.text('Página '+i+' de '+n,W-M,H-7.5,{align:'right'});
   if(i>1){doc.text(corta(meta.curto,W-2*M-50),M,10.5);doc.text('Gerado em '+meta.quando,W-M,10.5,{align:'right'});doc.line(M,13,W-M,13)}}};
 return P}

/* ---------- conteúdo de cada recorte (um cargo por vez) */
function limita(arr,max){return max?arr.slice(0,max):arr}
function filtraCand(arr,f){return arr.filter(function(c){return f==='todos'||(f==='eleitos')===eleito(c.st)})}
function rotFiltro(cfg,rotLista){var q=cfg.cand.max?cfg.cand.max+' primeiros':'todos';var f=cfg.cand.filtro==='eleitos'?'só eleitos':cfg.cand.filtro==='nao'?'só não eleitos':'eleitos e não eleitos';
 return (rotLista||'Candidatos')+': '+f+', '+q+' (do mais ao menos votado).'}

function secBrasil(P,cg,b,cs,cfg){var br_=b.br,x=cfg.secs;
 var nQ=0,nM=0;cs.forEach(function(c){if(c[5]==='Q')nQ++;else if(c[5]==='M')nM++});
 if(x.resumo){P.titulo('Resumo do país');P.kpis([{r:cg==='e'?'Eleitos nas assembleias':'Deputados federais eleitos',v:fmt(br_.vagas),d:cg==='e'?'26 assembleias e a Câmara Legislativa do DF':'Câmara dos Deputados'},
  {r:'Votos válidos',v:fmt(br_.vv),d:pc(br_.vl,br_.vv,1)+'% de legenda'},{r:'Comparecimento',v:pc(br_.c,br_.te,1)+'%',d:fmt(br_.c)+' de '+fmt(br_.te)+' eleitores'},
  {r:'Brancos e nulos',v:fmt(br_.vb+br_.tvn),d:'brancos '+fmt(br_.vb)+' · nulos '+fmt(br_.tvn)},{r:'Candidatos',v:fmt(br_.candidatos),d:br_.partidos+' partidos, '+Object.keys(b.fed).length+' federações'},
  {r:'Eleitos pelo quociente',v:fmt(nQ),d:'e '+nM+' pelas maiores médias (sobras)'},{r:'Votos sub judice',v:fmt(br_.vvc-br_.vv),d:'fora da conta até o julgamento'},
  {r:'Cidades',v:fmt(br_.cidades),d:'em 26 estados e no DF'}])}
 if(x.clausula&&b.cl){P.titulo('Cláusula de barreira','Regra de 2026 (Emenda Constitucional 97/2017): para ter fundo partidário e tempo de rádio e TV a partir de 2027, o partido precisa de 2,5% dos votos válidos do país, com pelo menos 1,5% em 9 estados, ou de 13 deputados eleitos em pelo menos 9 estados. A federação conta como um partido só (Resolução TSE 23.670/2021, art. 4º, § 2º). Conta feita com os votos válidos de hoje; a declaração oficial é do TSE.');
  var pas=0;b.ordem.forEach(function(id){if(b.cl[id].passa)pas++});
  P.texto(pas+' de '+b.ordem.length+' partidos ou federações passaram. Todos aparecem abaixo, com o que faltou para quem não alcançou.',8.6,COR.ink);
  var lin=[];b.ordem.forEach(function(id){var c=b.cl[id],n=id.slice(1),g=id.charAt(0)==='F'?b.fed[n]:b.par[n];
   lin.push([g.sg+(id.charAt(0)==='F'?'\n'+g.par.map(function(p){return b.par[p].sg+' '+b.par[p].el+' '+plural(b.par[p].el,'eleito','eleitos')}).join(' · '):''),pc(g.v,br_.vv)+'%',c.ufs15.length+' de 27',
    g.el+' em '+c.ufsEl.length+' '+plural(c.ufsEl.length,'estado','estados'),c.passa?'Passou':'Não passou']);
   if(!c.passa)lin.push([{content:'Por que não passou: '+c.txt.replace(/^Não alcançou\.\s*/,''),colSpan:5,styles:{fontSize:8,fontStyle:'normal',textColor:COR.ink2,fillColor:COR.zebra,cellPadding:{top:0.6,bottom:1.8,left:1.6,right:1.6}}}])});
  P.tabela(['Partido ou federação','% no país (mín. 2,5%)','Estados com 1,5% (mín. 9)','Eleitos (mín. 13 em 9 estados)','Resultado'],lin,
   {fs:8.2,zebra:false,cols:{0:{cellWidth:52,fontStyle:'bold'},1:{halign:'right',cellWidth:26},2:{halign:'right',cellWidth:30},3:{halign:'right'},4:{cellWidth:24}}})}
 else if(x.clausula&&!b.cl){P.titulo('Cláusula de barreira');P.texto('Não existe cláusula de barreira para deputado estadual: ela é medida só na eleição para a Câmara dos Deputados.')}
 if(x.bancadas){P.titulo(cg==='e'?'Bancadas eleitas nas assembleias':'Bancadas eleitas na Câmara','Soma de '+(cg==='e'?'todas as 27 casas legislativas':'todos os estados')+', do maior para o menor.');
  var pars=Object.keys(b.par).sort(function(a,c){return b.par[c].el-b.par[a].el||b.par[c].v-b.par[a].v});
  P.tabela(['Partido','Nome','Federação','Eleitos','Votos','% dos válidos','Candidatos'],pars.map(function(k){var p=b.par[k];return [p.sg,p.nome,p.fed?b.fed[p.fed].sg:'-',fmt(p.el),fmt(p.v),pc(p.v,br_.vv)+'%',fmt(p.cand)]}),
   {cols:{0:{fontStyle:'bold',cellWidth:24},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right'}}})}
 if(x.federacoes){P.titulo('Federações','Na eleição, a federação funciona como um partido só e soma os votos para o quociente'+(b.cl?' e para a cláusula.':'.'));
  var feds=Object.keys(b.fed).sort(function(a,c){return b.fed[c].el-b.fed[a].el});
  P.tabela(['Federação','Nome','Partidos (eleitos)','Eleitos','Votos','% dos válidos'],feds.map(function(k){var f=b.fed[k];return [f.sg,f.nome.replace('Federação ',''),f.par.map(function(p){return b.par[p].sg+' '+b.par[p].el}).join(' · '),fmt(f.el),fmt(f.v),pc(f.v,br_.vv)+'%']}),
   {cols:{0:{fontStyle:'bold',cellWidth:32},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'},5:{halign:'right'}}})}
 if(x.estados){P.titulo('Estados e quociente eleitoral','Quociente eleitoral = votos válidos do estado ÷ cadeiras. É quanto custa uma cadeira em votos.');var porUF={};cs.forEach(function(c){if(!porUF[c[0]])porUF[c[0]]=c});
  var ufs=b.uf.map(function(r){return b.U[r[0]]}).sort(function(a,c){return c.vagas-a.vagas||a.nome.localeCompare(c.nome)});
  P.tabela(['Estado','Cadeiras','Quociente eleitoral','Votos válidos','Comparecimento','Mais votado','Votos'],ufs.map(function(U){var mv=porUF[U.uf];
   return [U.nome,String(U.vagas),fmt(U.qe),fmt(U.vv),pc(U.c,U.te,1)+'%',mv?nomeProprio(mv[2])+' ('+sgDe(b,mv[3])+')':'-',mv?fmt(mv[4]):'-']}),
   {cols:{0:{fontStyle:'bold',cellWidth:30},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},6:{halign:'right'}}})}
 if(x.candidatos){var objs=filtraCand(cs.map(function(c){return {uf:c[0],n:c[1],nome:nomeProprio(c[2]),p:c[3],v:c[4],st:c[5],sj:c[6]}}),cfg.cand.filtro);
  P.secao('Mais votados do país',rotFiltro(cfg,'Lista')+' Percentual sobre os votos do estado (critério do TSE).',['Nº','Candidato','Partido','UF','Votos','% do estado','Situação'],limita(objs,cfg.cand.max).map(function(o,i){return [String(i+1),o.nome,sgDe(b,o.p),o.uf.toUpperCase(),fmt(o.v),pc(o.v,b.U[o.uf].vvc)+'%',stTxt(o.st,o.sj)]}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},4:{halign:'right'},5:{halign:'right'}}})}}

function secGrupo(P,cg,b,cs,cfg,S){var x=cfg.secs,G=grupoDe(b,S);if(!G){P.texto('Este partido ou federação não teve candidato a '+cargoNome(cg)+'.',9,COR.ink);return}
 var g=G.g,br_=b.br,cl=b.cl?b.cl[G.ent]:null,so=G.tipo==='par'&&g.fed,nE=g.st.Q+g.st.M,nUf=Object.keys(g.uf).filter(function(u){return g.uf[u][1]>0}).length;
 if(x.resumo){P.titulo('Resumo · '+g.sg,g.nome+(so?' · disputou na '+b.fed[g.fed].nome+' ('+b.fed[g.fed].sg+')':'')+(G.tipo==='fed'?' · partidos: '+g.par.map(function(p){return b.par[p].sg}).join(', '):''));
  var k=[{r:'Eleitos',v:fmt(nE),d:g.st.Q+' pelo quociente, '+g.st.M+' nas sobras'},{r:'Votos',v:fmt(g.v),d:pc(g.v,br_.vv)+'% dos válidos do país'},
   {r:'Candidatos',v:fmt(g.cand),d:fmt(g.cand-nE)+' não eleitos ('+fmt(g.st.S)+' suplentes)'},{r:'Estados com eleito',v:nUf+' de 27',d:cg==='e'?'assembleias com bancada':'estados com deputado'}];
  if(cl)k.push({r:'Cláusula de barreira',v:cl.passa?'Passou':'Não passou',d:G.tipo==='fed'?'conta da federação':so?'conta feita pela federação':'conta do partido'});
  if(G.tipo==='par')k.push({r:'Votos de legenda',v:fmt(g.leg),d:pc(g.leg,g.v,1)+'% dos votos do partido'});P.kpis(k)}
 if(x.clausula&&cl){P.titulo('Cláusula de barreira');P.nota((cl.passa?'Passou. ':'Não passou. ')+cl.txt,cl.passa?'ok':'no');
  if(so)P.texto(g.sg+' disputou dentro da federação '+b.fed[g.fed].sg+', e a cláusula vale para a federação inteira. Sozinho, teria '+pc(g.v,br_.vv)+'% no país, 1,5% em '+g.own.ufs15.length+' '+plural(g.own.ufs15.length,'estado','estados')+
   ' e '+g.el+' '+plural(g.el,'eleito','eleitos')+' em '+g.own.ufsEl.length+' '+plural(g.own.ufsEl.length,'estado','estados')+' ('+(g.own.passa?'passaria':'não passaria')+' por conta própria).')}
 else if(x.clausula&&!b.cl){P.titulo('Cláusula de barreira');P.texto('Não existe cláusula de barreira para deputado estadual: ela é medida só na eleição para a Câmara dos Deputados.')}
 if(x.estados){P.titulo('Estado por estado','Do estado onde teve mais força para o de menos força (parte dos votos válidos).'+(cl?' A coluna 1,5% mostra onde alcançou a parte da cláusula'+(so?' (conta só do partido)':'')+'.':''));
  var rows=b.uf.map(function(r){var U=b.U[r[0]],y=g.uf[r[0]]||[0,0,0];return {U:U,v:y[0],el:y[1],cand:y[2],need:precisaV(y[0],U.vv,15)}}).sort(function(a,c){return c.v/c.U.vv-a.v/a.U.vv||c.v-a.v});
  var head=['Estado','Votos','% dos válidos','Quociente eleitoral','Votos ÷ quociente','Eleitos','Candidatos'];if(cl)head.push('1,5% no estado');
  P.tabela(head,rows.map(function(r){var l=[r.U.nome,fmt(r.v),pc(r.v,r.U.vv)+'%',fmt(r.U.qe),razao(r.v,r.U.qe,2),String(r.el),String(r.cand)];
   if(cl)l.push(!r.need?'alcançou':(r.cand||r.v?'faltaram '+fmt(r.need):'sem candidato'));return l}),
   {cols:{0:{fontStyle:'bold'},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right',fontStyle:'bold'},6:{halign:'right'}}})}
 if(x.candidatos){var set={};G.membros.forEach(function(p){set[p]=1});
  var objs=filtraCand(cs.filter(function(c){return set[String(c[3])]}).map(function(c){return {uf:c[0],n:c[1],nome:nomeProprio(c[2]),p:c[3],v:c[4],st:c[5],sj:c[6]}}),cfg.cand.filtro);
  P.secao('Candidatos '+(G.tipo==='fed'?'da federação':'do partido')+' no Brasil',rotFiltro(cfg)+' '+fmt(objs.length)+' no total deste filtro.',['Nº','Candidato','Partido','UF','Votos','% do estado','Situação'],limita(objs,cfg.cand.max).map(function(o,i){return [String(i+1),o.nome,sgDe(b,o.p),o.uf.toUpperCase(),fmt(o.v),pc(o.v,b.U[o.uf].vvc)+'%',stTxt(o.st,o.sj)]}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},4:{halign:'right'},5:{halign:'right'}},vazio:'Nenhum candidato neste filtro.'})}
 if(x.cidades){P.secao('Cidades onde teve mais votos','As 10 do país.',['Nº','Cidade','UF','Eleitores','Votos de '+g.sg],g.top.map(function(c,i){return [String(i+1),c[2],c[0].toUpperCase(),fmt(c[4]),fmt(c[3])]}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},3:{halign:'right'},4:{halign:'right',fontStyle:'bold'}}})}}

function secEstado(P,cg,b,u,pm,cfg,S){var x=cfg.secs,U=b.U[S.uf],G=grupoDe(b,S),info={};u.cand.forEach(function(c){info[c[0]]=c});
 var nQ=0,nM=0;u.cand.forEach(function(c){if(c[5]==='Q')nQ++;else if(c[5]==='M')nM++});
 if(G){var g=G.g,y=g.uf[S.uf]||[0,0,0],agr=null;u.agr.forEach(function(a){if(a[0]===G.ent)agr=a});var daFed=agr&&agr[1]==='fed'&&G.tipo==='par';
  var lim=Math.ceil(15*U.vv/1000);
  if(x.resumo){P.titulo('Resumo · '+g.sg+' em '+U.nome,g.nome+' · '+casaNome(cg,S.uf)+' · '+U.vagas+' cadeiras');
   var k=[{r:'Eleitos',v:String(y[1])+' de '+U.vagas,d:y[2]+' '+plural(y[2],'candidato','candidatos')},{r:'Votos',v:fmt(y[0]),d:pc(y[0],U.vv)+'% dos válidos do estado'},
    {r:'Quociente eleitoral',v:fmt(U.qe),d:'votos por cadeira em '+U.nome}];
   if(agr){k.push({r:'Quocientes alcançados'+(daFed?' (federação)':''),v:razao(agr[3],U.qe,2),d:'quociente partidário: '+agr[7]+(daFed?' ('+b.fed[agr[0].slice(1)].sg+')':'')});
    k.push({r:'Cadeiras'+(daFed?' da federação':''),v:String(agr[8]),d:agr[9]+' pelo quociente, '+agr[10]+' nas sobras'});
    if(b.cl)k.push({r:'1,5% para a cláusula',v:agr[3]>=lim?'alcançou':'não alcançou',d:agr[3]>=lim?pc(agr[3],U.vv)+'% em '+U.nome:'faltaram '+fmt(lim-agr[3])+' votos'})}
   else k.push({r:'Neste estado',v:'sem candidato',d:'não disputou '+cargoNome(cg,S.uf)});
   if(pm){var ix=[];G.membros.forEach(function(m){var i=pm.p.indexOf(+m);if(i>=0)ix.push(i)});var zero=u.cid.filter(function(c){var row=pm.v[c[0]]||[],s=0;ix.forEach(function(i){s+=row[i]||0});return !s}).length;
    k.push({r:'Cidades sem voto',v:zero+' de '+u.cid.length,d:'onde o grupo não teve nenhum voto'})}
   P.kpis(k)}
  if(!y[2]){P.nota(g.sg+' não teve candidato a '+cargoNome(cg,S.uf)+' em '+U.nome+'. Por isso não há lista de candidatos nem votos por cidade neste recorte.');return}
  if(x.candidatos){var set={};G.membros.forEach(function(p){set[p]=1});
   var objs=filtraCand(u.cand.filter(function(c){return set[String(c[3])]}).map(function(c){return {n:c[0],nome:nomeProprio(c[1]),p:c[3],v:c[4],st:c[5],sj:c[6],r:c[8]}}),cfg.cand.filtro);
   P.secao('Candidatos '+(G.tipo==='fed'?'da federação':'do partido')+' em '+U.nome,rotFiltro(cfg)+' '+fmt(objs.length)+' no total deste filtro.',['Nº','Candidato','Partido','Posição no estado','Votos','% do estado','Situação'],limita(objs,cfg.cand.max).map(function(o,i){return [String(i+1),o.nome,sgDe(b,o.p),o.r+'º',fmt(o.v),pc(o.v,U.vvc)+'%',stTxt(o.st,o.sj)]}),
    {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}},vazio:'Nenhum candidato neste filtro.'})}
  if(x.cidades){var idx=[];G.membros.forEach(function(m){var i=pm.p.indexOf(+m);if(i>=0)idx.push(i)});
   var cids=u.cid.map(function(c){var row=pm.v[c[0]]||[],gv=0;idx.forEach(function(i){gv+=row[i]||0});return {nome:c[1],te:c[2],vv:c[3],gv:gv}});
   ordenaCid(cids,cfg.cid.ordem||'gv');
   P.secao('Votos de '+g.sg+' em cada cidade '+deUF(S.uf,U.nome),rotCid(cfg,cids.length,'gv'),['Nº','Cidade','Eleitores','Votos válidos','Votos de '+g.sg,'% dos válidos'],limita(cids,cfg.cid.max).map(function(c,i){return [String(i+1),c.nome,fmt(c.te),fmt(c.vv),fmt(c.gv),pc(c.gv,c.vv)+'%']}),
    {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right',fontStyle:'bold'},5:{halign:'right'}}})}
  return}
 var mv=u.cand[0];
 if(x.resumo){P.titulo('Resumo · '+U.nome,casaNome(cg,S.uf)+' · '+cargoNome(cg,S.uf));P.kpis([{r:'Cadeiras',v:String(U.vagas),d:nQ+' pelo quociente, '+nM+' nas sobras'},
  {r:'Quociente eleitoral',v:fmt(U.qe),d:fmt(U.vv)+' válidos ÷ '+U.vagas+' cadeiras'},{r:'Comparecimento',v:pc(U.c,U.te,1)+'%',d:fmt(U.c)+' de '+fmt(U.te)+' eleitores'},
  {r:'Brancos e nulos',v:fmt(U.vb+U.tvn),d:'brancos '+fmt(U.vb)+' · nulos '+fmt(U.tvn)},{r:'Candidatos',v:fmt(U.ncand),d:fmt(U.ncid)+' '+plural(U.ncid,'cidade','cidades')},
  {r:'Votação mínima para ser eleito',v:fmt(Math.ceil(U.qe/10)),d:'10% do quociente; nas sobras, 20%: '+fmt(Math.ceil(U.qe/5))},
  {r:'Mais votado',v:nomeProprio(mv[1]),d:sgDe(b,mv[3])+' · '+fmt(mv[4])+' votos'},{r:'Votos sub judice',v:fmt(U.vvc-U.vv),d:'fora da conta até o julgamento'}])}
 if(x.cadeiras){var lim2=Math.ceil(15*U.vv/1000);P.titulo('Divisão das '+U.vagas+' cadeiras','Cada quociente eleitoral completo ('+fmt(U.qe)+' votos) dá direito a uma cadeira, se o partido tiver candidato com 10% do quociente. As que sobram vão para as maiores médias, entre partidos com 80% do quociente e candidatos com 20%. Federação conta junta.');
  var head=['Partido ou federação','Votos','% dos válidos','Quocientes alcançados','Cadeiras pelo quociente','Cadeiras nas sobras','Total de cadeiras'];if(b.cl)head.push('1,5% para a cláusula');
  P.tabela(head,u.agr.map(function(a){var fed=a[1]==='fed',n=a[0].slice(1),l=[fed?b.fed[n].sg:sgDe(b,n),fmt(a[3]),pc(a[3],U.vv)+'%',razao(a[3],U.qe,2),String(a[9]),String(a[10]),String(a[8])];
   if(b.cl)l.push(a[3]>=lim2?'alcançou':'faltaram '+fmt(lim2-a[3]));return l}),
   {cols:{0:{fontStyle:'bold',cellWidth:38},1:{halign:'right'},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'},6:{halign:'right',fontStyle:'bold'}}});
  var qpx=u.agr.filter(function(a){return a[9]<a[7]});if(qpx.length)P.texto(qpx.map(function(a){var n=a[0].slice(1);return (a[1]==='fed'?b.fed[n].sg:sgDe(b,n))+' teve quociente partidário '+a[7]+', mas só '+a[9]+' '+plural(a[9],'candidato','candidatos')+' com 10% do quociente eleitoral'}).join('; ')+'. A cadeira que faltou foi para as sobras.',8,COR.ink3);
  var sjs=u.agr.filter(function(a){return a[6]>0});if(sjs.length)P.texto('Votos sub judice, fora da conta até o julgamento: '+sjs.map(function(a){var n=a[0].slice(1);return (a[1]==='fed'?b.fed[n].sg:sgDe(b,n))+' '+fmt(a[6])}).join('; ')+'.',8,COR.ink3)}
 if(x.eleitos){var el=u.cand.filter(function(c){return eleito(c[5])});P.titulo('Os '+el.length+' eleitos','Do mais ao menos votado.');
  P.tabela(['Nº','Candidato','Partido','Votos','% do estado','Como'],el.map(function(c,i){return [String(i+1),nomeProprio(c[1]),sgDe(b,c[3]),fmt(c[4]),pc(c[4],U.vvc)+'%',c[5]==='Q'?'Eleito pelo quociente':'Eleito nas sobras']}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},3:{halign:'right'},4:{halign:'right'}}})}
 if(x.candidatos){var objs2=filtraCand(u.cand.map(function(c){return {n:c[0],nome:nomeProprio(c[1]),p:c[3],v:c[4],st:c[5],sj:c[6],r:c[8]}}),cfg.cand.filtro);
  P.secao('Candidatos '+deUF(S.uf,U.nome),rotFiltro(cfg)+' '+fmt(objs2.length)+' no total deste filtro.',['Pos.','Candidato','Partido','Nº urna','Votos','% do estado','Situação'],limita(objs2,cfg.cand.max).map(function(o){return [o.r+'º',o.nome,sgDe(b,o.p),String(o.n),fmt(o.v),pc(o.v,U.vvc)+'%',stTxt(o.st,o.sj)]}),
   {cols:{0:{halign:'right',cellWidth:14},1:{fontStyle:'bold'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}}})}
 if(x.cidades){var cids2=u.cid.map(function(c){var l=info[c[7]],l2=c[9]?info[c[9]]:null;return {nome:c[1],te:c[2],vv:c[3],c:c[6],lid:l?(nomeProprio(l[1])+' ('+sgDe(b,l[3])+')'+(l2?' e '+nomeProprio(l2[1])+' ('+sgDe(b,l2[3])+'), empate':'')+' '+fmt(c[8])):'-'}});
  ordenaCid(cids2,cfg.cid.ordem==='gv'?'te':cfg.cid.ordem||'te');
  P.secao('Cidades '+deUF(S.uf,U.nome),rotCid(cfg,cids2.length,'te'),['Nº','Cidade','Eleitores','Comparecimento','Votos válidos','Mais votado'],limita(cids2,cfg.cid.max).map(function(c,i){return [String(i+1),c.nome,fmt(c.te),pc(c.c,c.te,1)+'%',fmt(c.vv),c.lid]}),
   {fs:8.2,cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold',cellWidth:38},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}})}}
function ordenaCid(arr,o){arr.sort(o==='nome'?function(a,c){return a.nome.localeCompare(c.nome,'pt')}:o==='gm'?function(a,c){return a.gv-c.gv||c.te-a.te}:function(a,c){return c[o]-a[o]||c.te-a.te})}
function rotCid(cfg,total,padrao){var od=cfg.cid.ordem||padrao;var o=od==='gm'?'das com menos votos, começando pelas sem nenhum voto (as de mais eleitores primeiro)':od==='nome'?'em ordem alfabética':od==='vv'?'das com mais votos válidos':od==='gv'&&padrao==='gv'?'das com mais votos do grupo':'das com mais eleitores';
 if(total===1)return 'A única cidade deste recorte.';
 return (cfg.cid.max&&cfg.cid.max<total?cfg.cid.max+' de '+total+' cidades, ':'As '+total+' cidades, ')+o+'.'}

function secCidade(P,cg,b,u,m,cfg,S,rec){var x=cfg.secs,U=b.U[S.uf],G=grupoDe(b,S),ci=null;u.cid.forEach(function(c){if(c[0]===S.cid)ci=c});if(rec)m={t:rec.t,c:rec.c,p:rec.p};
 var sub=!!rec,onde=ci[1],ondeSub=sub?'Recorte: '+rec.rot+'. ':'',t=m.t,info={};u.cand.forEach(function(c){info[c[0]]=c});
 function doG(p){return !G||G.membros.indexOf(String(p))>=0}
 if(x.resumo){var emp=m.c.length>1&&m.c[1][1]===m.c[0][1],lid=m.c[0]?nomeProprio(info[m.c[0][0]][1])+(emp?' e '+nomeProprio(info[m.c[1][0]][1]):''):'-';
  P.titulo('Resumo · '+ci[1]+' ('+S.uf.toUpperCase()+')',(sub?rec.rot+' · ':'')+cargoNome(cg,S.uf)+' · '+(G?'grupo: '+G.g.sg:'todos os partidos'));
  var gv=0;m.p.forEach(function(p){if(doG(p[0]))gv+=p[1]});
  var k=[sub?{r:'Votaram',v:fmt(t[1]),d:'neste recorte'}:{r:'Eleitores',v:fmt(t[0]),d:fmt(t[1])+' votaram ('+pc(t[1],t[0],1)+'%)'},{r:'Votos válidos',v:fmt(t[3]),d:'para '+cargoNome(cg,S.uf)},
   {r:'Brancos',v:fmt(t[5]),d:pc(t[5],t[1],1)+'% de quem votou'},{r:'Nulos',v:fmt(t[6]),d:pc(t[6],t[1],1)+'% de quem votou'},
   (emp?{r:'Empate no 1º lugar',v:fmt(m.c[0][1])+' votos cada',d:lid}:{r:'Mais votado',v:lid,d:m.c[0]?fmt(m.c[0][1])+' votos':''}),{r:'Votos de legenda',v:fmt(t[7]),d:'só no número do partido'},
   {r:'Candidatos com voto',v:fmt(m.c.length),d:'de '+fmt(U.ncand)+' do estado'}];
  if(G)k.unshift({r:'Votos de '+G.g.sg,v:fmt(gv),d:pc(gv,t[3])+'% dos válidos '+(sub?'do recorte':'da cidade')});P.kpis(k);
  if(sub)P.nota('Recorte dentro da cidade: '+rec.rot+'. Neste recorte não há número de eleitores, só de quem votou. O quociente eleitoral e a situação de cada candidato (eleito ou não) são do estado.');
  else P.nota('O quociente eleitoral é do estado: '+fmt(U.qe)+' votos por cadeira em '+U.nome+'. Os '+fmt(t[3])+' votos válidos de '+ci[1]+' equivalem a '+
   (t[3]>=U.qe?razao(t[3],U.qe,2)+' '+(t[3]<2*U.qe?'quociente':'quocientes'):pc(t[3],U.qe,1)+'% de um quociente')+'.')}
 if(x.partidos){P.secao('Votos por partido · '+onde,ondeSub+'Votos nos candidatos mais os de legenda.',['Partido','Federação','Votos','% dos válidos','Legenda'],m.p.filter(function(p){return doG(p[0])}).map(function(p){var f=b.par[String(p[0])]&&b.par[String(p[0])].fed;
   return [sgDe(b,p[0]),f?b.fed[f].sg:'-',fmt(p[1]),pc(p[1],t[3])+'%',fmt(p[2])]}),{cols:{0:{fontStyle:'bold'},2:{halign:'right',fontStyle:'bold'},3:{halign:'right'},4:{halign:'right'}}})}
 if(x.candidatos){var objs=filtraCand(m.c.filter(function(c){return doG(info[c[0]][3])}).map(function(c){var y=info[c[0]];return {n:c[0],nome:nomeProprio(y[1]),p:y[3],v:c[1],st:y[5],sj:y[6]}}),cfg.cand.filtro);
  P.secao('Candidatos votados · '+onde+(G?' · '+G.g.sg:''),ondeSub+rotFiltro(cfg)+' Situação (eleito ou não) é o resultado do estado. '+fmt(objs.length)+' no total deste filtro.',['Nº','Candidato','Partido',sub?'Votos no recorte':'Votos na cidade',sub?'% do recorte':'% da cidade','Situação no estado'],limita(objs,cfg.cand.max).map(function(o,i){return [String(i+1),o.nome,sgDe(b,o.p),fmt(o.v),pc(o.v,t[4])+'%',stTxt(o.st,o.sj)]}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},3:{halign:'right'},4:{halign:'right'}},vazio:'Nenhum voto para este grupo '+(sub?'neste recorte.':'na cidade.')})}}

function secCand(P,cg,b,u,cc,cfg,S){var x=cfg.secs,pr=S.c.split('-'),uf=pr[0],num=pr[1],U=b.U[uf],k=null;u.cand.forEach(function(c){if(String(c[0])===num)k=c});
 if(!k){P.texto('Candidato não encontrado.',9,COR.ink);return}var cid={};u.cid.forEach(function(c){cid[c[0]]=c});var lst=cc[String(k[0])]||[],f=b.par[String(k[3])].fed;
 if(x.resumo){P.titulo('Resumo · '+nomeProprio(k[1]),nomeProprio(k[2])+' · '+b.par[String(k[3])].nome+' ('+sgDe(b,k[3])+')'+(f?' · federação '+b.fed[f].sg:'')+' · nº '+k[0]+' · '+cargoNome(cg,uf)+' · '+U.nome);
  var top=lst[0];P.kpis([{r:'Votos',v:fmt(k[4]),d:pc(k[4],U.vvc)+'% dos votos do estado (critério do TSE)'},{r:'Situação',v:stTxt(k[5],k[6]),d:'resultado em '+U.nome},
   {r:'Posição no estado',v:k[8]+'º de '+fmt(U.ncand),d:'por votos'},{r:'Posição no Brasil',v:k[9]+'º de '+fmt(b.br.candidatos),d:'entre os candidatos a '+(cg==='e'?'deputado estadual e distrital':'deputado federal')},
   {r:'Do quociente eleitoral',v:pc(k[4],U.qe,1)+'%',d:'quociente de '+fmt(U.qe)+' votos'},{r:'Cidades com voto',v:fmt(k[7])+' de '+fmt(U.ncid),d:''},
   {r:'Onde mais votou',v:top?cid[top[0]][1]:'-',d:top?fmt(top[1])+' votos · '+pc(top[1],k[4],1)+'% do total':''}]);
  if(k[6])P.nota('O registro deste candidato está em julgamento (sub judice). Os votos aparecem aqui, mas ficam fora dos válidos até a decisão.','no')}
 if(x.cidades){var tem={};lst.forEach(function(c){tem[c[0]]=1});var zeros=u.cid.filter(function(c){return !tem[c[0]]}).sort(function(a,c){return c[2]-a[2]}).map(function(c){return [c[0],0]});
  lst=cfg.cid.ordem==='gm'?zeros.concat(lst.slice().reverse()):lst.concat(zeros);var tot=lst.length;
  P.secao('Votos em cada cidade',(tot===1?'A única cidade do estado.':(cfg.cid.max&&cfg.cid.max<tot?cfg.cid.max+' de '+tot:'As '+tot)+' cidades do estado, '+(cfg.cid.ordem==='gm'?'começando pelas sem nenhum voto (as de mais eleitores primeiro).':'da que mais votou para a que menos votou; as sem voto vêm no fim.'))+' Teve voto em '+zerosFalt(lst,zeros)+'.',['Nº','Cidade','Eleitores','Votos','% do total','% dos votos da cidade'],limita(lst,cfg.cid.max).map(function(c,i){var ci=cid[c[0]];return [String(i+1),ci[1],fmt(ci[2]),fmt(c[1]),pc(c[1],k[4],1)+'%',pc(c[1],ci[4])+'%']}),
   {cols:{0:{halign:'right',cellWidth:10},1:{fontStyle:'bold'},2:{halign:'right'},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'},5:{halign:'right'}}})}}

function secCandCidade(P,cg,b,D,cfg,S){var x=cfg.secs;if(!D||!D.k||!D.ci||!D.a){P.texto('Candidato ou cidade não encontrado.',9,COR.ink);return}
 var k=D.k,ci=D.ci,U=b.U[D.uf],a=D.a,nome=nomeProprio(k[1]),NA={cidade:'na cidade',zona:'na zona',local:'no local','seção':'na seção'},DA={cidade:'da cidade',zona:'da zona',local:'do local','seção':'da seção'};
 function ord(arr){return arr.slice().sort(function(p,q){return q.v-p.v||q.base-p.base})}
 if(x.resumo){P.titulo('Resumo · '+nome+' em '+ci[1],sgDe(b,k[3])+' · nº '+k[0]+' · '+cargoNome(cg,D.uf)+(a.rot?' · '+a.rot:''));
  var kp=[{r:'Votos '+NA[a.onde],v:fmt(a.v),d:a.v?pc(a.v,a.base)+'% dos votos '+DA[a.onde]:'nenhum voto'},{r:'Posição '+NA[a.onde],v:a.v?a.pos+'º':'-',d:'entre '+fmt(a.nc)+' candidatos com voto'},
   {r:'Do total do candidato',v:pc(a.v,k[4],1)+'%',d:fmt(k[4])+' votos em '+U.nome},{r:'Situação no estado',v:stTxt(k[5],k[6]),d:'resultado em '+U.nome}];
  if(!D.zi&&D.zonas.length>1)kp.push({r:'Zonas com voto',v:D.zonas.filter(function(z){return z.v>0}).length+' de '+D.zonas.length,d:''});
  if(D.locaisR&&!D.s1&&!D.lc)kp.push({r:'Locais com voto',v:D.locaisR.filter(function(l){return l.v>0}).length+' de '+D.locaisR.length,d:''});
  if(D.secoesR&&!D.s1)kp.push({r:'Seções com voto',v:D.secoesR.filter(function(s){return s.v>0}).length+' de '+D.secoesR.length,d:''});
  if(a.rot)kp.push({r:'Na cidade inteira',v:fmt(D.cid.v),d:D.cid.v?D.cid.pos+'º mais votado':'nenhum voto'});
  P.kpis(kp)}
 if(x.zonas&&!D.zi&&D.zonas.length>1)P.secao('Votos por zona · '+ci[1],'Da zona que deu mais votos ao candidato para a que deu menos; as sem voto vêm no fim, com os votos da zona.',['Zona','Locais','Seções','Votos','% da zona','Posição na zona'],
  ord(D.zonas).map(function(z){return ['Zona '+z.z,String(z.nloc),fmt(z.nsec),fmt(z.v),z.v?pc(z.v,z.base)+'%':'-',z.v?z.pos+'º de '+fmt(z.nc):'sem voto ('+fmt(z.base)+' votos na zona)']}),
  {cols:{0:{fontStyle:'bold'},1:{halign:'right'},2:{halign:'right'},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'}}});
 if(x.locais&&!D.s1&&!D.lc){if(!D.locaisR)P.nota(ci[1]+' tem '+fmt(D.nsec)+' seções. Para listar os locais de votação e as seções, escolha uma zona na tela e gere o PDF de novo.');
  else P.secao('Votos por local de votação'+(D.zi?' · Zona '+D.zi[0]:' · '+ci[1]),'Cada prédio de votação, do que deu mais votos ao candidato para o que deu menos; os sem voto vêm no fim.',['Local de votação','Zona','Seções','Votos','% do local','Posição'],
   ord(D.locaisR).map(function(l){return [l.nome,String(l.z),String(l.nsec),fmt(l.v),l.v?pc(l.v,l.base)+'%':'-',l.v?l.pos+'º de '+fmt(l.nc):'sem voto']}),
   {cols:{0:{fontStyle:'bold'},1:{halign:'right'},2:{halign:'right'},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'}}})}
 if(x.secoes&&D.secoesR&&!D.s1)P.secao('Votos por seção'+(D.lc?' · '+D.lc[1]:D.zi?' · Zona '+D.zi[0]:' · '+ci[1]),'Cada seção, da que deu mais votos ao candidato para a que deu menos; as sem voto vêm no fim.',['Seção','Local de votação','Zona','Votos','% da seção','Posição'],
  ord(D.secoesR).map(function(s){return [String(s.sc),s.loc,String(s.z),fmt(s.v),s.v?pc(s.v,s.base)+'%':'-',s.v?s.pos+'º de '+fmt(s.nc):'sem voto']}),
  {cols:{0:{halign:'right'},2:{halign:'right'},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'}}})}

/* ---------- montagem: capa + um bloco por cargo */
function rotScope(b,S,t){var p=[];if(t==='cand')return 'candidato';if(t==='candCidade')return (S._candNome||'Candidato')+' em '+(S._cidNome||'cidade')+(S._rot?' · '+S._rot:'');var G=grupoDe(b,S);if(G)p.push(G.g.sg);if(S.uf&&b.U[S.uf])p.push(b.U[S.uf].nome);if(t==='cidade'&&S._cidNome)p.push(S._cidNome);if(t==='cidade'&&S._rot)p.push(S._rot);return p.length?p.join(' · '):'Brasil'}
R.montaPDF=function(cfg,get,jsPDF){var S=cfg.S,t=tipoDe(S),cargos=cfg.cargo==='ambos'?['f','e']:[cfg.cargo];
 return Promise.all(cargos.map(function(cg){return get('brasil.json',cg).then(prepBR)})).then(function(bs){
  var b0=bs[0],extra=Promise.resolve(),recs=cargos.map(function(){return null});
  if(t==='cidade'){extra=get('uf/'+S.uf+'.json',cargos[0]).then(function(u){u.cid.forEach(function(c){if(c[0]===S.cid)S._cidNome=c[1]})});
   /* zona, local e seção da tela: cfg.recorte(cargo) devolve {rot,t,c,p} ou null (cidade inteira) */
   if(S.z&&cfg.recorte)extra=extra.then(function(){return Promise.all(cargos.map(function(cg){return cfg.recorte(cg)})).then(function(r){recs=r;S._rot=(r[0]||r[1]||{}).rot||''})})}
  var ccD=null;if(t==='candCidade'&&cfg.candCidade)extra=cfg.candCidade(cargos[0]).then(function(D){ccD=D;if(D.k)S._candNome=nomeProprio(D.k[1]);if(D.ci)S._cidNome=D.ci[1];S._rot=D.a?D.a.rot:''});
  if(t==='cand')extra=get('uf/'+S.c.split('-')[0]+'.json',cargos[0]).then(function(u){u.cand.forEach(function(c){if(String(c[0])===S.c.split('-')[1])S._candNome=nomeProprio(c[1])})});
  return extra.then(function(){
   var escopo=t==='cand'?(S._candNome||'Candidato'):rotScope(b0,S,t),quando=cfg.quando||agora();
   var tCargo=cargos.length>1?'Deputado federal e deputado estadual':cargoTitulo(cargos[0]);
   var rp=S._rot?S._rot.split(' · '):[],locN=rp.filter(function(p){return !/^(Zona|Seção) /.test(p)}).join(' · '),
    escC=S._rot?escopo.replace(S._rot,rp.filter(function(p){return /^(Zona|Seção) /.test(p)}).join(' · ')):escopo,
    cgC=cargos.length>1?'federal e estadual':cargos[0]==='e'?'deputado estadual':'deputado federal';
   var meta={titulo:escC+' · '+tCargo,sub:(locN?'Local de votação: '+locN+' · ':'')+'Relatório de '+({brasil:'resultado nacional',grupo:'partido ou federação no país',estado:'estado',grupoUF:'partido ou federação no estado',cidade:'cidade',cand:'candidato',candCidade:'candidato na cidade'}[t]),
    quando:quando,dados:b0.at,curto:'Eleições 2026 · '+escC+' · '+cgC};
   var P=Papel(jsPDF,meta);P.capa();
   var marcadas=SECOES[t].filter(function(s){return cfg.secs[s[0]]}),fora=SECOES[t].filter(function(s){return !cfg.secs[s[0]]});
   var inc=marcadas.map(function(s){return s[1]+(s[0]==='candidatos'&&temOpcCand(t)?' ('+(cfg.cand.filtro==='eleitos'?'só eleitos':cfg.cand.filtro==='nao'?'só não eleitos':'todos')+', '+(cfg.cand.max?cfg.cand.max+' primeiros':'todos')+')':'')+
    (s[0]==='cidades'&&temOpcCid(t)?' ('+(cfg.cid.max?cfg.cid.max+' primeiras':'todas')+')':'')});
   P.caixa([['Recorte:',escopo+' · '+tCargo+'.'],['Inclui:',inc.join('; ')+'.'],['Não inclui:',fora.length?fora.map(function(s){return s[1]}).join('; ')+'.':'nada; todas as seções deste recorte estão aqui.'],
    ['Como ler:','Eleito pelo quociente = entrou com as cadeiras que o partido ganhou dividindo seus votos pelo quociente eleitoral. Eleito nas sobras = entrou nas cadeiras que restaram, pelas maiores médias. Percentual de partido sobre os votos válidos; de candidato, sobre válidos + sub judice (critério do TSE).']]);
   var seq_=Promise.resolve();
   cargos.forEach(function(cg,i){seq_=seq_.then(function(){var b=bs[i];if(cargos.length>1)P.cargo(cargoTitulo(cg));
    if(t==='brasil')return get('cand.json',cg).then(function(cs){secBrasil(P,cg,b,cs,cfg)});
    if(t==='grupo')return get('cand.json',cg).then(function(cs){secGrupo(P,cg,b,cs,cfg,S)});
    if(t==='estado'||t==='grupoUF')return Promise.all([get('uf/'+S.uf+'.json',cg),(S.p||S.f)?get('pm/'+S.uf+'.json',cg):null]).then(function(r){secEstado(P,cg,b,r[0],r[1],cfg,S)});
    if(t==='cidade')return Promise.all([get('uf/'+S.uf+'.json',cg),get('m/'+S.uf+'/'+S.cid+'.json',cg)]).then(function(r){secCidade(P,cg,b,r[0],r[1],cfg,S,recs[i])});
    if(t==='candCidade')return secCandCidade(P,cg,b,ccD,cfg,S);
    if(t==='cand'){var uf=S.c.split('-')[0];return get('uf/'+uf+'.json',cg).then(function(u){var k=null;u.cand.forEach(function(c){if(String(c[0])===S.c.split('-')[1])k=c});
     return (k?get('cc/'+uf+'/'+k[3]+'.json',cg).catch(function(){return {}}):Promise.resolve({})).then(function(cc){secCand(P,cg,b,u,cc,cfg,S)})})}})});
   var arq=S._rot?escopo.replace(S._rot,S._rot.split(' · ').filter(function(p){return /^(Zona|Seção) /.test(p)}).join(' ')):escopo;
   return seq_.then(function(){P.fechar();return {doc:P.doc,nome:nomeArquivo(arq,tCargo)}})})})};
function agora(){var d=new Date(),z=function(n){return (n<10?'0':'')+n};return z(d.getDate())+'/'+z(d.getMonth()+1)+'/'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes())}
function zerosFalt(lst,zeros){var c=lst.length-zeros.length;return zeros.length?c+' '+plural(c,'cidade','cidades')+' e nenhum voto em '+zeros.length:'todas as '+c}
function nomeArquivo(escopo,cargo){var s=(escopo+' '+cargo).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return 'eleicoes-2026-'+s.slice(0,80)+'.pdf'}
R.SECOES=SECOES;R.tipoDe=tipoDe;

/* ---------- painel de escolha na página */
var CTX=null,box=null;
function el(h){var t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function carregaLibs(){if(raiz.jspdf&&raiz.jspdf.jsPDF&&raiz.jspdf.jsPDF.API.autoTable)return Promise.resolve();
 function sc(src){return new Promise(function(ok,falha){var s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=function(){falha(new Error(src))};document.head.appendChild(s)})}
 return sc('vendor/jspdf.umd.min.js').then(function(){return sc('vendor/jspdf.plugin.autotable.min.js')})}
R.abrir=function(ctx){CTX=ctx;var S=ctx.S,t=tipoDe(S);
 if(box)box.remove();
 var cg0=S.cg==='e'?'e':'f',secs=SECOES[t];
 var h='<section class="rel" id="rel" aria-labelledby="rel-t"><div class="rel-h"><h2 id="rel-t">Relatório em PDF</h2><button type="button" class="limpa" data-rel="fechar">Fechar</button></div>'+
  '<p class="rel-rec">Recorte: '+ctx.rotulo().replace(/^Mostrando:?\s*(o\s)?/,'')+'. Para mudar o recorte, use os filtros acima e toque de novo em Relatório.</p>'+
  '<fieldset class="caixa"><legend>Cargo</legend><div class="seg" data-grupo="cargo">'+
  [['f','Deputado federal'],['e','Deputado estadual'],['ambos','Os dois']].filter(function(o){return (t!=='cand'&&t!=='candCidade')||o[0]===cg0}).map(function(o){return '<button type="button" data-v="'+o[0]+'" class="'+(o[0]===cg0?'on':'')+'" aria-pressed="'+(o[0]===cg0)+'">'+o[1]+'</button>'}).join('')+'</div></fieldset>'+
  '<div class="rel-pe"><span class="rel-st" aria-live="polite"></span><button type="button" class="pdf-btn" data-rel="pdf">Baixar PDF</button></div>'+
  '<details class="rel-mais"><summary>Escolher o que entra no PDF</summary>'+
  '<fieldset class="caixa"><legend>O que entra no relatório</legend><div class="rel-secs">'+secs.map(function(s){return '<label class="chk"><input type="checkbox" data-sec="'+s[0]+'" checked><span><b>'+esc(s[1])+'</b><small>'+esc(s[2])+'</small></span></label>'}).join('')+'</div></fieldset>'+
  (temOpcCand(t)?'<fieldset class="caixa"><legend>Candidatos</legend><div class="f-linha"><div class="campo"><label for="rel-cf">Quais</label><select id="rel-cf"><option value="todos">Eleitos e não eleitos</option><option value="eleitos">Só eleitos</option><option value="nao">Só não eleitos</option></select></div>'+
   '<div class="campo"><label for="rel-cm">Quantos</label><select id="rel-cm"><option value="20">20 primeiros</option><option value="50" selected>50 primeiros</option><option value="100">100 primeiros</option><option value="0">Todos</option></select></div></div></fieldset>':'')+
  (temOpcCid(t)?'<fieldset class="caixa"><legend>Cidades</legend><div class="f-linha"><div class="campo"><label for="rel-xm">Quantas</label><select id="rel-xm"><option value="20">20</option><option value="50" selected>50</option><option value="100">100</option><option value="0">Todas</option></select></div>'+
   '<div class="campo"><label for="rel-xo">Ordem</label><select id="rel-xo">'+(t==='grupoUF'?'<option value="gv">Mais votos do grupo</option><option value="gm">Menos votos (sem voto primeiro)</option>':'')+(t==='cand'?'<option value="gv">Mais votos</option><option value="gm">Menos votos (sem voto primeiro)</option>':'<option value="te">Mais eleitores</option><option value="vv">Mais votos válidos</option><option value="nome">Nome</option>')+'</select></div></div></fieldset>':'')+
  '</details></section>';
 box=el(h);ctx.depois.insertAdjacentElement('afterend',box);box.scrollIntoView({block:'start'});
 box.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;
  if(b.dataset.rel==='fechar'){box.remove();box=null;return}
  if(b.parentNode.dataset.grupo==='cargo'){[].forEach.call(b.parentNode.children,function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});return}
  if(b.dataset.rel==='pdf')gerar(b)})};
function lerCfg(){var S=CTX.S,secs={};[].forEach.call(box.querySelectorAll('[data-sec]'),function(c){secs[c.dataset.sec]=c.checked});
 var cg=box.querySelector('[data-grupo="cargo"] .on');
 return {S:Object.assign({},S),recorte:CTX.recorte,candCidade:CTX.candCidade,cargo:cg?cg.dataset.v:(S.cg==='e'?'e':'f'),secs:secs,
  cand:{filtro:(box.querySelector('#rel-cf')||{}).value||'todos',max:+((box.querySelector('#rel-cm')||{}).value||50)},
  cid:{max:+((box.querySelector('#rel-xm')||{}).value||50),ordem:(box.querySelector('#rel-xo')||{}).value||'te'}}}
function gerar(btn){var st=box.querySelector('.rel-st'),cfg=lerCfg();
 if(!Object.keys(cfg.secs).some(function(k){return cfg.secs[k]})){st.textContent='Marque pelo menos uma seção.';return}
 btn.disabled=true;st.textContent='Montando o PDF…';
 carregaLibs().then(function(){return R.montaPDF(cfg,CTX.get,raiz.jspdf.jsPDF)}).then(function(r){r.doc.save(r.nome);var np=r.doc.getNumberOfPages();st.textContent='Pronto: '+np+' '+plural(np,'página','páginas')+' ('+r.nome+'). ';
  try{var a=document.createElement('a');a.href=r.doc.output('bloburl');a.target='_blank';a.rel='noopener';a.textContent='Se o download não começou, toque aqui para abrir o PDF.';st.appendChild(a)}catch(e){}})
 .catch(function(err){if(raiz.console)console.error(err);st.textContent='Não consegui gerar o PDF. Confira a conexão e tente de novo.'})
 .then(function(){btn.disabled=false})}

if(typeof module!=='undefined'&&module.exports)module.exports=R;else raiz.RELATORIO=R;
})(typeof window!=='undefined'?window:globalThis);
