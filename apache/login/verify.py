#! /usr/bin/env python3

# Test that I understand RSA public key signature verification in Python

from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA

def test():
  message = "Hello, world"
  key = RSA.generate(1024)
  h = SHA256.new(message.encode("utf8"))
  signature = pkcs1_15.new(key).sign(h)
  print(signature)
  return pkcs1_15.new(key.publickey()).verify(h, signature)

def main():
  print(test())


if __name__ == "__main__":
  main()
