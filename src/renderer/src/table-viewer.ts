const FORM_HINTS: Record<string, string[]> = {
    SoilType: ['Чорнозем', 'Чорнозем опідзолений', 'Суглинок', 'Сірий лісовий', 'Супіщаний'],
    FarmingSystem: ['Традиційне', 'No-Till', 'Mini-Till', 'Strip-Till'],
    Position: ['Агроном', 'Тракторист', 'Комбайнер', 'Механізатор'],
    OperationType: ['Оранка', 'Культивація', 'Сівба', 'Внесення добрив', 'Обприскування', 'Збирання'],
    Category: ['Насіння', 'Добрива', 'ЗЗР', 'Пальне', 'Послуги', 'Ремонт', 'Зарплата', 'Амортизація', 'Власна праця'],
    Buyer: ['Kernel', 'НІБУЛОН', 'Cargill', 'ADM', 'Bunge']
}

const NUMERIC_TYPES = ['int', 'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'money']

function parseNumeric(raw: string): number | null {
    const normalized = raw.trim().replace(',', '.')
    if (normalized === '') return null
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
}

function buildFieldHtml(f: ColumnInfo, refOptions: Record<string, { value: any; label: string }[]>): string {
    const required = f.IS_NULLABLE === 'NO'
    const reqMark = required ? ' *' : ''
    const label = `${f.COLUMN_NAME}${reqMark}`
    const name = f.COLUMN_NAME

    if (f.DATA_TYPE === 'date') {
        return `<div><label for="f-${name}">${label}<input id="f-${name}" name="${name}" type="date"${required ? ' required' : ''}></label></div>`
    }
    if (f.DATA_TYPE === 'bit') {
        return `<div><label for="f-${name}">${label}<input id="f-${name}" name="${name}" type="checkbox"></label></div>`
    }
    if (NUMERIC_TYPES.includes(f.DATA_TYPE)) {
        const step = f.DATA_TYPE === 'int' || f.DATA_TYPE === 'bigint' || f.DATA_TYPE === 'smallint' || f.DATA_TYPE === 'tinyint' ? 'step="1"' : 'step="0.01"'
        return `<div><label for="f-${name}">${label}<input id="f-${name}" name="${name}" type="number" inputmode="decimal" ${step}${required ? ' required' : ''}></label></div>`
    }
    if (f.FK_REFERENCED_TABLE) {
        const options = refOptions[f.FK_REFERENCED_TABLE] ?? []
        const opts = options
            .map((o, i) => `<option value="${o.value}">${o.label}</option>`)
            .join('')
        const placeholder = required ? '' : '<option value="">—</option>'
        return `<div><label for="f-${name}">${label}<select id="f-${name}" name="${name}"${required ? ' required' : ''}>${placeholder}${opts}</select></label></div>`
    }

    const hints = FORM_HINTS[name]
    const dl = hints ? `<datalist id="dl-${name}">${hints.map(h => `<option value="${h}">`).join('')}</datalist>` : ''
    const listAttr = hints ? ` list="dl-${name}"` : ''
    return `<div><label for="f-${name}">${label}<input id="f-${name}" name="${name}" type="text"${listAttr}${required ? ' required' : ''}></label>${dl}</div>`
}

interface ColumnInfo {
    COLUMN_NAME: string
    DATA_TYPE: string
    IS_NULLABLE: string
    FK_REFERENCED_TABLE?: string | null
    IS_COMPUTED?: number
}

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
        const { columns, rows, objectType } = result
        const isView = objectType === 'VIEW'

        const pkColumn = columns.find(c => c.COLUMN_NAME.endsWith('ID'))?.COLUMN_NAME
        let html = `<h2>${tableName}</h2>`
        html += '<table class="data-table">'
        html += '<thead><tr>'

        for (const col of columns) {
            html += `<th>${col.COLUMN_NAME}</th>`
        }
        if (!isView) html += '<th>Дії</th>'
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
                    html += `<td contenteditable="${isView ? 'false' : 'true'}">${value}</td>`
                }
            }
            if (!isView) {
                html += `<td><button class="delete-btn" data-index="${i}">Видалити</button></td>`
            }
            html += '</tr>'
        }

        html += '</tbody></table>'
        if (!isView) {
            html += '<p><button class="add-row-btn">Додати рядок</button></p>'
        }
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
        const columns = result.columns as ColumnInfo[]

        const pkColumn = columns.find(c => c.COLUMN_NAME.endsWith('ID'))?.COLUMN_NAME
        const fields = columns.filter(c =>
            c.COLUMN_NAME !== pkColumn && !c.IS_COMPUTED
        )

        const refOptions: Record<string, { value: any; label: string }[]> = {}
        for (const f of fields) {
            const refTable = f.FK_REFERENCED_TABLE
            if (!refTable || refOptions[refTable]) continue
            const ref = await window.api.db.table.read(refTable)
            const refColumns = ref.columns as unknown as ColumnInfo[]
            const refPk = refColumns.find(c => c.COLUMN_NAME.endsWith('ID'))?.COLUMN_NAME
            const nameCol = refColumns.find(c => c.COLUMN_NAME === 'Name')
                ?? refColumns.find(c => !c.COLUMN_NAME.endsWith('ID') && ['nvarchar', 'varchar', 'char'].includes(c.DATA_TYPE))
            refOptions[refTable] = ref.rows.map(r => ({
                value: refPk ? r[refPk] : r[Object.keys(r)[0]],
                label: nameCol ? `${r[refPk]} — ${r[nameCol.COLUMN_NAME]}` : String(refPk ? r[refPk] : '')
            }))
        }

        const dialog = document.createElement('dialog')
        dialog.innerHTML = `
    <form id="add-form">
      <h3>Додати рядок: ${tableName}</h3>
      <p class="req-hint">* — обов'язкове поле</p>
      <p class="dialog-error" hidden></p>
      ${fields.map(f => buildFieldHtml(f, refOptions)).join('')}
      <div>
        <button type="button" id="cancel-btn">Скасувати</button>
        <button type="submit">Зберегти</button>
      </div>
    </form>`
        document.body.appendChild(dialog)
        dialog.showModal()

        const entered = await new Promise<Record<string, any> | null>(resolve => {
            let submitted: Record<string, any> | null = null
            const errorEl = dialog.querySelector<HTMLElement>('.dialog-error')

            dialog.querySelector('#cancel-btn')!.addEventListener('click', () => dialog.close())
            dialog.querySelector('#add-form')!.addEventListener('submit', async (e) => {
                e.preventDefault()
                const values: Record<string, any> = {}
                for (const f of fields) {
                    const el = dialog.querySelector(`[name="${f.COLUMN_NAME}"]`) as HTMLInputElement | HTMLSelectElement | null
                    if (!el) continue
                    if (f.DATA_TYPE === 'bit') {
                        values[f.COLUMN_NAME] = (el as HTMLInputElement).checked ? 1 : 0
                        continue
                    }
                    const raw = (el as HTMLInputElement).value?.trim() ?? ''
                    if (raw === '') { values[f.COLUMN_NAME] = null; continue }
                    if (NUMERIC_TYPES.includes(f.DATA_TYPE)) {
                        values[f.COLUMN_NAME] = parseNumeric(raw)
                    } else {
                        values[f.COLUMN_NAME] = raw
                    }
                }
                try {
                    await window.api.db.table.insert(tableName, values)
                    submitted = values
                    dialog.close()
                } catch (ex: any) {
                    if (errorEl) {
                        errorEl.textContent = 'Не вдалося зберегти: ' + (ex?.message ?? String(ex))
                        errorEl.hidden = false
                    }
                }
            })
            dialog.addEventListener('close', () => resolve(submitted))
        })

        dialog.remove()
        if (!entered) return
        await this.loadTable(tableName)
    }
}

customElements.define('table-viewer', TableView)