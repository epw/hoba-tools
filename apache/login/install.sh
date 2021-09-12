#! /bin/bash

if [[ $# -lt 2 ]]; then
    echo "Usage: $0 <WWW_ROOT> <SQLITE_DB_FILE>"
    exit 1
fi

www="$1"; shift
sqlite_file="$1"; shift

for f in `ls hoba-login.html hoba-script.js hoba-style.css hoba.cgi`; do
    ln -s "`realpath $f`" "$www/$f"
done

sqlite3 schema.sql > "$sqlite_file"

echo "Now:"
echo
echo "Enable these Apache mods: auth_form authn_dbd session session_cookie"
echo
echo "Run $ sudo apt install libaprutil1-dbd-sqlite3"
echo
echo "Add these lines to your Apache site config:"
echo
echo "  DBDriver sqlite3"
echo "  DBDParams \"$sqlite_file\""
echo
echo "Add these lines to the top <Directory> stanza:"
echo
cat <<EOF
  Session On
  SessionEnv On
  SessionCookieName session path=/
  SessionHeader X-Replace-Session

  AuthFormProvider dbd
  AuthType form
  AuthName "Uses Form Authentication"
  AuthDBDUserPWQuery "SELECT password FROM authn WHERE username = %s"
            
  # This is the login phase
  ErrorDocument 401 /hoba-login.html
EOF

echo
echo "You should run $ sudo apache2ctl graceful"
echo
echo "Now you can add a .htaccess file containing \"require valid-user\" to any directory to protect."

