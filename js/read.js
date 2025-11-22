document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "produtosBin";

    const cardsContainer = document.getElementById("cardsContainer");
    const searchInput = document.getElementById("searchInput");
    const popupOverlay = document.getElementById("popupOverlay");
    const closePopup = document.getElementById("closePopup");


    function removerAcentos(texto = "") {
        return texto.normalize ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : texto;
    }


    function loadBuffer() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return new Uint8Array(2);
        }
        try {
            const arr = JSON.parse(raw);
            return new Uint8Array(arr);
        } catch (e) {
            console.error("Erro lendo produtosBin do localStorage:", e);
            return new Uint8Array(2);
        }
    }

    function saveBuffer(u8) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(u8)));
    }

    function readUint16(view, offset) {
        return view.getUint16(offset);
    }



    // decodeRecordAt atualizado: sizeTotal = tamanho TOTAL do registro (gravado pelo create.js)
    function decodeRecordAt(buffer, startOffset) {
        const totalLen = buffer.length;
        if (startOffset >= totalLen) return null;

        // precisa ao menos lápide(1) + size(2)
        if (startOffset + 3 > totalLen) return null;

        const view = new DataView(buffer.buffer);
        let offset = startOffset;

        const lapide = buffer[offset]; offset += 1;
        const sizeTotal = readUint16(view, offset); offset += 2;

        // sizeTotal é o tamanho TOTAL do registro (inclui lápide + size(2) + dados)
        if (startOffset + sizeTotal > totalLen) {
            console.warn("Registro truncado em decodeRecordAt:", startOffset);
            return null;
        }

        try {
            // id (2 bytes) está em offset atual (startOffset + 3)
            const id = readUint16(view, offset); offset += 2;

            // nome
            const nomeLen = readUint16(view, offset); offset += 2;
            const nomeBytes = buffer.slice(offset, offset + nomeLen); offset += nomeLen;
            const nome = new TextDecoder().decode(nomeBytes || new Uint8Array());

            // gtin
            const gtinLen = readUint16(view, offset); offset += 2;
            const gtinBytes = buffer.slice(offset, offset + gtinLen); offset += gtinLen;
            const gtin = new TextDecoder().decode(gtinBytes || new Uint8Array());

            // descricao
            const descLen = readUint16(view, offset); offset += 2;
            const descBytes = buffer.slice(offset, offset + descLen); offset += descLen;
            const descricao = new TextDecoder().decode(descBytes || new Uint8Array());

            // icone
            const iconLen = readUint16(view, offset); offset += 2;
            const iconBytes = buffer.slice(offset, offset + iconLen); offset += iconLen;
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

            // nextOffset = startOffset + sizeTotal (já que sizeTotal == recordLen)
            const nextOffset = startOffset + sizeTotal;
            return { produto, nextOffset, recordBytes: buffer.slice(startOffset, nextOffset) };
        } catch (err) {
            console.error("Erro ao decodificar registro:", err);
            return null;
        }
    }


    function carregarProdutosBinarios() {
        const buffer = loadBuffer();
        const produtos = [];

        if (!buffer || buffer.length <= 2) return produtos;

        const view = new DataView(buffer.buffer);
        const ultimoId = readUint16(view, 0);

        let offset = 2;
        while (offset < buffer.length) {
            const decoded = decodeRecordAt(buffer, offset);
            if (!decoded) {
                console.warn("Leitura interrompida em offset", offset);
                break;
            }
            const { produto, nextOffset } = decoded;
            if (produto && produto.lapide === 0) produtos.push(produto);
            offset = nextOffset;
        }


        produtos.sort((a, b) => (a.nomeProduto || "").localeCompare(b.nomeProduto || ""));
        return produtos;
    }


    function exibirProdutos(lista) {
        if (!cardsContainer) return;
        cardsContainer.innerHTML = "";

        if (!lista || lista.length === 0) {
            cardsContainer.innerHTML = "<p>Nenhum produto encontrado.</p>";
            return;
        }

        lista.forEach(produto => {
            const card = document.createElement("div");
            card.classList.add("card");
            card.innerHTML = `
        <i class="${produto.icone}"></i>
        <h3>${produto.nomeProduto}</h3>
        <p>${produto.descricao}</p>
        <p><strong>GTIN:</strong> ${produto.gtin}</p>
      `;
            card.addEventListener("click", () => abrirPopup(produto));
            cardsContainer.appendChild(card);
        });
    }


    function encontrarRecordBytesPorId(id) {
        const buffer = loadBuffer();
        if (!buffer || buffer.length <= 2) return null;
        let offset = 2;
        while (offset < buffer.length) {
            const decoded = decodeRecordAt(buffer, offset);
            if (!decoded) break;
            const { produto, nextOffset, recordBytes } = decoded;
            if (produto && produto.id === id) return recordBytes;
            offset = nextOffset;
        }
        return null;
    }


    // produtoToRecordBytes atualizado: grava uint16 com recordLen (tamanho TOTAL do registro)
    function produtoToRecordBytes(produto) {
        const encoder = new TextEncoder();
        const nomeBytes = encoder.encode(produto.nomeProduto || "");
        const gtinBytes = encoder.encode(produto.gtin || "");
        const descBytes = encoder.encode(produto.descricao || "");
        const iconBytes = encoder.encode(produto.icone || "");

        // dataPart = campos depois do header (id + 2+nome + 2+gtin + 2+desc + 2+icon)
        const dataPart =
            2 + // id
            2 + nomeBytes.length +
            2 + gtinBytes.length +
            2 + descBytes.length +
            2 + iconBytes.length;

        // recordLen = lapide(1) + size(2) + dataPart
        const recordLen = 1 + 2 + dataPart;
        const record = new Uint8Array(recordLen);
        const view = new DataView(record.buffer);
        let off = 0;

        // lápide
        record[off++] = produto.lapide ? 1 : 0;

        // escrevemos o tamanho TOTAL do registro (recordLen)
        view.setUint16(off, recordLen); off += 2;

        // id
        view.setUint16(off, produto.id); off += 2;

        // nome
        view.setUint16(off, nomeBytes.length); off += 2;
        if (nomeBytes.length) record.set(nomeBytes, off);
        off += nomeBytes.length;

        // gtin
        view.setUint16(off, gtinBytes.length); off += 2;
        if (gtinBytes.length) record.set(gtinBytes, off);
        off += gtinBytes.length;

        // descricao
        view.setUint16(off, descBytes.length); off += 2;
        if (descBytes.length) record.set(descBytes, off);
        off += descBytes.length;

        // icone
        view.setUint16(off, iconBytes.length); off += 2;
        if (iconBytes.length) record.set(iconBytes, off);
        off += iconBytes.length;

        return record;
    }


    function formatBytes(arr) {
        if (!arr) return "";
        return Array.from(arr).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    }


    function abrirPopup(produto) {
        if (!produto || !popupOverlay) return;
        popupOverlay.style.display = "flex";

        let recordBytes = encontrarRecordBytesPorId(produto.id);
        if (!recordBytes) {
            // fallback: gera bytes a partir do objeto (mesma ordem usada no create)
            recordBytes = produtoToRecordBytes(produto);
        }

        const uint8 = new Uint8Array(recordBytes);
        const view = new DataView(uint8.buffer);
        let offset = 0;

        const lapide = uint8[offset++];
        const sizeTotal = view.getUint16(offset); offset += 2;
        const id = view.getUint16(offset); offset += 2;

        const nomeLen = view.getUint16(offset); offset += 2;
        const nomeBytes = uint8.slice(offset, offset + nomeLen); offset += nomeLen;
        const nomeText = new TextDecoder().decode(nomeBytes || new Uint8Array());

        const gtinLen = view.getUint16(offset); offset += 2;
        const gtinBytes = uint8.slice(offset, offset + gtinLen); offset += gtinLen;
        const gtinText = new TextDecoder().decode(gtinBytes || new Uint8Array());

        const descLen = view.getUint16(offset); offset += 2;
        const descBytes = uint8.slice(offset, offset + descLen); offset += descLen;
        const descText = new TextDecoder().decode(descBytes || new Uint8Array());

        const iconLen = view.getUint16(offset); offset += 2;
        const iconBytes = uint8.slice(offset, offset + iconLen); offset += iconLen;
        const iconText = new TextDecoder().decode(iconBytes || new Uint8Array()) || "";

        const el = (idSel) => document.getElementById(idSel);
        if (el("iconBytes")) el("iconBytes").textContent = formatBytes(iconBytes || []);
        if (el("iconDecoded")) el("iconDecoded").innerHTML = iconText ? `<i class="${iconText}" style="font-size:40px;color:darkcyan"></i>` : "(nenhum)";
        if (el("nameBytes")) el("nameBytes").textContent = formatBytes(nomeBytes || []);
        if (el("nameDecoded")) el("nameDecoded").textContent = nomeText;
        if (el("gtinBytes")) el("gtinBytes").textContent = formatBytes(gtinBytes || []);
        if (el("gtinDecoded")) el("gtinDecoded").textContent = gtinText;
        if (el("descBytes")) el("descBytes").textContent = formatBytes(descBytes || []);
        if (el("descDecoded")) el("descDecoded").textContent = descText;

        if (el("productPreview")) {
            el("productPreview").innerHTML = `
        <div class="card">
          <i class="${produto.icone}"></i>
          <h3>${produto.nomeProduto}</h3>
          <p>${produto.descricao}</p>
          <p><strong>GTIN:</strong> ${produto.gtin}</p>
          <p style="margin-top:10px; color:${lapide === 0 ? 'green' : 'red'};">
            ${lapide === 0 ? 'Ativo' : 'Removido'}
          </p>
        </div>
      `;
        }
    }


    if (closePopup) closePopup.addEventListener("click", () => popupOverlay.style.display = "none");
    if (popupOverlay) {
        popupOverlay.addEventListener("click", (e) => {
            if (e.target === popupOverlay) popupOverlay.style.display = "none";
        });
    }


    function carregarEFiltrar(term = "") {
        const todos = carregarProdutosBinarios();
        if (!term) return todos;
        const termo = removerAcentos(term.toLowerCase());
        return todos.filter(p =>
            removerAcentos((p.nomeProduto || "").toLowerCase()).includes(termo) ||
            removerAcentos((p.descricao || "").toLowerCase()).includes(termo) ||
            ((p.gtin || "").includes(termo))
        );
    }

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const term = removerAcentos(e.target.value.toLowerCase());
            const lista = carregarProdutosBinarios();
            const filtered = lista.filter(p =>
                removerAcentos((p.nomeProduto || "").toLowerCase()).includes(term) ||
                removerAcentos((p.descricao || "").toLowerCase()).includes(term) ||
                ((p.gtin || "").includes(term))
            );
            exibirProdutos(filtered);
        });
    }


    const inicial = carregarProdutosBinarios();
    exibirProdutos(inicial);
});
