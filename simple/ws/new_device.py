#! /usr/bin/env python3

import atexit
from datetime import datetime
import json
import os
import random
import selectors
import socket
import sys

import hoba, hoba_config

import common

sel = selectors.DefaultSelector()

def output(payload):
  print(json.dumps(payload))

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
    cursor = self.db.cursor()
    share_code = random.randint(1e5, 1e6)
    share_code_created = datetime.now()
    if not hoba.select(cursor, "SELECT rowid FROM users WHERE rowid = ?", (self.rowid,)):
      return None
    if hoba.select(cursor, "SELECT share_code FROM share_codes WHERE userid = ?", (self.rowid,)):
      cursor.execute("UPDATE share_codes SET share_code = ?, share_code_created = ? WHERE userid = ?",
                     (share_code, share_code_created, self.rowid))
    else:
      cursor.execute("INSERT INTO share_codes (userid, share_code, share_code_created) VALUES (?, ?, ?)",
                     (self.rowid, share_code, share_code_created))
    self.db.commit()
    self.share_code = share_code
    return share_code

  def output_share_code(self):
    output({"share_code": self.share_code})

  
def system_read(uds, mask, state):
  buf, address = uds.recvfrom(1024)
  line = buf.decode("utf8").strip()
  if line == "new request":
    if state.pull_tempname():
      output({"tempname": state.tempname})
      uds.sendto(b"OK\n", address)
    else:
      uds.sendto(b"Error\n", address)

def browser_read(f, mask, state):
  print("From stdin", f.readline())

  
def serve(state):
  run = common.run_dir(sys.argv[0].rsplit(".", 1)[0].rsplit("/", 1)[-1])
  if not run:
    print("Error setting up /run dir")
    return
  uds_path = os.path.join(run, str(os.getpid()) + ".uds")
  uds = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
  uds.bind(uds_path)
  atexit.register(lambda: os.unlink(uds_path))

  state.output_share_code()
  
  sel.register(sys.stdin, selectors.EVENT_READ, browser_read)
  sys.stdout.flush()

  sel.register(uds, selectors.EVENT_READ, system_read)
  
  while True:
    events = sel.select(timeout=30.0)
    if not events:
      # On timeout, refresh share code
      state.make_share_code()
      state.output_share_code()

    for key, mask in events:
      key.data(key.fileobj, mask, state)

def main():
  user = hoba.check_user(hoba_config.DB)
  if not user:
    print("UNAUTHORIZED")
    exit()
  state = State(user)
  serve(state)

if __name__ == "__main__":
  main()
