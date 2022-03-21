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

def api(params):
  C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
  user = None
  public_id = C["user"].value
  if "token" in C:
    user = hoba.get_user(values.DB, public_id, C["token"].value)
  if not user:
    hoba.output({"error": "Not logged in"}, 403)
    return

  conn = hoba.connect(values.DB)
  cursor = conn.cursor()

  name = params.getfirst("name")
  if name:
    data = json.loads(hoba.select(cursor, "SELECT data FROM users WHERE public_id = ?", (public_id,))["data"])
    if data is None:
      data = {}
    data["name"] = name
    cursor.execute("UPDATE users SET data = ? WHERE public_id = ?", (json.dumps(data), public_id))
    conn.commit()
  hoba.output(hoba.select(cursor, "SELECT data FROM users WHERE public_id = ?", (public_id,))["data"], 200, True)
    

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
