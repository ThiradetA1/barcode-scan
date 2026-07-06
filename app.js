(function() {

    /* ---- DOM refs ---- */
    var btnScan = document.getElementById('btnScan');
    var btnStop = document.getElementById('btnStop');
    var btnSearch = document.getElementById('btnSearch');
    var btnScanAgain = document.getElementById('btnScanAgain');
    var manualInput = document.getElementById('manualInput');
    var statusEl = document.getElementById('status');
    var resultSection = document.getElementById('resultSection');
    var cameraBox = document.getElementById('cameraBox');
    var historySection = document.getElementById('historySection');
    var historyList = document.getElementById('historyList');

    /* ---- State ---- */
    var scanning = false;
    var lastCode = '';
    var lastCodeTime = 0;
    var history = [];

    /* ---- Status ---- */
    function status(msg, type) {
        statusEl.textContent = msg;
        statusEl.className = 'status ' + (type || '');
    }

    /* ---- History ---- */
    function loadHistory() {
        try { history = JSON.parse(localStorage.getItem('barcode_history') || '[]'); } catch(e) { history = []; }
    }

    function saveHistory() {
        try { localStorage.setItem('barcode_history', JSON.stringify(history)); } catch(e) {}
    }

    function addHistory(code, name) {
        history = history.filter(function(h) { return h.code !== code; });
        history.unshift({ code: code, name: name || '-', time: new Date().toLocaleString('th-TH') });
        if (history.length > 30) history.length = 30;
        saveHistory();
        renderHistory();
    }

    function renderHistory() {
        if (!history.length) { historySection.classList.add('hidden'); return; }
        historySection.classList.remove('hidden');
        historyList.innerHTML = history.map(function(h) {
            return '<li data-code="' + h.code + '">' +
                '<span class="h-code">' + h.code + '</span>' +
                '<span class="h-name">' + esc(h.name) + '</span>' +
                '<span class="h-time">' + h.time + '</span>' +
                '</li>';
        }).join('');
        historyList.querySelectorAll('li').forEach(function(li) {
            li.addEventListener('click', function() { lookup(this.dataset.code); });
        });
    }

    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    /* ---- Scanner (Quagga2) ---- */
    function startScanner() {
        if (scanning) return;
        if (typeof Quagga === 'undefined') { status('Cannot load scanner library', 'error'); return; }

        scanning = true;
        status('กำลังเปิดกล้อง...', 'info');
        cameraBox.classList.add('scanning');
        btnScan.disabled = true;
        btnStop.disabled = false;

        Quagga.init({
            inputStream: {
                name: 'Live',
                type: 'LiveStream',
                target: cameraBox,
                constraints: { facingMode: 'environment', width: { min: 640 }, height: { min: 480 } }
            },
            locator: { patchSize: 'medium', halfSample: true },
            numOfWorkers: 2,
            decoder: { readers: ['ean_reader','ean_8_reader','upc_reader','upc_e_reader','code_128_reader','code_39_reader','code_93_reader'] },
            locate: true
        }, function(err) {
            if (err) { status('เปิดกล้องไม่สำเร็จ: ' + err, 'error'); stopScanner(); return; }
            Quagga.start();
            status('กำลังสแกน... เล็งกล้องไปที่บาร์โค้ด', 'info');
        });

        Quagga.onDetected(function(r) {
            var code = r && r.codeResult && r.codeResult.code;
            if (code) {
                var now = Date.now();
                if (code === lastCode && now - lastCodeTime < 2500) return;
                lastCode = code;
                lastCodeTime = now;
                lookup(code);
                stopScanner();
            }
        });
    }

    function stopScanner() {
        scanning = false;
        cameraBox.classList.remove('scanning');
        btnScan.disabled = false;
        btnStop.disabled = true;
        if (typeof Quagga !== 'undefined') { Quagga.stop(); }
    }

    /* ---- Manual input ---- */
    function manualSearch() {
        var code = manualInput.value.trim();
        if (!code) { status('พิมพ์เลขบาร์โค้ดก่อน', 'error'); return; }
        if (!/^[A-Za-z0-9\-_]+$/.test(code)) { status('รูปแบบบาร์โค้ดไม่ถูกต้อง', 'error'); return; }
        manualInput.value = '';
        lookup(code);
    }

    /* ---- Product lookup ---- */
    function lookup(code) {
        status('กำลังค้นหา ' + code + '...', 'info');
        showLoading();
        resultSection.classList.remove('hidden');

        fetchProduct(code);
    }

    function fetchProduct(code) {
        fetch('https://world.openfoodfacts.org/api/v2/product/' + code + '.json')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.status === 1 && data.product) {
                    showProduct(code, data.product);
                } else {
                    fetchUPCitemdb(code);
                }
            })
            .catch(function() {
                fetchUPCitemdb(code);
            });
    }

    function fetchUPCitemdb(code) {
        fetch('https://api.upcitemdb.com/prod/trial/lookup?upc=' + code)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.items && data.items.length > 0) {
                    var item = data.items[0];
                    showProductUP(code, item);
                } else {
                    showNoResult(code);
                }
            })
            .catch(function() {
                showNoResult(code);
            });
    }

    function showNoResult(code) {
        document.getElementById('barcodeDisplay').textContent = code;
        document.getElementById('productName').textContent = 'ไม่พบข้อมูลสินค้า';
        document.getElementById('productBrand').textContent = 'ลองค้นหาด้วยบาร์โค้ดอื่น';
        document.getElementById('productQuantity').textContent = '';
        document.getElementById('productImage').style.display = 'none';
        document.getElementById('detailsGrid').innerHTML = '';
        document.getElementById('ingredientsBox').classList.add('hidden');
        document.getElementById('nutrientsBox').classList.add('hidden');
        status('ไม่พบข้อมูลสำหรับ ' + code, 'error');
        addHistory(code, 'ไม่พบข้อมูล');
    }

    function showLoading() {
        document.getElementById('barcodeDisplay').textContent = '';
        document.getElementById('productName').textContent = 'กำลังค้นหา...';
        document.getElementById('productBrand').textContent = '';
        document.getElementById('productQuantity').textContent = '';
        document.getElementById('productImage').style.display = 'none';
        document.getElementById('detailsGrid').innerHTML = '';
        document.getElementById('ingredientsBox').classList.add('hidden');
        document.getElementById('nutrientsBox').classList.add('hidden');
    }

    /* ---- Display product (Open Food Facts) ---- */
    function showProduct(code, p) {
        document.getElementById('barcodeDisplay').textContent = code;

        var name = p.product_name_th || p.product_name || p.generic_name_th || p.generic_name || 'ไม่ทราบชื่อ';
        document.getElementById('productName').textContent = name;

        var brand = p.brands || '';
        document.getElementById('productBrand').textContent = brand;

        var qty = p.quantity || '';
        document.getElementById('productQuantity').textContent = qty;

        var img = document.getElementById('productImage');
        if (p.image_front_url || p.image_url) {
            img.src = p.image_front_url || p.image_url;
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }

        var details = [];
        addDetail(details, 'ประเภท', cats(p));
        addDetail(details, 'ประเทศ', p.countries);
        addDetail(details, 'ร้าน', p.stores);
        addDetail(details, 'ฉลาก/มาตรฐาน', p.labels);
        addDetail(details, 'บรรจุภัณฑ์', p.packaging);
        if (p.nutriscore_grade) addDetail(details, 'Nutri-Score', p.nutriscore_grade.toUpperCase());
        if (p.ecoscore_grade) addDetail(details, 'Eco-Score', p.ecoscore_grade.toUpperCase());
        if (p.nova_group) addDetail(details, 'NOVA Group', p.nova_group);

        document.getElementById('detailsGrid').innerHTML = details.map(function(d) {
            return '<div class="detail-item"><span class="detail-label">' + d[0] + '</span><span class="detail-value">' + d[1] + '</span></div>';
        }).join('');

        var ing = document.getElementById('ingredientsBox');
        var ingText = document.getElementById('ingredients');
        var ingStr = p.ingredients_text_th || p.ingredients_text || p.ingredients_text_en || '';
        if (ingStr) {
            ing.classList.remove('hidden');
            ingText.textContent = ingStr;
        } else {
            ing.classList.add('hidden');
        }

        var nutBox = document.getElementById('nutrientsBox');
        var nutTable = document.getElementById('nutrientsTable');
        var nuts = (p.nutriments || {});
        var nutRows = [];
        var nutDefs = [
            ['energy-kcal','พลังงาน','kcal'],
            ['fat','ไขมัน','g'],
            ['saturated-fat','ไขมันอิ่มตัว','g'],
            ['carbohydrates','คาร์โบไฮเดรต','g'],
            ['sugars','น้ำตาล','g'],
            ['fiber','ใยอาหาร','g'],
            ['proteins','โปรตีน','g'],
            ['salt','เกลือ','g'],
            ['sodium','โซเดียม','g']
        ];
        nutDefs.forEach(function(nd) {
            var key = nd[0];
            var val100g = nuts[key + '_100g'];
            if (val100g !== undefined && val100g !== null) {
                nutRows.push('<tr><td>' + nd[1] + '</td><td>' + Number(val100g).toFixed(1) + ' ' + nd[2] + '</td></tr>');
            }
        });
        if (nutRows.length > 0) {
            nutBox.classList.remove('hidden');
            nutTable.innerHTML = nutRows.join('');
        } else {
            nutBox.classList.add('hidden');
        }

        status('พบข้อมูล :)', 'success');
        addHistory(code, name);
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    /* ---- Display product (UPCitemdb) ---- */
    function showProductUP(code, item) {
        document.getElementById('barcodeDisplay').textContent = code;
        document.getElementById('productName').textContent = item.title || 'ไม่ทราบชื่อ';
        document.getElementById('productBrand').textContent = item.brand || '';
        document.getElementById('productQuantity').textContent = item.size || item.weight || '';

        var img = document.getElementById('productImage');
        if (item.images && item.images.length > 0) {
            img.src = item.images[0];
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }

        var details = [];
        addDetail(details, 'ประเภท', item.category);
        addDetail(details, 'รุ่น', item.model);
        addDetail(details, 'สี', item.color);
        addDetail(details, 'ร้าน', item.vendor);
        addDetail(details, 'ประเทศ', item.country);
        if (item.lowest_recorded_price) addDetail(details, 'ราคาต่ำสุด', '$' + item.lowest_recorded_price);
        if (item.highest_recorded_price) addDetail(details, 'ราคาสูงสุด', '$' + item.highest_recorded_price);

        document.getElementById('detailsGrid').innerHTML = details.map(function(d) {
            return '<div class="detail-item"><span class="detail-label">' + d[0] + '</span><span class="detail-value">' + d[1] + '</span></div>';
        }).join('');

        document.getElementById('ingredientsBox').classList.add('hidden');
        document.getElementById('nutrientsBox').classList.add('hidden');

        status('พบข้อมูล :)', 'success');
        addHistory(code, item.title || 'ไม่ทราบชื่อ');
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function cats(p) {
        var tags = p.categories_tags || [];
        return tags.map(function(t) { return t.replace(/^[a-z]{2}:/,''); }).slice(0,3).join(', ') || '-';
    }

    function addDetail(arr, label, val) {
        if (val && String(val).trim()) arr.push([label, String(val).trim()]);
    }

    /* ---- Events ---- */
    btnScan.addEventListener('click', startScanner);
    btnStop.addEventListener('click', stopScanner);
    btnSearch.addEventListener('click', manualSearch);
    btnScanAgain.addEventListener('click', function() {
        resultSection.classList.add('hidden');
        status('', '');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    manualInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') manualSearch(); });

    /* ---- Init ---- */
    loadHistory();
    renderHistory();
})();
