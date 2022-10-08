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

DB = "hoba.sqlite"
ACL_CREATE_ACCOUNT_REQUIRED = True
try:
  from hoba_config import *
except ModuleNotFoundError:
  pass

C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))

def confirm_bind_output():
  print("""Location: /login.html\n""")
  return
  print("""Content-Type: text/html

<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="login.css">
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

def create_user(conn, pubkey):
  cursor = conn.cursor()
  public_id = None
  while public_id is None:
    public_id = random.randint(0, 100000)
    row = hoba.select(cursor, "SELECT rowid FROM users WHERE public_id = ?", (public_id,))
    if row is not None:
      public_id = None
  cursor.execute("INSERT INTO users (public_id, data) VALUES (?, ?)", (public_id, "null"))
  userid = cursor.lastrowid
  if public_id is not None:
    save_pubkey(conn, userid, pubkey)
  return public_id

def make_share_code(user, conn):
  cursor = conn.cursor()
  share_code = random.randint(1e5, 1e6)
  share_code_created = datetime.now()
  if not hoba.select(cursor, "SELECT rowid FROM users WHERE rowid = ?", (user,)):
    return None
#  cursor.execute("UPDATE users SET share_code = ?, share_code_created = ? WHERE rowid = ?",
#                 (share_code, share_code_created, user))
  cursor.execute("INSERT INTO share_codes (userid, share_code, share_code_creaed) VALUES (?, ?, ?)",
                 (user, share_code, share_code_created))
  conn.commit()
  return share_code
  

def api(params):
  conn = hoba.connect(DB)
  cursor = conn.cursor()
  
  a = params.getfirst("action")
  public_id = params.getfirst("user")
  if a == "create":
    if ACL_CREATE_ACCOUNT_REQUIRED:
      hoba.output({"error": "Not authorized to create accounts"}, 403)
      return
    public_id = create_user(conn, params.getfirst("pubkey"))
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
    user = hoba.get_user(DB, C[hoba.COOKIE_USER].value, C[hoba.COOKIE_TOKEN].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value, "token": C[hoba.COOKIE_TOKEN].value}, 403)
      return
    secret = generate_secret()
    expiry = datetime.now() + timedelta(days=1)
    cursor.execute("UPDATE users SET new_browser_secret = ?, new_browser_secret_expiry = ?, old_browser_identifier = ? WHERE rowid = ?",
                   (secret, expiry, params.getfirst("origin_identifier"), user["rowid"]))
    conn.commit()
    share_code = make_share_code(user["rowid"], conn)
    hoba.output({"secret": secret, "share_code": share_code})
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

  elif a == "refresh_share_code":
    user = hoba.get_user(DB, C[hoba.COOKIE_USER].value, C[hoba.COOKIE_TOKEN].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value, "token": C[hoba.COOKIE_TOKEN].value}, 403)
      return
    share_code = make_share_code(user["rowid"], conn)
    out_obj = {"share_code": share_code}
#    if share_code is None:
#      out_obj["done"] = True
    hoba.output(out_obj)
  elif a == "clear_share_code":
    user = hoba.get_user(DB, C[hoba.COOKIE_USER].value, C[hoba.COOKIE_TOKEN].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value, "token": C[hoba.COOKIE_TOKEN].value}, 403)
      return
    cursor.execute("DELETE FROM share_codes WHERE userid = ?", (user["rowid"],))
    conn.commit()
    hoba.output({"status": "success"})
  elif a == "share_code_to_secret":
    share_code = params.getfirst("share_code")
    user = hoba.select(cursor, "SELECT rowid, public_id, new_browser_secret FROM users WHERE share_code = ? AND share_code_created > ? AND share_code IS NOT NULL AND new_browser_secret IS NOT NULL",
                       (share_code, datetime.now() - timedelta(seconds=30)))
    if user:
      cursor.execute("UPDATE users SET share_code = NULL WHERE rowid = ?", (user["rowid"],))
      hoba.output({"user": user["public_id"],
                   "secret": user["new_browser_secret"]})
    else:
      hoba.output({"error": "Code did not match."})
  elif a == "share_code_request":
    share_code = params.getfirst("share_code")
    user = hoba.select(cursor, "SELECT rowid, public_id, new_browser_secret FROM users WHERE share_code = ? AND share_code_created > ? AND share_code IS NOT NULL AND new_browser_secret IS NOT NULL",
                       (share_code, datetime.now() - timedelta(seconds=30)))
    if not user:
      hoba.output({"error": "Code did not match."})
      return
    
    cursor.execute("UPDATE share_codes SET share_code = NULL WHERE rowid = ?", (user["rowid"],))
    hoba.output({"user": user["public_id"],
                 "secret": user["new_browser_secret"]})


  elif a == "new_empty_account":
    old_user = hoba.get_user(DB, C[hoba.COOKIE_USER].value, C[hoba.COOKIE_TOKEN].value)
    if not old_user:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value, "token": C[hoba.COOKIE_TOKEN].value}, 403)
      return

    if ACL_CREATE_ACCOUNT_REQUIRED and not old_user["acl_create_account"]:
      hoba.output({"error": "Not authorized to create accounts", "user": C[hoba.COOKIE_USER].value}, 403)
      return
    
    public_id = create_user(conn, None)
    secret = generate_secret()
    expiry = datetime.now() + timedelta(days=1)
    cursor.execute("UPDATE users SET new_browser_secret = ?, new_browser_secret_expiry = ?, old_browser_identifier = ? WHERE public_id = ?",
                   (secret, expiry, params.getfirst("origin_identifier"), public_id))
    user_data = params.getfirst("data")
    if user_data:
      cursor.execute("UPDATE users SET data = ? WHERE public_id = ?", (user_data, public_id))
    conn.commit()
    hoba.output({"user": public_id, "secret": secret})

  elif a == "retrieve":
    if hoba.COOKIE_TOKEN not in C:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value}, 403)
      return
    user = hoba.get_user(DB, C[hoba.COOKIE_USER].value, C[hoba.COOKIE_TOKEN].value)
    if not user:
      hoba.output({"error": "Not logged in", "user": C[hoba.COOKIE_USER].value, "token": C[hoba.COOKIE_TOKEN].value}, 403)
      return
    if user["data"] == "null":
      hoba.output({"empty": True})
    else:
      data = json.loads(user["data"])
      data["_user"] = user["public_id"]
      data["_acl_create_account"] = not ACL_CREATE_ACCOUNT_REQUIRED or user.get("acl_create_account", False)
      hoba.output(data, 200)

  elif a == "acls":
    hoba.output({"create_account": not ACL_CREATE_ACCOUNT_REQUIRED})
      
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
