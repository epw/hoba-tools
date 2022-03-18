#! /usr/bin/env python3

import cgi, cgitb
cgitb.enable()

from http import cookies
import os
import sys

import hoba
import values

def get_user_or_redirect():
  C = cookies.SimpleCookie(os.getenv("HTTP_COOKIE"))
  if "user" in C and "token" in C:
    user = hoba.get_user(values.DB, C["user"].value, C["token"].value)
    if user:
      return user

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
