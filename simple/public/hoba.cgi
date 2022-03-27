#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from datetime import datetime, timedelta
import hashlib
from http import cookies
import json
import os
import random
import sys
import traceback

import hoba

DB = "/var/local/eric/hoba.sqlite"

C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))

def confirm_bind_output():
  print("""Content-Type: text/html

<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="style.css">
<script src="hoba.js"></script>
<meta name="hoba:api" content="hoba.cgi">
<meta name="hoba:unique_ui" content="true">
</head>
<body>
Presenting login options...
</body>
</html>
""")


def generate_secret():
  buf = []
  for _ in range(16):
    buf.append(chr(random.randint(0, 128)))
  return hashlib.sha256(bytes(datetime.isoformat(datetime.now()) + "".join(buf), "utf8")).hexdigest()

def save_pubkey(conn, userid, pubkey):
  cursor = conn.cursor()
  cursor.execute("INSERT INTO keys (userid, pubkey) VALUES (?, ?)", (userid, pubkey))
  conn.commit()
  
def api(params):
  conn = hoba.connect(DB)
  cursor = conn.cursor()
  
  a = params.getfirst("action")
  public_id = params.getfirst("user")
  if a == "create":
    public_id = None
    while public_id is None:
      public_id = random.randint(0, 100000)
      row = hoba.select(cursor, "SELECT rowid FROM users WHERE public_id = ?", (public_id,))
      if row is not None:
        public_id = None
    cursor.execute("INSERT INTO users (public_id, data) VALUES (?, ?)", (public_id, "null"))
    userid = cursor.lastrowid
    save_pubkey(conn, userid, params.getfirst("pubkey"))
    hoba.output({"id": public_id})
  elif a == "challenge":
    challenge = generate_secret()
    cursor.execute("UPDATE keys SET challenge = ? WHERE pubkey = ?", (challenge, params.getfirst("pubkey")))
    conn.commit()
    hoba.output({"challenge": challenge})
  elif a == "token":
    challenge_key = hoba.select(cursor, "SELECT rowid, pubkey, challenge FROM keys WHERE pubkey = ?", (params.getfirst("pubkey"),))
    if not challenge_key:
      hoba.output({"error": "No user found for ID {}".format(public_id)}, 404)
      return
    key_row = challenge_key["rowid"]
    h = SHA256.new(challenge_key["challenge"].encode("utf8"))
    public_key = RSA.import_key(challenge_key["pubkey"])
    signature = bytes.fromhex(params.getfirst("signature"))
    try:
      pkcs1_15.new(public_key).verify(h, signature)
    except ValueError as e:
      hoba.output({"error": str(e)})
      return
    token = generate_secret()
    cursor.execute("UPDATE keys SET challenge = NULL, token = ? WHERE rowid = ?", (token, key_row))
    conn.commit()
    hoba.output({"token": token})

  elif a == "browser_secret":
    user = hoba.get_user(DB, C["user"].value, C["token"].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C["user"].value, "token": C["token"].value}, 403)
      return
    secret = generate_secret()
    expiry = datetime.now() + timedelta(days=1)
    cursor.execute("UPDATE users SET new_browser_secret = ?, new_browser_secret_expiry = ?, old_browser_identifier = ? WHERE rowid = ?",
                   (secret, expiry, params.getfirst("origin_identifier"), user["rowid"]))
    conn.commit()
    hoba.output({"secret": secret});
  elif a == "confirm_bind":
    public_id = params.getfirst("user")
    user = hoba.select(cursor, "SELECT new_browser_secret FROM users WHERE public_id = ?", (public_id,))
    if not user:
      hoba.output({"error": "User not found", "user": public_id}, 404)
      return
    if user["new_browser_secret"] != params.getfirst("secret"):
      hoba.output({"error": "Incorrect browser secret.", "user": public_id, "secret": params.getfirst("secret")}, 403)
      return
    confirm_bind_output()
  elif a == "bind":
    public_id = params.getfirst("user")
    user = hoba.select(cursor, "SELECT rowid, new_browser_secret FROM users WHERE public_id = ?", (public_id,))
    if not user:
      hoba.output({"error": "User not found", "user": public_id}, 404)
      return
    if user["new_browser_secret"] != params.getfirst("secret"):
      hoba.output({"error": "Incorrect browser secret.", "user": public_id, "secret": params.getfirst("secret")}, 403)
      return
    save_pubkey(conn, user["rowid"], params.getfirst("pubkey"))
    cursor.execute("UPDATE users SET new_browser_secret = NULL WHERE rowid = ?", (user["rowid"],))
    conn.commit()
    hoba.output({"id": public_id})
    
  elif a == "retrieve":
    if "token" not in C:
      hoba.output({"error": "Not logged in", "user": C["user"].value}, 403)
      return
    user = hoba.get_user(DB, C["user"].value, C["token"].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C["user"].value, "token": C["token"].value}, 403)
      return
    if user["data"] == "null":
      hoba.output({"empty": True})
    else:
      hoba.output(user["data"], 200, True)

def main():
  params = cgi.FieldStorage()
  try:
    api(params)
  except Exception:
    d = {}
    for key in params.keys():
      d[key] = params.getlist(key)
    d["traceback"] = traceback.format_exc()
    hoba.output(d, status=500)


if __name__ == "__main__":
  main()
