#! /usr/bin/env python3

import os
import sys

import hoba, hoba_config

def send():
  print("Ready for user to try logging in.")

def main():
  if not hoba.check_user(hoba_config.DB):
    print("UNAUTHORIZED")
    exit()
  send()
  
if __name__ == "__main__":
  main()
