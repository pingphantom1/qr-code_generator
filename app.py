import os
import qrcode
import qrcode.image.svg
import io
import base64
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, Response
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ["SECRET_KEY"]

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # no global limit; apply per-route only
    storage_uri="memory://",    # in-process store; swap for Redis in production
)


# ── Error handlers ────────────────────────────────────────────────────────────
@app.errorhandler(400)
def bad_request(e):
    return render_template("errors/400.html"), 400

@app.errorhandler(403)
def forbidden(e):
    return render_template("errors/403.html"), 403

@app.errorhandler(404)
def not_found(e):
    return render_template("errors/404.html"), 404

@app.errorhandler(429)
def too_many_requests(e):
    return jsonify({"error": "Too many requests — please slow down."}), 429

@app.errorhandler(500)
def server_error(e):
    return render_template("errors/500.html"), 500


# ── Landing page ──────────────────────────────────────────────────────────────
@app.route("/")
def landing():
    return render_template("index.html")


# ── QR code generator ─────────────────────────────────────────────────────────
# The generator lives on the landing page at the #generator section.
# /generate simply redirects there.
@app.route("/generate")
def generate():
    return redirect(url_for("landing") + "#generator")


# ── QR code API ───────────────────────────────────────────────────────────────
MAX_QR_DATA_LEN = 2048  # characters; well above practical QR capacity (~4296 bytes)


def _validate_qr_data(data: str):
    """Return (data, error_response) — error_response is None when input is valid."""
    if not data:
        return None, (jsonify({"error": "No data provided"}), 400)
    if len(data) > MAX_QR_DATA_LEN:
        return None, (
            jsonify({"error": f"Data too long (max {MAX_QR_DATA_LEN} characters)"}),
            400,
        )
    return data, None


def _make_qr(data: str):
    """Return a configured QRCode object for the given data string."""
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr


@app.route("/api/qr", methods=["POST"])
@limiter.limit("60 per minute; 5 per second")
def api_qr_png():
    """Generate a QR code PNG and return it as a base64 data URI."""
    raw = (request.json or {}).get("data", "").strip()
    data, err = _validate_qr_data(raw)
    if err:
        return err

    try:
        qr  = _make_qr(data)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return jsonify({"dataUri": "data:image/png;base64," + b64})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/qr/svg", methods=["POST"])
@limiter.limit("60 per minute; 5 per second")
def api_qr_svg():
    """Generate a QR code SVG and return it as plain SVG text."""
    raw = (request.json or {}).get("data", "").strip()
    data, err = _validate_qr_data(raw)
    if err:
        return err

    try:
        qr  = _make_qr(data)
        img = qr.make_image(image_factory=qrcode.image.svg.SvgPathImage)
        buf = io.BytesIO()
        img.save(buf)
        svg_text = buf.getvalue().decode("utf-8")
        return Response(svg_text, mimetype="image/svg+xml")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Contact form handler ──────────────────────────────────────────────────────
@app.route("/contact", methods=["POST"])
def contact():
    name    = request.form.get("name", "").strip()
    email   = request.form.get("email", "").strip()
    subject = request.form.get("subject", "").strip()
    message = request.form.get("message", "").strip()

    if not name or not email or not message:
        flash("Please fill in all required fields.", "error")
        return redirect(url_for("landing") + "#contact")

    # TODO: send email or store submission
    flash("Thanks for your message! We will get back to you soon.", "success")
    return redirect(url_for("landing") + "#contact")


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "false").strip().lower() == "true"
    app.run(debug=debug)
