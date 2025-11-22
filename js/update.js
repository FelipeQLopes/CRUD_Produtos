document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("produtosContainer");
    const popup = document.getElementById("popup");
    const closePopup = document.getElementById("closePopup");
    const form = document.getElementById("editForm");
    const searchInput = document.getElementById("searchInput");

    const iconOptions = Array.from(document.querySelectorAll(".popup .icon-option, .popup-content .icon-option"));
    const selectedIconEl = document.getElementById("selectedIcon");


    const iconBytesEl = document.getElementById("iconBytes");
    const iconDecodedEl = document.getElementById("iconDecoded");
    const nameBytesEl = document.getElementById("nameBytes");
    const nameDecodedEl = document.getElementById("nameDecoded");
    const gtinBytesEl = document.getElementById("gtinBytes");
    const gtinDecodedEl = document.getElementById("gtinDecoded");
    const descBytesEl = document.getElementById("descBytes");
    const descDecodedEl = document.getElementById("descDecoded");

    const editNome = document.getElementById("editNome");
    const editGtin = document.getElementById("editGtin");
    const editDescricao = document.getElementById("editDescricao");

    const STORAGE_KEY = "produtosBin";

    let currentIndex = -1;
    let currentDraft = null;


    function removerAcentos(texto = "") {
        return texto.normalize ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : texto;
    }
    function bytesToHex(arr) {
        if (!arr) return "";
        return Array.from(arr).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    }


    function loadBuffer() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Uint8Array(2);
        try {
            const arr = JSON.parse(raw);
            return new Uint8Array(arr);
        } catch (e) {
            console.error("Erro lendo buffer:", e);
            return new Uint8Array(2);
        }
    }

    function saveBuffer(u8) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(u8)));
    }

    function readUint16(view, offset) {
        return view.getUint16(offset);
    }



    function produtoToRecordBytes(produto) {
        const encoder = new TextEncoder();
        const nomeBytes = encoder.encode(produto.nomeProduto || "");
        const gtinBytes = encoder.encode(produto.gtin || "");
        const descBytes = encoder.encode(produto.descricao || "");
        const iconBytes = encoder.encode(produto.icone || "");

        const sizeData =
            2 +
            2 + nomeBytes.length +
            2 + gtinBytes.length +
            2 + descBytes.length +
            2 + iconBytes.length;

        const recordLen = 1 + 2 + sizeData;
        const record = new Uint8Array(recordLen);
        const view = new DataView(record.buffer);
        let off = 0;

        record[off++] = produto.lapide ? 1 : 0;
        view.setUint16(off, sizeData); off += 2;
        view.setUint16(off, produto.id); off += 2;

        view.setUint16(off, nomeBytes.length); off += 2;
        if (nomeBytes.length) record.set(nomeBytes, off);
        off += nomeBytes.length;

        view.setUint16(off, gtinBytes.length); off += 2;
        if (gtinBytes.length) record.set(gtinBytes, off);
        off += gtinBytes.length;

        view.setUint16(off, descBytes.length); off += 2;
        if (descBytes.length) record.set(descBytes, off);
        off += descBytes.length;

        view.setUint16(off, iconBytes.length); off += 2;
        if (iconBytes.length) record.set(iconBytes, off);
        off += iconBytes.length;

        return record;
    }



    function decodeRecordAt(buffer, startOffset) {
        const total = buffer.length;
        if (startOffset >= total) return null;
        if (startOffset + 3 > total) return null;

        const view = new DataView(buffer.buffer);
        let off = startOffset;
        const lapide = buffer[off]; off += 1;
        const sizeData = readUint16(view, off); off += 2;


        if (off + sizeData > total) {
            console.warn("Registro truncado em offset", startOffset);
            return null;
        }

        try {
            const id = readUint16(view, off); off += 2;

            const nomeLen = readUint16(view, off); off += 2;
            const nomeBytes = buffer.slice(off, off + nomeLen); off += nomeLen;
            const nome = new TextDecoder().decode(nomeBytes || new Uint8Array());

            const gtinLen = readUint16(view, off); off += 2;
            const gtinBytes = buffer.slice(off, off + gtinLen); off += gtinLen;
            const gtin = new TextDecoder().decode(gtinBytes || new Uint8Array());

            const descLen = readUint16(view, off); off += 2;
            const descBytes = buffer.slice(off, off + descLen); off += descLen;
            const descricao = new TextDecoder().decode(descBytes || new Uint8Array());

            const iconLen = readUint16(view, off); off += 2;
            const iconBytes = buffer.slice(off, off + iconLen); off += iconLen;
            const icone = new TextDecoder().decode(iconBytes || new Uint8Array()) || "fa-solid fa-box";

            const produto = {
                id,
                nomeProduto: nome,
                gtin,
                descricao,
                icone,
                lapide,
                ativo: lapide === 0
            };

            const nextOffset = startOffset + 1 + 2 + sizeData;
            const recordBytes = buffer.slice(startOffset, nextOffset);
            return { produto, startOffset, nextOffset, recordBytes };
        } catch (err) {
            console.error("Erro ao decodificar registro em", startOffset, err);
            return null;
        }
    }


    function parseAllRecords() {
        const buffer = loadBuffer();
        const records = [];
        if (!buffer || buffer.length <= 2) return records;
        let off = 2;
        while (off < buffer.length) {
            const decoded = decodeRecordAt(buffer, off);
            if (!decoded) break;
            records.push(decoded);
            off = decoded.nextOffset;
        }
        return records;
    }


    function exibirProdutos(lista) {
        if (!container) return;
        container.innerHTML = "";
        if (!lista || lista.length === 0) {
            container.innerHTML = "<p>Nenhum produto encontrado.</p>";
            return;
        }
        lista.forEach((p, i) => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
        <i class="${p.icone}"></i>
        <h3>${p.nomeProduto}</h3>
        <p>${p.descricao}</p>
        <p><strong>GTIN:</strong> ${p.gtin}</p>
      `;
            card.addEventListener("click", () => abrirPopupByIndex(i));
            container.appendChild(card);
        });
    }


    function buildProdutosList() {
        const recs = parseAllRecords();
        const ativos = recs.filter(r => r.produto && r.produto.lapide === 0).map(r => r.produto);
        ativos.sort((a, b) => (a.nomeProduto || "").localeCompare(b.nomeProduto || ""));
        return ativos;
    }


    function abrirPopupByIndex(i) {
        const produtos = buildProdutosList();
        currentIndex = i;
        const produto = produtos[i];
        if (!produto) return;


        editNome.value = produto.nomeProduto || "";
        editGtin.value = produto.gtin || "";
        editDescricao.value = produto.descricao || "";


        iconOptions.forEach(opt => opt.classList.remove("selected"));
        let matched = false;
        iconOptions.forEach(opt => {
            const cls = Array.from(opt.classList).filter(c => c !== "icon-option").join(" ");
            if (cls === produto.icone) {
                opt.classList.add("selected");
                matched = true;
                selectedIconEl.innerHTML = `<i class="${cls}"></i>`;
            }
        });
        if (!matched && iconOptions[0]) {
            iconOptions[0].classList.add("selected");
            const cls = Array.from(iconOptions[0].classList).filter(c => c !== "icon-option").join(" ");
            selectedIconEl.innerHTML = `<i class="${cls}"></i>`;
        }

        currentDraft = {
            id: produto.id,
            nomeProduto: produto.nomeProduto,
            gtin: produto.gtin,
            descricao: produto.descricao,
            icone: produto.icone,
            lapide: typeof produto.lapide !== "undefined" ? produto.lapide : 0,
            ativo: produto.ativo
        };


        updateByteViewFromDraft(currentDraft);
        if (popup) popup.classList.add("active");
    }

    function fecharPopup() {
        if (popup) popup.classList.remove("active");
        currentIndex = -1;
        currentDraft = null;
    }


    function updateByteViewFromDraft(draft) {
        if (!draft) return;
        const record = produtoToRecordBytes(draft);
        const uint8 = record;
        const view = new DataView(uint8.buffer);
        let offset = 0;

        const lapide = uint8[offset++];
        const sizeData = readUint16(view, offset); offset += 2;
        const id = readUint16(view, offset); offset += 2;

        const nomeLen = readUint16(view, offset); offset += 2;
        const nomeBytes = uint8.slice(offset, offset + nomeLen); offset += nomeLen;
        const nomeText = new TextDecoder().decode(nomeBytes || new Uint8Array());

        const gtinLen = readUint16(view, offset); offset += 2;
        const gtinBytes = uint8.slice(offset, offset + gtinLen); offset += gtinLen;
        const gtinText = new TextDecoder().decode(gtinBytes || new Uint8Array());

        const descLen = readUint16(view, offset); offset += 2;
        const descBytes = uint8.slice(offset, offset + descLen); offset += descLen;
        const descText = new TextDecoder().decode(descBytes || new Uint8Array());

        const iconLen = readUint16(view, offset); offset += 2;
        const iconBytes = uint8.slice(offset, offset + iconLen); offset += iconLen;
        const iconText = new TextDecoder().decode(iconBytes || new Uint8Array());


        if (iconBytesEl) iconBytesEl.textContent = bytesToHex(iconBytes);
        if (iconDecodedEl) iconDecodedEl.innerHTML = iconText ? `<i class="${iconText}" style="font-size:36px;color:darkcyan"></i>` : "(nenhum)";
        if (nameBytesEl) nameBytesEl.textContent = bytesToHex(nomeBytes);
        if (nameDecodedEl) nameDecodedEl.textContent = nomeText;
        if (gtinBytesEl) gtinBytesEl.textContent = bytesToHex(gtinBytes);
        if (gtinDecodedEl) gtinDecodedEl.textContent = gtinText;
        if (descBytesEl) descBytesEl.textContent = bytesToHex(descBytes);
        if (descDecodedEl) descDecodedEl.textContent = descText;
    }


    iconOptions.forEach(opt => {
        opt.addEventListener("click", () => {
            iconOptions.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            const cls = Array.from(opt.classList).filter(c => c !== "icon-option").join(" ");
            if (selectedIconEl) selectedIconEl.innerHTML = `<i class="${cls}"></i>`;
            if (currentDraft) {
                currentDraft.icone = cls;
                updateByteViewFromDraft(currentDraft);
            }
        });
    });

    [editNome, editGtin, editDescricao].forEach(input => {
        if (!input) return;
        input.addEventListener("input", () => {
            if (!currentDraft) return;
            currentDraft.nomeProduto = editNome.value;
            currentDraft.gtin = editGtin.value;
            currentDraft.descricao = editDescricao.value;
            updateByteViewFromDraft(currentDraft);
        });
    });


    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (!currentDraft) return;


            currentDraft.nomeProduto = editNome.value;
            currentDraft.gtin = editGtin.value;
            currentDraft.descricao = editDescricao.value;
            currentDraft.lapide = typeof currentDraft.lapide !== "undefined" ? currentDraft.lapide : 0;


            const novoRecord = produtoToRecordBytes(currentDraft);


            const buffer = loadBuffer();


            const recs = parseAllRecords();
            let found = null;
            for (const r of recs) {
                if (r.produto && r.produto.id === currentDraft.id) {
                    found = r;
                    break;
                }
            }

            let novoBuffer;
            if (!found) {

                novoBuffer = new Uint8Array(buffer.length + novoRecord.length);
                novoBuffer.set(buffer, 0);
                novoBuffer.set(novoRecord, buffer.length);


                const viewHeader = new DataView(novoBuffer.buffer);
                const ultimoId = viewHeader.getUint16(0);
                if (currentDraft.id > ultimoId) viewHeader.setUint16(0, currentDraft.id);
            } else {

                const antes = buffer.slice(0, found.startOffset);
                const depois = buffer.slice(found.nextOffset);
                novoBuffer = new Uint8Array(antes.length + novoRecord.length + depois.length);
                novoBuffer.set(antes, 0);
                novoBuffer.set(novoRecord, antes.length);
                novoBuffer.set(depois, antes.length + novoRecord.length);


            }


            saveBuffer(novoBuffer);


            const produtosAtivos = buildProdutosList();
            exibirProdutos(produtosAtivos);
            fecharPopup();
        });
    }


    if (closePopup) closePopup.addEventListener("click", fecharPopup);
    if (popup) popup.addEventListener("click", (ev) => { if (ev.target === popup) fecharPopup(); });


    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = removerAcentos(e.target.value.toLowerCase());
            const lista = buildProdutosList();
            const filtered = lista.filter(p =>
                removerAcentos((p.nomeProduto || "").toLowerCase()).includes(term) ||
                removerAcentos((p.descricao || "").toLowerCase()).includes(term) ||
                ((p.gtin || "").includes(term))
            );
            exibirProdutos(filtered);
        });
    }


    const inicial = buildProdutosList();
    exibirProdutos(inicial);
});
