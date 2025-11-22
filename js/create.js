
document.addEventListener("DOMContentLoaded", () => {

    const iconSelector = document.getElementById("iconSelector");
    const iconOptions = iconSelector ? iconSelector.querySelectorAll(".icon-option") : [];
    const selectedIconPreview = document.getElementById("selectedIcon");
    const form = document.getElementById("createForm");
    const hexOutput = document.getElementById("hexOutput");
    const msgEl = document.getElementById("msg");
    const nomeInput = document.getElementById("nomeProduto");
    const gtinInput = document.getElementById("gtin");
    const descInput = document.getElementById("descricao");


    const TEXT_ENCODER = new TextEncoder();
    const TEXT_DECODER = new TextDecoder();

    function bytesFromString(s) {
        return TEXT_ENCODER.encode(s || "");
    }
    function stringFromBytes(arr) {
        return TEXT_DECODER.decode(arr || new Uint8Array());
    }


    function concatUint8(a, b) {
        const out = new Uint8Array(a.length + b.length);
        out.set(a, 0);
        out.set(b, a.length);
        return out;
    }



    const STORAGE_KEY = "produtosBin";

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


    function readUltimoId(buffer) {
        if (!buffer || buffer.length < 2) return 0;
        const view = new DataView(buffer.buffer);
        return view.getUint16(0);
    }

    function writeUltimoId(buffer, id) {

        if (buffer.length < 2) {
            const tmp = new Uint8Array(2);
            tmp.set(buffer, 0);
            buffer = tmp;
        }
        const view = new DataView(buffer.buffer);
        view.setUint16(0, id);
        return buffer;
    }


    function getIconClassFromElem(el) {
        if (!el || !el.classList) return "fa-solid fa-box";
        return Array.from(el.classList).filter(c => c.startsWith("fa-")).join(" ") || "fa-solid fa-box";
    }


    let currentIconClass = "fa-solid fa-box";
    if (iconOptions.length > 0) {
        iconOptions.forEach(op => op.classList.remove("selected"));
        iconOptions[0].classList.add("selected");
        currentIconClass = getIconClassFromElem(iconOptions[0]);
        if (selectedIconPreview) selectedIconPreview.innerHTML = `<i class="${currentIconClass}"></i>`;
    }


    iconOptions.forEach(op => {
        op.addEventListener("click", () => {
            iconOptions.forEach(x => x.classList.remove("selected"));
            op.classList.add("selected");
            currentIconClass = getIconClassFromElem(op);
            if (selectedIconPreview) selectedIconPreview.innerHTML = `<i class="${currentIconClass}"></i>`;
        });
    });




    function buildRecordBytes(produto) {

        const nomeBytes = bytesFromString(produto.nomeProduto || "");
        const gtinBytes = bytesFromString(produto.gtin || "");
        const descBytes = bytesFromString(produto.descricao || "");
        const iconBytes = bytesFromString(produto.icone || "");
        const sizeData =
            2 +
            2 + nomeBytes.length +
            2 + gtinBytes.length +
            2 + descBytes.length +
            2 + iconBytes.length;

        const recordLen = 1 + 2 + sizeData;
        const record = new Uint8Array(recordLen);
        const rview = new DataView(record.buffer);

        let roffset = 0;

        record[roffset++] = produto.lapide ? 1 : 0;

        rview.setUint16(roffset, sizeData); roffset += 2;

        rview.setUint16(roffset, produto.id); roffset += 2;


        rview.setUint16(roffset, nomeBytes.length); roffset += 2;
        if (nomeBytes.length) record.set(nomeBytes, roffset);
        roffset += nomeBytes.length;


        rview.setUint16(roffset, gtinBytes.length); roffset += 2;
        if (gtinBytes.length) record.set(gtinBytes, roffset);
        roffset += gtinBytes.length;


        rview.setUint16(roffset, descBytes.length); roffset += 2;
        if (descBytes.length) record.set(descBytes, roffset);
        roffset += descBytes.length;


        rview.setUint16(roffset, iconBytes.length); roffset += 2;
        if (iconBytes.length) record.set(iconBytes, roffset);
        roffset += iconBytes.length;


        if (roffset !== recordLen) {
            console.warn("Tamanho do registro esperado:", recordLen, "tamanho escrito:", roffset);
        }

        return record;
    }



    function decodeRecordAt(buffer, startOffset) {
        const totalLen = buffer.length;
        if (startOffset >= totalLen) return null;
        if (startOffset + 1 + 2 > totalLen) return null;

        const view = new DataView(buffer.buffer);
        let offset = startOffset;
        const lapide = buffer[offset]; offset += 1;
        const sizeData = view.getUint16(offset); offset += 2;


        if (offset + sizeData > totalLen) {

            return null;
        }

        const recordStart = offset;
        try {
            const id = view.getUint16(offset); offset += 2;


            const nomeLen = view.getUint16(offset); offset += 2;
            const nomeBytes = buffer.slice(offset, offset + nomeLen); offset += nomeLen;
            const nome = stringFromBytes(nomeBytes || new Uint8Array());


            const gtinLen = view.getUint16(offset); offset += 2;
            const gtinBytes = buffer.slice(offset, offset + gtinLen); offset += gtinLen;
            const gtin = stringFromBytes(gtinBytes || new Uint8Array());


            const descLen = view.getUint16(offset); offset += 2;
            const descBytes = buffer.slice(offset, offset + descLen); offset += descLen;
            const descricao = stringFromBytes(descBytes || new Uint8Array());


            const iconLen = view.getUint16(offset); offset += 2;
            const iconBytes = buffer.slice(offset, offset + iconLen); offset += iconLen;
            const icone = stringFromBytes(iconBytes || new Uint8Array()) || "fa-solid fa-box";

            const ativo = (lapide === 0);

            const produto = {
                id,
                nomeProduto: nome,
                gtin,
                descricao,
                icone,
                ativo,
                lapide
            };

            const nextOffset = startOffset + 1 + 2 + sizeData;
            return { produto, nextOffset, recordBytes: buffer.slice(startOffset, nextOffset) };
        } catch (e) {
            console.error("Erro ao decodificar registro em offset", startOffset, e);
            return null;
        }
    }


    function renderHexView() {
        const buffer = loadBuffer();
        if (!buffer || buffer.length <= 2) {
            if (hexOutput) hexOutput.textContent = "Nenhum produto criado ainda...";
            return;
        }

        let out = "";
        const ultimoId = readUltimoId(buffer);
        out += `Último ID: ${ultimoId}\n\n`;


        out += "HEX COMPLETO:\n";
        out += gerarHexCompleto(buffer) + "\n\n";


        out += "Registros decodificados:\n\n";

        let offset = 2;
        let idx = 0;

        while (offset < buffer.length) {
            const decoded = decodeRecordAt(buffer, offset);
            if (!decoded) {
                out += `Registro em offset ${offset} inválido ou truncado.\n`;
                break;
            }

            idx++;
            const { produto, nextOffset, recordBytes } = decoded;

            out += `Produto ${idx} — ID: ${produto.id}\n`;
            out += `Lápide: ${produto.lapide} (${produto.lapide === 0 ? "ativo" : "removido"})\n`;
            out += `Tamanho (bytes): ${recordBytes.length}\n`;


            out += gerarHexCompleto(recordBytes) + "\n";


            out += `> Nome: ${produto.nomeProduto}\n`;
            out += `> GTIN: ${produto.gtin}\n`;
            out += `> Descrição: ${produto.descricao}\n`;
            out += `> Ícone: ${produto.icone}\n\n`;

            offset = nextOffset;
        }

        if (hexOutput) {
            hexOutput.textContent = out;
            hexOutput.scrollTop = hexOutput.scrollHeight;
        }
    }



    function validarGtin(gtin) {
        return /^\d{13}$/.test(String(gtin).trim());
    }


    function appendProdutoToBuffer(produto) {

        let buffer = loadBuffer();

        if (!buffer || buffer.length < 2) buffer = new Uint8Array(2);


        const record = buildRecordBytes(produto);


        const newBuffer = concatUint8(buffer, record);


        const updated = writeUltimoId(newBuffer, produto.id);


        saveBuffer(updated);

        return updated;
    }


    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            if (msgEl) {
                msgEl.textContent = "";
                msgEl.style.color = "";
            }

            const nome = nomeInput ? nomeInput.value.trim() : "";
            const gtin = gtinInput ? gtinInput.value.trim() : "";
            const descricao = descInput ? descInput.value.trim() : "";

            if (!nome) {
                if (msgEl) msgEl.textContent = "Nome é obrigatório.";
                return;
            }
            if (!validarGtin(gtin)) {
                if (msgEl) msgEl.textContent = "GTIN inválido — deve conter exatamente 13 dígitos.";
                return;
            }
            if (!descricao) {
                if (msgEl) msgEl.textContent = "Descrição é obrigatória.";
                return;
            }


            const buffer = loadBuffer();
            const ultimoId = readUltimoId(buffer);
            const novoId = ultimoId + 1;

            const produto = {
                id: novoId,
                nomeProduto: nome,
                gtin: gtin,
                descricao: descricao,
                icone: currentIconClass || "fa-solid fa-box",
                lapide: 0
            };


            appendProdutoToBuffer(produto);


            renderHexView();


            if (msgEl) {
                msgEl.style.color = "#0a660a";
                msgEl.textContent = "Produto criado com sucesso!";
                setTimeout(() => (msgEl.textContent = ""), 3000);
            }


            form.reset();
            if (iconOptions.length > 0) {
                iconOptions.forEach(op => op.classList.remove("selected"));
                iconOptions[0].classList.add("selected");
                currentIconClass = getIconClassFromElem(iconOptions[0]);
                if (selectedIconPreview) selectedIconPreview.innerHTML = `<i class="${currentIconClass}"></i>`;
            }
        });
    }


    renderHexView();




    window.marcarProdutoRemovido = function (id) {
        const buffer = loadBuffer();
        let offset = 2;
        while (offset < buffer.length) {
            const view = new DataView(buffer.buffer);
            if (offset + 1 + 2 > buffer.length) break;
            const lapide = buffer[offset];
            const sizeData = view.getUint16(offset + 1);
            const recordStart = offset;
            const idPos = offset + 1 + 2;
            if (idPos + 2 > buffer.length) break;
            const recId = view.getUint16(idPos);
            const recordTotalLen = 1 + 2 + sizeData;
            if (recId === id) {

                buffer[recordStart] = 1;
                saveBuffer(buffer);
                renderHexView();
                return true;
            }
            offset += recordTotalLen;
        }
        return false;
    };

    function gerarHexCompleto(bytes) {
        let linhas = [];
        let linha = [];

        for (let i = 0; i < bytes.length; i++) {
            linha.push(bytes[i].toString(16).padStart(2, "0"));

            if ((i + 1) % 16 === 0) {
                linhas.push(linha.join(" "));
                linha = [];
            }
        }

        if (linha.length > 0) linhas.push(linha.join(" "));

        return linhas.join("\n");
    }


});

