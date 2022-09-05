#! /usr/bin/env python3

import atexit
import json
import os
import selectors
import sys

import hoba, hoba_config

import common

sel = selectors.DefaultSelector()

class State(object):
  rowid = None
  tempname = None
  db = None

  def __init__(self, user):
    self.db = hoba.connect(hoba_config.DB)
    self.rowid = user["rowid"]

  def pull_tempname(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT temp_name FROM share_codes WHERE userid = ?", (self.rowid,))
    if not row:
      return False
    self.tempname = row["temp_name"]
    return True

def system_read(f, mask, state):
  line = f.read().strip()
  if line == "new request":
    state.pull_tempname()
    print(state.tempname)

def browser_read(f, mask, state):
  pass
  
  
def serve(state):
  run = common.run_dir()
  if not run:
    print("Error setting up FIFO")
    return
  fifo_path = os.mkfifo(os.path.join(run, os.getpid() + ".fifo"))
  atexit.register(lambda: os.unlink(fifo_path))
  
  sel.register(sys.stdin, selectors.EVENT_READ, browser_read)
  with open(fifo_path) as fifo:
    sel.register(fifo, selectors.EVENT_READ, system_read)
  
  while True:
    events = sel.select()
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
