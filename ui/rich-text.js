/* Local assets only. Sanitize after Markdown parsing; never trust model HTML. */
globalThis.kairosRichText = {
  render(element, text) {
    const html = marked.parse(String(text ?? ''), { gfm: true, breaks: true });
    element.replaceChildren(DOMPurify.sanitize(html, {
      RETURN_DOM_FRAGMENT: true,
      ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','b','em','i','s','del','blockquote','ul','ol','li','a','pre','code','table','thead','tbody','tr','th','td'],
      ALLOWED_ATTR: ['href','title','start'],
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    }));
    for (const link of element.querySelectorAll('a')) {
      const href = link.getAttribute('href') ?? '';
      if (!/^https?:\/\//i.test(href)) link.removeAttribute('href');
      else link.addEventListener('click', event => {
        event.preventDefault(); window.qwenChat.openLink(href);
      });
    }
  },
  text(element) { return element.innerText ?? element.textContent ?? ''; },
};
