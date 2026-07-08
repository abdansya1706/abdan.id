let PRODUCTS = []; 
let cart = [];
let kategoriAktif = "all";

document.addEventListener("DOMContentLoaded", async function() {
    // === LOGIKA PADA HALAMAN UTAMA / DASHBOARD ===
    if (window.location.pathname.includes('dashboard.html')) {
        const session = localStorage.getItem('sessionUser');
        if (!session) { window.location.href = 'index.html'; return; }
        
        document.getElementById('welcome-user').innerText = `Halo, ${JSON.parse(session).name}`;
        
        // Memunculkan tombol kendali Owner jika email Anda cocok
        if (JSON.parse(session).email === 'abdansyakuro1706@gmail.com') {
            const ownerBtn = document.getElementById('owner-secret-btn');
            if (ownerBtn) ownerBtn.style.display = 'inline-block';
        }

        await muatProdukDariServer();

        setTimeout(() => {
            const loader = document.getElementById('loading-screen');
            if(loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }
            memicuAnimasiMasuk();
        }, 800);
    }

    // === LOGIKA PADA HALAMAN MASUK / AUTENTIKASI (INDEX.HTML) ===
    if (document.getElementById('form-login') || document.getElementById('form-register')) {
        initAuthFeatures();
    }
});

function initAuthFeatures() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');

    // Navigasi Tampilan Form
    document.getElementById('link-to-register')?.addEventListener('click', (e) => {
        e.preventDefault(); loginForm.classList.add('hidden'); registerForm.classList.remove('hidden');
    });
    document.getElementById('link-to-login-from-reg')?.addEventListener('click', (e) => {
        e.preventDefault(); registerForm.classList.add('hidden'); loginForm.classList.remove('hidden');
    });
    document.getElementById('link-to-forgot')?.addEventListener('click', (e) => {
        e.preventDefault(); loginForm.classList.add('hidden'); forgotForm.classList.remove('hidden');
    });
    document.getElementById('link-to-login-from-forgot')?.addEventListener('click', (e) => {
        e.preventDefault(); forgotForm.classList.add('hidden'); loginForm.classList.remove('hidden');
    });

    // Request Pendaftaran Akun Baru
    document.getElementById('form-register')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const result = await response.json();
            if (result.success) {
                alert('Pendaftaran akun baru sukses! Silakan gunakan email untuk masuk.');
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert('Gangguan pada koneksi server registrasi.');
        }
    });

    // Request Validasi Log Masuk
    document.getElementById('form-login')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json();
            if (result.success) {
                localStorage.setItem('sessionUser', JSON.stringify(result.user));
                window.location.href = 'dashboard.html';
            } else {
                alert(result.message);
            }
        } catch (error) {
            alert('Gagal autentikasi, pastikan Node Server Anda menyala.');
        }
    });
}

// === LOAD DATA PRODUK REAL-TIME DARI SERVER ===
async function muatProdukDariServer() {
    try {
        const response = await fetch('/api/products');
        const result = await response.json();
        if (result.success) {
            PRODUCTS = result.data;
            tampilkanDaftarLayanan();
        }
    } catch (error) { console.error("Gagal sinkronisasi data produk server.", error); }
}

function tampilkanDaftarLayanan(dataKustom = null) {
    const container = document.getElementById('products-container');
    if (!container) return;
    container.innerHTML = '';

    let dataYangDitampilkan = dataKustom ? dataKustom : PRODUCTS;
    if (!dataKustom && kategoriAktif !== "all") {
        dataYangDitampilkan = PRODUCTS.filter(p => p.category === kategoriAktif);
    }

    if(dataYangDitampilkan.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; color:#94a3b8; text-align:center; padding: 20px;">Layanan kosong. Tambahkan stok produk dari panel admin.</p>`;
        return;
    }

    dataYangDitampilkan.forEach((p) => {
        container.innerHTML += `
            <div class="product-card fade-item">
                <div class="card-header">
                    <img src="${p.img}" class="sosmed-icon">
                    <span class="badge-${p.category}">${p.category.toUpperCase()}</span>
                </div>
                <h3>${p.name}</h3>
                <p class="product-price">Rp ${p.price.toLocaleString('id-ID')}</p>
                <button onclick="pilihLayanan(${p.id})" class="btn-add-cart">Pilih Layanan</button>
            </div>`;
    });
    memicuAnimasiMasuk();
}

function cariProduk() {
    const keyword = document.getElementById('search-input').value.toLowerCase().trim();
    if (keyword === "") { tampilkanDaftarLayanan(); return; }

    const hasilCari = PRODUCTS.filter(p => {
        const matchesKeyword = p.name.toLowerCase().includes(keyword) || p.category.toLowerCase().includes(keyword);
        if (kategoriAktif !== "all") { return matchesKeyword && p.category === kategoriAktif; }
        return matchesKeyword;
    });
    tampilkanDaftarLayanan(hasilCari);
}

function filterKategori(kategori) {
    kategoriAktif = kategori;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');
    document.getElementById('search-input').value = "";
    tampilkanDaftarLayanan();
}

function memicuAnimasiMasuk() {
    const items = document.querySelectorAll('.fade-item');
    items.forEach((item, idx) => { setTimeout(() => item.classList.add('show'), idx * 50); });
}

// ==========================================================================
// TRANSAKSI & MULTI-CHECKOUT (BISA BANYAK PRODUK sekaligus)
// ==========================================================================

// 1. Memperbaiki agar fungsi ini menambahkan produk ke list, bukan menimpa yang lama
function pilihLayanan(id) {
    const produk = PRODUCTS.find(p => p.id === id);
    if (!produk) return;

    // Cek apakah produk tersebut sudah ada di dalam keranjang
    const itemAda = cart.find(item => item.id === id);

    if (itemAda) {
        itemAda.qty += 1; // Jika sudah ada, tambahkan jumlahnya (quantity)
    } else {
        cart.push({ ...produk, qty: 1 }); // Jika belum ada, masukkan produk baru ke keranjang
    }
    
    alert(`🚀 ${produk.name} berhasil ditambahkan ke keranjang!`);
    updateCartUI();
}

// 2. Fungsi untuk mengurangi atau menghapus item dari keranjang jika salah klik
function hapusDariKeranjang(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

// 3. Memperbaiki tampilan keranjang agar bisa memuat daftar banyak produk sekaligus
function updateCartUI() {
    const cartItems = document.getElementById('cart-items');
    const totalPrice = document.getElementById('cart-total-price');
    if (!cartItems || !totalPrice) return;

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Silakan pilih beberapa layanan di sebelah kiri.</p>';
        totalPrice.innerText = 'Rp 0';
        return;
    }

    // Render semua item yang ada di keranjang
    cartItems.innerHTML = '';
    let totalSemua = 0;

    cart.forEach(item => {
        const subTotal = item.price * item.qty;
        totalSemua += subTotal;

        cartItems.innerHTML += `
            <div class="cart-item" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <div style="max-width: 70%;">
                    <span style="display:block; font-size:13px; font-weight:600;">🚀 ${item.name}</span>
                    <span style="font-size:11px; color: var(--text-secondary);">Jumlah: ${item.qty}x (@Rp ${item.price.toLocaleString('id-ID')})</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight:700; color:#6366f1; font-size:13px;">Rp ${subTotal.toLocaleString('id-ID')}</span>
                    <button onclick="hapusDariKeranjang(${item.id})" style="background:none; border:none; color:var(--neon-red); cursor:pointer; font-weight:bold; font-size:12px;">❌</button>
                </div>
            </div>`;
    });

    totalPrice.innerText = `Rp ${totalSemua.toLocaleString('id-ID')}`;
}

// 4. Memperbaiki fungsi checkout agar mengirimkan seluruh isi array produk keranjang ke server
async function checkout() {
    if (cart.length === 0) return alert('Pilih minimal salah satu layanan terlebih dahulu!');

    const namaPembeli = document.getElementById('buyer-name').value.trim();
    const teleponPembeli = document.getElementById('buyer-phone').value.trim();
    const targetLink = document.getElementById('buyer-target').value.trim();

    if (!namaPembeli || !teleponPembeli || !targetLink) {
        alert('Mohon lengkapi seluruh form data pembeli dan target akun!');
        return;
    }

    // Hitung total belanja dari seluruh item di keranjang
    const totalFinal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                cart: cart, 
                total: totalFinal, 
                namaPembeli: namaPembeli, 
                teleponPembeli: `${teleponPembeli} | Target: ${targetLink}`
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Semua pesanan Anda berhasil direkam oleh sistem!');
            if (result.redirectUrl) window.open(result.redirectUrl, '_blank');
            
            // Kosongkan kembali keranjang belanja setelah sukses belanja
            cart = [];
            document.getElementById('buyer-name').value = '';
            document.getElementById('buyer-phone').value = '';
            document.getElementById('buyer-target').value = '';
            updateCartUI();
        } else { 
            alert(result.message); 
        }
    } catch (e) { 
        alert('Gagal memproses transaksi multi-produk.'); 
    }
}

document.addEventListener("DOMContentLoaded", async function() {
    // === 1. JALANKAN ANIMASI NOTIFIKASI RANDOM DI SEMUA HALAMAN (Login, Daftar, & Dashboard) ===
    jalankanNotifikasiRandom();

    // === LOGIKA KHUSUS HALAMAN DASHBOARD ===
    if (window.location.pathname.includes('dashboard.html')) {
        const session = localStorage.getItem('sessionUser');
        if (!session) { window.location.href = 'index.html'; return; }
        
        document.getElementById('welcome-user').innerText = `Halo, ${JSON.parse(session).name}`;
        
        // Memunculkan tombol kendali Owner jika email Anda cocok
        if (JSON.parse(session).email === 'abdansyakuro1706@gmail.com') {
            const ownerBtn = document.getElementById('owner-secret-btn');
            if (ownerBtn) ownerBtn.style.display = 'inline-block';
        }

        await muatProdukDariServer();

        setTimeout(() => {
            const loader = document.getElementById('loading-screen');
            if(loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 500); }
            memicuAnimasiMasuk();
        }, 800);
    }

    // === LOGIKA KHUSUS HALAMAN AUTH / UTAMA (INDEX.HTML) ===
    if (document.getElementById('form-login') || document.getElementById('form-register')) {
        initAuthFeatures();
    }
});

// ==========================================================================
// FITUR ANIMASI NOTIFIKASI PEMBELIAN RANDOM DENGAN DATA 100% INDONESIA
// ==========================================================================
function jalankanNotifikasiRandom() {
    // 100 Nama Orang Indonesia Acak (Pria & Wanita)
    const daftarNama = [
        "Budi", "Siti", "Agus", "Dewi", "Rian", "Mega", "Aditya", "Putri", "Dedi", "Rina", 
        "Fajar", "Indah", "Roni", "Ayu", "Hendra", "Anisa", "Eko", "Yanti", "Bambang", "Wulan",
        "Rizky", "Fitri", "Taufik", "Nanda", "Andi", "Sri", "Dimas", "Maya", "Diki", "Diana",
        "Aris", "Lestari", "Wahyu", "Eka", "Slamet", "Sari", "Arif", "Kartika", "Denny", "Novi",
        "Hadi", "Yuni", "Joko", "Tri", "Rudi", "Endah", "Anwar", "Gita", "Yudi", "Ria",
        "Kevin", "Siska", "Farhan", "Amalia", "Ilham", "Dina", "Faisal", "Nisa", "Akbar", "Utami",
        "Rangga", "Lia", "Dani", "Dewi", "Zaki", "Intan", "Ferry", "Vina", "Bagus", "Ratna",
        "Reza", "Mia", "Adit", "Rini", "Fadel", "Puput", "Zul", "Chandra", "Galih", "Kurnia",
        "Dhany", "Mitha", "Daffa", "Anggi", "Robby", "Tika", "Gilang", "Rara", "Eky", "Syafiq",
        "Rendra", "Febri", "Gema", "Nabila", "Dika", "Hesti", "Irfan", "Tiara", "Agung", "Zahra"
    ];

    // 100 Kota/Kabupaten Seluruh Wilayah Indonesia (Sabang sampai Merauke)
    const daftarKota = [
        "Jakarta Pusat", "Surabaya", "Bandung", "Medan", "Bekasi", "Semarang", "Tangerang", "Makassar", 
        "Palembang", "Depok", "Asahan", "Batam", "Yogyakarta", "Malang", "Denpasar", "Balikpapan", 
        "Samarinda", "Banjarmasin", "Pontianak", "Padang", "Pekanbaru", "Bandar Lampung", "Bogor",
        "Cirebon", "Surakarta", "Tasikmalaya", "Manado", "Ambon", "Jayapura", "Kupang", "Mataram",
        "Banda Aceh", "Lhokseumawe", "Binjai", "Pematangsiantar", "Bukittinggi", "Payakumbuh", "Dumai",
        "Jambi", "Lubuklinggau", "Prabumulih", "Pangkalpinang", "Tanjungpinang", "Cimahi", "Sukabumi",
        "Banjar", "Pekalongan", "Tegal", "Salatiga", "Probolinggo", "Pasuruan", "Blitar", "Batu",
        "Madiun", "Mojokerto", "Serang", "Cilegon", "Singkawang", "Banjarbaru", "Tarakan", "Bitung",
        "Tomohon", "Kotamobagu", "Gorontalo", "Palopo", "Parepare", "Bau-Bau", "Kendari", "Palu",
        "Ternate", "Tidore", "Sorong", "Sleman", "Bantul", "Garut", "Cianjur", "Ciamis", "Kuningan",
        "Karawang", "Subang", "Purwakarta", "Sumedang", "Indramayu", "Majalengka", "Banyumas", "Cilacap",
        "Kebumen", "Purworejo", "Klaten", "Boyolali", "Sragen", "Sukoharjo", "Wonogiri", "Karanganyar",
        "Kudus", "Jepara", "Demak", "Pati", "Rembang", "Banyuwangi", "Jember", "Sidoarjo"
    ];

    const daftarWaktu = [
        "1 menit yang lalu", "3 menit yang lalu", "5 menit yang lalu", "9 menit yang lalu", 
        "14 menit yang lalu", "22 menit yang lalu", "35 menit yang lalu", "48 menit yang lalu", 
        "1 jam yang lalu", "2 jam yang lalu", "3 jam yang lalu", "4 jam yang lalu"
    ];

    const layananCadangan = [
        "Followers IG 1.000 | Non-Drop ♻️",
        "Likes IG 500 | Lifetime ♻️",
        "1.000 Followers TikTok Real Account",
        "1.000 Subscriber YouTube Garansi 30 Hari",
        "4.000 Jam Tayang YouTube (Monetisasi)",
        "1.000 Member Channel/Group Telegram"
    ];

    // Cek agar tidak menduplikasi elemen jika script ter-load ulang
    if (document.querySelector('.fake-notification')) return;

    // Buat wadah elemen pop-up secara dinamis
    const notifEl = document.createElement('div');
    notifEl.className = 'fake-notification';
    notifEl.innerHTML = `
        <div class="fake-icon">🚀</div>
        <div class="fake-content">
            <span id="fake-text"></span>
            <span id="fake-time-el" class="fake-time"></span>
        </div>
    `;
    document.body.appendChild(notifEl);

    function acakKonten() {
        const namaAcak = daftarNama[Math.floor(Math.random() * daftarNama.length)];
        const kotaAcak = daftarKota[Math.floor(Math.random() * daftarKota.length)];
        const waktuAcak = daftarWaktu[Math.floor(Math.random() * daftarWaktu.length)];
        
        let layananAcak = layananCadangan[Math.floor(Math.random() * layananCadangan.length)];
        // Menggunakan daftar produk asli database server jika array global-nya sudah termuat
        if (typeof PRODUCTS !== 'undefined' && PRODUCTS.length > 0) {
            layananAcak = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)].name;
        }

        // Teks Notifikasi Premium
        document.getElementById('fake-text').innerHTML = `<strong>${namaAcak}</strong> dari <em>${kotaAcak}</em> baru saja membeli <br><strong>${layananAcak}</strong>`;
        document.getElementById('fake-time-el').innerText = waktuAcak;

        notifEl.classList.add('show');

        // Sembunyikan pop-up setelah 5 detik tampil
        setTimeout(() => {
            notifEl.classList.remove('show');
        }, 5000);
    }

    function jadwalkanNotifBerikutnya() {
        // Durasi jeda acak pop-up berikutnya muncul (antara 10 sampai 18 detik sekali)
        const jedaWaktu = Math.floor(Math.random() * (18000 - 10000 + 1)) + 10000;
        setTimeout(() => {
            acakKonten();
            jadwalkanNotifBerikutnya();
        }, jedaWaktu);
    }

    // Pertama kali muncul: 3 detik setelah halaman apa saja terbuka
    setTimeout(() => {
        acakKonten();
        jadwalkanNotifBerikutnya();
    }, 3000);
}

function logout() { localStorage.removeItem('sessionUser'); window.location.href = 'index.html'; }

// ==========================================================================
// FITUR WIDGET INTERAKTIF CHAT WHATSAPP ADMIN
// ==========================================================================

// 1. Fungsi untuk Membuka dan Menutup Kotak Obrolan Pop-up
function toggleWaChat() {
    const chatBox = document.getElementById('wa-chat-box');
    if (!chatBox) return;

    if (chatBox.classList.contains('hidden')) {
        chatBox.classList.remove('hidden');
        // Jeda sedikit agar transisi CSS animasi smooth berjalan rapi
        setTimeout(() => chatBox.classList.add('show'), 10);
    } else {
        chatBox.classList.remove('show');
        setTimeout(() => chatBox.classList.add('hidden'), 300);
    }
}

// 2. Fungsi Kirim Pesan: Mengalihkan Teks Input menuju Link API WhatsApp Anda
function kirimKeWhatsApp() {
    const inputEl = document.getElementById('wa-chat-input');
    if (!inputEl) return;

    const pesanUser = inputEl.value.trim();
    
    // Jika user menekan kirim tapi kolomnya kosong, arahkan langsung ke chat kosong
    let teksTujuan = "Halo admin, saya ingin bertanya mengenai layanan suntik sosmed.";
    if (pesanUser !== "") {
        teksTujuan = pesanUser;
    }

    // KONFIGURASI NOMOR WHATSAPP ANDA (Ganti dengan nomor WhatsApp aktif Anda)
    // Format wajib menggunakan kode negara tanpa tanda '+' atau angka '0' di depan. Contoh: 6283851923159
    const nomorWhatsAppAdmin = "6285643585243"; 

    // Encode teks agar kompatibel dengan URL Browser
    const urlWhatsApp = `https://api.whatsapp.com/send?phone=${6285643585243}&text=${encodeURIComponent(teksTujuan)}`;
    
    // Buka aplikasi WhatsApp di tab browser baru
    window.open(urlWhatsApp, '_blank');

    // Kosongkan kembali form setelah ditekan kirim
    inputEl.value = "";
    toggleWaChat(); // Tutup kotak chat kembali
}

// 3. Pendeteksi Tombol Enter: Supaya ketik pesan bisa langsung dikirim saat tekan Enter di keyboard
function handleWaEnter(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        kirimKeWhatsApp();
    }
}