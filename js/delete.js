document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "produtosBin";

    const ativosEl = document.getElementById("ativos");
    const inativosEl = document.getElementById("inativos");
    const searchInput = document.getElementById("searchInput");
    const refreshBtn = document.getElementById("refreshBtn");
    const inactivateSelectedBtn = document.getElementById("inactivateSelected");
    const reactivateSelectedBtn = document.getElementById("reactivateSelected");
    const selectAllAtivosBtn = document.getElementById("selectAllAtivos");
    const selectAllInativosBtn = document.getElementById("selectAllInativos");

    let selectedAtivos = new Set();
    let selectedInativos = new Set();

    function removerAcentos(texto = "") {
        return texto.normalize ? texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : texto;
    }
    function bytesToHex(arr) {
        if (!arr) return "";
        return Array.from(arr).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
    }


    function loadBuffer() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return new Uint8Array(2);
        }
        try {
            const parsed = JSON.parse(raw);


            if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
                let total = 2;
                for (const a of parsed) total += a.length;
                const out = new Uint8Array(total);


                out[0] = 0; out[1] = 0;
                let off = 2;
                for (const a of parsed) {
                    out.set(new Uint8Array(a), off);
                    off += a.length;
                }

                saveBuffer(out);
                return out;
            }

            if (Array.isArray(parsed)) return new Uint8Array(parsed);

            return new Uint8Array(2);
        } catch (e) {
            console.error("Erro lendo produtosBin:", e);
            return new Uint8Array(2);
        }
    }

    function saveBuffer(u8) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(u8)));
    }

    function readUint16(view, offset) {
        return view.getUint16(offset);
    }


    function decodeRecordAt(buffer, startOffset) {
        const total = buffer.length;
        if (startOffset >= total) return null;

        if (startOffset + 3 > total) return null;

        const view = new DataView(buffer.buffer);
        let off = startOffset;

        const lapide = buffer[off]; off += 1;
        const sizeTotal = readUint16(view, off); off += 2;


        if (startOffset + sizeTotal > total) {

            console.warn("Registro truncado em decodeRecordAt:", startOffset);
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

            const nextOffset = startOffset + sizeTotal;
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
            const rec = decodeRecordAt(buffer, off);
            if (!rec) break;
            records.push(rec);
            off = rec.nextOffset;
        }
        return records;
    }

    function listarProdutos() {
        const recs = parseAllRecords();
        return recs.map(r => ({ ...r.produto, _startOffset: r.startOffset, _nextOffset: r.nextOffset }));
    }


    function renderList(container, items, tipo) {
        if (!container) return;
        container.innerHTML = "";
        const selSet = tipo === "ativos" ? selectedAtivos : selectedInativos;

        if (!items.length) {
            container.innerHTML = `<p style="color:var(--muted)">Nenhum produto ${tipo === "ativos" ? "ativo" : "inativo"}.</p>`;
            return;
        }

        items.forEach(p => {
            const card = document.createElement("div");
            card.className = "card";
            if (selSet.has(p.id)) card.classList.add("selected");

            const iconWrap = document.createElement("div");
            iconWrap.className = "icon-wrap";
            iconWrap.innerHTML = `<i class="${p.icone}"></i>`;

            const info = document.createElement("div");
            info.className = "info";
            info.innerHTML = `<h3 title="${p.nomeProduto}">${p.nomeProduto}</h3>
                        <p title="${p.descricao}">${p.descricao}</p>
                        <p>${p.gtin || ''}</p>`;

            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = "cb";
            cb.checked = selSet.has(p.id);
            cb.addEventListener("click", (ev) => {
                ev.stopPropagation();
                toggleSelect(p.id, tipo);
            });

            card.addEventListener("click", () => toggleSelect(p.id, tipo));

            card.appendChild(iconWrap);
            card.appendChild(info);
            card.appendChild(cb);
            container.appendChild(card);
        });
    }

    function renderTudo(filter = "") {
        const term = removerAcentos((filter || "").toLowerCase());
        const produtos = listarProdutos();

        const ativos = produtos.filter(p => p.lapide === 0 && (
            !term ||
            removerAcentos((p.nomeProduto || "").toLowerCase()).includes(term) ||
            removerAcentos((p.descricao || "").toLowerCase()).includes(term) ||
            ((p.gtin || "").includes(term))
        ));
        const inativos = produtos.filter(p => p.lapide === 1 && (
            !term ||
            removerAcentos((p.nomeProduto || "").toLowerCase()).includes(term) ||
            removerAcentos((p.descricao || "").toLowerCase()).includes(term) ||
            ((p.gtin || "").includes(term))
        ));

        renderList(ativosEl, ativos, "ativos");
        renderList(inativosEl, inativos, "inativos");
    }

    function toggleSelect(prodId, tipo) {
        const set = tipo === "ativos" ? selectedAtivos : selectedInativos;
        if (set.has(prodId)) set.delete(prodId);
        else set.add(prodId);
        renderTudo(searchInput ? searchInput.value : "");
    }

    function selectAll(tipo) {
        const produtos = listarProdutos();
        if (tipo === "ativos") {
            selectedAtivos = new Set(produtos.filter(p => p.lapide === 0).map(p => p.id));
        } else {
            selectedInativos = new Set(produtos.filter(p => p.lapide === 1).map(p => p.id));
        }
        renderTudo(searchInput ? searchInput.value : "");
    }


    function toggleActiveById(prodId, makeActive) {
        const buffer = loadBuffer();
        const recs = parseAllRecords();
        let modified = false;
        for (const r of recs) {
            if (r.produto && r.produto.id === prodId) {

                buffer[r.startOffset] = makeActive ? 0 : 1;
                modified = true;
                break;
            }
        }
        if (modified) {
            saveBuffer(buffer);
            return true;
        }
        return false;
    }

    function inactivateSelected() {
        const ids = Array.from(selectedAtivos);
        if (ids.length === 0) return;
        ids.forEach(id => toggleActiveById(id, false));
        selectedAtivos.clear();
        renderTudo(searchInput ? searchInput.value : "");
    }

    function reactivateSelected() {
        const ids = Array.from(selectedInativos);
        if (ids.length === 0) return;
        ids.forEach(id => toggleActiveById(id, true));
        selectedInativos.clear();
        renderTudo(searchInput ? searchInput.value : "");
    }


    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderTudo(e.target.value);
        });
    }

    refreshBtn?.addEventListener("click", () => {
        renderTudo(searchInput ? searchInput.value : "");
    });

    inactivateSelectedBtn?.addEventListener("click", () => {
        inactivateSelected();
    });

    reactivateSelectedBtn?.addEventListener("click", () => {
        reactivateSelected();
    });

    selectAllAtivosBtn?.addEventListener("click", () => selectAll("ativos"));
    selectAllInativosBtn?.addEventListener("click", () => selectAll("inativos"));


    renderTudo("");
});
