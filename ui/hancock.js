/* Original KAIROS character. No Coucou/Mochi code or artwork used. */
(() => {
  const stylesheet = new URL("hancock-character.css", document.currentScript?.src ?? document.baseURI).href;
  const labels = {
    idle: 'Hancock ist bereit.',
    waiting: 'Hancock wartet auf die Antwort.',
    done: 'Das Ergebnis ist fertig.',
    error: 'Ein Fehler ist aufgetreten.',
    attention: 'Deine Entscheidung wird benötigt.',
  };
  class KairosHancock extends HTMLElement {
    static observedAttributes = ['state', 'paused'];
    constructor() {
      super();
      this.attachShadow({ mode: 'open' }).innerHTML = `
        <link rel="stylesheet" href="${stylesheet}">
        <button type="button"><svg viewBox="0 0 240 240" aria-hidden="true">
          <ellipse cx="120" cy="218" rx="56" ry="9" fill="#102d35" opacity=".12"/>
          <g class="body">
            <path d="M120 57V38" stroke="#193d49" stroke-width="7" stroke-linecap="round"/>
            <path class="indicator" d="m120 17 13 13-13 13-13-13Z" stroke="#193d49" stroke-width="4" stroke-linejoin="round"/>
            <path d="M75 171 69 204h27l7-24M165 171l6 33h-27l-7-24" fill="#193d49" stroke="#193d49" stroke-width="8" stroke-linejoin="round"/>
            <path d="M58 116c-18 2-23 19-18 35" fill="none" stroke="#193d49" stroke-width="12" stroke-linecap="round"/>
            <path class="arm-right" d="M182 116c18 2 23 19 18 35" fill="none" stroke="#193d49" stroke-width="12" stroke-linecap="round"/>
            <path d="m85 57-30 37v57l30 37h70l30-37V94l-30-37Z" fill="#53d6c5" stroke="#193d49" stroke-width="6" stroke-linejoin="round"/>
            <path d="m87 69-20 25" stroke="#b5fff0" stroke-width="6" stroke-linecap="round"/>
            <rect x="70" y="91" width="100" height="66" rx="23" fill="#193d49"/>
            <g class="gaze"><g class="eyes">
              <rect x="88" y="107" width="19" height="28" rx="9.5" fill="#f9f4e6"/>
              <rect x="133" y="107" width="19" height="28" rx="9.5" fill="#f9f4e6"/>
            </g></g>
            <path class="mouth" d="M111 142q9 7 18 0"/>
            <path class="indicator" d="m120 165 6 6-6 6-6-6Z"/>
          </g>
        </svg></button>`;
      this.button = this.shadowRoot.querySelector('button');
      this.gaze = this.shadowRoot.querySelector('.gaze');
      this.button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('hancock-open', { bubbles:true, composed:true }));
      });
      this.button.addEventListener('pointermove', event => {
        if (this.hasAttribute('paused') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const box = this.button.getBoundingClientRect();
        const dx = Math.max(-4, Math.min(4, (event.clientX - box.left - box.width / 2) / box.width * 8));
        const dy = Math.max(-3, Math.min(3, (event.clientY - box.top - box.height / 2) / box.height * 6));
        this.gaze.setAttribute('transform', 'translate(' + dx + ' ' + dy + ')');
      });
      this.button.addEventListener('pointerleave', () => this.gaze.removeAttribute('transform'));
    }
    connectedCallback() { this.update(); }
    attributeChangedCallback() { this.update(); }
    update() {
      if (!this.button) return;
      const state = Object.hasOwn(labels, this.getAttribute('state')) ? this.getAttribute('state') : 'idle';
      this.button.setAttribute('aria-label', labels[state] + ' KAIROS öffnen.');
      this.button.title = labels[state];
      this.shadowRoot.querySelector('.mouth').setAttribute('d', state === 'error' ? 'M111 146q9-7 18 0' : state === 'waiting' ? 'M115 143h10' : 'M111 142q9 7 18 0');
      if (this.hasAttribute('paused')) this.gaze.removeAttribute('transform');
    }
  }
  if (!customElements.get('kairos-hancock')) customElements.define('kairos-hancock', KairosHancock);
})();
