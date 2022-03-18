#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

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
  if a == "create":
    cursor.execute("INSERT INTO users (pubkey) VALUES (?)", (params.getfirst("pubkey"),))
    conn.commit()
    output({"id": cursor.lastrowid})
  if a == "challenge":
    challenge = str(uuid.uuid4())
    cursor.execute("UPDATE users SET token = ? WHERE rowid = ?", (challenge, params.getfirst("user")))
    conn.commit()
    output({"challenge": challenge})
  
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
