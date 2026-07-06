(function() {
    var STORAGE_KEY = 'warranty_products';

    var products = [];

    var videoEl = document.getElementById('video');
    var codeReader = null;
    var scanning = false;
    var pendingDeleteId = null;

    var dom = {
        statTotal:    document.getElementById('statTotal'),
        statActive:   document.getElementById('statActive'),
        statExpiring: document.getElementById('statExpiring'),
        statExpired:  document.getElementById('statExpired'),
        btnStartScan: document.getElementById('btnStartScan'),
        btnStopScan:  document.getElementById('btnStopScan'),
        barcodeManual:document.getElementById('barcodeManual'),
        btnSearch:    document.getElementById('btnSearchBarcode'),
        scanStatus:   document.getElementById('scanStatus'),
        form:         document.getElementById('warrantyForm'),
        formTitle:    document.getElementById('formTitle'),
        editId:       document.getElementById('editId'),
        barcode:      document.getElementById('barcode'),
        serial:       document.getElementById('serial'),
        productName:  document.getElementById('productName'),
        brand:        document.getElementById('brand'),
        model:        document.getElementById('model'),
        purchaseDate: document.getElementById('purchaseDate'),
        warrantyYears:document.getElementById('warrantyYears'),
        shop:         document.getElementById('shop'),
        price:        document.getElementById('price'),
        notes:        document.getElementById('notes'),
        btnSave:      document.getElementById('btnSave'),
        btnClear:     document.getElementById('btnClear'),
        tableBody:    document.getElementById('tableBody'),
        searchFilter: document.getElementById('searchFilter'),
        btnExport:    document.getElementById('btnExport'),
        modalDelete:  document.getElementById('modalDelete'),
    };

    /* ===== Storage ===== */
    var SAMPLE_DATA = [
        {
            id: '1719000000001', barcode: '8400066553311', serial: 'SN2401A5B3C001',
            name: 'Corsair Vengeance DDR5 32GB (2x16GB)', brand: 'Corsair', model: 'CMK32GX5M2B5600C36',
            purchaseDate: '2026-06-15', warrantyYears: '10', shop: 'JIB', price: '3,990', notes: 'ประกัน Synnex 10 ปี'
        },
        {
            id: '1719000000002', barcode: '4710484742535', serial: 'SN2308K9L2M004',
            name: 'Samsung 990 PRO 2TB NVMe SSD', brand: 'Samsung', model: 'MZ-V9P2T0BW',
            purchaseDate: '2026-05-20', warrantyYears: '5', shop: 'Advice', price: '6,900', notes: 'ประกันศูนย์ไทย'
        },
        {
            id: '1719000000003', barcode: '0195553904012', serial: 'SN2501X7Y3Z009',
            name: 'Intel Core i7-14700K', brand: 'Intel', model: 'BX8071514700K',
            purchaseDate: '2026-07-01', warrantyYears: '3', shop: 'Banana IT', price: '14,500', notes: ''
        },
        {
            id: '1719000000004', barcode: '0822233100037', serial: 'SN2302H6B8T112',
            name: 'ASUS TUF RTX 4070 Ti 12GB', brand: 'ASUS', model: 'TUF-RTX4070TI-O12G-GAMING',
            purchaseDate: '2025-11-10', warrantyYears: '3', shop: 'JIB', price: '29,900', notes: 'ประกัน 3 ปี ลงทะเบียนออนไลน์'
        },
        {
            id: '1719000000005', barcode: '0840109750123', serial: 'SN2407R2P8L055',
            name: 'WD Black SN850X 4TB NVMe', brand: 'Western Digital', model: 'WDS400T2X0E',
            purchaseDate: '2025-01-15', warrantyYears: '5', shop: 'JIB', price: '12,500', notes: ''
        }
    ];

    function loadProducts() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                products = JSON.parse(raw);
            } else {
                products = JSON.parse(JSON.stringify(SAMPLE_DATA));
                saveProducts();
            }
        } catch (e) {
            products = JSON.parse(JSON.stringify(SAMPLE_DATA));
        }
    }

    function saveProducts() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
        } catch (e) {
            setStatus('ไม่สามารถบันทึกข้อมูลได้ (พื้นที่เต็ม)', 'error');
        }
    }

    /* ===== Warranty Status ===== */
    function getWarrantyStatus(item) {
        if (!item.purchaseDate || !item.warrantyYears) return { status: 'unknown', label: 'ไม่ระบุ', css: '' };
        if (parseFloat(item.warrantyYears) === 0) return { status: 'forever', label: 'ตลอดชีพ', css: 'badge-forever' };

        var purchase = new Date(item.purchaseDate);
        var expiry = new Date(purchase);
        expiry.setFullYear(expiry.getFullYear() + parseFloat(item.warrantyYears));
        var today = new Date(); today.setHours(0,0,0,0);
        var diffDays = Math.ceil((expiry - today) / (1000*60*60*24));

        if (diffDays < 0) return { status: 'expired', label: 'หมดประกัน', css: 'badge-expired', expiry: expiry };
        if (diffDays <= 30) return { status: 'expiring', label: 'ใกล้หมด ('+diffDays+' วัน)', css: 'badge-expiring', expiry: expiry };
        return { status: 'active', label: 'ยังไม่หมด', css: 'badge-active', expiry: expiry };
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        var parts = dateStr.split('-');
        return parts[2] + '/' + parts[1] + '/' + (parseInt(parts[0]) + 543);
    }

    function formatDateShort(dateObj) {
        if (!dateObj) return '-';
        var d = dateObj.getDate();
        var m = dateObj.getMonth() + 1;
        var y = dateObj.getFullYear() + 543;
        return (d<10?'0':'') + d + '/' + (m<10?'0':'') + m + '/' + y;
    }

    /* ===== Render ===== */
    function renderAll() {
        renderTable();
        renderStats();
    }

    function renderStats() {
        var total = products.length;
        var active = 0, expiring = 0, expired = 0;

        products.forEach(function(p) {
            var ws = getWarrantyStatus(p);
            if (ws.status === 'active' || ws.status === 'forever') active++;
            else if (ws.status === 'expiring') expiring++;
            else if (ws.status === 'expired') expired++;
        });

        dom.statTotal.textContent = total;
        dom.statActive.textContent = active;
        dom.statExpiring.textContent = expiring;
        dom.statExpired.textContent = expired;
    }

    function renderTable(filterText) {
        var list = products;
        if (filterText) {
            var ft = filterText.toLowerCase();
            list = products.filter(function(p) {
                return (p.barcode && p.barcode.toLowerCase().indexOf(ft) >= 0) ||
                       (p.name && p.name.toLowerCase().indexOf(ft) >= 0) ||
                       (p.serial && p.serial.toLowerCase().indexOf(ft) >= 0) ||
                       (p.brand && p.brand.toLowerCase().indexOf(ft) >= 0);
            });
        }

        if (list.length === 0) {
            dom.tableBody.innerHTML = '<tr class="empty-row"><td colspan="7">' +
                (filterText ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีสินค้า &mdash; สแกนบาร์โค้ดเพื่อเริ่มลงทะเบียน') +
                '</td></tr>';
            return;
        }

        dom.tableBody.innerHTML = list.map(function(p) {
            var ws = getWarrantyStatus(p);
            var expiryStr = ws.expiry ? formatDateShort(ws.expiry) : (p.warrantyYears == 0 ? 'ตลอดชีพ' : '-');
            return '<tr>' +
                '<td>' + (p.barcode || '-') + '</td>' +
                '<td><strong>' + escapeHtml(p.name || '-') + '</strong>' +
                    (p.brand ? '<br><small>' + escapeHtml(p.brand) + '</small>' : '') + '</td>' +
                '<td>' + (p.serial || '-') + '</td>' +
                '<td>' + formatDate(p.purchaseDate) + '</td>' +
                '<td>' + expiryStr + '</td>' +
                '<td><span class="badge ' + ws.css + '">' + ws.label + '</span></td>' +
                '<td>' +
                    '<button class="btn btn-xs btn-outline" data-action="edit" data-id="' + p.id + '">&#9998;</button> ' +
                    '<button class="btn btn-xs btn-danger" data-action="delete" data-id="' + p.id + '">&#10005;</button>' +
                '</td>' +
                '</tr>';
        }).join('');
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===== Form ===== */
    function resetForm() {
        dom.form.reset();
        dom.editId.value = '';
        dom.formTitle.textContent = 'ลงทะเบียนสินค้าใหม่';
        dom.btnSave.textContent = '\uD83D\uDCBE บันทึก';
        dom.purchaseDate.value = new Date().toISOString().split('T')[0];
        dom.warrantyYears.value = 1;
    }

    function fillForm(product) {
        dom.editId.value = product.id;
        dom.barcode.value = product.barcode || '';
        dom.serial.value = product.serial || '';
        dom.productName.value = product.name || '';
        dom.brand.value = product.brand || '';
        dom.model.value = product.model || '';
        dom.purchaseDate.value = product.purchaseDate || '';
        dom.warrantyYears.value = product.warrantyYears != null ? product.warrantyYears : 1;
        dom.shop.value = product.shop || '';
        dom.price.value = product.price || '';
        dom.notes.value = product.notes || '';
        dom.formTitle.textContent = 'แก้ไขข้อมูลสินค้า';
        dom.btnSave.textContent = '\uD83D\uDCBE อัปเดต';
        dom.formSection.scrollIntoView({ behavior: 'smooth' });
    }

    function submitForm(e) {
        e.preventDefault();
        var id = dom.editId.value;
        var data = {
            id: id || Date.now().toString(),
            barcode: dom.barcode.value.trim(),
            serial: dom.serial.value.trim(),
            name: dom.productName.value.trim(),
            brand: dom.brand.value.trim(),
            model: dom.model.value.trim(),
            purchaseDate: dom.purchaseDate.value,
            warrantyYears: dom.warrantyYears.value,
            shop: dom.shop.value.trim(),
            price: dom.price.value.trim(),
            notes: dom.notes.value.trim(),
        };

        if (!data.name) {
            setStatus('กรุณากรอกชื่อสินค้า', 'error');
            return;
        }

        if (id) {
            var idx = products.findIndex(function(p) { return p.id === id; });
            if (idx >= 0) products[idx] = data;
        } else {
            products.unshift(data);
        }

        saveProducts();
        renderAll();
        resetForm();
        setStatus('บันทึกข้อมูลเรียบร้อย', 'success');
    }

    /* ===== Delete ===== */
    function showDeleteModal(id) {
        pendingDeleteId = id;
        dom.modalDelete.classList.add('show');
    }

    function confirmDelete() {
        if (!pendingDeleteId) return;
        products = products.filter(function(p) { return p.id !== pendingDeleteId; });
        pendingDeleteId = null;
        dom.modalDelete.classList.remove('show');
        saveProducts();
        renderAll();
        resetForm();
        setStatus('ลบรายการเรียบร้อย', 'success');
    }

    /* ===== Scan ===== */
    function onBarcodeFound(barcode) {
        setStatus('พบ: ' + barcode, 'success');
        var existing = products.find(function(p) { return p.barcode === barcode; });
        if (existing) {
            fillForm(existing);
            setStatus('พบข้อมูลในระบบแล้ว กำลังแสดง...', 'success');
        } else {
            resetForm();
            dom.barcode.value = barcode;
            dom.formTitle.textContent = 'ลงทะเบียนสินค้าใหม่';
            dom.formSection.scrollIntoView({ behavior: 'smooth' });
            setStatus('บาร์โค้ดใหม่ กรุณากรอกข้อมูล', 'success');
        }
        stopScan();
    }

    function startScan() {
        if (scanning) return;
        codeReader = new ZXing.BrowserMultiFormatReader();
        scanning = true;
        setStatus('กำลังเปิดกล้อง...', '');
        dom.btnStartScan.disabled = true;
        dom.btnStopScan.disabled = false;

        codeReader.decodeFromVideoDevice(null, 'video', function(result, err) {
            if (result && scanning) {
                onBarcodeFound(result.text);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                // ignore NotFound
            }
        }).catch(function(err) {
            setStatus('ไม่สามารถเปิดกล้องได้: ' + err.message, 'error');
            scanning = false;
            dom.btnStartScan.disabled = false;
            dom.btnStopScan.disabled = true;
        });
    }

    function stopScan() {
        scanning = false;
        if (codeReader) {
            codeReader.reset();
            codeReader = null;
        }
        var stream = videoEl.srcObject;
        if (stream) {
            stream.getTracks().forEach(function(t) { t.stop(); });
            videoEl.srcObject = null;
        }
        dom.btnStartScan.disabled = false;
        dom.btnStopScan.disabled = true;
    }

    function searchByBarcode() {
        var barcode = dom.barcodeManual.value.trim();
        if (!barcode) { setStatus('กรุณาป้อนเลขบาร์โค้ด', 'error'); return; }
        if (!/^[\w-]+$/.test(barcode)) { setStatus('รูปแบบบาร์โค้ดไม่ถูกต้อง', 'error'); return; }
        onBarcodeFound(barcode);
    }

    function setStatus(msg, type) {
        dom.scanStatus.textContent = msg;
        dom.scanStatus.className = 'status-msg ' + (type || '');
    }

    /* ===== Export ===== */
    function exportCSV() {
        if (products.length === 0) { alert('ไม่มีข้อมูลที่จะ export'); return; }

        var header = ['Barcode','ชื่อสินค้า','Serial','ยี่ห้อ','รุ่น','วันที่ซื้อ','ประกัน(ปี)','วันหมดประกัน','ร้าน','ราคา','หมายเหตุ'];
        var rows = products.map(function(p) {
            var ws = getWarrantyStatus(p);
            return [
                p.barcode || '', '"' + (p.name || '').replace(/"/g,'""') + '"',
                p.serial || '', '"' + (p.brand || '').replace(/"/g,'""') + '"',
                '"' + (p.model || '').replace(/"/g,'""') + '"',
                p.purchaseDate || '',
                p.warrantyYears || '',
                ws.expiry ? formatDateShort(ws.expiry) : '',
                '"' + (p.shop || '').replace(/"/g,'""') + '"',
                p.price || '',
                '"' + (p.notes || '').replace(/"/g,'""') + '"'
            ].join(',');
        });

        var csv = '\uFEFF' + header.join(',') + '\n' + rows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'warranty_' + new Date().toISOString().split('T')[0] + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ===== Events ===== */
    dom.btnStartScan.addEventListener('click', startScan);
    dom.btnStopScan.addEventListener('click', stopScan);
    dom.btnSearch.addEventListener('click', searchByBarcode);
    dom.barcodeManual.addEventListener('keydown', function(e) { if (e.key === 'Enter') searchByBarcode(); });

    dom.form.addEventListener('submit', submitForm);
    dom.btnClear.addEventListener('click', function() { resetForm(); setStatus('', ''); });

    dom.tableBody.addEventListener('click', function(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var id = btn.dataset.id;
        var action = btn.dataset.action;
        if (action === 'edit') {
            var product = products.find(function(p) { return p.id === id; });
            if (product) fillForm(product);
        } else if (action === 'delete') {
            showDeleteModal(id);
        }
    });

    dom.searchFilter.addEventListener('input', function() {
        renderTable(this.value);
    });

    dom.btnExport.addEventListener('click', exportCSV);

    document.getElementById('btnConfirmDelete').addEventListener('click', confirmDelete);
    document.getElementById('btnCancelDelete').addEventListener('click', function() {
        pendingDeleteId = null;
        dom.modalDelete.classList.remove('show');
    });
    dom.modalDelete.addEventListener('click', function(e) {
        if (e.target === dom.modalDelete) { pendingDeleteId = null; dom.modalDelete.classList.remove('show'); }
    });

    /* ===== Init ===== */
    loadProducts();
    resetForm();
    renderAll();
})();
