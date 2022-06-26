#! /bin/bash

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <www root directory>"
    exit 1
fi

dest="`realpath $1`"
cd public/
# Note that login.html is NOT copied, there's too much site-specific stuff.
cp hoba.py hoba.js hoba.cgi login.css login.js "$dest"/.
