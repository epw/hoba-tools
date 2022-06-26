from http import cookies
import json
import os
import sqlite3
import sys

# HOBA constants

COOKIE_USER = "_hoba_user"
COOKIE_TOKEN = "_hoba_token"

# Constants used in dependent systems
CONFIG_FILE = ".hoba"
CONFIG_DEFAULTS = {
  "db": "/dev/null",
  "login": "/login.html"
}


def connect(db):
  if not os.path.exists(db):
    return None
  conn = sqlite3.connect(db)
  conn.row_factory = sqlite3.Row
  return conn

# Only set up to be used in development
def init_db(conn):
  cursor = conn.cursor()
  with open("schema.sql") as f:
    cursor.executescript(f.read())

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
  if user is None:
    return None
  rows = select_all(cursor, "SELECT token FROM keys WHERE userid = ?", (user["rowid"],))
  for row in rows:
    if row and row["token"] == token:
      return dict(user)
  return None

def get_user(db, public_id, token):
  return get_user_identified(db, token, public_id=public_id)

def get_user_rowid(db, rowid, token):
  return get_user_identified(db, token, rowid=rowid)

def check_user(db):
  C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
  if (not COOKIE_USER in C) or (not COOKIE_TOKEN in C):
    return None
  return get_user(db, C[COOKIE_USER].value, C[COOKIE_TOKEN].value)

# Logic to support CGI programs across systems

def find_config():
  cwd = os.getenv("SCRIPT_FILENAME").rsplit("/", 1)[0]
  while cwd and cwd != "/":
    filename = os.path.join(cwd, CONFIG_FILE)
    if os.path.exists(filename):
      return filename
    if cwd == os.getenv("DOCUMENT_ROOT"):
      return None
    cwd = cwd.rsplit("/", 1)[0]
  return None

def get_config():
  config = CONFIG_DEFAULTS.copy()
  filename = find_config()
  if filename and os.path.exists(filename):
    with open(filename) as f:
      config.update(json.load(f))
  else:
    raise FileNotFoundError(f"No config file found at '{CONFIG_FILE}': {filename}")
  return config

CONFIG = None

def authenticated():
  global CONFIG
  CONFIG = get_config()
  return check_user(CONFIG["db"])


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
