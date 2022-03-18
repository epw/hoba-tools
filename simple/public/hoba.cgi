#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
import json
import sys
import traceback
import uuid

import db

def output(data, status=200):
  if status != 200:
    print("Status:", status)
  print("Content-Type: application/json")
  print()
  json.dump(data, sys.stdout)

def api(params):
  conn = db.connect()
  cursor = conn.cursor()
  
  a = params.getfirst("action")
  userrow = params.getfirst("user")
  if a == "create":
    cursor.execute("INSERT INTO users (pubkey) VALUES (?)", (params.getfirst("pubkey"),))
    conn.commit()
    output({"id": cursor.lastrowid})
  elif a == "challenge":
    challenge = str(uuid.uuid4())
    cursor.execute("UPDATE users SET challenge = ? WHERE rowid = ?", (challenge, userrow))
    conn.commit()
    output({"challenge": challenge})
  elif a == "token":
    user = db.select_one(cursor, "SELECT pubkey, challenge FROM users WHERE rowid = ?", (userrow))
    h = SHA256.new(user["challenge"].encode("utf8"))
    public_key = RSA.import_key(user["pubkey"])
    signature = bytes.fromhex(params.getfirst("signature"))
    pkcs1_15.new(public_key).verify(h, signature)
    token = str(uuid.uuid4())
    cursor.execute("UPDATE users SET challenge = NULL, token = ? WHERE rowid = ?", (token, userrow))
    conn.commit()
    output({"token": token})

  
def main():
  params = cgi.FieldStorage()
  try:
    api(params)
  except Exception:
    d = {}
    for key in params.keys():
      d[key] = params.getlist(key)
    d["traceback"] = traceback.format_exc()
    output(d, status=500)


if __name__ == "__main__":
  main()
