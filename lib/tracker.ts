/**
 * ZELREX ANALYTICS TRACKER
 * 
 * This script is injected into the <head> of every deployed freelancer website.
 * It sends anonymous events to the Zelrex analytics endpoint.
 * 
 * What it tracks:
 * - Page views (with path, referrer, device type)
 * - CTA clicks (pricing buttons, contact buttons, booking links)
 * - Checkout starts (clicks on Stripe payment links)
 * - Scroll depth (25%, 50%, 75%, 100%)
 * - Time on page
 * 
 * What it does NOT do:
 * - No cookies (uses sessionStorage for visit dedup)
 * - No PII collection
 * - No cross-site tracking
 * - No third-party scripts
 * - < 2KB gzipped
 * 
 * Usage in buildPreviewHtml or deploy:
 *   <script data-zelrex-site="${userId}" src="https://zelrex.ai/api/analytics/tracker.js"></script>
 *   OR inline:
 *   <script>${trackerScript(userId)}</script>
 */

export function generateTrackerScript(userId: string, siteId?: string): string {
  return `(function(){
  var Z_USER="${userId}";
  var Z_SITE="${siteId || ''}";
  var Z_API="${process.env.NEXT_PUBLIC_APP_URL || 'https://zelrex.ai'}/api/analytics/track";
  var vid;
  try{vid=sessionStorage.getItem('z_vid');if(!vid){vid='v_'+Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem('z_vid',vid)}}catch(e){vid='v_'+Math.random().toString(36).slice(2)}
  var dev=window.innerWidth<768?'mobile':window.innerWidth<1024?'tablet':'desktop';
  function send(type,data){
    try{
      var payload=Object.assign({user_id:Z_USER,site_id:Z_SITE,event_type:type,visitor_id:vid,referrer:document.referrer||'',device_type:dev,page_path:location.pathname},data||{});
      if(navigator.sendBeacon){navigator.sendBeacon(Z_API,JSON.stringify(payload))}
      else{var x=new XMLHttpRequest();x.open('POST',Z_API);x.setRequestHeader('Content-Type','application/json');x.send(JSON.stringify(payload))}
    }catch(e){}
  }
  send('pageview');
  var scrollMarks={25:false,50:false,75:false,100:false};
  function checkScroll(){
    var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight)-window.innerHeight;
    if(h<=0)return;
    var pct=Math.round((window.scrollY/h)*100);
    [25,50,75,100].forEach(function(m){if(pct>=m&&!scrollMarks[m]){scrollMarks[m]=true;send('scroll_depth',{metadata:JSON.stringify({depth:m})})}});
  }
  window.addEventListener('scroll',checkScroll,{passive:true});
  document.addEventListener('click',function(e){
    var el=e.target;
    while(el&&el!==document.body){
      if(el.tagName==='A'||el.tagName==='BUTTON'||el.tagName==='SPAN'){
        var href=el.getAttribute('href')||'';
        var txt=(el.textContent||'').trim().slice(0,100);
        var id=el.getAttribute('id')||el.getAttribute('data-nav')||'';
        if(href.indexOf('stripe.com')>-1||href.indexOf('buy.stripe.com')>-1){
          send('checkout_start',{element_id:id,element_text:txt,metadata:JSON.stringify({href:href})});
        }else if(el.classList.contains('btn-primary')||el.classList.contains('btn-secondary')||id){
          send('cta_click',{element_id:id||'btn',element_text:txt,metadata:JSON.stringify({href:href})});
        }
        break;
      }
      el=el.parentElement;
    }
  });
  var startTime=Date.now();
  window.addEventListener('beforeunload',function(){
    var duration=Math.round((Date.now()-startTime)/1000);
    send('time_on_page',{metadata:JSON.stringify({seconds:duration})});
  });
})();`;
}

/**
 * Returns the inline script tag to inject into website HTML
 */
export function getTrackerScriptTag(userId: string, siteId?: string): string {
  return `<script>${generateTrackerScript(userId, siteId)}</script>`;
}
