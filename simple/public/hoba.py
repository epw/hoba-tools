import os
import sqlite3

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
  row = select(cursor, "SELECT * FROM users WHERE rowid = ?", (userid,))
  if row and row["token"] == token:
    return row
  return None
