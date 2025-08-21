/**
 * ArticleView
 * Renders the article preview panel (title, image, extract, link).
 */
export default class ArticleView {
  constructor({ el }) {
    this.container = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.container) throw new Error('ArticleView: container element not found');
  }

  show(articleData) {
    if (!articleData) return;
    const imageUrl = this._extractImageUrl(articleData);
    const imageHtml = imageUrl
      ? `<div class="article-image"><img src="${imageUrl}" alt="${this._esc(articleData.title)}" /></div>`
      : '';

    this.container.innerHTML = `
      <div class="article-title">${this._esc(articleData.title)}</div>
      ${imageHtml}
      <div class="article-extract">${this._esc(articleData.extract || 'No description available.')}</div>
      <a href="${articleData.url || '#'}" target="_blank" class="article-link">Read full article on Wikipedia</a>
    `;
  }

  showError(title) {
    this.container.innerHTML = `
      <div class="article-title">${this._esc(title)}</div>
      <div class="article-extract">Sorry, we couldn't load the preview for this article.</div>
      <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" class="article-link">View on Wikipedia</a>
    `;
  }

  _extractImageUrl(articleData) {
    if (articleData?.thumbnail?.source) return articleData.thumbnail.source;
    if (articleData?.originalimage?.source) return articleData.originalimage.source;
    return null;
  }

  _esc(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }
}

