// lib/websiteContactForm.ts — Generates a working contact form for freelancer websites
// Uses mailto: approach (no backend needed) — form submits open the user's email client

export function generateContactFormHtml(businessEmail: string, businessName: string, primaryColor: string): string {
  return `
<section id="contact" data-nav="contact" style="padding:80px 24px;max-width:640px;margin:0 auto">
  <h2 style="font-size:32px;font-weight:800;margin-bottom:8px;letter-spacing:-0.04em;text-align:center">Get in touch</h2>
  <p style="color:rgba(255,255,255,0.5);font-size:15px;text-align:center;margin-bottom:36px;line-height:1.6">Ready to start a project? Send me a message and I'll get back to you within 24 hours.</p>
  <form id="zContactForm" onsubmit="return handleZContact(event)" style="display:flex;flex-direction:column;gap:16px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <input type="text" id="zc-name" placeholder="Your name" required style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primaryColor}'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
      <input type="email" id="zc-email" placeholder="your@email.com" required style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primaryColor}'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
    </div>
    <input type="text" id="zc-subject" placeholder="Project type (e.g., Logo Design, Video Edit)" style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='${primaryColor}'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'">
    <textarea id="zc-message" placeholder="Tell me about your project..." rows="4" required style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;resize:vertical;min-height:100px;line-height:1.6;transition:border-color 0.2s" onfocus="this.style.borderColor='${primaryColor}'" onblur="this.style.borderColor='rgba(255,255,255,0.1)'"></textarea>
    <button type="submit" class="btn-primary" style="padding:16px 32px;border-radius:12px;border:none;background:${primaryColor};color:#fff;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:-0.01em;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 8px 24px ${primaryColor}40'" onmouseout="this.style.transform='';this.style.boxShadow=''">Send message</button>
  </form>
  <p style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.3)">Or email me directly at <a href="mailto:${businessEmail}" style="color:${primaryColor};text-decoration:none">${businessEmail}</a></p>
</section>
<script>
function handleZContact(e){
  e.preventDefault();
  var n=document.getElementById('zc-name').value;
  var em=document.getElementById('zc-email').value;
  var s=document.getElementById('zc-subject').value||'New Project Inquiry';
  var m=document.getElementById('zc-message').value;
  var body='Hi ${businessName.replace(/'/g, "\\'")},%0A%0A'+encodeURIComponent(m)+'%0A%0AFrom: '+encodeURIComponent(n)+' ('+encodeURIComponent(em)+')';
  window.location.href='mailto:${businessEmail}?subject='+encodeURIComponent(s)+'&body='+body;
  var btn=e.target.querySelector('button[type=submit]');
  btn.textContent='Opening email client...';
  btn.style.opacity='0.6';
  setTimeout(function(){btn.textContent='Send message';btn.style.opacity='1';},3000);
  return false;
}
</script>`;
}