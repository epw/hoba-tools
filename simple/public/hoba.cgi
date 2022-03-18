#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import base64
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from http import cookies
import json
import os
import sys
import traceback
import uuid

import hoba
import values

def output(data, status=200):
  if status != 200:
    print("Status:", status)
  print("Content-Type: application/json")
  print()
  json.dump(data, sys.stdout)

def api(params):
  conn = hoba.connect(values.DB)
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
    user = hoba.select(cursor, "SELECT pubkey, challenge FROM users WHERE rowid = ?", (userrow))
    if not user:
      output({"error": "No user found for ID {}".format(userrow)}, 404)
      return
    h = SHA256.new(user["challenge"].encode("utf8"))
    public_key = RSA.import_key(user["pubkey"])
    signature = bytes.fromhex(params.getfirst("signature"))
    try:
      pkcs1_15.new(public_key).verify(h, signature)
    except ValueError as e:
      output({"error": "Challenge signing failed.",
              "ValueError": str(e)})
      return
    token = str(uuid.uuid4())
    cursor.execute("UPDATE users SET challenge = NULL, token = ? WHERE rowid = ?", (token, userrow))
    conn.commit()
    output({"token": token})

  elif a == "retrieve":
    C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
    if "token" in C:
      user = hoba.get_user(values.DB, C["user"].value, C["token"].value)
      if user:
        output(dict(user))
        return
      else:
        output({"unauthorized": "Not logged in", "user": C["user"].value, "token": C["token"].value}, 403)
    else:
      output({"unauthorized": "Not logged in", "user": C["user"].value}, 403)

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
