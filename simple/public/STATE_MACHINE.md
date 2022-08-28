# HOBA Tools State Machine

This summiarzes the state machine for easier reference.

## New User Flow

(Assuming a case where a new account can be created by a
previously-unseen browser)

1.  Browser visits `/login.html`
1.  `/hoba.js` loads initial state in `window.HOBA` object
1.  `HOBA.attach_ui()` calls `HOBA.update_ui()` to produce HTML dialog
    box. It finds no private key in the IndexedDB, and so makes only
    the "Create Account" buttons visible.
1.  `HOBA.auto_login()` finds no private key stored in the IndexedDB
    and brings up login dialog with `HOBA.present_ui()`
1.  User clicks Create Account button
1.  `HOBA.create()` generates and stores the new keypair locally
1.  `HOBA.create()` make API call (to `/hoba.cgi`) with `action=create`
    and new public key
1.  `/hoba.cgi` with `action=create` creates a new user with a random public ID in the
    database, and inserts the new public key associated with the user
    in the database. The public ID is returned to the browser
1.  `HOBA.create()` saves the new public user ID for this account
1.  `HOBA.create()` calls `HOBA.login()`
1.  `HOBA.login()` makes an API call with `action=challenge` and the
    public user ID and public key
1.  `/hoba.cgi` with `action=challenge` generates a random secret
    called a "challenge", saves it in the database associated with the
    public key, and returns it to the browser

    **Possible XSRF exploit: if a bad guy with the public key makes a
    challenge request, they can keep causing new challenges to be
    generated, possibly resulting in a DoS for the user who might get
    logged out depending on what extra challenge requests cause.**
1.  `HOBA.login()` signs the challenge with the private key
1.  `HOBA.login()` makes an API call with `action=token` passing in
    the public user ID, public key, and signature for the challenge
1.  `/hoba.cgi` with `action=token` checks the user exists and
    verifies the signature. It returns an error to the browser if
    not. But if successful, it generates a random secret called a
    "token" that will be used for logging in automatically. The token
    is saved to the database, associated with the public key, and
    returns the token to the browser. It also clears the challenge
    that was signed.
1.  `HOBA.login()` sets a cookie with the public user ID and the
    received token.
1.  `HOBA.login()` calls `HOBA.get_user()`
1.  `HOBA.get_user()` makes an API call with `action=retrieve`
1.  `/hoba.cgi` with `action=retrieve` looks at the cookies in the
    request and requires that both a valid public user ID and token
    matching one of the user's public keys exist. If not, it returns
    an error. If they do match, it returns user data from the database
1.  `HOBA.get_user()` updates the page state, including `HOBA.user`
    and login dialog, to reflect a logged-in user
1.  `HOBA.login()` dispatches login events
1.  If a `redirect=` URL param exists, `HOBA.login()` redirects to the
    provided destination

## Logging in Flow

1.  Browser visits `/login.html`
1.  `/hoba.js` loads initial state in `window.HOBA` object
1.  `HOBA.attach_ui()` calls `HOBA.update_ui()` to produce HTML dialog
    box. It finds a private key in the IndexedDB, and so makes login buttons visible.
1.  `HOBA.auto_login()` finds a private key stored in the IndexedDB and so calls `HOBA.get_user()`

(OK, so what happens next? We try to log in, and if the token is
there, it's exactly like just after creating a user. If not, it does
something to get a new cookie, maybe just HOBA.login()?)
