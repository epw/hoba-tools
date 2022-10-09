#! /usr/bin/env python3

import time


def main():
  i = 0
  while True:
    line = input()
    print("Got: " + line.strip())
    i += 1
    if i > 3:
      time.sleep(10)
      print("WAITED")
      i = 0


if __name__ == "__main__":
  main()
