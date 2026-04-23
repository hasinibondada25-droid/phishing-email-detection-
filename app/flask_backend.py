from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import re
import os

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def home():
    return send_from_directory('public', 'index.html')

@app.route('/api/health')
def health():
    return jsonify({'status': 'healthy'})

def extract_features(subject, body, url, has_attachment=0):
    keywords = ['urgent', 'verify', 'account', 'suspended', 'confirm', 'password', 'banking', 'login', 'security', 'update', 'click here']
    text = f"{subject} {body}".lower()
    return {
        'suspicious_keywords': any(kw in text for kw in keywords),
        'url_length': len(url) > 50 if url else False,
        'has_ip_in_url': bool(re.search(r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url or '')),
        'num_links': (body or '').count('http'),
        'has_attachment': bool(has_attachment)
    }

def predict_phishing(subject, body, url, has_attachment=0):
    f = extract_features(subject, body, url, has_attachment)
    score = sum([
        30 if f['suspicious_keywords'] else 0,
        20 if f['url_length'] else 0,
        25 if f['has_ip_in_url'] else 0,
        15 if f['num_links'] > 2 else 0,
        10 if f['has_attachment'] else 0
    ])
    phishing = min(score, 100)
    safe = 100 - phishing
    return {
        'prediction': 'Phishing' if phishing >= 50 else 'Safe',
        'confidence': phishing if phishing >= 50 else safe,
        'safe_probability': safe,
        'phishing_probability': phishing,
        'features': f
    }

@app.route('/api/analyze', methods=['POST'])
def analyze():
    d = request.get_json()
    result = predict_phishing(
        d.get('subject', ''),
        d.get('body', ''),
        d.get('url', ''),
        d.get('has_attachment', 0)
    )
    return jsonify(result)

@app.route('/api/batch', methods=['POST'])
def batch():
    d = request.get_json()
    emails = d.get('emails', [])
    results = []
    for email in emails:
        result = predict_phishing(
            email.get('subject', ''),
            email.get('body', ''),
            email.get('url', ''),
            email.get('has_attachment', 0)
        )
        results.append({
            'email_id': email.get('id', 0),
            'subject': email.get('subject', ''),
            'prediction': result['prediction'],
            'confidence': result['confidence']
        })
    
    safe_count = sum(1 for r in results if r['prediction'] == 'Safe')
    phishing_count = len(results) - safe_count
    
    return jsonify({
        'results': results,
        'stats': {
            'total': len(results),
            'safe': safe_count,
            'phishing': phishing_count
        }
    })

@app.route('/api/stats')
def stats():
    return jsonify({
        'total_emails': 8,
        'safe_count': 4,
        'phishing_count': 4,
        'safe_percentage': 50.0,
        'phishing_percentage': 50.0
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)