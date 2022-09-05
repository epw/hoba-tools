import os

def run_dir(name):
  for parent in ["/run", "/var/run"]:
    d = os.path.join(parent, "hoba", name)
    if os.path.exists(d):
      return d
  return None

