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
          status.textContent = 'Prévia segura: o envio ao n8n será ativado somente após a validação do webhook e da privacidade.';
          status.classList.add('is-preview');
          return;
        }
        var payload = Object.fromEntries(new FormData(form).entries());
        payload.page_path = window.location.pathname;
        payload.landing_url = window.location.href;
        payload.utm_source = new URLSearchParams(window.location.search).get('utm_source') || '';
        payload.utm_medium = new URLSearchParams(window.location.search).get('utm_medium') || '';
        payload.utm_campaign = new URLSearchParams(window.location.search).get('utm_campaign') || '';
        payload.cta_id = 'solution_form';
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(function (response) { if (!response.ok) throw new Error('lead_submit_failed'); return response.json().catch(function () { return {}; }); })
          .then(function () { status.textContent = 'Recebemos sua solicitação. Em breve, retornaremos pelo canal escolhido.'; track('lead_form_submitted', { page_path: window.location.pathname }); form.reset(); })
          .catch(function () { status.textContent = 'Não foi possível enviar agora. Você pode falar conosco pelo WhatsApp.'; });
      });
    });
  });
}());
