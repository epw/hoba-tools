import os

def ensure_dir(*ds):
  for pos in range(1, len(ds)):
    if not os.path.exists(os.path.join(*ds[:pos])):
      os.mkdir(os.path.join(*ds[:pos]))
  return os.path.join(*ds)

def run_dir(name):
  for parent in ["/run", "/var/run"]:
    if os.path.exists(os.path.join(parent, "hoba")):
      d = ensure_dir(parent, "hoba", name)
      if os.path.exists(d):
        return d
  return None

