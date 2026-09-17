#!/usr/bin/env python3
"""Pre-commit guard. Exit 1 if anything looks like a secret or a private identifier.
Usage: python3 tools/scan_secrets.py [path ...]   (default: repo root)
Install as hook:  ln -s ../../tools/scan_secrets.py .git/hooks/pre-commit
"""
import os, re, sys, pathlib

RULES = {
    "make webhook": r"hook\.[a-z0-9]+\.make\.com/[A-Za-z0-9]{10,}",
    "google sheet id": r"(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{40,44}(?![A-Za-z0-9_-])",
    "api key": r"\b(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|apify_api_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,})",
    "bearer/token": r"(?i)(bearer|authorization:?)\s+[A-Za-z0-9._-]{20,}",
    "telegram bot token": r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b",
    "telegram chat id": r"\"chatId\"\s*:\s*\"?-?\d{6,}",
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}",
    "phone": r"\+49\s?\d{2,4}[\s\d]{6,}",
    # add private names to block via env: SCAN_BLOCKLIST="name1|name2"
}
if os.environ.get("SCAN_BLOCKLIST"):
    RULES["blocklisted name"] = r"(?i)\b(" + os.environ["SCAN_BLOCKLIST"] + r")\b"
SKIP = {".git", "node_modules", "__pycache__"}
ALLOW_FILES = {"scan_secrets.py"}


def main():
    roots = [pathlib.Path(p) for p in sys.argv[1:]] or [pathlib.Path(__file__).resolve().parent.parent]
    hits = 0
    for root in roots:
        files = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file() and not SKIP & set(p.parts)]
        for f in files:
            if f.name in ALLOW_FILES or f.suffix.lower() in {".png", ".jpg", ".pdf", ".zip"}:
                continue
            try:
                text = f.read_text(errors="ignore")
            except Exception:
                continue
            for n, line in enumerate(text.splitlines(), 1):
                for label, rx in RULES.items():
                    if re.search(rx, line):
                        hits += 1
                        print(f"{f}:{n}: {label}: {line.strip()[:120]}")
    if hits:
        print(f"\n{hits} potential leak(s). Fix or redact before committing.")
        sys.exit(1)
    print("scan_secrets: clean")


if __name__ == "__main__":
    main()
