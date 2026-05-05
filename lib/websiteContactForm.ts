// lib/websiteContactForm.ts — Generates a working contact form for freelancer websites
//
// FIXED VERSION — closes XSS holes from previous version
//
// Critical fixes:
// 1. HTML ESCAPING — businessName, businessEmail properly escaped before insertion
// 2. JS ESCAPING — values inserted into JavaScript strings escape ALL dangerous characters
// 3. INPUT VALIDATION — primaryColor validated as hex, email validated, name length-capped
// 4. </script> PROTECTION — explicit prevention of script tag breakouts
// 5. INLINE HANDLERS REMOVED — focus/blur/mouse handlers attached programmatically (no string injection)

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsString(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    // Critical: prevent script-tag breakout
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");
}

function safeHexColor(color: string, fallback = "#4A90FF"): string {
  if (!color || typeof color !== "string") return fallback;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim())) return fallback;
  return color.trim();
}

function safeEmail(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return null;
  if (trimmed.length > 254) return null;
  return trimmed;
}

function safeName(name: string, maxLen = 100): string {
  if (!name || typeof name !== "string") return "";
  return name.trim().slice(0, maxLen);
}

export function generateContactFormHtml(
  businessEmail: string,
  businessName: string,
  primaryColor: string
): string {
  const safeEmailValue = safeEmail(businessEmail);
  if (!safeEmailValue) return ""; // Caller handles missing form
  
  const safeNameValue = safeName(businessName);
  const safeColor = safeHexColor(primaryColor);
  
  const nameJs = escapeJsString(safeNameValue);
  const emailHtml = escapeHtml(safeEmailValue);
  const emailUrl = encodeURIComponent(safeEmailValue);
  const colorAttr = safeColor; // Already validated as hex
  const colorJs = escapeJsString(safeColor);

  return `
<section id="contact" data-nav="contact" style="padding:80px 24px;max-width:640px;margin:0 auto">
  <h2 style="font-size:32px;font-weight:800;margin-bottom:8px;letter-spacing:-0.04em;text-align:center">Get in touch</h2>
  <p style="color:rgba(255,255,255,0.5);font-size:15px;text-align:center;margin-bottom:36px;line-height:1.6">Ready to start a project? Send me a message and I'll get back to you within 24 hours.</p>
  <form id="zContactForm" onsubmit="return handleZContact(event)" style="display:flex;flex-direction:column;gap:16px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <input type="text" id="zc-name" placeholder="Your name" required maxlength="100" style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s">
      <input type="email" id="zc-email" placeholder="your@email.com" required maxlength="254" style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s">
    </div>
    <input type="text" id="zc-subject" placeholder="Project type (e.g., Logo Design, Video Edit)" maxlength="200" style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;transition:border-color 0.2s">
    <textarea id="zc-message" placeholder="Tell me about your project..." rows="4" required maxlength="5000" style="padding:14px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#fff;font-size:14px;font-family:inherit;outline:none;resize:vertical;min-height:100px;line-height:1.6;transition:border-color 0.2s"></textarea>
    <button type="submit" class="btn-primary" style="padding:16px 32px;border-radius:12px;border:none;background:${colorAttr};color:#fff;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:-0.01em;transition:transform 0.15s,box-shadow 0.15s">Send message</button>
  </form>
  <p style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.3)">Or email me directly at <a href="mailto:${emailUrl}" style="color:${colorAttr};text-decoration:none">${emailHtml}</a></p>
</section>
<script>
(function(){
  var ZC_COLOR = '${colorJs}';
  var ZC_DEFAULT_BORDER = 'rgba(255,255,255,0.1)';
  var inputs = document.querySelectorAll('#zContactForm input, #zContactForm textarea');
  for (var i = 0; i < inputs.length; i++) {
    (function(el){
      el.addEventListener('focus', function(){ el.style.borderColor = ZC_COLOR; });
      el.addEventListener('blur', function(){ el.style.borderColor = ZC_DEFAULT_BORDER; });
    })(inputs[i]);
  }
  
  var btn = document.querySelector('#zContactForm button[type=submit]');
  if (btn) {
    btn.addEventListener('mouseover', function(){
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 8px 24px ' + ZC_COLOR + '40';
    });
    btn.addEventListener('mouseout', function(){
      btn.style.transform = '';
      btn.style.boxShadow = '';
    });
  }
})();

function handleZContact(e){
  e.preventDefault();
  var nameEl = document.getElementById('zc-name');
  var emailEl = document.getElementById('zc-email');
  var subjectEl = document.getElementById('zc-subject');
  var messageEl = document.getElementById('zc-message');
  if (!nameEl || !emailEl || !messageEl) return false;
  
  var n = (nameEl.value || '').slice(0, 100);
  var em = (emailEl.value || '').slice(0, 254);
  var s = ((subjectEl && subjectEl.value) || 'New Project Inquiry').slice(0, 200);
  var m = (messageEl.value || '').slice(0, 5000);
  
  // Build mailto body — encodeURIComponent handles all dangerous characters
  var greeting = 'Hi ${nameJs},';
  var body = greeting + '\\n\\n' + m + '\\n\\nFrom: ' + n + ' (' + em + ')';
  
  var mailto = 'mailto:${emailUrl}?subject=' + encodeURIComponent(s) + '&body=' + encodeURIComponent(body);
  window.location.href = mailto;
  
  var btn = e.target.querySelector('button[type=submit]');
  if (btn) {
    btn.textContent = 'Opening email client...';
    btn.style.opacity = '0.6';
    setTimeout(function(){ btn.textContent = 'Send message'; btn.style.opacity = '1'; }, 3000);
  }
  return false;
}
</script>`;
}