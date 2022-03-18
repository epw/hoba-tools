#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

import json
import sys

def output(data, status=200):
  if status != 200:
    print("Status:", status)
  print("Content-Type: application/json")
  print()
  json.dump(data, sys.stdout)

def api(params):
  output(True)
  
def main():
  params = cgi.FieldStorage()
  api(params)


if __name__ == "__main__":
  main()
