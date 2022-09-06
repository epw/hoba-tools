#! /usr/bin/env python3

import atexit
import json
import os
import random
import selectors
import sys

import hoba, hoba_config

import common

sel = selectors.DefaultSelector()

class State(object):
  rowid = None
  tempname = None
  db = None

  pid = None
  
  def __init__(self, user):
    self.db = hoba.connect(hoba_config.DB)
    self.rowid = user["rowid"]
    self.pid = os.getpid()
    self.make_share_code()
    
  def pull_tempname(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT temp_name FROM share_codes WHERE userid = ?", (self.rowid,))
    if not row:
      return False
    self.tempname = row["temp_name"]
    return True

  def make_share_code(self):
    cursor = self.conn.cursor()
    share_code = random.randint(1e5, 1e6)
    share_code_created = datetime.now()
    if not hoba.select(cursor, "SELECT rowid FROM users WHERE rowid = ?", (self.rowid,)):
      return None
    cursor.execute("INSERT INTO share_codes (userid, share_code, share_code_creaed) VALUES (?, ?, ?)",
                   (self.rowid, share_code, share_code_created))
    self.conn.commit()
    self.share_code = share_code
    return share_code

  
def system_read(f, mask, state):
  line = f.read().strip()
  if line == "new request":
    state.pull_tempname()
    print(state.tempname)

def browser_read(f, mask, state):
  pass
  

def output(payload):
  json.dump(payload, sys.stdout)
  sys.stdout.flush()

def serve(state):
  run = common.run_dir()
  if not run:
    print("Error setting up FIFO")
    return
  fifo_path = os.mkfifo(os.path.join(run, os.getpid() + ".fifo"))
  atexit.register(lambda: os.unlink(fifo_path))

  output({"pid": state.pid, "share_code": state.share_code})
  
  sel.register(sys.stdin, selectors.EVENT_READ, browser_read)
  with open(fifo_path) as fifo:
    sel.register(fifo, selectors.EVENT_READ, system_read)
  
  while True:
    events = sel.select(timeout=30.0)
    for key, mask in events:
      key.data(key.fileobj, mask, state)

def main():
  user = hoba.check_user(hoba_config.DB):
  if not user:
    print("UNAUTHORIZED")
    exit()
  state = State(user)
  serve(state)
  
if __name__ == "__main__":
  main()
