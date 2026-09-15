class LeftDock extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="left-dock-div">
    <h1>Інформаційна панель</h1>
    <a href="index.html">Головна</a>
  </div>
    `;
  }
}
customElements.define('left-dock', LeftDock);
