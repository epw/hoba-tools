#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from http import cookies
import json
import sqlite3
import subprocess
import sys
import traceback
import uuid

AUTH_DB = "/var/local/eric/auth-form.sqlite"

def htpasswd(s):
  return subprocess.run(["htpasswd", "-nb", "", s], capture_output=True).stdout.decode("utf8")[1:].strip()

def create_account_from_pubkey(cursor, pubkey):
  cursor.execute("INSERT INTO accounts (name) VALUES (NULL)");
  cursor.execute("INSERT INTO pubkeys (keydata, account_id) VALUES (?, ?)", (pubkey, cursor.lastrowid))
  return True

def json_output(cookie, obj):
  cookie.output()
  print()
  json.dump(obj, sys.stdout)

def api(action, pubkey=None, signature=None):
  C = cookies.SimpleCookie()
  print("Content-Type: application/json")

  conn = sqlite3.connect(AUTH_DB)
  conn.row_factory = sqlite3.Row
  cursor = conn.cursor()

  if action == "create":
    # Really just want an account record to exist, no values, but you can't insert ()
    json_output(C, create_account_from_pubkey(cursor, pubkey))
  elif action == "challenge":
    cursor.execute("SELECT rowid FROM pubkeys WHERE keydata = ?", (pubkey,))
    row = cursor.fetchone()
    if not row:
      assert create_account_from_pubkey(cursor, pubkey)
    challenge = str(uuid.uuid4())
    cursor.execute("UPDATE pubkeys SET challenge = ? WHERE keydata = ?", (challenge, pubkey))
    json_output(C, {"value": str(challenge)})
  elif action == "token":
    cursor.execute("SELECT challenge FROM pubkeys WHERE keydata = ?", (pubkey,))
    challenge = cursor.fetchone()[0]
    h = SHA256.new(challenge.encode("utf8"))
    public_key = RSA.import_key(pubkey)
    signature = bytes.fromhex(signature)
    try:
      pkcs1_15.new(public_key).verify(h, signature)
      token = str(uuid.uuid4())
      cursor.execute("UPDATE pubkeys SET challenge = NULL, token = ? WHERE keydata = ?", (htpasswd(token), pubkey))
      C["sessiondbd"] = token
      json_output(C, {"token": token})
    except (ValueError, TypeError) as e:
      tb = traceback.format_exc()
      json_output(C, {"error": True, "traceback": tb, "signature": str(signature), "challenge": challenge, "token": str(token)})
  else:
    json_output(C, {"error": "No action given"})
  conn.commit()

def main():
  try:
    params = cgi.FieldStorage()
    api(action=params.getfirst("action"),
        pubkey=params.getfirst("pubkey"),
        signature=params.getfirst("signature"))
  except:
    print("Content-Type: text/plain")
    print("Status: 500 Internal Server Error\n")
    raise

if __name__ == "__main__":
  main()
