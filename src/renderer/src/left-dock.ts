class LeftDock extends HTMLElement {
  async connectedCallback() {

    const tables = await window.api.db.tables.list()
    let links = `<a href="index.html">Головна</a>`
    for (const table of tables) {
      links += `<a href="tables.html?table=${table.TABLE_NAME}">${table.TABLE_NAME}</a>`
    }

    this.innerHTML = `
      <div class="left-dock-div">
    <h1>Інформаційна панель</h1>
    ${links}
  </div>
    `;
  }
}
customElements.define('left-dock', LeftDock);
