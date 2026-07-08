const express = require('express');
const fs = require('fs');
const path = require('path');
const midtransClient = require('midtrans-client');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// FILE DATABASE JSON
const USER_FILE = path.join(__dirname, 'database.json');       // Khusus Akun User
const PRODUK_FILE = path.join(__dirname, 'db_produk.json');     // Khusus Katalog Produk
const PEMBELI_FILE = path.join(__dirname, 'db_form_pembeli.json'); // Khusus Pesanan Masuk

// Memastikan semua file json database siap
if (!fs.existsSync(USER_FILE)) fs.writeFileSync(USER_FILE, '[]', 'utf8');
if (!fs.existsSync(PRODUK_FILE)) fs.writeFileSync(PRODUK_FILE, '[]', 'utf8');
if (!fs.existsSync(PEMBELI_FILE)) fs.writeFileSync(PEMBELI_FILE, '[]', 'utf8');

function readData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) { return []; }
}

function writeData(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8'); } 
    catch (error) { console.error("Gagal menulis file:", error); }
}

// KONFIGURASI MIDTRANS
let snap = new midtransClient.Snap({
    isProduction: false, 
    serverKey: 'Mid-server-KjWhXKpwzVU2xaiDRq2twMMT' 
});

// Track klien aktif untuk Notifikasi Admin Live
let sseClients = [];

// ==========================================================================
// API AUTENTIKASI (LOGIN & REGISTER)
// ==========================================================================
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.json({ success: false, message: 'Semua form wajib diisi!' });
    }
    
    const users = readData(USER_FILE);
    if (users.find(u => u.email === email)) {
        return res.json({ success: false, message: 'Email sudah terdaftar!' });
    }
    
    const newUser = { name, email, password };
    users.push(newUser);
    writeData(USER_FILE, users);
    res.json({ success: true, message: 'Pendaftaran berhasil!' });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const users = readData(USER_FILE);
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        res.json({ success: true, user: { name: user.name, email: user.email } });
    } else {
        res.json({ success: false, message: 'Email atau password salah!' });
    }
});

// ==========================================================================
// API PRODUK (DIBACA DI DASHBOARD USER)
// ==========================================================================
app.get('/api/products', (req, res) => {
    const produk = readData(PRODUK_FILE);
    res.json({ success: true, data: produk });
});

// ==========================================================================
// API TRANSAKSI BERSAMA (CHECKOUT)
// ==========================================================================
app.post('/api/checkout', async (req, res) => {
    const { cart, total, namaPembeli, teleponPembeli } = req.body;
    if (!namaPembeli || !teleponPembeli) return res.json({ success: false, message: 'Form wajib diisi!' });

    const orderId = 'INV-' + Math.floor(Math.random() * 1000000);
    const dbPembeli = readData(PEMBELI_FILE);
    
    const dataBaru = {
        orderId: orderId,
        namaPembeli: namaPembeli,
        teleponPembeli: teleponPembeli,
        totalBelanja: total,
        itemBelanja: cart.map(item => ({ nama: item.name, qty: item.qty, subtotal: item.price * item.qty })),
        tanggalPembelian: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    };
    
    dbPembeli.push(dataBaru);
    writeData(PEMBELI_FILE, dbPembeli);

    // Kirim sinyal Live ke browser admin yang sedang terbuka
    sseClients.forEach(client => client.res.write(`data: ${JSON.stringify(dataBaru)}\n\n`));

    try {
        let parameter = {
            "transaction_details": { "order_id": orderId, "gross_amount": total },
            "credit_card": { "secure": true },
            "enabled_payments": ["qris", "gopay", "shopeepay", "bank_transfer"]
        };
        const transaction = await snap.createTransaction(parameter);
        res.json({ success: true, redirectUrl: transaction.redirect_url });
    } catch(e) {
        res.json({ success: true, message: 'Transaksi terekam (Mode Simulasi)' });
    }
});

// ==========================================================================
// API KHUSUS ADMIN (MONITORING & TAMBAH LAYANAN)
// ==========================================================================
app.get('/api/admin/pembeli', (req, res) => {
    if (req.query.email !== 'abdansyakuro1706@gmail.com') {
        return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
    }
    res.json({ success: true, data: readData(PEMBELI_FILE) });
});

app.post('/api/admin/tambah-layanan', (req, res) => {
    const { email, produkBaru } = req.body;
    if (email !== 'abdansyakuro1706@gmail.com') {
        return res.status(403).json({ success: false, message: 'Akses Ditolak!' });
    }
    
    const produk = readData(PRODUK_FILE);
    produk.push(produkBaru);
    writeData(PRODUK_FILE, produk);
    res.json({ success: true, message: 'Layanan baru berhasil diterbitkan untuk semua user!' });
});

app.get('/api/admin/updates', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const clientId = Date.now();
    sseClients.push({ id: clientId, res });
    req.on('close', () => { sseClients = sseClients.filter(c => c.id !== clientId); });
});

app.listen(PORT, '0.0.0.0', () => { console.log(`Server aktif di port ${PORT}`); });