/* Parse math before Markdown can consume LaTeX escapes/underscores.
   Raw chat HTML and generated formula markup have separate sanitizer policies. */
function readMath(source, block = false) {
  const delimiters = block ? [['$$','$$',true],['\\[','\\]',true]] : [['$$','$$',true],['\\[','\\]',true],['\\(','\\)',false],['$','$',false]];
  for(const [left,right,display] of delimiters) {
    if(!source.startsWith(left))continue;
    for(let end=left.length;end<source.length;end++) {
      if(!source.startsWith(right,end))continue;
      let escapes=0;for(let i=end-1;i>=0&&source[i]==='\\';i--)escapes++;
      if(escapes%2)continue;
      const latex=source.slice(left.length,end);
      // Single dollars must touch their content: ordinary prices stay text.
      if(!latex.trim() || left==='$' && (/^\s|\s$/.test(latex)||latex.includes('\n')))return;
      return {raw:source.slice(0,end+right.length),latex,display};
    }
    return;
  }
}
globalThis.kairosRichText = {
  render(element, text) {
    const formulas=[];const prefix='KAIROSMATH'+crypto.randomUUID().replaceAll('-','');
    const extension=(level)=>({name:'math'+level,level,
      start:source=>{const at=source.search(level==='block'?/\$\$|\\\[/:/\$|\\[([]/);return at<0?undefined:at;},
      tokenizer(source){const math=readMath(source,level==='block');if(math)return {type:'math'+level,...math};},
      renderer(token){const index=formulas.push(token)-1;return prefix+'X'+index+'END'+(level==='block'?'\n':'');},
    });
    const parser=new marked.Marked({gfm:true,breaks:true},{extensions:[extension('block'),extension('inline')]});
    const html = parser.parse(String(text ?? ''));
    element.replaceChildren(DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','b','em','i','s','del','blockquote','ul','ol','li','a','pre','code','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR: ['href','title','start'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    }));
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    const placeholder=new RegExp(prefix+'X(\\d+)END','g');
    for(const node of nodes) {
      const value=node.nodeValue;let match;let offset=0;const fragment=document.createDocumentFragment();
      while((match=placeholder.exec(value))) {
        fragment.append(document.createTextNode(value.slice(offset,match.index)));
        const formula=formulas[Number(match[1])];const span=document.createElement('span');
        span.className='math-formula'+(formula.display?' math-display':'');span.dataset.latex=formula.latex;
        try {
          if(formula.latex.length>10000||Number(match[1])>=100)throw Error('Formula limit');
          const rendered=katex.renderToString(formula.latex,{displayMode:formula.display,throwOnError:true,trust:false,maxExpand:200,maxSize:10,macros:{},output:'htmlAndMathml',strict:'ignore'});
          span.append(DOMPurify.sanitize(rendered,{RETURN_DOM_FRAGMENT:true,USE_PROFILES:{html:true,svg:true,mathMl:true},FORBID_TAGS:['a','img','script','style','iframe'],FORBID_ATTR:['id'],ALLOW_DATA_ATTR:false}));
        }catch {
          span.className='math-fallback';span.textContent=formula.raw;span.title='Diese Formel konnte nicht dargestellt werden.';
        }
        fragment.append(span);offset=match.index+match[0].length;
      }
      if(offset){fragment.append(document.createTextNode(value.slice(offset)));node.replaceWith(fragment);}
    }
    for (const link of element.querySelectorAll('a')) {
      const href = link.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) link.removeAttribute('href');
      else link.addEventListener('click', event => {
        event.preventDefault(); window.qwenChat.openLink(href);
      });
    }
  },
  text(element) {
    const copy=element.cloneNode(true);
    for(const formula of copy.querySelectorAll('.math-formula'))formula.replaceWith(document.createTextNode(formula.dataset.latex));
    return copy.innerText ?? copy.textContent ?? '';
  },
};
