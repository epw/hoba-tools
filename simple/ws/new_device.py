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

class State(object):
  db = None
  share_code = None
  userid = None
  tempname = None

  uds_path = None
  
  def __init__(self, uds_path, share_code):
    self.db = hoba.connect(hoba_config.DB)
    self.uds_path = uds_path
    self.share_code = share_code
    
  def verify_share_code(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT userid FROM share_codes WHERE share_code = ? AND share_code_created > ?", (self.share_code, datetime.now() - timedelta(seconds=60)))
    if row:
      self.userid = row["userid"]
    else:
      self.userid = None
    return row

  def make_key_entry(self, pubkey):
    cursor = self.db.cursor()
    cursor.execute("INSERT INTO keys (pubkey) VALUES (?)", (pubkey,))
    return cursor.lastrowid
  
  def make_tempname(self, keyid):
    cursor = self.db.cursor()
    tempname = "".join([chr(65 + random.randint(0, 25)) for _ in range(4)])
    if hoba.select(cursor, "SELECT share_code FROM share_codes WHERE userid = ?", (self.userid,)):
      cursor.execute("UPDATE share_codes SET temp_name = ?, keyid = ?, new_device_uds = ? WHERE userid = ?",
                     (tempname, keyid, self.uds_path, self.userid))
    else:
      common.output({"Error": f"No matching share code found for {self.userid}"})
    self.db.commit()
    self.tempname = tempname
    return tempname

  def output_tempname(self):
    common.output({"tempname": self.tempname})

  def notify_logged_in_device(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT logged_in_uds FROM share_codes WHERE userid = ?", (self.userid,))
    if row:
      common.send_uds(row["logged_in_uds"], "new request\n")

  def login(self):
    cursor = self.db.cursor()
    row = hoba.select(cursor, "SELECT public_id FROM users WHERE rowid = ?", (self.userid,))
    common.output({"login": True, "userid": row["public_id"]})


def system_read(uds, mask, state):
  buf, _ = uds.recvfrom(1024)
  line = buf.decode("utf8").strip()
  if line == "Error":
    common.output({"Error": "Uh-oh"})
  elif line == "login accepted":
    state.login()
  elif line == "login refused":
    common.output({"login": False})

def browser_read(f, mask, state):
  try:
    f.readline()
  except KeyboardInterrupt:
    exit()

def setup(uds_path, msg):
  state = State(uds_path, msg["share_code"])
  if not state.verify_share_code():
    common.output({"Error": "Can't verify share code"})
    exit()
  keyid = state.make_key_entry(msg["pubkey"])
  state.make_tempname(keyid)
  state.output_tempname()
  state.notify_logged_in_device()
  return state
  
def serve():
  run = common.run_dir(sys.argv[0])
  if not run:
    print("Error setting up /run dir")
    return
  uds, uds_path = common.establish_uds(run)

  line = input()
  state = setup(uds_path, json.loads(line))
  
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
