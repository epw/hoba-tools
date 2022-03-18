#! /usr/bin/env python3

import cgi, cgitb
import json
import sys

def api(params):
  json.dump("Hello, world", sys.stdout)
  
def main():
  print("Content-Type: application/json\n")
  params = cgi.FieldStorage()
  api(params)


if __name__ == "__main__":
  main()
