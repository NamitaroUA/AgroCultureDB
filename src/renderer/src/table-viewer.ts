class TableView extends HTMLElement {
    container: HTMLDivElement | null = null
    currentTable: string = ''

    constructor() {
        super()
    }

    async connectedCallback() {
        this.container = document.createElement('div')
        this.container.style.padding = '20px'
        this.appendChild(this.container)

        this.container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement
            if (target.classList.contains('add-row-btn')) this._addRow()
            if (target.classList.contains('delete-btn')) {
                const index = parseInt(target.getAttribute('data-index') || '0')
                this._deleteRow(index)
            }
        })

        const params = new URLSearchParams(window.location.search)
        this.currentTable = params.get('table') || ''

        if (!this.currentTable) {
            this.container.innerHTML = '<p>Оберіть таблицю з меню зліва.</p>'
            return
        }

        await this.loadTable(this.currentTable)
    }

    async loadTable(tableName: string) {
        const result = await window.api.db.table.read(tableName)
        const { columns, rows } = result

        const pkColumn = columns.find(c => c.COLUMN_NAME.endsWith('ID'))?.COLUMN_NAME

        let html = `<h2>${tableName}</h2>`
        html += '<table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">'
        html += '<thead><tr>'

        for (const col of columns) {
            html += `<th>${col.COLUMN_NAME}</th>`
        }
        html += '<th>Дії</th>'
        html += '</tr></thead>'
        html += '<tbody>'

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            html += `<tr data-pk-col="${pkColumn}" data-pk-val="${row[pkColumn]}">`
            for (const col of columns) {
                const value = row[col.COLUMN_NAME] ?? ''
                const isPk = col.COLUMN_NAME === pkColumn

                if (isPk) {
                    html += `<td><b>${value}</b></td>`
                } else {
                    html += `<td contenteditable="true">${value}</td>`
                }
            }
            // Use a class name instead of onclick
            html += `<td><button class="delete-btn" data-index="${i}">Видалити</button></td>`
            html += '</tr>'
        }

        html += '</tbody></table>'
        // Use a class name instead of onclick
        html += '<p><button class="add-row-btn">Додати рядок</button></p>'

        this.container!.innerHTML = html

        
    }

    async _deleteRow(rowIndex: number) {
        if (!this.container) return

        const rows = this.container.querySelectorAll('tbody tr')
        if (rowIndex >= rows.length) return

        const row = rows[rowIndex] as HTMLElement
        const pkColumn = row.dataset.pkCol
        const pkValue = row.dataset.pkVal

        if (!pkColumn || pkValue === undefined) return

        if (!confirm('Видалити цей рядок?')) return

        await window.api.db.table.delete(this.currentTable, pkColumn, pkValue)
        await this.loadTable(this.currentTable)
    }

    async _addRow() {
        const tableName = this.currentTable
        const result = await window.api.db.table.read(tableName)
        const { columns } = result

        const pkColumn = columns.find(c => c.COLUMN_NAME.endsWith('ID'))?.COLUMN_NAME
        const fields = columns.filter(c => c.COLUMN_NAME !== pkColumn)

        const dialog = document.createElement('dialog')
        dialog.innerHTML = `
    <form id="add-form">
      <h3>Додати рядок: ${tableName}</h3>
      ${fields.map(f => `
        <div>
          <label for="f-${f.COLUMN_NAME}">${f.COLUMN_NAME}
            <input id="f-${f.COLUMN_NAME}" name="${f.COLUMN_NAME}">
          </label>
        </div>`).join('')}
      <div>
        <button type="button" id="cancel-btn">Скасувати</button>
        <button type="submit">Зберегти</button>
      </div>
    </form>`
        document.body.appendChild(dialog)
        dialog.showModal()

        const entered = await new Promise<Record<string, any> | null>(resolve => {
            dialog.querySelector('#cancel-btn')!.addEventListener('click', () => {
                dialog.close()
            })
            dialog.querySelector('#add-form')!.addEventListener('submit', (e) => {
                e.preventDefault()
                const fd = new FormData(dialog.querySelector('#add-form')!)
                const values: Record<string, any> = {}
                for (const f of fields) {
                    const raw = (fd.get(f.COLUMN_NAME) as string)?.trim() ?? ''
                    if (raw === '') { values[f.COLUMN_NAME] = null; continue }
                    if (f.DATA_TYPE === 'int' || f.DATA_TYPE === 'decimal') values[f.COLUMN_NAME] = Number(raw)
                    else if (f.DATA_TYPE === 'bit') values[f.COLUMN_NAME] = raw.toLowerCase() === 'true' || raw === '1'
                    else values[f.COLUMN_NAME] = raw
                }
                resolve(values)
                dialog.close()
            })
            dialog.addEventListener('close', () => resolve(null))
        })

        dialog.remove()
        if (!entered || Object.keys(entered).length === 0) return

        await window.api.db.table.insert(tableName, entered)
        await this.loadTable(tableName)
    }
}

customElements.define('table-viewer', TableView)