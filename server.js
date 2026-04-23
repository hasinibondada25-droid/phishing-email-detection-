const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const FLASK_API = 'http://127.0.0.1:5000';

app.post('/api/analyze', async (req, res) => {
    try {
        const response = await fetch(`${FLASK_API}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to connect to ML service', details: error.message });
    }
});

app.post('/api/batch', async (req, res) => {
    try {
        const response = await fetch(`${FLASK_API}/api/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to connect to ML service', details: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const response = await fetch(`${FLASK_API}/api/stats`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to connect to ML service', details: error.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const response = await fetch(`${FLASK_API}/api/health`);
        const flaskHealth = await response.json();
        res.json({ 
            status: 'online', 
            flask: flaskHealth 
        });
    } catch (error) {
        res.json({ 
            status: 'partial', 
            flask: { status: 'offline', error: error.message }
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

const server = http.createServer(app);

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Flask API proxy: ${FLASK_API}`);
});