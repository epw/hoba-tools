#! /bin/bash

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <www root directory> [--full]"
    exit 1
fi

dest="`realpath $1`"

# WebSockets (from root directory)
cp -r ws "$dest"/ws/hoba



cd public/
# Note that login.html is NOT copied, there's too much site-specific stuff.
# hoba.py is copied into the system below when --full is added.
cp hoba.js hoba-auth.js hoba.cgi login.css login.js "$dest"/.

if [[ $# -lt 2 ]]; then
    echo "Not doing full install (System-wide Python libraries unchanged)"
    exit 0
fi

if [[ "$2" = "--full" ]]; then
    for p in /usr/local/lib/python3*; do
	sudo mkdir -p $p/dist-packages/hoba
	sudo cp hoba.py $p/dist-packages/hoba/__init__.py
    done
else
    echo "Unknown option '$2'"
    exit 1
fi

