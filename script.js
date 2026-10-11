/* REGISTRASI SERVICE WORKER UNTUK PWA */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker terdaftar:', reg.scope))
            .catch(err => console.error('Pendaftaran Service Worker gagal:', err));
    });
}

/* LOGIKA FITUR DARK / LIGHT MODE */
function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeUI(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeUI(newTheme);

    renderRecapTahunan();
}

function updateThemeUI(theme) {
    const icon = document.getElementById("themeIcon");
    const text = document.getElementById("themeText");
    if (icon) icon.textContent = theme === "dark" ? "🌙" : "☀️";
    if (text) text.textContent = theme === "dark" ? "Dark" : "Light";
}

initTheme();

/* CONFIG SUPABASE */
const SUPABASE_URL = "https://mdcegfhpkvrikxvbwxqu.supabase.co";
const SUPABASE_KEY = "sb_publishable_ReqDYL_GZugxAXb5ylavNw_l4p4MX4O";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* HIERARKI PRIORITAS LOGIN (SESSION LOCK) */
const ROLE_PRIORITY = {
    'admin': 3,     // Operator A
    'operator': 2,  // Operator B
    'member': 1     // Member
};

let transactions = [];
let heartbeatTimer = null;
let currentUserRole = 'member';
let sessionChannel = null;
let allAuditLogs = [];

/* INTEGRASI SWEETALERT2 NOTIFICATION TOAST */
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
});

function showToast(message) {
    let iconType = 'info';
    if (message.includes('✅') || message.includes('🎉')) iconType = 'success';
    else if (message.includes('❌') || message.includes('🗑') || message.includes('🚫')) iconType = 'error';
    else if (message.includes('⚠️') || message.includes('⏳')) iconType = 'warning';

    let cleanMessage = message.replace(/[✅🎉❌🗑🚫⚠️⏳ℹ️]/g, '').trim();

    Toast.fire({
        icon: iconType,
        title: cleanMessage
    });
}

/* FUNGSI FITUR AUDIT LOG (DISARING DENGAN ROLE & KALENDER) */
async function logAuditAction(action, details = '') {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const email = session?.user?.email || 'System';
        
        await supabaseClient.from('audit_logs').insert([{
            user_email: email,
            user_role: currentUserRole,
            action: action,
            details: details
        }]);
        
        await loadAuditLogs();
    } catch (err) {
        console.error('Gagal mencatat audit log:', err);
    }
}

async function loadAuditLogs() {
    const container = document.getElementById('bodyTabelAudit');
    if (!container) return;

    const { data: logs, error } = await supabaseClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !logs || logs.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:#888;padding:15px;">Belum ada riwayat aktivitas.</div>`;
        allAuditLogs = [];
        return;
    }

    allAuditLogs = logs;
    filterAuditLogs();
}

function renderAuditLogs(logs) {
    const container = document.getElementById('bodyTabelAudit');
    if (!container) return;

    container.innerHTML = '';

    if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center;color:#888;padding:15px;">Tidak ada riwayat aktivitas untuk filter tersebut.</div>`;
        return;
    }

    logs.forEach(log => {
        const d = new Date(log.created_at);
        const waktuSingkat = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} (${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()})`;

        let displayUser = escapeHTML(log.user_email || '');
        if (displayUser.includes('@')) {
            displayUser = displayUser.split('@')[0];
        }

        const role = (log.user_role || 'member').toUpperCase();
        let roleBg = '#334155';
        if (role === 'ADMIN') roleBg = '#8b5cf6';
        else if (role === 'OPERATOR') roleBg = '#059669';
        else if (role === 'SYSTEM') roleBg = '#475569';

        const card = document.createElement('div');
        card.className = 'audit-card-item';
        card.innerHTML = `
            <div class="audit-card-header">
                <span class="audit-time">🕒 ${waktuSingkat}</span>
                <span class="audit-role" style="background: ${roleBg};">${role}</span>
            </div>
            <div class="audit-card-body">
                <div class="audit-user">👤 <b>${displayUser}</b> <span style="font-size:11px; color:var(--text-secondary);">(${escapeHTML(log.user_email)})</span></div>
                <div class="audit-action">⚡ <b>${escapeHTML(log.action)}</b></div>
                <div class="audit-detail">${escapeHTML(log.details || '-')}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

function filterAuditLogs() {
    const roleEl = document.getElementById('filterRoleAudit');
    const dateEl = document.getElementById('filterTanggalAudit');
    
    const selectedRole = roleEl ? roleEl.value.toLowerCase() : '';
    const selectedDate = dateEl ? dateEl.value : '';

    const filtered = allAuditLogs.filter(log => {
        const logRole = (log.user_role || '').toLowerCase();
        const matchRole = !selectedRole || logRole === selectedRole;

        let matchDate = true;
        if (selectedDate && log.created_at) {
            const logDateOnly = log.created_at.split('T')[0];
            matchDate = logDateOnly === selectedDate;
        }

        return matchRole && matchDate;
    });

    renderAuditLogs(filtered);
}

function resetFilterAudit() {
    const roleEl = document.getElementById('filterRoleAudit');
    const dateEl = document.getElementById('filterTanggalAudit');
    if (roleEl) roleEl.value = '';
    if (dateEl) dateEl.value = '';
    renderAuditLogs(allAuditLogs);
}

/* FUNGSI ADMIN PANEL: MANAJEMEN PENGGUNA (OTOMATIS MENGAMBIL DARI PROFILES & AUDIT LOGS) */
async function loadUsersList() {
    const tbody = document.getElementById('bodyTabelUsers');
    if (!tbody) return;

    try {
        // 1. Ambil data profil yang sudah terdaftar
        const { data: profiles, error: errProfiles } = await supabaseClient
            .from('profiles')
            .select('*');

        if (errProfiles) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#888;padding:15px;">Gagal memuat data pengguna.</td></tr>`;
            return;
        }

        // 2. Ambil seluruh email dari audit logs agar pengguna yang baru login/aktivitas otomatis terdeteksi
        const { data: auditLogs } = await supabaseClient
            .from('audit_logs')
            .select('user_email, user_role');

        let userMap = new Map();

        // Masukkan pengguna yang ada di profiles
        (profiles || []).forEach(p => {
            if (p.email) {
                userMap.set(p.email.toLowerCase(), p.role || 'member');
            }
        });

        // Masukkan pengguna dari audit_logs jika belum tercatat di profiles
        (auditLogs || []).forEach(log => {
            if (log.user_email && log.user_email !== 'System' && !log.user_email.includes('null')) {
                const emailClean = log.user_email.toLowerCase();
                if (!userMap.has(emailClean)) {
                    const defaultRole = (log.user_role || 'member').toLowerCase();
                    userMap.set(emailClean, defaultRole);

                    // Daftarkan otomatis ke profiles agar tersimpan permanen
                    supabaseClient.from('profiles').insert([{ email: emailClean, role: defaultRole }]);
                }
            }
        });

        if (userMap.size === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#888;padding:15px;">Belum ada pengguna terdaftar.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        userMap.forEach((role, email) => {
            const tr = document.createElement('tr');
            const roleClean = (role || 'member').toLowerCase();

            tr.innerHTML = `
                <td style="word-break: break-all;"><b>${escapeHTML(email)}</b></td>
                <td>
                    <select onchange="ubahRoleUser('${escapeHTML(email)}', this.value)" style="padding: 6px 8px; font-size: 12px; min-width: 100px;">
                        <option value="member" ${roleClean === 'member' ? 'selected' : ''}>Member</option>
                        <option value="operator" ${roleClean === 'operator' ? 'selected' : ''}>Operator</option>
                        <option value="admin" ${roleClean === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td style="text-align: center;">
                    <button class="delete-btn" onclick="hapusUser('${escapeHTML(email)}')">Hapus</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#888;padding:15px;">Terjadi kesalahan memuat data pengguna.</td></tr>`;
    }
}



async function tambahPenggunaBaru() {
    if (currentUserRole !== 'admin') {
        showToast("⚠️ Hanya Admin yang dapat menambah/mengatur pengguna!");
        return;
    }

    const emailInput = document.getElementById('inputEmailUserBaru');
    const roleSelect = document.getElementById('selectRoleUserBaru');
    const email = emailInput.value.trim().toLowerCase();
    const role = roleSelect.value;

    if (!email || !email.includes('@')) {
        showToast("⚠️ Masukkan email yang valid!");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .upsert([{ email: email, role: role }], { onConflict: 'email' });

        if (error) {
            showToast("❌ Gagal menyimpan data pengguna!");
            return;
        }

        await logAuditAction('TAMBAH_PENGGUNA', `Mengatur role ${email} menjadi ${role}`);
        showToast(`✅ Pengguna ${email} berhasil diatur sebagai ${role}!`);
        emailInput.value = '';
        await loadUsersList();
    } catch (e) {
        showToast("❌ Terjadi kesalahan sistem");
    }
}

async function ubahRoleUser(email, newRole) {
    if (currentUserRole !== 'admin') {
        showToast("⚠️ Hanya Admin yang dapat mengubah role!");
        await loadUsersList();
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ role: newRole })
            .eq('email', email);

        if (error) {
            showToast("❌ Gagal mengubah role pengguna");
            await loadUsersList();
            return;
        }

        await logAuditAction('UBAH_ROLE_USER', `Mengubah role ${email} menjadi ${newRole}`);
        showToast(`✅ Role ${email} diubah menjadi ${newRole}`);
        await loadUsersList();
    } catch (e) {
        showToast("❌ Terjadi kesalahan");
    }
}

async function hapusUser(email) {
    if (currentUserRole !== 'admin') {
        showToast("⚠️ Hanya Admin yang dapat menghapus pengguna!");
        return;
    }

    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    Swal.fire({
        title: 'Hapus Pengguna?',
        text: `Yakin ingin menghapus akses untuk ${email}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#ffffff' : '#0f172a'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .delete()
                    .eq('email', email);

                if (error) {
                    showToast("❌ Gagal menghapus pengguna");
                    return;
                }

                await logAuditAction('HAPUS_PENGGUNA', `Menghapus akses pengguna ${email}`);
                showToast("🗑 Pengguna berhasil dihapus");
                await loadUsersList();
            } catch (e) {
                showToast("❌ Terjadi kesalahan");
            }
        }
    });
}

/* FUNGSI SAPAAN KHUSUS BERDASARKAN ROLE */
function tampilkanSapaanRole() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const bgSwal = isDark ? '#0f172a' : '#ffffff';
    const textSwal = isDark ? '#ffffff' : '#0f172a';

    if (currentUserRole === 'admin') {
        Swal.fire({
            icon: 'success',
            title: 'Halo, Ketua Osis (Admin)! 👑',
            html: 'Selamat bekerja! Kamu punya <b>akses tertinggi</b> untuk mengelola kas, manajemen pengguna, dan mengambil alih sesi.',
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Mulai Kelola Kas',
            background: bgSwal,
            color: textSwal
        });
    } else if (currentUserRole === 'operator') {
        Swal.fire({
            icon: 'success',
            title: 'Halo, Bendahara! 🛠️',
            html: 'Selamat bekerja! Kamu punya <b>akses penuh</b> untuk mengelola kas. (Akan menunggu jika Ketua Osis sedang aktif).',
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Mulai Kelola Kas',
            background: bgSwal,
            color: textSwal
        });
    } else {
        Swal.fire({
            icon: 'info',
            title: 'Selamat Datang! 👋',
            html: 'Kamu masuk sebagai <b>Member</b> (Mode Lihat Saja). Kamu dapat melihat seluruh laporan dan grafik rekapitulasi kas.',
            confirmButtonColor: '#2563eb',
            confirmButtonText: 'Lihat Laporan',
            background: bgSwal,
            color: textSwal
        });
    }
}

/* GENERATE DROPDOWN TAHUN */
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

/* CEK ROLE PENGGUNA DARI TABEL PROFILES */
async function checkUserRole(email) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('email', email)
            .maybeSingle();

        if (data && data.role) {
            currentUserRole = data.role.toLowerCase();
        } else {
            currentUserRole = 'member';
        }
    } catch (e) {
        currentUserRole = 'member';
    }

    terapkanHakAksesUI();
}

/* MENERAPKAN HAK AKSES UI BERDASARKAN ROLE */
function terapkanHakAksesUI() {
    const roleBadge = document.getElementById('userRoleBadge');
    const isOperator = (currentUserRole === 'admin' || currentUserRole === 'operator');

    if (roleBadge) {
        roleBadge.textContent = currentUserRole.toUpperCase();
        if (currentUserRole === 'admin') roleBadge.style.background = '#8b5cf6';
        else if (currentUserRole === 'operator') roleBadge.style.background = '#059669';
        else roleBadge.style.background = '#d97706';
    }

    const sectionTambahSiswa = document.getElementById('sectionTambahSiswaContainer');
    const sectionTambahTransaksi = document.getElementById('sectionTambahTransaksi');
    const sectionAdminPanel = document.getElementById('sectionAdminPanel');

    if (!isOperator) {
        if (sectionTambahSiswa) sectionTambahSiswa.style.display = 'none';
        if (sectionTambahTransaksi) sectionTambahTransaksi.style.display = 'none';
    } else {
        if (sectionTambahSiswa) sectionTambahSiswa.style.display = 'flex';
        if (sectionTambahTransaksi) sectionTambahTransaksi.style.display = 'block';
    }

    if (sectionAdminPanel) {
        sectionAdminPanel.style.display = (currentUserRole === 'admin') ? 'block' : 'none';
    }
    if (currentUserRole === 'admin') {
        loadUsersList();
    }
}

/* LOGIKA CHECKLIST KAS SISWA (BERBASIS SUPABASE) */
const NOMINAL_KAS_PER_BULAN = 2000;

function getSelectedYear() {
    const el = document.getElementById('filterTahunRecap');
    return el ? el.value : new Date().getFullYear().toString();
}

async function getDataSiswa() {
    const year = getSelectedYear();
    try {
        const { data, error } = await supabaseClient
            .from('siswa')
            .select('*')
            .eq('tahun', year)
            .order('created_at', { ascending: true });

        if (error || !data) return [];
        return data;
    } catch {
        return [];
    }
}

async function renderTabelSiswa() {
    const tbody = document.getElementById('bodyTabelSiswa');
    const thAksiSiswa = document.getElementById('thAksiSiswa');
    if (!tbody) return;
    tbody.innerHTML = '';

    const isOperator = (currentUserRole === 'admin' || currentUserRole === 'operator');

    if (thAksiSiswa) {
        thAksiSiswa.style.display = isOperator ? 'table-cell' : 'none';
    }

    let dataSiswa = await getDataSiswa();
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
            const tr = document.createElement('tr');
            const bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : new Array(12).fill(false);
            const jumlahBulanLunas = bulanArr.filter(b => b === true).length;
            const totalBayar = jumlahBulanLunas * NOMINAL_KAS_PER_BULAN;

            let htmlCheckbox = '';
            bulanArr.forEach((lunas, indexBulan) => {
                const disabledAttr = !isOperator ? 'disabled' : '';
                htmlCheckbox += `
                    <td style="text-align: center;">
                        <input type="checkbox" style="width: 18px; height: 18px; accent-color: #10b981; cursor: pointer;" ${lunas ? 'checked' : ''} ${disabledAttr} onchange="toggleBayar('${siswa.id}', ${indexBulan})">
                    </td>
                `;
            });

            let htmlAksi = '';
            if (isOperator) {
                htmlAksi = `
                    <td style="text-align: center; white-space: nowrap;">
                        <button class="refresh-btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px; background: #2563eb;" onclick="kirimNotifWA('${siswa.id}')" title="Kirim Tagihan WA">💬 WA</button>
                        <button class="refresh-btn" style="padding: 4px 8px; font-size: 11px; margin-right: 4px;" onclick="lunasSemuaBulan('${siswa.id}')" title="Lunas 1 Tahun">Lunas 1Th</button>
                        <button class="delete-btn" onclick="hapusSiswa('${siswa.id}', '${escapeHTML(siswa.nama)}')">✕</button>
                    </td>
                `;
            }

            tr.innerHTML = `
                <td><b>${escapeHTML(siswa.nama)}</b></td>
                <td><span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; white-space: nowrap;">Kelas ${escapeHTML(siswa.kelas || '-')}</span></td>
                ${htmlCheckbox}
                <td class="masuk" style="white-space: nowrap;">${rupiah(totalBayar)}</td>
                ${htmlAksi}
            `;
            tbody.appendChild(tr);
        });
    }

    await updateSummary();
    await renderRecapTahunan();
}

async function toggleBayar(idSiswa, indexBulan) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'operator') {
        showToast("⚠️ Anda tidak memiliki izin mengubah data!");
        await renderTabelSiswa();
        return;
    }
    
    const { data: siswa } = await supabaseClient.from('siswa').select('nama, bulan').eq('id', idSiswa).single();
    if (!siswa) return;

    let bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : new Array(12).fill(false);
    bulanArr[indexBulan] = !bulanArr[indexBulan];

    await supabaseClient.from('siswa').update({ bulan: bulanArr }).eq('id', idSiswa);
    await logAuditAction('UBAH_KAS_SISWA', `Mengubah status kas siswa ${siswa.nama} (Bulan ke-${indexBulan + 1})`);
    await renderTabelSiswa();
}

async function lunasSemuaBulan(idSiswa) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'operator') return;

    const { data: siswa } = await supabaseClient.from('siswa').select('nama, bulan').eq('id', idSiswa).single();
    if (!siswa) return;

    let bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : new Array(12).fill(false);
    const isAllChecked = bulanArr.every(b => b === true);
    const newBulanArr = new Array(12).fill(!isAllChecked);

    await supabaseClient.from('siswa').update({ bulan: newBulanArr }).eq('id', idSiswa);
    await logAuditAction('UBAH_KAS_SISWA', `Mengubah status lunas 1 th siswa ${siswa.nama}`);
    await renderTabelSiswa();
    showToast(`✅ Status pembayaran diperbarui!`);
}

async function tambahSiswa() {
    if (currentUserRole !== 'admin' && currentUserRole !== 'operator') return;
    const input = document.getElementById('inputNamaSiswa');
    const selectKelas = document.getElementById('selectKelasSiswa');
    const nama = input.value.trim();
    const kelas = selectKelas ? selectKelas.value : '7';
    const tahun = getSelectedYear();

    if (nama !== '') {
        const { error } = await supabaseClient.from('siswa').insert([{
            nama: nama,
            kelas: kelas,
            tahun: tahun,
            bulan: new Array(12).fill(false)
        }]);

        if (error) {
            showToast("❌ Gagal menambahkan siswa!");
            return;
        }

        await logAuditAction('TAMBAH_SISWA', `Menambahkan siswa: ${nama} (Kelas ${kelas})`);
        input.value = '';
        await renderTabelSiswa();
        showToast(`✅ Siswa ${nama} berhasil ditambahkan!`);
    } else {
        showToast("⚠️ Masukkan nama siswa terlebih dahulu!");
    }
}

async function hapusSiswa(idSiswa, namaSiswa) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'operator') return;
    
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    Swal.fire({
        title: 'Hapus Siswa?',
        text: `Yakin ingin menghapus ${namaSiswa} dari checklist? Data ini tidak dapat dikembalikan.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#ffffff' : '#0f172a'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await supabaseClient.from('siswa').delete().eq('id', idSiswa);
            await logAuditAction('HAPUS_SISWA', `Menghapus siswa: ${namaSiswa}`);
            await renderTabelSiswa();
            showToast("🗑 Siswa berhasil dihapus");
        }
    });
}

/* FITUR KIRIM NOTIFIKASI TAGIHAN KAS VIA WHATSAPP */
window.kirimNotifWA = async function (idSiswa) {
    const { data: siswa } = await supabaseClient.from('siswa').select('*').eq('id', idSiswa).single();
    if (!siswa) return;

    const namaBulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    let bulanBelumLunas = [];
    const bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : new Array(12).fill(false);
    
    bulanArr.forEach((lunas, idx) => {
        if (!lunas) {
            bulanBelumLunas.push(namaBulan[idx]);
        }
    });

    if (bulanBelumLunas.length === 0) {
        showToast(`🎉 Pembayaran ${siswa.nama} sudah lunas 1 tahun!`);
        return;
    }

    const totalTunggakan = bulanBelumLunas.length * NOMINAL_KAS_PER_BULAN;
    const tahunTerpilih = getSelectedYear();

    let pesan = `Halo *${siswa.nama}* (Kelas ${siswa.kelas || '-'}),\n\n`;
    pesan += `Berikut adalah pemberitahuan tagihan kas sekolah tahun ${tahunTerpilih} yang belum lunas:\n`;
    pesan += `• *Bulan Belum Lunas*:\n  - ${bulanBelumLunas.join('\n  - ')}\n\n`;
    pesan += `• *Total Tunggakan*: ${rupiah(totalTunggakan)}\n\n`;
    pesan += `Mohon segera melakukan pembayaran kas kepada bendahara kelas ya. Terima kasih! 🙏`;

    const encodedPesan = encodeURIComponent(pesan);
    const waUrl = `https://wa.me/?text=${encodedPesan}`;
    window.open(waUrl, '_blank');
};

/* FITUR CETAK LAPORAN PDF */
window.exportPDF = function () {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
        showToast("❌ Library PDF belum dimuat!");
        return;
    }

    const doc = new jsPDF();
    const selectedYear = getSelectedYear();

    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129);
    doc.text("LAPORAN KAS SEKOLAH", 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Tahun Periode: ${selectedYear}`, 14, 28);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 34);

    const data = getFilteredData();
    
    if (data.length === 0) {
        showToast("⚠️ Tidak ada data transaksi untuk dicetak ke PDF");
        return;
    }

    const tableRows = data.map((item, index) => [
        index + 1,
        formatDate(item.tanggal),
        item.jenis,
        rupiah(item.jumlah),
        item.kategori || '-',
        item.pihak || '-',
        item.keterangan || '-'
    ]);

    doc.autoTable({
        startY: 42,
        head: [['No', 'Tanggal', 'Jenis', 'Jumlah', 'Kategori', 'Pihak', 'Keterangan']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [6, 78, 59] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            3: { halign: 'right' }
        }
    });

    doc.save(`Laporan-Kas-Sekolah-${selectedYear}.pdf`);
    logAuditAction('EKSPOR_PDF', `Mencetak laporan PDF periode ${selectedYear}`);
    showToast("✅ Berhasil mengunduh Laporan PDF!");
};

/* REKAPITULASI TAHUNAN & GRAFIK KEUANGAN */
async function renderRecapTahunan() {
    const tbody = document.getElementById('bodyTabelRecap');
    if (!tbody) return;

    const selectedYear = getSelectedYear();
    const namaBulanFull = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const namaBulanSingkat = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

    let kasSiswaBulan = new Array(12).fill(0);
    let transaksiMasukBulan = new Array(12).fill(0);
    let transaksiKeluarBulan = new Array(12).fill(0);

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

    let dataSiswa = await getDataSiswa();
    dataSiswa.forEach(siswa => {
        const bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : [];
        bulanArr.forEach((lunas, indexBulan) => {
            if (lunas) {
                kasSiswaBulan[indexBulan] += NOMINAL_KAS_PER_BULAN;
            }
        });
    });

    tbody.innerHTML = '';
    let grandKasSiswa = 0;
    let grandPemasukanLain = 0;
    let grandPengeluaran = 0;

    let totalMasukGrafik = [];

    for (let i = 0; i < 12; i++) {
        const kasSiswa = kasSiswaBulan[i];
        const masukaLain = transaksiMasukBulan[i];
        const totalMasuk = kasSiswa + masukaLain;
        const pengeluaran = transaksiKeluarBulan[i];
        const saldoBersih = totalMasuk - pengeluaran;

        grandKasSiswa += kasSiswa;
        grandPemasukanLain += masukaLain;
        grandPengeluaran += pengeluaran;

        totalMasukGrafik.push(totalMasuk);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${namaBulanFull[i]}</b></td>
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

    renderGrafikKeuangan(namaBulanSingkat, totalMasukGrafik, transaksiKeluarBulan);
}

/* GRAFIK KEUANGAN (CHART.JS) DENGAN TEMA DINAMIS */
let myChart = null;

function renderGrafikKeuangan(labelsBulan, dataMasuk, dataKeluar) {
    const canvasElement = document.getElementById('grafikKeuangan');
    if (!canvasElement) return;

    if (myChart) {
        myChart.destroy();
    }

    const ctx = canvasElement.getContext('2d');
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    const textColor = isDark ? '#f1f5f9' : '#0f172a';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

    let gradientMasuk = ctx.createLinearGradient(0, 0, 0, 250);
    gradientMasuk.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    gradientMasuk.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    let gradientKeluar = ctx.createLinearGradient(0, 0, 0, 250);
    gradientKeluar.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
    gradientKeluar.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsBulan,
            datasets: [
                {
                    label: 'Pemasukan (Rp)',
                    data: dataMasuk,
                    backgroundColor: gradientMasuk,
                    borderColor: '#10b981',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Pengeluaran (Rp)',
                    data: dataKeluar,
                    backgroundColor: gradientKeluar,
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#ef4444',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { 
                        color: textColor, 
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
                        boxWidth: 14,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.raw || 0;
                            return ` ${context.dataset.label}: Rp ${value.toLocaleString('id-ID')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: textColor, 
                        font: { family: 'Plus Jakarta Sans', size: 11 },
                        maxRotation: 0 
                    },
                    grid: { display: false }
                },
                y: {
                    ticks: { 
                        color: textColor, 
                        font: { family: 'Plus Jakarta Sans', size: 10 },
                        callback: function(value) {
                            if (value >= 1000000) {
                                return (value / 1000000) + 'jt';
                            } else if (value >= 1000) {
                                return (value / 1000) + 'rb';
                            }
                            return value;
                        }
                    },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

/* FUNGSI JAM REAL TIME */
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

        if (errorElement) {
            errorElement.innerHTML = `⏳ Terlalu banyak percobaan gagal.<br>Silakan tunggu <b>${remainingSeconds}</b> detik lagi.`;
            errorElement.style.display = "block";
        }
        if (loginBtn) loginBtn.disabled = true;
        return true;
    } else {
        if (lockoutUntil !== 0) {
            localStorage.removeItem("lockoutUntil");
            localStorage.setItem("failedAttempts", "0");
            const loginBtn = document.getElementById("loginSubmitBtn");
            const errorElement = document.getElementById("loginError");
            if (loginBtn) loginBtn.disabled = false;
            if (errorElement) errorElement.style.display = "none";
        }
        return false;
    }
}

setInterval(() => {
    const loginPage = document.getElementById("loginPage");
    if (loginPage && loginPage.style.display !== "none") {
        isLockedOut();
    }
}, 1000);

/* SINGLE SESSION LOCK BERBASIS HIERARKI PERAN */
async function checkActiveSessionLock(currentEmail, currentRole) {
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
            const myPriority = ROLE_PRIORITY[currentRole] || 1;
            const activePriority = ROLE_PRIORITY[data.user_role] || 1;

            if (myPriority > activePriority) {
                return { locked: false, isKicking: true };
            }

            return { locked: true, activeUser: data.user_email, activeRole: data.user_role };
        }

        return { locked: false };
    } catch {
        return { locked: false };
    }
}

async function sendHeartbeat(email, role) {
    try {
        await supabaseClient.from("session_lock").upsert({
            id: 1,
            user_email: email,
            user_role: role || currentUserRole,
            last_ping: new Date().toISOString()
        });
    } catch (e) {}
}

function startHeartbeat(email, role) {
    stopHeartbeat();
    sendHeartbeat(email, role);
    heartbeatTimer = setInterval(() => {
        sendHeartbeat(email, role);
    }, 10000);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

/* REALTIME DETECTOR SESI & PERUBAHAN DATA SISWA */
function initRealtimeSessionListener(myEmail) {
    if (sessionChannel) {
        supabaseClient.removeChannel(sessionChannel);
    }

    sessionChannel = supabaseClient
        .channel('session_lock_tracker')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_lock' }, async (payload) => {
            const newLock = payload.new;
            if (newLock && newLock.user_email && newLock.user_email !== myEmail) {
                const activePriority = ROLE_PRIORITY[newLock.user_role] || 1;
                const myPriority = ROLE_PRIORITY[currentUserRole] || 1;

                if (activePriority > myPriority) {
                    stopHeartbeat();
                    await supabaseClient.auth.signOut();
                    
                    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
                    Swal.fire({
                        icon: 'warning',
                        title: 'Sesi Dialihkan ⚠️',
                        text: `Sesi kamu diakhiri secara otomatis karena pengguna dengan hirarki lebih tinggi (${newLock.user_email}) telah masuk.`,
                        confirmButtonColor: '#ef4444',
                        background: isDark ? '#0f172a' : '#ffffff',
                        color: isDark ? '#ffffff' : '#0f172a'
                    }).then(() => {
                        location.reload();
                    });
                }
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'siswa' }, async () => {
            await renderTabelSiswa();
        })
        .subscribe();
}

/* PROSES LOGIN DENGAN PRIORITAS ROLE HIERARKI */
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
            errorElement.textContent = `⚠ Email atau password salah! (Sisa percobaan: ${remaining})`;
            errorElement.style.display = "block";
        }
    } else {
        await checkUserRole(data.user.email);

        const lockStatus = await checkActiveSessionLock(data.user.email, currentUserRole);
        if (lockStatus.locked) {
            await supabaseClient.auth.signOut();
            await logAuditAction('SESI_DITOLAK', `Ditolak masuk karena ${lockStatus.activeUser} (${lockStatus.activeRole}) aktif`);
            errorElement.innerHTML = `🚫 Sistem sedang digunakan oleh <b>${escapeHTML(lockStatus.activeUser)}</b> (${(lockStatus.activeRole || '').toUpperCase()}).<br>Kamu tidak dapat mengambil alih sesi pengguna tingkat di atasmu!`;
            errorElement.style.display = "block";
            return;
        }

        localStorage.removeItem("failedAttempts");
        localStorage.removeItem("lockoutUntil");
        errorElement.style.display = "none";
        document.getElementById("password").value = "";

        try {
            await supabaseClient.from("log_login").insert([{ email: data.user.email }]);
        } catch (err) {}

        startHeartbeat(data.user.email, currentUserRole);
        initRealtimeSessionListener(data.user.email);
        await logAuditAction('LOGIN', 'Berhasil masuk ke sistem');
        await checkLogin();
        
        tampilkanSapaanRole();
    }
};

/* PROSES LOGOUT */
window.logout = async function () {
    await logAuditAction('LOGOUT', 'Keluar dari sistem');
    stopHeartbeat();
    try {
        await supabaseClient.from("session_lock").delete().eq("id", 1);
    } catch(e) {}

    await supabaseClient.auth.signOut();
    location.reload();
};

/* PENGECEKAN SESI AKTIF SAAT REFRESH HALAMAN */
async function checkLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        const userEmail = session.user.email;
        await checkUserRole(userEmail);

        const lockStatus = await checkActiveSessionLock(userEmail, currentUserRole);
        if (lockStatus.locked) {
            stopHeartbeat();
            await supabaseClient.auth.signOut();
            document.getElementById("loginPage").style.display = "flex";
            document.getElementById("dashboard").style.display = "none";
            const errorElement = document.getElementById("loginError");
            if (errorElement) {
                errorElement.innerHTML = `🚫 Sesi dialihkan. Sistem sedang aktif digunakan oleh <b>${escapeHTML(lockStatus.activeUser)}</b>.`;
                errorElement.style.display = "block";
            }
            return;
        }

        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        document.getElementById("currentUserDisplay").textContent = `Pengguna: ${userEmail}`;

        startHeartbeat(userEmail, currentUserRole);
        initRealtimeSessionListener(userEmail);

        generateYearOptions(); 
        await renderTabelSiswa();
        await loadTransactions();
        await loadAuditLogs();
    } else {
        stopHeartbeat();
        document.getElementById("loginPage").style.display = "flex";
        document.getElementById("dashboard").style.display = "none";
        isLockedOut();
    }
}

const passwordInputEl = document.getElementById("password");
if (passwordInputEl) {
    passwordInputEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") window.login();
    });
}

/* UTILS */
function rupiah(number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(number);
}

function getToday() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const inputTanggal = document.getElementById("tanggal");
if (inputTanggal) inputTanggal.value = getToday();

/* KONEKSI & AMBIL DATA TRANSAKSI */
async function checkConnection() {
    const status = document.getElementById("connectionStatus");
    if (!status) return;
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
        await updateSummary();
        renderTable();
        await renderRecapTahunan();
    } catch {
        showToast("❌ Terjadi kesalahan jaringan");
    }
}

const transForm = document.getElementById("transactionForm");
if (transForm) {
    transForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (currentUserRole !== 'admin' && currentUserRole !== 'operator') {
            showToast("⚠️ Akses ditolak! Hanya operator/admin yang dapat menambah transaksi.");
            return;
        }

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
            await logAuditAction('TAMBAH_TRANSAKSI', `${transaksi.jenis}: ${rupiah(transaksi.jumlah)} (${transaksi.kategori})`);
            showToast("✅ Transaksi berhasil dicatat!");
            this.reset();
            document.getElementById("tanggal").value = getToday();
            await loadTransactions();
        } catch {
            showToast("❌ Terjadi kesalahan sistem");
        }
    });
}

window.deleteTransaction = async function (id) {
    if (currentUserRole !== 'admin' && currentUserRole !== 'operator') {
        showToast("⚠️ Akses ditolak! Hanya operator/admin yang dapat menghapus transaksi.");
        return;
    }
    
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";

    Swal.fire({
        title: 'Hapus Transaksi?',
        text: "Data kas yang dihapus dari database tidak dapat dikembalikan!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Ya, Hapus Transaksi!',
        cancelButtonText: 'Batal',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#ffffff' : '#0f172a'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { error } = await supabaseClient.from("kas_sekolah").delete().eq("id", id);
                if (error) {
                    showToast("❌ Gagal menghapus transaksi");
                    return;
                }
                await logAuditAction('HAPUS_TRANSAKSI', `Menghapus transaksi ID: ${id}`);
                showToast("🗑 Transaksi berhasil dihapus");
                await loadTransactions();
            } catch {
                showToast("❌ Terjadi kesalahan saat menghapus");
            }
        }
    });
};

/* PERHITUNGAN RINGKASAN SALDO */
async function updateSummary() {
    let masuk = 0, keluar = 0;
    
    transactions.forEach(item => {
        if (item.jenis === "MASUK") masuk += Number(item.jumlah);
        else if (item.jenis === "KELUAR") keluar += Number(item.jumlah);
    });

    let totalKasChecklist = 0;
    let dataSiswa = await getDataSiswa();
    dataSiswa.forEach(siswa => {
        const bulanArr = Array.isArray(siswa.bulan) ? siswa.bulan : [];
        const jumlahBulanLunas = bulanArr.filter(b => b === true).length;
        totalKasChecklist += jumlahBulanLunas * NOMINAL_KAS_PER_BULAN;
    });

    masuk += totalKasChecklist;

    const elMasuk = document.getElementById("totalMasuk");
    const elKeluar = document.getElementById("totalKeluar");
    const elSaldo = document.getElementById("saldo");

    if (elMasuk) elMasuk.textContent = rupiah(masuk);
    if (elKeluar) elKeluar.textContent = rupiah(keluar);
    if (elSaldo) elSaldo.textContent = rupiah(masuk - keluar);
}

function getFilteredData() {
    const search = document.getElementById("search") ? document.getElementById("search").value.toLowerCase().trim() : "";
    const tanggal = document.getElementById("filterTanggal") ? document.getElementById("filterTanggal").value : "";
    const jenis = document.getElementById("filterJenis") ? document.getElementById("filterJenis").value : "";
    const kategori = document.getElementById("filterKategori") ? document.getElementById("filterKategori").value.toLowerCase().trim() : "";

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
    const thAksiRiwayat = document.getElementById("thAksiRiwayat");
    if (!tbody) return;

    const isOperator = (currentUserRole === 'admin' || currentUserRole === 'operator');

    if (thAksiRiwayat) {
        thAksiRiwayat.style.display = isOperator ? 'table-cell' : 'none';
    }

    const data = getFilteredData();
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;padding:30px;">Belum ada transaksi kas 💸</td></tr>`;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement("tr");
        let htmlAksi = '';
        if (isOperator) {
            htmlAksi = `<td><button class="delete-btn" onclick="deleteTransaction('${item.id}')">Hapus</button></td>`;
        }

        tr.innerHTML = `
            <td>${formatDate(item.tanggal)}</td>
            <td class="${item.jenis === "MASUK" ? "masuk" : "keluar"}">${item.jenis === "MASUK" ? "💸 MASUK" : "📤 KELUAR"}</td>
            <td>${rupiah(item.jumlah)}</td>
            <td>${escapeHTML(item.kategori)}</td>
            <td>${escapeHTML(item.pihak)}</td>
            <td>${escapeHTML(item.metode)}</td>
            <td>${escapeHTML(item.keterangan || "-")}</td>
            ${htmlAksi}
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
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", renderTable);
});
const filterJenisEl = document.getElementById("filterJenis");
if (filterJenisEl) filterJenisEl.addEventListener("change", renderTable);

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
    logAuditAction('EKSPOR_CSV', 'Mengekspor laporan kas ke format CSV');
};

/* MENJALANKAN PENGECEKAN SESI AWAL */
checkLogin();
