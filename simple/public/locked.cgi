#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

from http import cookies
import os
import sys

import db

def get_user_or_redirect():
  conn = db.connect()
  cursor = conn.cursor()
  C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
  if "user" in C:
    row = db.select(cursor, "SELECT token FROM users WHERE rowid = ?", (C["user"].value,))
    if row["token"] == C["token"].value:
      return row

  print("Location: index.html")
  print()

def page(user):
  print("Content-Type: text/html")
  print()

  print("<html><head><link rel='stylesheet' href='style.css'></head>")
  print("<body><h1>This is a secret</h1></body></html>")


def main():
  user = get_user_or_redirect()
  if user:
    page(user)


if __name__ == "__main__":
  main()
