#! /usr/bin/env python3

print("Content-Type: text/plain")

import cgi, cgitb
cgitb.enable()

import sqlite3
import uuid

AUTH_DB = "/var/local/eric/auth-form.sqlite"

def api(create, pubkey):
  conn = sqlite3.connect(AUTH_DB)
  conn.row_factory = sqlite3.Row
  cursor = conn.cursor()

  if create:
    # Really just want an account record to exist, no values, but you can't insert ()
    cursor.execute("INSERT INTO accounts (name) VALUES (NULL)");
    cursor.execute("INSERT INTO pubkeys (keydata, account_id) VALUES (?, ?)", (pubkey, cursor.lastrowid))
    conn.commit()
    print()
    print("OK")
  else:
    print()
    print("No action given.")

def main():
  try:
    params = cgi.FieldStorage()
    api(params.getfirst("create"), params.getfirst("pubkey"))
  except:
    print("Status: 500 Internal Server Error\n")
    raise

if __name__ == "__main__":
  main()
