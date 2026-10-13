(function () {
  'use strict';

  var consentKey = 'opticore_cookie_consent_v1';
  var gtmId = 'GTM-N3RDDK2L';
  window.dataLayer = window.dataLayer || [];

  function gtag() {
    window.dataLayer.push(arguments);
  }

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function loadGtm() {
    if (document.querySelector('script[data-opticore-gtm]')) return;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    var script = document.createElement('script');
    script.async = true;
    script.dataset.opticoreGtm = 'true';
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
    document.head.appendChild(script);
  }

  function track(eventName, details) {
    if (localStorage.getItem(consentKey) !== 'accepted') return;
    window.dataLayer.push(Object.assign({ event: eventName }, details || {}));
  }

  function saveConsent(value) {
    localStorage.setItem(consentKey, value);
    gtag('consent', 'update', {
      analytics_storage: value === 'accepted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (value === 'accepted') loadGtm();
    var banner = document.querySelector('[data-cookie-banner]');
    if (banner) banner.classList.remove('is-visible');
  }

  function showConsent() {
    var banner = document.querySelector('[data-cookie-banner]');
    if (banner) banner.classList.add('is-visible');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.body.insertAdjacentHTML('beforeend', '<aside class="cookie-banner" data-cookie-banner role="dialog" aria-modal="true" aria-labelledby="cookie-title"><div><h2 id="cookie-title">Você escolhe como medimos o site</h2><p>Usamos cookies de análise somente com sua autorização. Eles ajudam a entender quais páginas e botões geram conversas. <a href="privacy.html#cookies">Saiba mais</a>.</p></div><div class="cookie-actions"><button class="cookie-reject" type="button" data-cookie-reject>Recusar</button><button class="cookie-accept" type="button" data-cookie-accept>Aceitar análise</button></div></aside>');

    var consent = localStorage.getItem(consentKey);
    if (consent === 'accepted') loadGtm();
    if (!consent) showConsent();

    document.querySelector('[data-cookie-accept]').addEventListener('click', function () { saveConsent('accepted'); });
    document.querySelector('[data-cookie-reject]').addEventListener('click', function () { saveConsent('rejected'); });
    document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
      button.addEventListener('click', showConsent);
    });

    document.querySelectorAll('[data-track="whatsapp"]').forEach(function (link) {
      link.addEventListener('click', function () {
        track('whatsapp_click', {
          cta: link.dataset.cta || 'nao_identificado',
          page_path: window.location.pathname,
          utm_source: new URLSearchParams(window.location.search).get('utm_source') || 'direct'
        });
      });
    });

    document.querySelectorAll('[data-track="solution"]').forEach(function (link) {
      link.addEventListener('click', function () {
        track('solution_click', {
          solution: link.dataset.solution || 'nao_identificada',
          page_path: window.location.pathname
        });
      });
    });

    var leadDialog = document.querySelector('[data-lead-dialog]');
    document.querySelectorAll('[data-open-lead-form]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (leadDialog && typeof leadDialog.showModal === 'function') {
          leadDialog.showModal();
          track('lead_form_opened', { page_path: window.location.pathname });
        }
      });
    });
    document.querySelectorAll('[data-close-lead-form]').forEach(function (button) {
      button.addEventListener('click', function () { if (leadDialog) leadDialog.close(); });
    });
    document.querySelectorAll('[data-lead-form]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        var status = form.querySelector('[data-lead-form-status]');
        var endpoint = form.dataset.endpoint;
        if (!endpoint) {
          status.textContent = 'O formulário está temporariamente indisponível. Fale conosco pelo botão do WhatsApp nesta página.';
          status.classList.add('is-preview');
          return;
        }

        var payload = Object.fromEntries(new FormData(form).entries());
        if (payload.contact_preference === 'email' && !payload.email.trim()) {
          status.textContent = 'Informe seu e-mail para receber o retorno por esse canal.'; return;
        }
        if (!/^\d{10,15}$/.test(payload.phone.replace(/\D/g, ''))) {
          status.textContent = 'Confira o WhatsApp informado, incluindo o DDD.'; return;
        }
        if (!form.dataset.requestId) form.dataset.requestId = crypto.randomUUID();
        payload.request_id = form.dataset.requestId;
        payload.page_path = window.location.pathname;
        // Do not send full URLs, which may contain unrelated private query parameters.
        ['utm_source','utm_medium','utm_campaign'].forEach(function (key) {
          payload[key] = (new URLSearchParams(window.location.search).get(key) || '').slice(0, 120);
        });
        var button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        status.textContent = 'Enviando sua solicitação…';
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 20000);
        fetch(endpoint, { method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: new URLSearchParams(payload).toString(), signal: controller.signal })
          .then(function (response) {
            return response.json().then(function (body) {
              if (!response.ok || body.ok !== true || body.request_id !== payload.request_id) {
                throw new Error(body.error || 'lead_submit_failed');
              }
              return body;
            });
          })
          .then(function () {
            status.textContent = 'Recebemos sua solicitação. Em breve, retornaremos pelo canal escolhido.';
            status.classList.remove('is-preview');
            track('lead_form_submitted', { page_path: window.location.pathname });
            form.reset(); delete form.dataset.requestId;
          })
          .catch(function (error) {
            status.textContent = error.message === 'rate_limited'
              ? 'Você enviou várias solicitações. Aguarde alguns minutos ou fale conosco pelo WhatsApp.'
              : 'Não foi possível confirmar o envio. Tente novamente ou fale conosco pelo WhatsApp.';
          })
          .finally(function () { clearTimeout(timer); button.disabled = false; });

      });
    });
  });
}());

