// =========================================================
// POWER AUTOMATE CONFIG - replace with your flow's HTTP POST URL
// See the SETUP INSTRUCTIONS comment block in index.html for how
// to create this flow in Power Automate.
// =========================================================
const POWER_AUTOMATE_URL = "https://default53d82571da1947e49cb4625a166a4a.2a.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/09/workflows/23e8bb0f89fe47b9962624afbac843b4/triggers/manual/paths/invoke?api-version=1";

// ---------- Translations ----------
const translations = {
    en: {
        title: "PZ3 General Affairs Feedback/Complaint",
        subtitle: "Housekeeping Complaint Form",
        location: 'Location / Area <span class="required">*</span>',
        category: 'Complaint Category <span class="required">*</span>',
        cat_select: "-- Select Category --",
        cat_1: "Cleanliness Issues",
        cat_2: "Toilet & Washroom Complaints",
        cat_3: "Waste Management",
        cat_4: "Pantry & Cafeteria Areas",
        cat_5: "Pest Control",
        cat_6: "Safety Housekeeping",
        cat_7: "Contractor Performance",
        cat_8: "Environmental Issues",
        cat_9: "Office Area Complaints",
        cat_10: "Landscape & External Areas",
        description: 'Complaint Description <span class="required">*</span>',
        photo: 'Photo Evidence <span class="required">*</span>',
        submit: "Submit Complaint",
        submit_success: "✓ Submission Success",
        sending: "Sending...",
        success: "Complaint submitted and emailed successfully!",
        error: "Something went wrong sending the email. Please try again.",
        photo_required_alert: "Photo evidence is mandatory."
    },
    ms: {
        title: "PZ3 Maklum Balas/Aduan Hal Ehwal Am",
        subtitle: "Borang Aduan Pembersihan",
        location: 'Lokasi / Kawasan <span class="required">*</span>',
        category: 'Kategori Aduan <span class="required">*</span>',
        cat_select: "-- Pilih Kategori --",
        cat_1: "Isu Kebersihan",
        cat_2: "Aduan Tandas & Bilik Air",
        cat_3: "Pengurusan Sisa",
        cat_4: "Kawasan Pantri & Kafeteria",
        cat_5: "Kawalan Perosak",
        cat_6: "Keselamatan Pembersihan",
        cat_7: "Prestasi Kontraktor",
        cat_8: "Isu Alam Sekitar",
        cat_9: "Aduan Kawasan Pejabat",
        cat_10: "Landskap & Kawasan Luar",
        description: 'Butiran Aduan <span class="required">*</span>',
        photo: 'Bukti Foto <span class="required">*</span>',
        submit: "Hantar Aduan",
        submit_success: "✓ Berjaya Dihantar",
        sending: "Menghantar...",
        success: "Aduan berjaya dihantar melalui e-mel!",
        error: "Masalah berlaku semasa menghantar e-mel. Sila cuba lagi.",
        photo_required_alert: "Bukti foto adalah wajib."
    }
};

let currentLang = 'en';

// ---------- Browser notification on successful submission ----------
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    // Ask once, quietly, so a real OS-level notification can pop up later
    // to confirm the complaint went through - useful if the person
    // switches tabs/apps while it's sending.
    Notification.requestPermission();
}

function notifyUser(message) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
        try {
            new Notification('PZ3 General Affairs', { body: message });
        } catch (e) {
            // Some browsers restrict Notification from non-HTTPS/file
            // contexts - fail silently since the on-page message still shows.
        }
    }
}

function setLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;

    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    document.getElementById('btn-ms').classList.toggle('active', lang === 'ms');

    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        const key = el.getAttribute('data-i18n');
        const text = translations[lang][key];
        if (text !== undefined) {
            el.innerHTML = text;
        }
    });

    document.title = translations[lang].title;
}

// ---------- Image Preview + adaptive compression for email payload ----------
let compressedPhotoDataUrl = "";
const TARGET_MAX_BYTES = 250 * 1024; // aim to keep photo payload under ~250KB

function estimateBase64Bytes(dataUrl) {
    const base64 = dataUrl.split(',')[1] || '';
    return Math.floor(base64.length * 0.75);
}

function compressImage(img, maxDim, quality) {
    let w = img.width, h = img.height;
    if (w > h && w > maxDim) { h *= maxDim / w; w = maxDim; }
    else if (h > maxDim) { w *= maxDim / h; h = maxDim; }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
}

function adaptiveCompress(img) {
    // Start reasonably large/high-quality, then step down dimensions and
    // quality together until the payload fits the target size or we hit
    // the smallest acceptable settings.
    const steps = [
        { maxDim: 1000, quality: 0.7 },
        { maxDim: 800,  quality: 0.6 },
        { maxDim: 600,  quality: 0.5 },
        { maxDim: 500,  quality: 0.4 },
        { maxDim: 400,  quality: 0.3 },
        { maxDim: 320,  quality: 0.25 }
    ];

    let result = compressImage(img, steps[0].maxDim, steps[0].quality);
    for (let i = 0; i < steps.length; i++) {
        result = compressImage(img, steps[i].maxDim, steps[i].quality);
        if (estimateBase64Bytes(result) <= TARGET_MAX_BYTES) break;
    }
    return result;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(0) + ' KB';
}

document.getElementById('photo').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const originalSize = file.size;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        preview.src = e.target.result;
        preview.style.display = 'block';

        const img = new Image();
        img.onload = function() {
            compressedPhotoDataUrl = adaptiveCompress(img);
            const compressedSize = estimateBase64Bytes(compressedPhotoDataUrl);

            const sizeInfo = document.getElementById('photoSizeInfo');
            if (sizeInfo) {
                sizeInfo.textContent =
                    formatBytes(originalSize) + ' -> ' + formatBytes(compressedSize);
                sizeInfo.style.display = 'block';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

// ---------- Form Submission (auto email via Power Automate) ----------
document.getElementById('complaintForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const photoFiles = document.getElementById('photo').files.length;
    if (photoFiles === 0) {
        alert(translations[currentLang].photo_required_alert);
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    const statusMsg = document.getElementById('statusMsg');

    submitBtn.disabled = true;
    statusMsg.className = 'status-msg sending';
    statusMsg.style.display = 'block';
    statusMsg.textContent = translations[currentLang].sending;

    const payload = {
        location: document.getElementById('location').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        photo: compressedPhotoDataUrl
    };

    fetch(POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function(response) {
            if (!response.ok) throw new Error('Flow returned status ' + response.status);
            return response.text().then(function(text) {
                // The flow's "Response" step should return {"status":"success"}
                // once the email step has actually completed. If the flow has
                // no Response step, text will be empty - treat that as success
                // too (HTTP 2xx alone), but a real body confirms the email sent.
                if (text) {
                    try {
                        const data = JSON.parse(text);
                        if (data.status && data.status !== 'success') {
                            throw new Error('Flow reported status: ' + data.status);
                        }
                    } catch (parseErr) {
                        // Non-JSON body from a flow without a proper Response
                        // step - fall back to trusting the HTTP status alone.
                    }
                }
            });
        })
        .then(function() {
            statusMsg.className = 'status-msg success';
            statusMsg.textContent = translations[currentLang].success;

            submitBtn.textContent = translations[currentLang].submit_success;
            submitBtn.classList.add('success');

            notifyUser(translations[currentLang].success);

            document.getElementById('complaintForm').reset();
            document.getElementById('imagePreview').style.display = 'none';
            const sizeInfo = document.getElementById('photoSizeInfo');
            if (sizeInfo) sizeInfo.style.display = 'none';
            compressedPhotoDataUrl = "";

            setTimeout(function() {
                submitBtn.textContent = translations[currentLang].submit;
                submitBtn.classList.remove('success');
            }, 3000);
        })
        .catch(function(err) {
            statusMsg.className = 'status-msg error';
            statusMsg.textContent = translations[currentLang].error;
            console.error('Power Automate error:', err);
        })
        .finally(function() {
            submitBtn.disabled = false;
        });
});
