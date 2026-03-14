import { NextResponse } from 'next/server';

/**
 * GET /api/z/t.js?u=userId
 * 
 * Serves the analytics tracker as an external JavaScript file.
 * The deployed website loads this via <script src="...">.
 * 
 * This means:
 * - Tracker code updates instantly without redeploying freelancer sites
 * - The script is always the latest version
 * - Cached for 5 minutes to reduce load
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('u') || '';
  
  const script = `(function(){
  var U="${userId}";if(!U)return;
  var H="https://zelrex.ai/api/z/px";
  var vid;try{vid=sessionStorage.getItem('_zv');if(!vid){vid=Math.random().toString(36).slice(2,10);sessionStorage.setItem('_zv',vid)}}catch(e){vid=Math.random().toString(36).slice(2,10)}
  var dv=window.innerWidth<768?'m':window.innerWidth<1024?'t':'d';
  var curPage='home';
  function px(t,x){new Image().src=H+'?u='+U+'&t='+t+'&v='+vid+'&p='+encodeURIComponent('/'+curPage)+'&r='+encodeURIComponent(document.referrer)+'&d='+dv+(x?'&x='+encodeURIComponent(x):'')}
  px('pv');
  var sm={};
  window.addEventListener('scroll',function(){var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight;if(h<=0)return;var p=Math.round(window.scrollY/h*100);[25,50,75,100].forEach(function(m){if(p>=m&&!sm[m]){sm[m]=1;px('sd',m)}})},{passive:true});
  document.addEventListener('click',function(e){
    var el=e.target;
    while(el&&el!==document.body){
      var nav=el.getAttribute&&el.getAttribute('data-nav');
      var hr=el.getAttribute&&(el.getAttribute('href')||'');
      var tx=(el.textContent||'').trim().slice(0,60);
      var tag=el.tagName;
      if(nav){
        if(nav!==curPage){curPage=nav;sm={};setTimeout(function(){px('pv')},50)}
        if((tag==='SPAN'||tag==='A')&&el.classList.contains('btn-primary')){px('cc',nav+'|'+tx)}
        break;
      }
      if(tag==='A'&&hr&&hr.indexOf('stripe.com')>-1){px('cs',tx);break}
      if(tag==='A'&&hr&&hr.indexOf('mailto:')>-1){px('cc','email|'+tx);break}
      if(tag==='A'&&hr&&hr.indexOf('http')===0){px('cc','link|'+tx);break}
      if((tag==='A'||tag==='BUTTON'||tag==='SPAN')&&(el.classList.contains('btn-primary')||el.classList.contains('btn-secondary'))){px('cc','btn|'+tx);break}
      el=el.parentElement;
    }
  },true);
  var st=Date.now();
  window.addEventListener('beforeunload',function(){px('tp',Math.round((Date.now()-st)/1000))});
})();`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
