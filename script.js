/* REGISTRASI SERVICE WORKER UNTUK PWA */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker terdaftar:', reg.scope))
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}

/* CONFIG SUPABASE */
const SUPABASE_URL = "https://mdcegfhpkvrikxvbwxqu.supabase.co";
const SUPABASE_KEY = "sb_publishable_ReqDYL_GZugxAXb5ylavNw_l4p4MX4O";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let transactions = [];
let heartbeatTimer = null;

/* GENERATE OTO TAHUN PADA DROPDOWN */
function generateYearOptions() {
    const select = document.getElementById('filterTahunRecap');
    if (!select) return;
    select.innerHTML = '';
    
    const currentYear = new Date().getFullYear();
    for (let y = 2024; y <= currentYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        select.appendChild(opt);
    }
}

/* LOGIKA FITUR CHECKLIST BULANAN BERDASARKAN TAHUN TERPILIH */
const NOMINAL_KAS_PER_BULAN = 2000;

function getSelectedYear() {
    const el = document.getElementById('filterTahunRecap');
    return el ? el.value : new Date().getFullYear().toString();
}

function getDataSiswa() {
    const year = getSelectedYear();
    const storageKey = 'dataKasSiswaBulanan_' + year;
    let data = JSON.parse(localStorage.getItem(storageKey));
    if (!data) {
        data = [
            { nama: "Ahmad", kelas: "7", bulan: new Array(12).fill(false) },
            { nama: "Budi", kelas: "8", bulan: new Array(12).fill(false) }
        ];
        localStorage.setItem(storageKey, JSON.stringify(data));
    }
    return data;
}

function saveCurrentDataSiswa(data) {
    const year = getSelectedYear();
    const storageKey = 'dataKasSiswaBulanan_' + year;
    localStorage.setItem(storageKey, JSON.stringify(data));
}

function renderTabelSiswa() {
    const tbody = document.getElementById('bodyTabelSiswa');
    if (!tbody) return;
    tbody.innerHTML = '';

    let dataSiswa = getDataSiswa();
    const filterKelas = document.getElementById('filterKelasSiswa') ? document.getElementById('filterKelasSiswa').value : '';
    const searchQuery = document.getElementById('searchSiswa') ? document.getElementById('searchSiswa').value.toLowerCase().trim() : '';

    const filteredData = dataSiswa.filter(siswa => {
        const matchKelas = !filterKelas || (siswa.kelas || '') === filterKelas;
        const matchName = !searchQuery || siswa.nama.toLowerCase().includes(searchQuery);
        return matchKelas && matchName;
    });

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16" style="text-align:center;color:#888;padding:20px;">Belum ada data siswa untuk tahun ini 🧑‍🎓</td></tr>`;
    } else {
        filteredData.forEach((siswa) => {
            const indexSiswaOriginal = dataSiswa.indexOf(siswa);
            const tr = document.createElement('tr');
            const jumlahBulanLunas = siswa.bulan.filter(b => b === true).length;
            const totalBayar = jumlahBulanLunas * NOMINAL_KAS_PER_BULAN;

            let htmlCheckbox = '';
            siswa.bulan.forEach((lunas, indexBulan) => {
                htmlCheckbox += `
                    <td style="text-align: center;">
                        <input type="checkbox" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer;" ${lunas ? 'checked' : ''} onchange="toggleBayar(${indexSiswaOriginal}, ${indexBulan})">
                    </td>
                `;
            });

            tr.innerHTML = `
                <td><b>${escapeHTML(siswa.nama)}</b></td>
                <td><span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; white-space: nowrap;">Kelas ${escapeHTML(siswa.kelas || '-')}</span></td>
                ${htmlCheckbox}
                <td class="masuk" style="white-space: nowrap;">${rupiah(totalBayar)}</td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="refresh-btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="lunasSemuaBulan(${indexSiswaOriginal})" title="Lunas 1 Tahun">Lunas 1Th</button>
                    <button class="delete-btn" onclick="hapusSiswa(${indexSiswaOriginal})">✕</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    saveCurrentDataSiswa(dataSiswa);
    updateSummary();
    renderRecapTahunan();
}

function toggleBayar(indexSiswa, indexBulan) {
    let dataSiswa = getDataSiswa();
    dataSiswa[indexSiswa].bulan[indexBulan] = !dataSiswa[indexSiswa].bulan[indexBulan];
    saveCurrentDataSiswa(dataSiswa);
    renderTabelSiswa();
}

function lunasSemuaBulan(indexSiswa) {
    let dataSiswa = getDataSiswa();
    const isAllChecked = dataSiswa[indexSiswa].bulan.every(b => b === true);
    dataSiswa[indexSiswa].bulan = new Array(12).fill(!isAllChecked);
    saveCurrentDataSiswa(dataSiswa);
    renderTabelSiswa();
    showToast(`✅ Status pembayaran diperbarui!`);
}

function tambahSiswa() {
    const input = document.getElementById('inputNamaSiswa');
    const selectKelas = document.getElementById('selectKelasSiswa');
    const nama = input.value.trim();
    const kelas = selectKelas ? selectKelas.value : '7';

    if (nama !== '') {
        let dataSiswa = getDataSiswa();
        dataSiswa.push({
            nama: nama,
            kelas: kelas,
            bulan: new Array(12).fill(false)
        });
        saveCurrentDataSiswa(dataSiswa);
        input.value = '';
        renderTabelSiswa();
        showToast(`✅ Siswa ${nama} berhasil ditambahkan!`);
    } else {
        showToast("⚠️ Masukkan nama siswa terlebih dahulu!");
    }
}

function hapusSiswa(index) {
    let dataSiswa = getDataSiswa();
    if (confirm(`Yakin ingin menghapus ${dataSiswa[index].nama} dari checklist?`)) {
        dataSiswa.splice(index, 1);
        saveCurrentDataSiswa(dataSiswa);
        renderTabelSiswa();
        showToast("🗑 Siswa berhasil dihapus");
    }
}

/* LOGIKA REKAPITULASI TAHUNAN */
function renderRecapTahunan() {
    const tbody = document.getElementById('bodyTabelRecap');
    if (!tbody) return;

    const selectedYear = getSelectedYear();
    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    let kasSiswaBulan = new Array(12).fill(0);
    let transaksiMasukBulan = new Array(12).fill(0);
    let transaksiKeluarBulan = new Array(12).fill(0);

    // Hitung transaksi manual berdasarkan tahun terpilih
    transactions.forEach(item => {
        if (!item.tanggal) return;
        const parts = item.tanggal.split('-');
        const itemYear = parts[0];
        const itemMonthIdx = parseInt(parts[1], 10) - 1;

        if (itemYear === selectedYear && itemMonthIdx >= 0 && itemMonthIdx < 12) {
            if (item.jenis === "MASUK") {
                transaksiMasukBulan[itemMonthIdx] += Number(item.jumlah);
            } else if (item.jenis === "KELUAR") {
                transaksiKeluarBulan[itemMonthIdx] += Number(item.jumlah);
            }
        }
    });

    // Hitung kas siswa dari checklist sesuai tahun yang sedang dipilih
    let dataSiswa = getDataSiswa();
    dataSiswa.forEach(siswa => {
        siswa.bulan.forEach((lunas, indexBulan) => {
            if (lunas) {
                kasSiswaBulan[indexBulan] += NOMINAL_KAS_PER_BULAN;
            }
        });
    });

    tbody.innerHTML = '';
    let grandKasSiswa = 0;
    let grandPemasukanLain = 0;
    let grandPengeluaran = 0;

    for (let i = 0; i < 12; i++) {
        const kasSiswa = kasSiswaBulan[i];
        const masukaLain = transaksiMasukBulan[i];
        const totalMasuk = kasSiswa + masukaLain;
        const pengeluaran = transaksiKeluarBulan[i];
        const saldoBersih = totalMasuk - pengeluaran;

        grandKasSiswa += kasSiswa;
        grandPemasukanLain += masukaLain;
        grandPengeluaran += pengeluaran;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${namaBulan[i]}</b></td>
            <td class="masuk">${rupiah(kasSiswa)}</td>
            <td class="masuk">${rupiah(masukaLain)}</td>
            <td class="masuk" style="font-weight: 700;">${rupiah(totalMasuk)}</td>
            <td class="keluar">${rupiah(pengeluaran)}</td>
            <td style="font-weight: 700; color: ${saldoBersih >= 0 ? '#34d399' : '#f87171'}">${rupiah(saldoBersih)}</td>
        `;
        tbody.appendChild(tr);
    }

    document.getElementById('recapKasSiswa').textContent = rupiah(grandKasSiswa);
    document.getElementById('recapPemasukanLain').textContent = rupiah(grandPemasukanLain);
    document.getElementById('recapPengeluaran').textContent = rupiah(grandPengeluaran);
}

/* FUNGSI WAKTU REAL TIME */
function updateRealTimeClock() {
    const now = new Date();
    
    const optionsDate = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateFormatted = now.toLocaleDateString('id-ID', optionsDate);
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const loginClock = document.getElementById("loginClock");
    if (loginClock) {
        loginClock.innerHTML = `<span>📅 ${dateFormatted}</span><span class="clock-divider">|</span><span>⏰ <b>${timeFormatted} WIB</b></span>`;
    }

    const dashClock = document.getElementById("dashClock");
    if (dashClock) {
        dashClock.innerHTML = `⏰ ${dateFormatted} • <b>${timeFormatted} WIB</b>`;
    }
}

setInterval(updateRealTimeClock, 1000);
updateRealTimeClock();

/* PROTEKSI RATE LIMITING */
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_TIME_MS = 30 * 1000;

function getFailedAttempts() {
    return parseInt(localStorage.getItem("failedAttempts") || "0");
}

function getLockoutUntil() {
    return parseInt(localStorage.getItem("lockoutUntil") || "0");
}

function isLockedOut() {
    const lockoutUntil = getLockoutUntil();
    const now = Date.now();

    if (lockoutUntil > now) {
        const remainingSeconds = Math.ceil((lockoutUntil - now) / 1000);
        const errorElement = document.getElementById("loginError");
        const loginBtn = document.getElementById("loginSubmitBtn");

        errorElement.innerHTML = `⏳ Terlalu banyak percobaan gagal.<br>Silakan tunggu <b>${remainingSeconds}</b> detik lagi.`;
        errorElement.style.display = "block";
        loginBtn.disabled = true;
        return true;
    } else {
        if (lockoutUntil !== 0) {
            localStorage.removeItem("lockoutUntil");
            localStorage.setItem("failedAttempts", "0");
            document.getElementById("loginSubmitBtn").disabled = false;
            document.getElementById("loginError").style.display = "none";
        }
        return false;
    }
}

setInterval(() => {
    if (document.getElementById("loginPage").style.display !== "none") {
        isLockedOut();
    }
}, 1000);

/* SINGLE SESSION LOCK */
async function checkActiveSessionLock(currentEmail) {
    try {
        const { data, error } = await supabaseClient
            .from("session_lock")
            .select("*")
            .eq("id", 1)
            .maybeSingle();

        if (error || !data) return { locked: false };

        const lastPing = new Date(data.last_ping).getTime();
        const now = Date.now();
        const secondsDiff = (now - lastPing) / 1000;

        if (secondsDiff < 30 && data.user_email && data.user_email !== currentEmail) {
            return { locked: true, activeUser: data.user_email };
        }

        return { locked: false };
    } catch {
        return { locked: false };
    }
}

async function sendHeartbeat(email) {
    try {
        await supabaseClient.from("session_lock").upsert({
            id: 1,
            user_email: email,
            last_ping: new Date().toISOString()
        });
    } catch (e) {
        console.error("Gagal mengirim heartbeat:", e);
    }
}

function startHeartbeat(email) {
    stopHeartbeat();
    sendHeartbeat(email);
    heartbeatTimer = setInterval(() => {
        sendHeartbeat(email);
    }, 10000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

/* LOGIN */
window.login = async function () {
    if (isLockedOut()) return;

    const emailInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value;
    const errorElement = document.getElementById("loginError");

    if (!emailInput || !passwordInput) {
        errorElement.textContent = "⚠️ Mohon isi email dan password!";
        errorElement.style.display = "block";
        return;
    }

    const lockStatus = await checkActiveSessionLock(emailInput);
    if (lockStatus.locked) {
        errorElement.innerHTML = `🚫 Pengguna <b>${escapeHTML(lockStatus.activeUser)}</b> sedang aktif di sistem.<br>Silakan tunggu pengguna tersebut logout!`;
        errorElement.style.display = "block";
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput
    });

    if (error) {
        let attempts = getFailedAttempts() + 1;
        localStorage.setItem("failedAttempts", attempts);

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_TIME_MS;
            localStorage.setItem("lockoutUntil", lockoutUntil);
            isLockedOut();
        } else {
            const remaining = MAX_LOGIN_ATTEMPTS - attempts;
            errorElement.textContent = `⚠️ Email atau password salah! (Sisa percobaan: ${remaining})`;
            errorElement.style.display = "block";
        }
    } else {
        localStorage.removeItem("failedAttempts");
        localStorage.removeItem("lockoutUntil");
        errorElement.style.display = "none";
        document.getElementById("password").value = "";

        try {
            await supabaseClient.from("log_login").insert([{ email: data.user.email }]);
        } catch (err) {}

        startHeartbeat(data.user.email);
        await checkLogin();
    }
};

/* LOGOUT */
window.logout = async function () {
    stopHeartbeat();
    try {
        await supabaseClient.from("session_lock").delete().eq("id", 1);
    } catch(e) {}

    await supabaseClient.auth.signOut();
    location.reload();
};

/* CHECK SESSION */
async function checkLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        const userEmail = session.user.email;
        
        const lockStatus = await checkActiveSessionLock(userEmail);
        if (lockStatus.locked) {
            await supabaseClient.auth.signOut();
            document.getElementById("loginPage").style.display = "flex";
            document.getElementById("dashboard").style.display = "none";
            const errorElement = document.getElementById("loginError");
            errorElement.innerHTML = `🚫 Sesi dialihkan. Pengguna <b>${escapeHTML(lockStatus.activeUser)}</b> sedang aktif di perangkat lain.`;
            errorElement.style.display = "block";
            return;
        }

        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        document.getElementById("currentUserDisplay").textContent = `Pengguna: ${userEmail}`;

        startHeartbeat(userEmail);
        generateYearOptions(); // Generate pilihan tahun otomatis saat login sukses
        renderTabelSiswa();
        loadTransactions();
    } else {
        stopHeartbeat();
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("dashboard").style.display = "none";
        isLockedOut();
    }
}

document.getElementById("password").addEventListener("keydown", function (e) {
    if (e.key === "Enter") window.login();
});

/* UTILS */
function rupiah(number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);
}

function getToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

document.getElementById("tanggal").value = getToday();

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2500);
}

/* DATABASE OPERATIONAL */
async function checkConnection() {
    const status = document.getElementById("connectionStatus");
    try {
        const { error } = await supabaseClient.from("kas_sekolah").select("id").limit(1);
        status.innerHTML = error ? "🔴 Database tidak terhubung" : "🟢 Database terhubung aktif";
    } catch {
        status.innerHTML = "🔴 Database tidak terhubung";
    }
}

async function loadTransactions() {
    await checkConnection();
    try {
        const { data, error } = await supabaseClient
            .from("kas_sekolah")
            .select("*")
            .order("tanggal", { ascending: false });

        if (error) {
            showToast("❌ Gagal mengambil data transaksi");
            return;
        }

        transactions = data || [];
        updateSummary();
        renderTable();
        renderRecapTahunan();
    } catch {
        showToast("❌ Terjadi kesalahan jaringan");
    }
}

document.getElementById("transactionForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const transaksi = {
        tanggal: document.getElementById("tanggal").value,
        jenis: document.getElementById("jenis").value,
        jumlah: Number(document.getElementById("jumlah").value),
        kategori: document.getElementById("kategori").value.trim(),
        pihak: document.getElementById("pihak").value.trim(),
        metode: document.getElementById("metode").value,
        keterangan: document.getElementById("keterangan").value.trim()
    };

    if (!transaksi.jumlah || transaksi.jumlah <= 0) {
        showToast("❌ Nominal harus lebih dari 0");
        return;
    }

    try {
        const { error } = await supabaseClient.from("kas_sekolah").insert([transaksi]);
        if (error) {
            showToast("❌ Gagal menyimpan data");
            return;
        }
        showToast("✅ Transaksi berhasil dicatat!");
        this.reset();
        document.getElementById("tanggal").value = getToday();
        await loadTransactions();
    } catch {
        showToast("❌ Terjadi kesalahan sistem");
    }
});

window.deleteTransaction = async function (id) {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;

    try {
        const { error } = await supabaseClient.from("kas_sekolah").delete().eq("id", id);
        if (error) {
            showToast("❌ Gagal menghapus transaksi");
            return;
        }
        showToast("🗑 Transaksi berhasil dihapus");
        await loadTransactions();
    } catch {
        showToast("❌ Terjadi kesalahan saat menghapus");
    }
};

/* FUNGSI UPDATE RINGKASAN TOTAL DANA MASUK & SALDO */
function updateSummary() {
    let masuk = 0, keluar = 0;
    
    transactions.forEach(item => {
        if (item.jenis === "MASUK") masuk += Number(item.jumlah);
        else if (item.jenis === "KELUAR") keluar += Number(item.jumlah);
    });

    let totalKasChecklist = 0;
    let dataSiswa = getDataSiswa();
    dataSiswa.forEach(siswa => {
        const jumlahBulanLunas = siswa.bulan.filter(b => b === true).length;
        totalKasChecklist += jumlahBulanLunas * NOMINAL_KAS_PER_BULAN;
    });

    masuk += totalKasChecklist;

    document.getElementById("totalMasuk").textContent = rupiah(masuk);
    document.getElementById("totalKeluar").textContent = rupiah(keluar);
    document.getElementById("saldo").textContent = rupiah(masuk - keluar);
}

function getFilteredData() {
    const search = document.getElementById("search").value.toLowerCase().trim();
    const tanggal = document.getElementById("filterTanggal").value;
    const jenis = document.getElementById("filterJenis").value;
    const kategori = document.getElementById("filterKategori").value.toLowerCase().trim();

    return transactions.filter(item => {
        const text = `${item.kategori || ''} ${item.pihak || ''} ${item.keterangan || ''}`.toLowerCase();
        return text.includes(search) &&
            (!tanggal || item.tanggal === tanggal) &&
            (!jenis || item.jenis === jenis) &&
            (!kategori || (item.kategori || '').toLowerCase().includes(kategori));
    });
}

function renderTable() {
    const tbody = document.getElementById("transactionTable");
    const data = getFilteredData();
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;padding:30px;">Belum ada transaksi kas 💸</td></tr>`;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(item.tanggal)}</td>
            <td class="${item.jenis === "MASUK" ? "masuk" : "keluar"}">${item.jenis === "MASUK" ? "💸 MASUK" : "📤 KELUAR"}</td>
            <td>${rupiah(item.jumlah)}</td>
            <td>${escapeHTML(item.kategori)}</td>
            <td>${escapeHTML(item.pihak)}</td>
            <td>${escapeHTML(item.metode)}</td>
            <td>${escapeHTML(item.keterangan || "-")}</td>
            <td>
                <button class="delete-btn" onclick="deleteTransaction('${item.id}')">Hapus</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(date) {
    if (!date) return "-";
    return new Date(date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function escapeHTML(text) {
    return String(text)
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

["search", "filterTanggal", "filterKategori"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderTable);
});
document.getElementById("filterJenis").addEventListener("change", renderTable);

window.exportCSV = function () {
    const data = getFilteredData();
    if (data.length === 0) {
        showToast("Tidak ada data untuk diekspor");
        return;
    }

    let csv = "Tanggal,Jenis,Jumlah,Kategori,Pihak,Metode,Keterangan\n";
    data.forEach(item => {
        const clean = str => `"${String(str || '').replaceAll('"', '""')}"`;
        csv += [item.tanggal, item.jenis, item.jumlah, clean(item.kategori), clean(item.pihak), clean(item.metode), clean(item.keterangan)].join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-kas-sekolah-${getToday()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/* RUN ON STARTUP */
checkLogin();
