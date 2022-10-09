#! /usr/bin/env python3

from datetime import datetime, timedelta
import json
import os
import random
import selectors
import sys

import hoba, hoba_config

import common

sel = selectors.DefaultSelector()

def output(payload):
  print(json.dumps(payload))

class State(object):
  db = None
  pid = None
  share_code = None
  userid = None
  tempname = None

  def __init__(self, share_code):
    self.db = hoba.connect(hoba_config.DB)
    self.pid = os.getpid()
    self.share_code = share_code
    
  def verify_share_code(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT userid FROM share_codes WHERE share_code = ? AND share_code_created > ?", (self.share_code, datetime.now() - timedelta(seconds=60)))
    if row:
      userid = row["userid"]
    else:
      userid = None
    return row

  def make_key_entry(self, pubkey):
    cursor = self.db.cursor()
    cursor.execute("INSERT INTO keys (pubkey) VALUES (?)", (pubkey,))
    return cursor.lastrowid
  
  def make_tempname(self, keyid):
    cursor = self.db.cursor()
    tempname = "".join([chr(65 + random.randint(0, 25)) for _ in range(4)])
    if hoba.select(cursor, "SELECT share_code FROM share_codes WHERE userid = ?", (self.userid,)):
      cursor.execute("UPDATE share_codes SET temp_name = ?, keyid = ? WHERE userid = ?",
                     (tempname, keyid, self.rowid))
    self.db.commit()
    self.tempname = tempname
    return tempname

  def output_tempname(self):
    output({"tempname": self.tempname})

  
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

def setup(msg):
  state = State(msg["share_code"])
#  if not state.verify_share_code():
#    output({"Error": "Can't verify share code"})
#    exit()
  keyid = state.make_key_entry(msg["pubkey"])
  state.make_tempname(keyid)
  state.output_tempname()
  return state
  
def serve():
  run = common.run_dir(sys.argv[0])
  if not run:
    print("Error setting up /run dir")
    return
  uds = common.establish_uds(run)

  line = input()
  state = setup(json.loads(line))
  
  sel.register(sys.stdin, selectors.EVENT_READ, browser_read)
  sel.register(uds, selectors.EVENT_READ, system_read)
  
  while True:
    events = sel.select(timeout=30.0)
    for key, mask in events:
      key.data(key.fileobj, mask, state)

def main():
  serve()

if __name__ == "__main__":
  main()
