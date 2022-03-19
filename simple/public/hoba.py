import json
import os
import sqlite3
import sys

def connect(db):
  needs_init = False
  if not os.path.exists(db):
    needs_init = True

  conn = sqlite3.connect(db)
  conn.row_factory = sqlite3.Row
  if needs_init:
    cursor = conn.cursor()
    with open("schema.sql") as f:
      cursor.executescript(f.read())

  return conn

def select(cursor, statement, *args):
  cursor.execute(statement, *args)
  return cursor.fetchone()

def select_all(cursor, statement, *args):
  cursor.execute(statement, *args)
  return cursor.fetchall()

def get_user(db, userid, token):
  conn = connect(db)
  cursor = conn.cursor()
  user = select(cursor, "SELECT rowid, data FROM users WHERE rowid = ?", (userid,))
  row = select(cursor, "SELECT token FROM keys WHERE userid = ?", (userid,))
  if row and row["token"] == token:
    return user
  return None

# Convenience function for JSON CGI output. Also helpful for other scripts that use the same structure.
def output(data, status=200, force_str=False):
  if status != 200:
    print("Status:", status)
  print("Content-Type: application/json")
  print()
  if force_str:
    sys.stdout.write(data)
  else:
    json.dump(data, sys.stdout)
