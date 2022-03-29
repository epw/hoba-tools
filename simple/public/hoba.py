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

def get_user_identified(db, token, rowid=None, public_id=None):
  conn = connect(db)
  cursor = conn.cursor()
  selector = None
  value = None
  if public_id:
    selector = "public_id"
    value = public_id
  elif rowid:
    selector = "rowid"
    value = rowid
  select_statement = "SELECT rowid, public_id, data, acl_create_account FROM users WHERE {} = ?".format(selector)
  user = select(cursor, select_statement, (value,))
  rows = select_all(cursor, "SELECT token FROM keys WHERE userid = ?", (user["rowid"],))
  for row in rows:
    if row and row["token"] == token:
      return dict(user)
  return None

def get_user(db, public_id, token):
  return get_user_identified(db, token, public_id=public_id)

def get_user_rowid(db, rowid, token):
  return get_user_identified(db, token, rowid=rowid)

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
