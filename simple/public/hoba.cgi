#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from datetime import datetime
import hashlib
from http import cookies
import json
import os
import random
import sys
import traceback

import hoba
import values

def generate_secret():
  buf = []
  for _ in range(16):
    buf.append(chr(random.randint(0, 128)))
  return hashlib.sha256(bytes(datetime.isoformat(datetime.now()) + "".join(buf), "utf8")).hexdigest()

def api(params):
  conn = hoba.connect(values.DB)
  cursor = conn.cursor()
  
  a = params.getfirst("action")
  userrow = params.getfirst("user")
  if a == "create":
    cursor.execute("INSERT INTO users (data) VALUES (\"null\")")
    userid = cursor.lastrowid
    cursor.execute("INSERT INTO keys (userid, pubkey) VALUES (?, ?)", (userid, params.getfirst("pubkey"),))
    conn.commit()
    hoba.output({"id": userid})
  elif a == "challenge":
    challenge = generate_secret()
    cursor.execute("UPDATE keys SET challenge = ? WHERE pubkey = ?", (challenge, params.getfirst("pubkey")))
    conn.commit()
    hoba.output({"challenge": challenge})
  elif a == "token":
    challenge_key = hoba.select(cursor, "SELECT rowid, pubkey, challenge FROM keys WHERE userid = ?", userrow)
    if not challenge_key:
      hoba.output({"error": "No user found for ID {}".format(userrow)}, 404)
      return
    key_row = challenge_key["rowid"]
    h = SHA256.new(challenge_key["challenge"].encode("utf8"))
    public_key = RSA.import_key(challenge_key["pubkey"])
    signature = bytes.fromhex(params.getfirst("signature"))
    try:
      pkcs1_15.new(public_key).verify(h, signature)
    except ValueError as e:
      hoba.output({"error": "Challenge signing failed.",
              "ValueError": str(e)})
      return
    token = generate_secret()
    cursor.execute("UPDATE keys SET challenge = NULL, token = ? WHERE rowid = ?", (token, key_row))
    conn.commit()
    hoba.output({"token": token})

  elif a == "retrieve":
    C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
    if "token" in C:
      user = hoba.get_user(values.DB, C["user"].value, C["token"].value)
      if user:
        hoba.output(user["data"], 200, True)
        return
      else:
        hoba.output({"unauthorized": "Not logged in", "user": C["user"].value, "token": C["token"].value}, 403)
    else:
      hoba.output({"unauthorized": "Not logged in", "user": C["user"].value}, 403)

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
