# PhantomQR

A free, no-signup QR code generator built with Flask. Supports multiple QR types, live preview, and PNG/SVG download — all from a single page.

## Features

- **Seven QR types** — URL, plain text, vCard contact, email, SMS, phone number, WiFi
- **Live preview** — QR code updates as you type (debounced, 300 ms)
- **PNG & SVG download** — high-resolution PNG for screens, scalable SVG for print
- **Copy to clipboard** — one-click copy of the generated PNG (requires HTTPS)
- **No account required** — static QR codes encode data directly; nothing stored server-side
- **No watermarks** — the downloaded code is clean

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.13, Flask 3 |
| QR generation | `qrcode` + Pillow (PNG), `qrcode[svg]` (SVG) |
| Rate limiting | Flask-Limiter (in-memory; swap for Redis in production) |
| Config | `python-dotenv` |
| Frontend | Vanilla JS, custom CSS (no framework) |

## Project structure

```
qr_code_generator/
├── app.py                      # Flask application
├── requirements.txt            # Pinned Python dependencies
├── .env.example                # Environment variable template
├── static/
│   ├── css/style.css           # All styles
│   ├── js/
│   │   ├── main.js             # UI logic, QR generator, clipboard
│   │   └── theme.js            # Dark/light theme toggle
│   └── images/                 # Logo and favicon (SVG)
└── templates/
    ├── base.html               # Base layout
    ├── index.html              # Landing page (single-page app)
    ├── components/             # Jinja2 partials (navbar, footer, cards)
    └── errors/                 # Custom 400/403/404/500 pages
```

## Getting started

### Prerequisites

- Python 3.11 or newer
- `pip`

### Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd qr_code_generator

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
```

Open `.env` and set a strong secret key:

```bash
# Generate a secure key
python -c "import secrets; print(secrets.token_hex(32))"
```

Paste the output as the value of `SECRET_KEY` in `.env`.

### Running locally

```bash
flask run
# or
python app.py
```

The app will be available at `http://127.0.0.1:5000`.

## Environment variables

All configuration is loaded from `.env` at startup via `python-dotenv`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | Yes | — | Flask session signing key. Use a long random hex string. |
| `FLASK_DEBUG` | No | `false` | Set to `true` to enable debug mode. **Never use in production.** |
| `CONTACT_LOG` | No | `contact_submissions.log` | Path where contact form submissions are appended. |

## API reference

The frontend communicates with two JSON endpoints. You can call them directly too.

### `POST /api/qr`

Generate a QR code and return it as a base64 PNG data URI.

**Request body**
```json
{ "data": "https://example.com" }
```

**Success response** `200`
```json
{ "dataUri": "data:image/png;base64,iVBORw0KGgo..." }
```

**Error responses**

| Status | Condition |
|--------|-----------|
| `400` | `data` is empty or exceeds 2048 characters |
| `429` | Rate limit exceeded (60 req/min or 5 req/sec per IP) |
| `500` | Internal generation error |

---

### `POST /api/qr/svg`

Generate a QR code and return it as raw SVG text.

**Request body** — same as `/api/qr`

**Success response** `200` — `Content-Type: image/svg+xml`

```xml
<?xml version='1.0' encoding='UTF-8'?>
<svg ...>...</svg>
```

**Error responses** — same codes as `/api/qr`

## Contact form

Submissions from the contact form are appended to `contact_submissions.log` (or the path set in `CONTACT_LOG`) in the following format:

```
---
timestamp: 2026-10-06T13:00:00+00:00
name:      Jane Smith
email:     jane@example.com
subject:   Feature request
message:
Please add a geo-location QR type!
```

The log file is gitignored. Log write failures are caught silently so they never return an error to the user.

## Rate limiting

Both API endpoints are limited to **60 requests per minute** and **5 requests per second** per IP address. Exceeding the limit returns a `429` JSON response:

```json
{ "error": "Too many requests — please slow down." }
```

The default storage backend is in-process memory. For multi-worker or multi-instance deployments, set a Redis URI as the `storage_uri` in `app.py`.

## Deployment notes

- Set `FLASK_DEBUG=false` (the default) in production.
- Run behind a WSGI server such as Gunicorn: `gunicorn app:app`
- Serve over HTTPS — the copy-to-clipboard feature requires a secure context.
- For multi-worker deployments, replace the in-memory rate limiter storage with Redis.

## License

MIT
