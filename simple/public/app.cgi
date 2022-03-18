#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

from http import cookies
import json
import os
import sys
import traceback

import hoba
import values

def output(data, status=200):
  if status != 200:
    print("Status:", status)
  print("Content-Type: application/json")
  print()
  json.dump(data, sys.stdout)

def api(params):
  C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
  user = None
  userid = C["user"].value
  if "token" in C:
    user = hoba.get_user(values.DB, userid, C["token"].value)
  if not user:
    output({"error": "Not logged in"}, 403)
    return

  conn = hoba.connect(values.DB)
  cursor = conn.cursor()

  name = params.getfirst("name")
  if name:
    cursor.execute("UPDATE users SET username = ? WHERE rowid = ?", (name, userid))
    conn.commit()
  output({"name": hoba.select(cursor, "SELECT username FROM users WHERE rowid = ?", (userid,))["username"]})
    

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
