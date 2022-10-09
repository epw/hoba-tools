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

...

## Log In New Device (Old)

1.  Browser visits `/login.html`
1.  `/hoba.js` loads initial state in `window.HOBA` object
1.  `HOBA.attach_ui()` calls `HOBA.update_ui()` to produce HTML dialog
    box. It finds no private key in the IndexedDB, and so makes the
    "Log in with code" dialog available.
1.  User opens `/login.html` on an already-logged-in device
	*  If user is not logged in for any of the following steps,
       standard failures are returned, and the user can simply log in
       as above, and then restart here.
1.  User clicks "Manage account" on logged-in device
1.  User clicks "Link to log in elsewhere" button on logged-in device
1.  `HOBA.generate_share()` makes an API call to `/hoba.cgi` with
    `action=browser_secret`
1.  `/hoba.cgi` with `action=browser_secret` checks the user has a
    valid logged-in cookie, then generates a random secret called
    `new_browser_secret` and sets it, and a 1-day expiration, in the
    database. Then it calls `make_share_code()`
1.  `make_share_code()` generates a random 6-digit number called a
    "share code" and saves it, with its creation timestamp, in the
    database.
1.  `/hoba.cgi` returns the share code and the secret to the browser.
1.  `HOBA.generate_share()` displays the share code (on the logged-in
    device)
1.  `HOBA.generate_share()` generates a QR code and URL for the
    current location (presumed to be `/login.html`) with the
    additional parameters:
	*  `action=confirm_bind`
	*  `user=`<public user ID>
	*  `redirect=`<current URL>
	*  `original_identifier=`<site-supplied data, likely visible user
       name>
1.  User enters share code in new device. [See below for WebSockets
    flow](#websockets-new-device)
1.  `HOBA.enter_share_code()` makes an API call to `/hoba.cgi` with
    `action=share_code_to_secret`
1.  `/hoba.cgi` with `action=share_code_to_secret` looks up a user
    with matching valid (non-expired) share code in the database.
	*  If the user is not found, return an error
1.  `/hoba.cgi` clears the share code and returns the
    `new_browser_secret` and public user ID from the database to the
    browser.
1.  `HOBA.enter_share_code()` on the new device loads the public user
    ID and secert into its URL params and calls `HOBA.bind()`.
1.  `HOBA.bind()` creates and stores a new keypair locally.
1.  `HOBA.bind()` makes an API call to `/hoba.cgi` with `action=bind`
    and the public user ID, new browser secret, and new public key.
1.  `/hoba.cgi` with `action=bind` looks up the user with the public
    user ID in the database, and confirms its browser secret matches
    the one provided in the API call.
1.  `/hoba.cgi` saves the public key in the database linked to the
    user.
1.  `/hoba.cgi` clears the browser secret.
1.  `/hoba.cgi` returns the public user ID to the browser.
1.  `HOBA.bind()` stores the public user ID in localStorage and a
    cookie.
1.  `HOBA.bind()` calls `HOBA.login()`, and follows the [Logging In
    Flow] as usual.

Note: Does not account for 30-second share code timeout/refresh, or
how Manage Account dialog closes after a code has been used and
expires.

## Log In New Device (New)

1.  Browser visits `/login.html`
1.  `/hoba.js` loads initial state in `window.HOBA` object
1.  `HOBA.attach_ui()` calls `HOBA.update_ui()` to produce HTML dialog
    box. It finds no private key in the IndexedDB, and so makes the
    "Log in with code" dialog available.
1.  User opens `/login.html` on an already-logged-in device
	*  If user is not logged in for any of the following steps,
       standard failures are returned, and the user can simply log in
       as above, and then restart here.
1.  User clicks "Manage account" on logged-in device
1.  User clicks "Link to log in elsewhere" button on logged-in device
1.  `HOBA.generate_share()` makes an API call to `/hoba.cgi` with
    `action=share_code`
1.  `/hoba.cgi` with action `share_code` saves a new numerical code in
    the database, associated with the user, and returns it.
1.  The share code is displayed on the logged-in device.
	*   Every 60 seconds, `/hoba.js` requests a new share code
	because they expire.
1.  The user enters the share code on the new device.
1.  The new device generates a keypair.
1.  `HOBA.try_share_code()` on the new device makes an API call to
    `/hoba.cgi` with `action=try_share_code`, passing in the share
    code and public key.
1.  `/hoba.cgi` with `action=try_share_code` checks the share code's
    validity.
1.  `/hoba.cgi` generates a "temporary name" and stores it and the
    public key with the share code, and returns it to `/hoba.js` on
    the new device, which displays it.
1.  `/hoba.js` on the logged-in device is notified of the login
    attempt
	*   HOW? This is where we need WebSockets.
1.  `/hoba.js` on the logged-in device displays the temporary name to
    the user and asks if this device should be allowed to log in.
1.  If the user confirms, a challenge is stored in the database for
    the share code.
1.  `/hoba.js` on the new device is notified of the challenge
	*   WebSockets again?
1.  `/hoba.js` signs the challenge and sends it to `/hoba.cgi` with
    `action=bind_challenge`.
1.  `/hoba.cgi` with `action=bind_challenge` creates a new public key
    entry for the user, and returns the public user ID to `/hoba.js`.
	*   The share code is deleted from the database.
	*   `/hoba.js` on the logged-in device should be notified so
	it can close the share dialog.
1.  `HOBA.bind_challenge()` stores the public user ID in localStorage
    and a cookie.
1.  `HOBA.bind()` calls `HOBA.login()`, and follows the [Logging In
    Flow] as usual.

### WebSockets New Device

1.  `HOBA.enter_share_code()` connects to `/ws/hoba/new_device.py`
1.  `HOBA.enter_share_code()` makes an API call to `/hoba.cgi` with
    `action=share_code_request`.
1.  `/hoba.cgi` with `action=share_code_to_secret` looks up a user
    with matching valid (non-expired) share code in the database.
	*  If the user is not found, return an error
1.  `/hoba.cgi` generates a temporary name and stores it in the
    database for the looked-up user.
1.  `/hoba.cgi` informs the `/ws/hoba/logged_in.py` program currently
    connected to the logged-in device of the temporary name (or that a
    temporary name can now be found in the database), and returns the
    temporary name to the new device.
1.  `HOBA.enter_share_code()` displays the temporary name on the new
    device and tells the user to confirm they would like to log in on
    the device they got the share code from.
1.  The user clicks OK on the logged-in device. This is relayed
    through the WebSockets connection.
1.  `/ws/hoba/logged_in.py` informs the `/ws/hoba/new_device.py`
    program that it should allow the new user, then closes the
    connection.
1.  `/ws/hoba/new_device.py` sends a message to the new device telling
    it to set up a keypair and what secret to use, then closes the
    connection.
1.  `HOBA.bind()` continues as usual.


...

Right now: so /ws/hoba/logged_in.py exists, and it expects to have its
FIFO written to in order to tell it "go retrieve a temporary name".

We connect when you click "generate link to log in new device".

Now what has to happen is, when a different device calls the API with
`share_code_request`, we somehow find the FIFO for the right browser
and tell it "go retrieve a temporary name". Two choices: could
actually name the FIFO after the share code (means it would have to
change every minute, complicating selector call) or we could associate
share codes with FIFO names and just update that. Then we look up the
FIFO using the share code we were given, write to it, and the API call
terminates. The new device has its own websocket connection, which
will allow it to be told whether it was allowed to log in or not.
