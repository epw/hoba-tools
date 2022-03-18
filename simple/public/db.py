import os
import sqlite3

import values

def connect():
  needs_init = False
  if not os.path.exists(values.DB):
    needs_init = True

  conn = sqlite3.connect(values.DB)
  conn.row_factory = sqlite3.Row
  if needs_init:
    cursor = conn.cursor()
    with open("schema.sql") as f:
      cursor.executescript(f.read())

  return conn

def select_one(cursor, statement, *args):
  cursor.execute(statement, *args)
  return cursor.fetchone()

def select_all(cursor, statement, *args):
  cursor.execute(statement, *args)
  return cursor.fetchall()
