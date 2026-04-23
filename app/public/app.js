const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initAnalyzeForm();
    initBatchUpload();
    loadStats();
    checkHealth();
});

function checkHealth() {
    fetch(`${API_BASE}/api/health`)
        .then(res => res.json())
        .then(data => {
            console.log('System health:', data);
        })
        .catch(err => console.error('Health check failed:', err));
}

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
            const response = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, body, url, has_attachment: attachment })
            });

            const data = await response.json();
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
            const formData = new FormData();
            formData.append('file', batchFile);

            const text = await batchFile.text();
            const emails = parseCSV(text);

            const response = await fetch(`${API_BASE}/api/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails })
            });

            const data = await response.json();
            displayBatchResults(data);
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
    fetch(`${API_BASE}/api/stats`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('stat-total').textContent = data.total_emails;
            document.getElementById('stat-safe').textContent = data.safe_count;
            document.getElementById('stat-phishing').textContent = data.phishing_count;
            document.getElementById('stat-percentage').textContent = `${data.phishing_percentage}%`;

            document.getElementById('safe-bar-value').textContent = `${data.safe_percentage}%`;
            document.getElementById('safe-bar').style.width = `${data.safe_percentage}%`;
            document.getElementById('phish-bar-value').textContent = `${data.phishing_percentage}%`;
            document.getElementById('phish-bar').style.width = `${data.phishing_percentage}%`;
        })
        .catch(err => console.error('Failed to load stats:', err));
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}