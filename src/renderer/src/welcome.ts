const information = document.getElementById('info')

if (information) {
    information.innerText = `This app is using Chrome (v${window.versions.chrome()}), Node.js (v${window.versions.node()}), and Electron (v${window.versions.electron()})`
}


async function loadCrops(): Promise<void> {
    const crops = await window.api.crops.list()
    const list = document.getElementById('crops')

    if (list) {
        let html = ''
        for (const crop of crops) {
            html += `<li>${crop.id}: ${crop.name}</li>`
        }

        list.innerHTML = html
    }
}

loadCrops()