/**
 * build-report.mjs — Gera relatorio_executivo.docx a partir de data.json e converte para PDF.
 * Requer: pacote npm "docx" e LibreOffice instalado (soffice) para o PDF.
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, ImageRun
} from "docx";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(readFileSync(join(__dirname, "data.json"), "utf-8"));
const c = d.current, delta = d.delta, troca = d.troca, ref = d.ref;
const LOGO = existsSync(join(__dirname, "logo.png")) ? readFileSync(join(__dirname, "logo.png")) : null;

const NAVY="1E2A44", EMER="2F8A5F", AMBER="B26A00", BORD="B23636", MUTE="6B7585", LINE="DDDDDD";
const brl=(v,dec=2)=>v==null?"—":v.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
const int=(v)=>v==null?"—":Math.round(v).toLocaleString("pt-BR");
const pct=(x)=>(x>0?"+":"")+(x??0).toFixed(1).replace(".",",")+"%";
const colorOf=(x)=>Math.abs(x)<0.3?MUTE:(x>0?BORD:EMER); // custo: alta=vermelho, queda=verde

const cellB={style:BorderStyle.SINGLE,size:1,color:LINE};
const borders={top:cellB,bottom:cellB,left:cellB,right:cellB};
const th=(t,w)=>new TableCell({borders,width:{size:w,type:WidthType.DXA},shading:{fill:NAVY,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:110,right:110},verticalAlign:VerticalAlign.CENTER,children:[new Paragraph({children:[new TextRun({text:t,bold:true,color:"FFFFFF",size:17})]})]});
const td=(runs,w,align)=>new TableCell({borders,width:{size:w,type:WidthType.DXA},margins:{top:55,bottom:55,left:110,right:110},verticalAlign:VerticalAlign.CENTER,children:[new Paragraph({alignment:align||AlignmentType.LEFT,children:Array.isArray(runs)?runs:[new TextRun({text:String(runs),size:18})]})]});
const v=(t,col)=>new TextRun({text:t,bold:true,color:col,size:18});
const h2=(t)=>new Paragraph({spacing:{before:220,after:100},border:{bottom:{style:BorderStyle.SINGLE,size:6,color:NAVY,space:2}},children:[new TextRun({text:t,bold:true,size:22,color:NAVY})]});
const bullet=(runs)=>new Paragraph({numbering:{reference:"b",level:0},spacing:{after:70},children:runs});

const W=9360;
const fertTable=new Table({width:{size:W,type:WidthType.DXA},columnWidths:[2600,1900,1900,2960],rows:[
  new TableRow({tableHeader:true,children:[th("Fertilizante (FOB)",2600),th("Preço",1900),th("Var.",1900),th("Observação",2960)]}),
  new TableRow({children:[td("Ureia",2600),td(`US$ ${int(c.ureia)}/t`,1900,AlignmentType.RIGHT),td([v(pct(delta.ureia),colorOf(delta.ureia))],1900,AlignmentType.RIGHT),td([new TextRun({text:"Nitrogenado",size:17})],2960)]}),
  new TableRow({children:[td("MAP",2600),td(`US$ ${int(c.map)}/t`,1900,AlignmentType.RIGHT),td([v(pct(delta.map),colorOf(delta.map))],1900,AlignmentType.RIGHT),td([new TextRun({text:"Fosfatado",size:17})],2960)]}),
  new TableRow({children:[td("Cloreto de Potássio (KCl)",2600),td(`US$ ${int(c.kcl)}/t`,1900,AlignmentType.RIGHT),td([v(pct(delta.kcl),colorOf(delta.kcl))],1900,AlignmentType.RIGHT),td([new TextRun({text:"Potássico",size:17})],2960)]}),
]});

const sojaTable=new Table({width:{size:W,type:WidthType.DXA},columnWidths:[3400,1980,1980,2000],rows:[
  new TableRow({tableHeader:true,children:[th("Indicador",3400),th("Atual",1980),th("Var.",1980),th("Leitura",2000)]}),
  new TableRow({children:[td("Soja CEPEA (Nacional)",3400),td(`R$ ${brl(c.soja)}/sc`,1980,AlignmentType.RIGHT),td([v(pct(delta.soja),colorOf(-delta.soja))],1980,AlignmentType.RIGHT),td([new TextRun({text:"—",size:17})],2000)]}),
  new TableRow({children:[td("Soja Tocantins (Agrolink)",3400),td(`R$ ${brl(c.sojaTO)}/sc`,1980,AlignmentType.RIGHT),td([v(pct(delta.sojaTO),colorOf(-delta.sojaTO))],1980,AlignmentType.RIGHT),td([new TextRun({text:"Spread regional",size:17})],2000)]}),
  new TableRow({children:[td("Troca Soja/MAP",3400),td(`${brl(troca.map,1)} sc/t`,1980,AlignmentType.RIGHT),td([v(pct(delta.trocaMap),colorOf(delta.trocaMap))],1980,AlignmentType.RIGHT),td([new TextRun({text:delta.trocaMap<0?"Melhora":"Piora",size:17})],2000)]}),
  new TableRow({children:[td("Troca Soja/Ureia",3400),td(`${brl(troca.ureia,1)} sc/t`,1980,AlignmentType.RIGHT),td([new TextRun({text:"—",size:18,color:MUTE})],1980,AlignmentType.RIGHT),td([new TextRun({text:"Indicativo",size:17})],2000)]}),
]});

const macroTable=new Table({width:{size:W,type:WidthType.DXA},columnWidths:[3400,1980,1980,2000],rows:[
  new TableRow({tableHeader:true,children:[th("Driver macro",3400),th("Atual",1980),th("Var.",1980),th("Efeito",2000)]}),
  new TableRow({children:[td("Dólar (R$/US$)",3400),td(brl(c.dolar),1980,AlignmentType.RIGHT),td([v(pct(delta.dolar),colorOf(delta.dolar))],1980,AlignmentType.RIGHT),td([new TextRun({text:"Custo de importação",size:17})],2000)]}),
  new TableRow({children:[td("Gás Natural (Henry Hub)",3400),td(`US$ ${brl(c.gas)}`,1980,AlignmentType.RIGHT),td([v(pct(delta.gas),colorOf(delta.gas))],1980,AlignmentType.RIGHT),td([new TextRun({text:"Pressiona ureia",size:17})],2000)]}),
  new TableRow({children:[td("Frete Marítimo (BDI)",3400),td(`${int(c.bdi)} pts`,1980,AlignmentType.RIGHT),td([v(pct(delta.bdi),colorOf(delta.bdi))],1980,AlignmentType.RIGHT),td([new TextRun({text:"Custo de importação",size:17})],2000)]}),
  new TableRow({children:[td("Diesel S10 (ANP)",3400),td(`R$ ${brl(c.diesel)}/L`,1980,AlignmentType.RIGHT),td([v(pct(delta.diesel),colorOf(delta.diesel))],1980,AlignmentType.RIGHT),td([new TextRun({text:"Frete interno",size:17})],2000)]}),
]});

// Causas heurísticas (a partir dos deltas — sem inventar notícias)
const movers=[
  {n:"Ureia",x:delta.ureia},{n:"MAP",x:delta.map},{n:"KCl",x:delta.kcl},
  {n:"Dólar",x:delta.dolar},{n:"Gás Natural",x:delta.gas},{n:"BDI",x:delta.bdi},{n:"Diesel",x:delta.diesel},
].filter(m=>Math.abs(m.x)>=0.5).sort((a,b)=>Math.abs(b.x)-Math.abs(a.x)).slice(0,4);
const causasBullets = movers.length
  ? movers.map(m=>bullet([new TextRun({text:`${m.n}: `,bold:true,size:18}),new TextRun({text:`${m.x>0?"alta":"queda"} de ${pct(m.x)} no período.`,size:18})]))
  : [bullet([new TextRun({text:"Período sem variações relevantes (todas abaixo de 0,5%).",size:18})])];

const doc=new Document({
  creator:"Equipe de Planejamento, Controle e Pesquisa Florestal",
  title:"Relatório Executivo — Inteligência de Mercado de Insumos Florestais",
  styles:{default:{document:{run:{font:"Arial",size:19}}}},
  numbering:{config:[{reference:"b",levels:[{level:0,format:LevelFormat.BULLET,text:"\u2022",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:460,hanging:260}}}}]}]},
  sections:[{
    properties:{page:{size:{width:12240,height:15840},margin:{top:1500,right:1440,bottom:1080,left:1440,header:480,footer:480}}},
    headers: LOGO ? {default:new Header({children:[new Paragraph({alignment:AlignmentType.RIGHT,spacing:{after:0},children:[new ImageRun({type:"png",data:LOGO,transformation:{width:168,height:60}})]})]})} : undefined,
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,border:{top:{style:BorderStyle.SINGLE,size:4,color:LINE,space:6}},children:[new TextRun({text:`Inteligência de Mercado · ${ref}  ·  Página `,size:15,color:MUTE}),new TextRun({children:[PageNumber.CURRENT],size:15,color:MUTE}),new TextRun({text:" de ",size:15,color:MUTE}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:15,color:MUTE})]})]})},
    children:[
      new Paragraph({spacing:{after:20},children:[new TextRun({text:"RELATÓRIO EXECUTIVO",bold:true,size:16,color:MUTE,characterSpacing:30})]}),
      new Paragraph({spacing:{after:30},children:[new TextRun({text:"Inteligência de Mercado de Insumos Florestais",bold:true,size:30,color:NAVY})]}),
      new Paragraph({spacing:{after:60},border:{bottom:{style:BorderStyle.SINGLE,size:12,color:NAVY,space:4}},children:[new TextRun({text:`Equipe de Planejamento, Controle e Pesquisa Florestal  ·  Referência: ${ref}  ·  Gerado em ${d.updatedAtBR}`,size:17,color:MUTE})]}),
      h2("1. Sumário Executivo"),
      new Paragraph({spacing:{after:120},alignment:AlignmentType.JUSTIFIED,children:[
        new TextRun({text:`Leitura de ${ref}. `,size:19}),
        new TextRun({text:`Ureia FOB em US$ ${int(c.ureia)}/t (${pct(delta.ureia)}), MAP US$ ${int(c.map)}/t e KCl US$ ${int(c.kcl)}/t. `,size:19}),
        new TextRun({text:`O dólar está em R$ ${brl(c.dolar)} (${pct(delta.dolar)}) e a soja CEPEA em R$ ${brl(c.soja)}/saca. `,size:19}),
        new TextRun({text:`A relação de troca soja/MAP é de ${brl(troca.map,1)} sacas/t.`,size:19}),
      ]}),
      h2("2. Preços de Fertilizantes (FOB) e Variação"),fertTable,
      h2("3. Soja e Relação de Troca"),sojaTable,
      h2("4. Indicadores Macroeconômicos (Drivers)"),macroTable,
      h2("5. Principais Variações do Período"),...causasBullets,
      new Paragraph({spacing:{before:60,after:40},children:[new TextRun({text:"Observação: as causas qualitativas (notícias, geopolítica, safra) devem ser revisadas manualmente — este resumo é gerado a partir das variações numéricas.",italics:true,size:15,color:MUTE})]}),
      h2("6. Fontes e Notas Metodológicas"),
      new Paragraph({spacing:{after:40},children:[new TextRun({text:`Fontes automáticas: AwesomeAPI (câmbio), CEPEA/ESALQ (soja), ANP (diesel), stooq (BDI). Fertilizantes e gás natural: override manual (fertilizers-override.json). Status desta execução: ${JSON.stringify(d.status)}.`,size:15,color:MUTE})]}),
      new Paragraph({children:[new TextRun({text:"Notas: preços FOB de fertilizantes usam benchmark de importação (COMEX) e dependem de atualização manual periódica. Variações são calculadas frente à leitura anterior registrada. Relações de troca são derivadas (preço FOB em R$ ÷ preço da soja) e têm caráter indicativo.",size:15,color:MUTE})]}),
    ],
  }],
});

const docxPath=join(__dirname,"relatorio_executivo.docx");
const buf=await Packer.toBuffer(doc);
writeFileSync(docxPath,buf);
console.log("[report] docx gerado.");

// Converte para PDF via LibreOffice (soffice). No Windows o executável é soffice.exe (precisa estar no PATH).
const candidates=["soffice","soffice.exe","C:\\Program Files\\LibreOffice\\program\\soffice.exe"];
let ok=false;
for(const exe of candidates){
  const r=spawnSync(exe,["--headless","--convert-to","pdf","--outdir",__dirname,docxPath],{stdio:"ignore"});
  if(r.status===0){ ok=true; break; }
}
console.log(ok?"[report] PDF gerado.":"[report] PDF NÃO gerado — verifique se o LibreOffice (soffice) está instalado e no PATH. O .docx foi gerado normalmente.");
