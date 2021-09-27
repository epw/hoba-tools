#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
import json
import sqlite3
import sys
import traceback
import uuid

AUTH_DB = "/var/local/eric/auth-form.sqlite"

def api(action, pubkey=None, signature=None):
  print("Content-Type: application/json\n")

  conn = sqlite3.connect(AUTH_DB)
  conn.row_factory = sqlite3.Row
  cursor = conn.cursor()

  if action == "create":
    # Really just want an account record to exist, no values, but you can't insert ()
    cursor.execute("INSERT INTO accounts (name) VALUES (NULL)");
    cursor.execute("INSERT INTO pubkeys (keydata, account_id) VALUES (?, ?)", (pubkey, cursor.lastrowid))
    json.dump(True, sys.stdout)
  elif action == "challenge":
    challenge = str(uuid.uuid4())
    cursor.execute("UPDATE pubkeys SET challenge = ? WHERE keydata = ?", (challenge, pubkey))
    json.dump({"value": str(challenge)}, sys.stdout)
  elif action == "token":
    cursor.execute("SELECT challenge FROM pubkeys WHERE keydata = ?", (pubkey,))
    challenge = cursor.fetchone()[0]
    h = SHA256.new(challenge.encode("utf8"))
    public_key = RSA.import_key(pubkey)

    signature = bytes.fromhex(signature)
    
    try:
      pkcs1_15.new(public_key).verify(h, signature)
      token = str(uuid.uuid4())
      cursor.execute("UPDATE pubkeys SET challenge = NULL, token = ? WHERE keydata = ?", (token, pubkey))
      json.dump({"token": token}, sys.stdout)
    except (ValueError, TypeError) as e:
      tb = traceback.format_exc()
      json.dump({"error": True, "traceback": tb, "signature": str(signature), "challenge": challenge}, sys.stdout)
  else:
    json.dump({"error": "No action given"}, sys.stdout)
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
