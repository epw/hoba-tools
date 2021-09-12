#! /usr/bin/env python3

print("Content-Type: text/plain\n")

import cgi, cgitb
cgitb.enable()

import sqlite3
import uuid

AUTH_DB = "/var/local/eric/auth-form.sqlite"

def api(create):
  conn = sqlite3.connect(AUTH_DB)
  conn.row_factory = sqlite3.Row
  cursor = conn.cursor()

  if create:
    u = str(uuid.uuid4())
    cursor.execute("INSERT INTO authn (username, password) VALUES (?, '$apr1$shtMLQ5W$i1kRTLjR2jNPzWQmXWfbT0')", (u,))
    conn.commit()
    print(u)

def main():
  params = cgi.FieldStorage()
  api(params.getfirst("create"))


if __name__ == "__main__":
  main()
