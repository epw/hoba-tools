import atexit
import os
import socket

def ensure_dir(*ds):
  for pos in range(1, len(ds)):
    if not os.path.exists(os.path.join(*ds[:pos])):
      os.mkdir(os.path.join(*ds[:pos]))
  return os.path.join(*ds)

def run_dir(name):
  name = name.rsplit(".", 1)[0].rsplit("/", 1)[-1]
  for parent in ["/run", "/var/run"]:
    if os.path.exists(os.path.join(parent, "hoba")):
      d = ensure_dir(parent, "hoba", name)
      if os.path.exists(d):
        return d
  return None

def establish_uds(run):
  uds_path = os.path.join(run, str(os.getpid()) + ".uds")
  uds = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
  uds.bind(uds_path)
  atexit.register(lambda: os.unlink(uds_path))
  return uds
