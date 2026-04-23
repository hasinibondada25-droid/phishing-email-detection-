const API_BASE = '';

const SUSPICIOUS_KEYWORDS = ['urgent', 'verify', 'account', 'suspended', 'confirm', 'password', 'banking', 'login', 'security', 'update', 'click here'];

function extractFeatures(subject, body, url, hasAttachment = 0) {
    const text = (subject + ' ' + body).toLowerCase();
    return {
        suspicious_keywords: SUSPICIOUS_KEYWORDS.some(kw => text.includes(kw)),
        url_length: url && url.length > 50,
        has_ip_in_url: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url || ''),
        num_links: (body || '').toLowerCase().split('http').length - 1,
        has_attachment: Boolean(hasAttachment)
    };
}

function predictPhishing(subject, body, url, hasAttachment = 0) {
    const f = extractFeatures(subject, body, url, hasAttachment);
    let score = 0;
    if (f.suspicious_keywords) score += 30;
    if (f.url_length) score += 20;
    if (f.has_ip_in_url) score += 25;
    if (f.num_links > 2) score += 15;
    if (f.has_attachment) score += 10;
    
    const phishing = Math.min(score, 100);
    const safe = 100 - phishing;
    
    return {
        prediction: phishing >= 50 ? 'Phishing' : 'Safe',
        confidence: phishing >= 50 ? phishing : safe,
        safe_probability: safe,
        phishing_probability: phishing,
        features: f
    };
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initAnalyzeForm();
    initBatchUpload();
    loadStats();
});

function initTabs() {
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.dataset.tab;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
        });
    });
}

function initAnalyzeForm() {
    const form = document.getElementById('analyze-form');
    const resultCard = document.getElementById('result-card');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const subject = document.getElementById('subject').value;
        const body = document.getElementById('body').value;
        const url = document.getElementById('url').value || '';
        const attachment = document.getElementById('attachment').checked ? 1 : 0;

        showLoading();

        try {
            const data = predictPhishing(subject, body, url, attachment);
            displayResult(data);
        } catch (error) {
            alert('Error analyzing email: ' + error.message);
        } finally {
            hideLoading();
        }
    });
}

function displayResult(data) {
    const resultCard = document.getElementById('result-card');
    const resultIcon = document.getElementById('result-icon');
    const resultLabel = document.getElementById('result-label');
    const resultDesc = document.getElementById('result-description');
    const confidenceValue = document.getElementById('confidence-value');
    const confidenceBar = document.getElementById('confidence-bar');
    const safeProb = document.getElementById('safe-prob');
    const phishProb = document.getElementById('phish-prob');
    const featuresGrid = document.getElementById('features-grid');

    const isPhishing = data.prediction === 'Phishing';

    resultCard.classList.toggle('phishing-detected', isPhishing);
    resultIcon.textContent = isPhishing ? '!' : '✓';
    resultLabel.textContent = data.prediction;
    resultDesc.textContent = isPhishing 
        ? 'This email shows phishing indicators'
        : 'This email appears to be legitimate';

    confidenceValue.textContent = `${data.confidence}%`;
    confidenceBar.style.width = `${data.confidence}%`;

    safeProb.textContent = `${data.safe_probability}%`;
    phishProb.textContent = `${data.phishing_probability}%`;

    featuresGrid.innerHTML = '';
    const features = data.features;
    const featureLabels = {
        suspicious_keywords: 'Suspicious Keywords',
        url_length: 'URL Length',
        has_ip_in_url: 'IP in URL',
        num_links: 'Number of Links',
        has_attachment: 'Has Attachment'
    };

    for (const [key, value] of Object.entries(features)) {
        const item = document.createElement('div');
        item.className = `feature-item ${value ? 'positive' : 'negative'}`;
        item.innerHTML = `
            <span>${featureLabels[key] || key}</span>
            <span>${value ? 'Yes' : 'No'}</span>
        `;
        featuresGrid.appendChild(item);
    }

    resultCard.classList.remove('hidden');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

let batchFile = null;

function initBatchUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const clearBtn = document.getElementById('clear-file');
    const analyzeBtn = document.getElementById('analyze-batch');

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    clearBtn.addEventListener('click', () => {
        batchFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    });

    analyzeBtn.addEventListener('click', async () => {
        if (!batchFile) {
            alert('Please select a file first');
            return;
        }

        showLoading();

        try {
            const text = await batchFile.text();
            const emails = parseCSV(text);
            
            const results = emails.map(email => {
                const result = predictPhishing(email.subject, email.body, email.url, email.has_attachment);
                return {
                    email_id: email.id,
                    subject: email.subject,
                    prediction: result.prediction,
                    confidence: result.confidence
                };
            });
            
            const safeCount = results.filter(r => r.prediction === 'Safe').length;
            const phishCount = results.length - safeCount;
            
            displayBatchResults({
                results: results,
                stats: {
                    total: results.length,
                    safe: safeCount,
                    phishing: phishCount
                }
            });
        } catch (error) {
            alert('Error processing batch: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    function handleFileSelect(file) {
        const validExts = ['.csv', '.xlsx', '.xls'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExts.includes(ext)) {
            alert('Please upload a CSV or Excel file');
            return;
        }

        batchFile = file;
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        uploadArea.classList.add('hidden');
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const emails = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 2) {
            emails.push({
                id: i,
                subject: parts[0].replace(/^"|"$/g, ''),
                body: parts[1].replace(/^"|"$/g, ''),
                url: parts[2] ? parts[2].replace(/^"|"$/g, '') : '',
                has_attachment: parts[3] ? parseInt(parts[3]) : 0
            });
        }
    }

    return emails;
}

function displayBatchResults(data) {
    const resultsCard = document.getElementById('batch-results');
    const tbody = document.getElementById('results-tbody');
    const batchTotal = document.getElementById('batch-total');
    const batchSafe = document.getElementById('batch-safe');
    const batchPhish = document.getElementById('batch-phish');

    tbody.innerHTML = '';

    data.results.forEach(row => {
        const tr = document.createElement('tr');
        const isPhishing = row.prediction === 'Phishing';
        tr.innerHTML = `
            <td>${row.email_id}</td>
            <td>${truncate(row.subject, 40)}</td>
            <td><span class="result-badge ${isPhishing ? 'phishing' : 'safe'}">${row.prediction}</span></td>
            <td>${row.confidence}%</td>
        `;
        tbody.appendChild(tr);
    });

    batchTotal.textContent = data.stats.total;
    batchSafe.textContent = data.stats.safe;
    batchPhish.textContent = data.stats.phishing;

    resultsCard.classList.remove('hidden');
    resultsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function truncate(str, len) {
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function loadStats() {
    const savedStats = localStorage.getItem('phishGuardStats');
    const data = savedStats ? JSON.parse(savedStats) : { total_emails: 0, safe_count: 0, phishing_count: 0, safe_percentage: 50, phishing_percentage: 50 };
    
    document.getElementById('stat-total').textContent = data.total_emails;
    document.getElementById('stat-safe').textContent = data.safe_count;
    document.getElementById('stat-phishing').textContent = data.phishing_count;
    document.getElementById('stat-percentage').textContent = data.phishing_percentage + '%';

    document.getElementById('safe-bar-value').textContent = data.safe_percentage + '%';
    document.getElementById('safe-bar').style.width = data.safe_percentage + '%';
    document.getElementById('phish-bar-value').textContent = data.phishing_percentage + '%';
    document.getElementById('phish-bar').style.width = data.phishing_percentage + '%';
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}