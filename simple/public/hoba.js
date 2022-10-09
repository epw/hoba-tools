// Template HTML is at the top of the file, even though that means it's outside of the HOBA.* namespace
const HOBA_UI = `
<style>
#hoba .hoba-ui-row {
  display: none;
}
#hoba .hoba-ui-row.hoba-show {
  display: unset;
}
#hoba #hoba-close-button.hoba-ui-row {
  display: unset;
}
#hoba-share {
  display: none;
}
#hoba-share.hoba-show {
  display: unset;
}
#hoba-identifier-code, #hoba-identifier-code-binding {
  text-align: center;
  font-size: 200%;
  font-weight: bold;
}
#hoba-share-code {
  margin-top: 5px;
  text-align: center;
  font-size: 200%;
  font-weight: bold;
  border: inset medium gray;

  animation-duration: 30s;
  animation-name: fadeout;
  animation-iteration-count: infinite;
}
@keyframes fadeout {
  from {
    background-color: lightblue;
  }
  to {
    background-color: orange;
  }
}
#hoba-share-code-entry {
  font-size: 200%;
}
#hoba-qr {
  text-align: center;
}
#hoba .hoba-destroy {
  color: red;
}
#hoba-controls .hoba-immediate-button {
  display: none;
}
#hoba-controls .hoba-immediate-button.hoba-show {
  display: unset;
}
#hoba-error-message {
  color: red;
  font-weight: bold;
}
</style>

<dialog id="hoba" onclick="HOBA.dialog_click(event)" onclose="HOBA.dialog_closed()">
 <div id="hoba-bind" class="hoba-ui-row">
   <div class="hoba-identifier">
    <div id="hoba-identifier-code-binding"></div>
   </div>
   <p>
    <button type="button" onclick="HOBA.bind()">Bind account to this browser</button>
   </p>
 </div>
 <div id="hoba-share">
  <div class="hoba-identifier">
    <div id="hoba-identifier-code"></div>
  </div>
  <div id="hoba-share-code"></div>
  <div><div id="hoba-qr"></div></div>
  <div><span>Link to share:</span> <input type="text" id="hoba-share-link" readonly>
       <button type="button" id="hoba-copy-button" onclick="HOBA.copy_link()">Copy</button></div>
  <div><button type="button" onclick="HOBA.share_link()">Share</button></div>
 </div>
 <div id="hoba-sharing" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.generate_share()">Link to Log In Elsewhere</button>
  </p>
 </div>
 <div id="hoba-grant-new" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.grant_new()">Grant Account</button>
  </p>
 </div>
 <div id="hoba-create" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.create()">Create Account</button>
  </p>
 </div>
 <div id="hoba-login" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.login()">Login</button>
  </p>
 </div>
 <div id="hoba-nothing" class="hoba-ui-row">
  <p>
   To log in on this device, open <a id="hoba-login-link" href="">this page</a> on a device where you already can log in, click the "Link to Log In Elsewhere" button, and then on this device: &bull; enter the provided code below, &bull; scan the QR code, or &bull; visit the provided URL.
  </p>
  <p>
   <input type="number" id="hoba-share-code-entry" onchange="HOBA.enter_share_code(event)">
  </p>
 </div>
 <div id="hoba-logout" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.logout()">Logout</button>
  </p>
 </div>
 <div id="hoba-destroy" class="hoba-ui-row">
  <p>
   <button type="button" class="hoba-destroy" onclick="HOBA.destroy()">Destroy credentials</button>
  </p>
 </div>
 <div id="hoba-close-button" class="hoba-ui-row hoba-show">
  <p>
   <button type="button" onclick="HOBA.close_dialog()">Close</button>
  </p>
 </div>
 <div id="hoba-error-message">
 </div>
</dialog>
`;

const HOBA_CONTROLS = `
<span id="hoba-controls-insert">
 <button type="button" class="hoba-immediate-button" id="hoba-manage-button" onclick="HOBA.manage()">Manage Accounts</button>
 <button type="button" class="hoba-immediate-button" id="hoba-login-immediate" onclick="HOBA.login()">Login</button>
 <button type="button" class="hoba-immediate-button" id="hoba-logout-immediate" onclick="HOBA.logout()">Logout</button>
 <button type="button" class="hoba-immediate-button" id="hoba-create-immediate" onclick="HOBA.create()">Create Account</button>
</span>
`;

// Class is used to create a namespace but keep all the functions available.
class Hoba {
    // Constructor sets constants, and attaches dialog element to document.
    constructor() {

	this.user = null;

	this.description = null;
	this.dialog_dismissable = true;
	this.dialog = null;

	this.api_url = null;

	// Author-provided configuration
	this.options = {
	    "api": null,
	    "unique_ui": false,
	    "path": "/",
	    "is_login_page": false,
	    "login_uri": null,
	    "login_iframe": false,
	    
	    "failed_msg": "AUTH FAILED",
	};
	this.controls = null;

	this.url_params = new URLSearchParams(location.search);

	// Assign constants so keys can be program-recognized, not just strings

	this.CSS = {
	    SHOW: "hoba-show",
	};

	// Keep these constants equal to values in hoba.py
	this.COOKIE = {
	    USER: "_hoba_user",
	    TOKEN: "_hoba_token"
	};
	
	this.OBJECTS = "hoba";
	// Give localStorage its own "namespace" to stay separate from other scripts on the same server.
	this.STORAGE = ".hoba.";
	this.S = {
	    PRIVKEY: "priv_key",
	    PUBKEY: "pub_key",
	    HAS_PRIVKEY: "has_priv_key",
	    USER: "user",
	    AUTO: "auto",
	    LOGGED_IN: "logged_in",
	};

	this.MESSAGES = {
	    LOGIN_SUCCESS: "login_success",
	};

	this.db = null;
	const db_request = indexedDB.open("hoba", 1);
	db_request.onerror = e => {
	    console.log("Error creating indexedDB:", db_request.errorCode, e);
	};
	db_request.onsuccess = e => {
	    this.db = e.target.result;
	};
	db_request.onupgradeneeded = async (e) => {
	    const db = e.target.result;
	    const new_store = db.createObjectStore(this.OBJECTS);
	    await new_store.transaction;
	    const hoba_store = db.transaction(this.OBJECTS, "readwrite").objectStore(this.OBJECTS);
	    hoba_store.put(null, this.S.PRIVKEY);
	};
	
	// Events other scripts can listen for on document.
	this.EVENTS = {
	    LOGIN: "LOGIN",
	    LOGOUT: "LOGOUT",
	    LOGIN_MESSAGE: "LOGIN_MESSAGE",
	};

	this.KEY_ALG = {
	    name: "RSASSA-PKCS1-v1_5",
	    hash: {
		name: "SHA-256",
		classicname: "sha256",
	    },
	    modulusLength: 1024,
	    extractable: true,
	    publicExponent: new Uint8Array([1, 0, 1]),
	};
	this.PRIV_KEY_EXPORT_FORMAT = "pkcs8";

	this.encoding = "UTF-8";
	this.decoder = new TextDecoder(this.encoding);
	this.encoder = new TextEncoder(this.encoding);

	document.addEventListener("DOMContentLoaded", () => this.loaded());
    }

    get_params() {
	for (let option in this.options) {
	    const meta = document.querySelector(`meta[name='hoba:${option}']`);
	    if (meta) {
		this.options[option] = meta.content;
	    }
	}
	if (this.options.is_login_page) {
	    if (typeof(this.options.api) != "string") {
		console.error("No HOBA API URL provided. It must be provided with a tag: <meta name='hoba:api' content='URL'>");
	    }
	} else {
	    if (typeof(this.options.login_uri) != "string") {
		console.warn("No HOBA login page provided, make sure you've provided a custom way for the user to manage their account.");
	    }
	}

	this.controls = document.getElementById("hoba-controls");
	if (this.controls) {
	    this.controls.innerHTML = HOBA_CONTROLS;
	} else if (this.options.is_login_page) {
	    console.warn("No #hoba-controls element found, make sure you've provided a custom way for the user to manage their account.");
	}
    }

    attach_ui() {
	const script = document.createElement("script");
	script.setAttribute("async", "async");
	script.setAttribute("defer", "defer");
	script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
	document.body.append(script);

	document.body.insertAdjacentHTML("beforeend", HOBA_UI);

	if (this.url_params.get("secret")) {
	    document.getElementById("hoba-identifier-code-binding").textContent = this.url_params.get("original_identifier");
	}

	document.getElementById("hoba-login-link").href = location.pathname;

	this.update_ui();
    }

    show_ids(ids) {
	ids.map(id => this.safe_css_class_add(id, this.CSS.SHOW));
    }
    
    update_ui() {
	this.clear_error();
	Array.from(document.querySelectorAll(".hoba-ui-row, .hoba-immediate-button")).map(el => el.classList.remove(this.CSS.SHOW));
	let ids_to_show = ["hoba-nothing"];
	if (this.url_params.get("secret")) {
	    ids_to_show = ["hoba-bind"];
	} else if (localStorage.getItem(this.STORAGE + this.S.HAS_PRIVKEY)) {
	    if (this.user) {
		ids_to_show = ["hoba-manage-button", "hoba-logout", "hoba-logout-immediate", "hoba-destroy",
			       "hoba-sharing"];
		if (this.user._acl_create_account) {
		    ids_to_show.push("hoba-grant-new");
		}
	    } else {
		ids_to_show = ["hoba-login", "hoba-login-immediate"];
	    }
	} else {
	    this.api_call("?action=acls").then(acls => {
		if (acls.create_account) {
		    this.show_ids(["hoba-create", "hoba-create-immediate"]);
		}
	    });
	}
	this.show_ids(ids_to_show);
    }
    
    loaded() {
	localStorage.setItem(this.STORAGE + this.S.LOGGED_IN, "");
	this.get_params();
	if (this.options.is_login_page) {
	    this.attach_ui();
	}
	this.auto_login();
    }

    // DB management
    async db_get(key) {
	const promise = new Promise(resolve =>
				    this.db.transaction(this.OBJECTS)
				    .objectStore(this.OBJECTS).get(key).onsuccess = e => {
					resolve(e.target.result);
				    });
	return promise;
    }
    async db_set(key, value) {
	return this.db.transaction(this.OBJECTS, "readwrite").objectStore(this.OBJECTS).put(value, key);
    }
    async db_remove(key) {
	return this.db.transaction(this.OBJECTS, "readwrite").objectStore(this.OBJECTS).delete(key);
    }
    
    // Cookie management
    get_cookies() {
	const cookies = {};
	for (let cookie of document.cookie.split(";")) {
	    const parts = cookie.split("=");
	    cookies[parts[0]] = parts[1];
	}
	return cookies;
    }
    get_cookie(name) {
	for (let cookie of document.cookie.split(";")) {
	    if (cookie.trim().startsWith(name + "=")) {
		return cookie.split("=")[1];
	    }
	}
    }
    set_cookie(name, value) {
	document.cookie = `${name}=${value}; Path=${this.options.path}`;
    }
    clear_cookie(name) {
	document.cookie = name + `=; Path=${this.options.path}; Max-Age=0`;
    }

    // Helper functions for processing keys 
    async get_pem(public_key) {
	const keydata = await crypto.subtle.exportKey("spki", public_key);
	const body = btoa(String.fromCharCode(...new Uint8Array(keydata)));
	return "-----BEGIN PUBLIC KEY-----\r\n" + body.match(/.{1,64}/g).join("\r\n") + "\r\n-----END PUBLIC KEY-----";
    }
    buf2hex(buf) {
	return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
    }

    show_error(msg) {
	document.getElementById("hoba-error-message").innerHTML = msg;
    }
    append_error(msg) {
	document.getElementById("hoba-error-message").innerHTML += msg;
    }
    clear_error() {
	const el = document.getElementById("hoba-error-message");
	if (el) {
	    el.innerHTML = "";
	}
    }
    
    // Convenience wrapper for AJAX call
    async api_call(url, form, confirmation) {
	if (this.options.api == null) {
	    console.error(`No HOBA API URL provided, API call for ${url} cannot succeed.`);
	    return {"error": "No HOBA API URL",
		    "status": 0};
	}
	const base_url = new URL(this.options.api, location);
	const api_url = new URL(url, base_url);
	const res = await fetch(api_url, {
	    method: "POST",
	    body: form
	});
	if (res.status != 200) {
	    let body = await res.text();
	    try {
		body = JSON.parse(body);
	    } finally {
		return {"error": body,
			"status": res.status};
	    }
	}
	const body = await res.json();
	if (confirmation && !(confirmation in body)) {
	    console.error("Error " + res.status);
	    console.error(body);
	    return {"error": body};
	}
	return body;
    }

    api_error(body, msg) {
    	if ("error" in body) {
	    console.error(msg);
	    let err = "<p>" + msg;
	    if ("status" in body) {
		err += " Code: " + body.status;
	    }
	    err += "</p>";
	    if ("error" in body.error) {
		err += "<p>" + body.error.error + "</p>";
	    }
	    this.show_error(err);
	    this.present_ui();
	    return true;
	}
	return false;
    }

    // PRIMARY USER MANAGEMENT

    // Helper function used to actually generate keypair, used in both create() and bind(),
    // for new and preexisting accounts respectively.
    async new_keypair() {
	const keypair = await crypto.subtle.generateKey(this.KEY_ALG, true, ["sign", "verify"]);
	this.db_set(this.S.PRIVKEY, keypair.privateKey);
	localStorage.setItem(this.STORAGE + this.S.HAS_PRIVKEY, "true");

	// We only ever need the public key as a string, not a SubtleCrypto object,
	// so store the converted string for convenience.
	const public_key = await this.get_pem(keypair.publicKey);
	localStorage.setItem(this.STORAGE + this.S.PUBKEY, public_key);

	return public_key;
    }
    
    async create() {
	console.log("Creating user");
	const public_key = await this.new_keypair();
	const form = new FormData();
	form.set("pubkey", public_key);
	const body = await this.api_call("?action=create", form, "id");
	if (this.api_error(body, "Failed to create new user.")) {
	    this.clear_user();
	    return;
	}
	localStorage.setItem(this.STORAGE + this.S.USER, body["id"])
	this.set_cookie(this.COOKIE.USER, body["id"]);
	console.log("User created");
	this.update_ui();
	this.login();
    }

    async bind() {
	console.log("Binding to existing user");
	const public_key = await this.new_keypair();

	const form = new FormData();
	form.set("pubkey", public_key);
	form.set("user", this.url_params.get("user"));
	form.set("secret", this.url_params.get("secret"));
	const body = await this.api_call("?action=bind", form, "id");
	if (this.api_error(body, "Failed to bind to existing user.")) {
	    this.clear_user();
	    return;
	}
	localStorage.setItem(this.STORAGE + this.S.USER, body["id"])
	this.set_cookie(this.COOKIE.USER, body["id"]);
	console.log("User created");
	this.login();
    }
    
    async sign_challenge(challenge) {
	const private_key = await this.db_get(this.S.PRIVKEY);
	const signature = await crypto.subtle.sign(this.KEY_ALG, private_key, this.encoder.encode(challenge));
	return this.buf2hex(signature);
    }

    send_login_event() {
	localStorage.setItem(this.STORAGE + this.S.LOGGED_IN, "true");
	document.dispatchEvent(new Event(this.EVENTS.LOGIN));
    }
    send_logout_event() {
	localStorage.setItem(this.STORAGE + this.S.LOGGED_IN, "");
	document.dispatchEvent(new Event(this.EVENTS.LOGOUT));
    }

    safe_css_class_add(el, class_name) {
	if (typeof(el) == "string") {
	    el = document.getElementById(el);
	}
	if (el) {
	    el.classList.add(class_name);
	    return el;
	}
    }
    safe_css_class_remove(el, class_name) {
	if (typeof(el) == "string") {
	    el = document.getElementById(el);
	}
	if (el) {
	    el.classList.remove(class_name);
	    return el;
	}
    }

    async get_user() {
	const user = await this.api_call("?action=retrieve", null);
	if (this.api_error(user, "Error retrieving user data.")) {
	    this.user = null;
	    return;
	}
	this.user = user;
	this.update_ui();
	return this.user;
    }

    async login() {
	if (!localStorage.getItem(this.STORAGE + this.S.HAS_PRIVKEY)) {
	    console.error("Can't login before user has been created.");
	    this.show_error("<p>Can't login before user has been created.</p><p><a href='#' onclick='location.reload()'>Reload if Create Account button is not visible.</a></p>");
	    this.present_ui();
	    return;
	}

	localStorage.setItem(this.STORAGE + this.S.AUTO, "true");

	const user_id = localStorage.getItem(this.STORAGE + this.S.USER);
	
	const challenge_form = new FormData();
	challenge_form.set("user", user_id);
	challenge_form.set("pubkey", localStorage.getItem(this.STORAGE + this.S.PUBKEY));
	const challenge = await this.api_call("?action=challenge", challenge_form, "challenge");
	if (this.api_error(challenge, "Error retrieving challenge, which is required to log in.")) {
	    return;
	}
	const signature = await this.sign_challenge(challenge["challenge"]);
	const signature_form = new FormData();
	signature_form.set("user", localStorage.getItem(this.STORAGE + this.S.USER));
	signature_form.set("pubkey", localStorage.getItem(this.STORAGE + this.S.PUBKEY));
	signature_form.set("signature", signature);
	const token = await this.api_call("?action=token", signature_form, "token");
	if (this.api_error(token, "Failed challenge signing, required to log in.")) {
	    return;
	}
	this.set_cookie(this.COOKIE.USER, user_id);
	this.set_cookie(this.COOKIE.TOKEN, token.token);
	console.log("Token established:", token);
	document.getElementById("hoba").close();
	await this.get_user();
	this.send_login_event();
	postMessage(this.MESSAGES.LOGIN_SUCCESS, "*");

	if (this.url_params.get("redirect")) {
	    location = this.url_params.get("redirect");
	}

	return true;
    }

    logout() {
	this.clear_cookie(this.COOKIE.TOKEN);
	this.user = null;
	localStorage.setItem(this.STORAGE + this.S.AUTO, "false");
	this.close_dialog();
	this.update_ui();
	this.send_logout_event();
    }

    async clear_user() {
	for (let cookie of [this.COOKIE.USER, this.COOKIE.TOKEN]) {
	    this.clear_cookie(cookie);
	}
	for (let field of [this.S.USER, this.S.PUBKEY, this.S.HAS_PRIVKEY, this.S.AUTO]) {
	    localStorage.removeItem(this.STORAGE + field);
	}
	this.db_remove(this.S.PRIVKEY);
    }
    
    async destroy() {
	const confirmation = confirm(`Really destroy credentials?
WARNING: If you do not have another browser logged in, you won't be able to recover this account!`);
	if (!confirmation) {
	    return;
	}
	await this.clear_user();
	this.logout();
    }

    close_dialog() {
	if (this.dialog) {
	    this.dialog.close();

	    document.querySelector("#hoba-share").classList.remove(this.CSS.SHOW);
	    document.getElementById("hoba-share-link").value = "";
	    document.getElementById("hoba-qr").innerHTML = "";
	}
    }
    dialog_closed() {
	if (this.share_code_refresh) {
	    clearInterval(this.share_code_refresh);
	    this.share_code_refresh = null;
	}
	if (document.querySelector("#hoba-share").classList.contains(this.CSS.SHOW)) {
	    this.api_call("?action=clear_share_code", null);
	}
    }

    dialog_click(e) {
	if (e.target.tagName != "DIALOG") {
	    return;
	}
	if (!this.dialog_dismissable) {
	    return;
	}
	
	const rect = e.target.getBoundingClientRect();
	if (e.clientX < rect.left || e.clientX > rect.right
	    || e.clientY < rect.top || e.clientY > rect.bottom) {
	    this.dialog.close();
	}
    }

    present_ui() {
	if (!this.options.is_login_page) {
	    return;
	}
	this.dialog = document.getElementById("hoba");
	if (this.options.unique_ui == "true") {
	    this.dialog_dismissable = false;
	    document.getElementById("hoba-close-button").classList.remove(this.CSS.SHOW);
	}
	if (!this.dialog.open) {
	    this.dialog.showModal();
	}
    }

    friendly_identifier() {
	const identifier = [];
	for (let i = 0; i < 5; i++) {
	    identifier.push(Math.floor(Math.random() * 10));
	}
	return identifier.join("");
    }

    async refresh_share_code() {
	const secret = await this.api_call("?action=refresh_share_code", null, "share_code");
	if (this.api_error(secret, "Error refreshing share code.") || secret.done) {
	    clearInterval(this.share_code_refresh);
	    this.share_code_refresh = null;
	    this.close_dialog();
	    return;
	}
	document.getElementById("hoba-share-code").textContent = secret.share_code;
    }

    ws_url(path) {
	const url = new URL(location);
	url.protocol = "wss:";
	url.pathname = "/ws/hoba/" + path;
	return url;
    }
    
    establish_logged_in_ws() {
	this.ws = new WebSocket(this.ws_url("logged_in.py"));
	this.ws.onmessage = e => this.logged_in_message_pid(e);
    }
    
    async generate_share() {
	document.querySelector("#hoba-share").classList.add(this.CSS.SHOW);
	
	this.establish_logged_in_ws();
    }

    async logged_in_message_pid(e) {
	console.log(e);
	const secret = JSON.parse(e.data);
	document.getElementById("hoba-identifier-code").textContent = this.description;
	document.getElementById("hoba-share-code").textContent = secret.share_code;
	this.share_code_refresh = setInterval(() => this.refresh_share_code(), 30 * 1000);
/*	const field = document.getElementById("hoba-share-link");
	const url = new URL(this.options.api, location);
	const params = new URLSearchParams();
	params.set("action", "confirm_bind");
	params.set("user", this.get_cookie(this.COOKIE.USER));
	params.set("redirect", location);
	params.set("original_identifier", this.description);
	const secret = await this.api_call("?action=browser_secret", null, "secret");
	if (this.api_error(secret, "Error generating secret.")) {
	    return;
	}
	params.set("secret", secret.secret);
	url.search = params;
	field.value = url;
	
	const qr = qrcode(0, "L");
	qr.addData(url.toString());
	qr.make();
	document.getElementById("hoba-qr").innerHTML = qr.createImgTag(5);
*/
    }

    async grant_new() {
	let new_user_data = {};
	if ("newUser" in this.controls.dataset) {
	    new_user_data = window[this.controls.dataset.newUser]();
	    if (new_user_data == null) {
		return;
	    }
	} else {
	    return;
	}

	document.querySelector("#hoba-share").classList.add(this.CSS.SHOW);
	
	const field = document.getElementById("hoba-share-link");
	const url = new URL(this.options.api, location);
	const params = new URLSearchParams();
	params.set("action", "confirm_bind");
	params.set("redirect", location);
	params.set("original_identifier", new_user_data.description);

	const body = new FormData();
	body.set("data", JSON.stringify(new_user_data.data));
	const new_user = await this.api_call("?action=new_empty_account", body, "secret");
	if (this.api_error(new_user, "Error generating secret.")) {
	    return;
	}
	params.set("user", new_user.user);
	params.set("secret", new_user.secret);
	url.search = params;
	field.value = url;

	document.getElementById("hoba-identifier-code").textContent = new_user_data.description;

	const qr = qrcode(0, "L");
	qr.addData(url.toString());
	qr.make();
	document.getElementById("hoba-qr").innerHTML = qr.createImgTag(5);
    }

    copy_link() {
	navigator.clipboard.writeText(document.getElementById("hoba-share-link").value);
	const copy_button = document.getElementById("hoba-copy-button");
	copy_button.disabled = true;
	const original_text = copy_button.textContent;
	copy_button.textContent = "Copied";
	setTimeout(() => {
	    copy_button.textContent = original_text;
	    copy_button.disabled = false;
	}, 1000);
    }

    share_link() {
	if ("share" in navigator) {
	    navigator.share({url: document.getElementById("hoba-share-link").value});
	} else {
	    this.copy_link();
	}
    }

    async enter_share_code(e) {
	if (!(e.target.value >= 1e5 && e.target.value <= 1e6)) {
	    return;
	}
	const form = new FormData();
	form.set("share_code", e.target.value);
	const secret = await this.api_call("?action=share_code_request", form);
	if (secret.error) {
	    e.target.value = "";
	    alert("Code failed. Try again. They expire in 30 seconds.");
	    return;
	}
	this.url_params.set("user", secret.user);
	this.url_params.set("secret", secret.secret);
	await this.bind();
    }
    
    manage() {
	if (!this.user) {
	    this.present_ui();
	    return;
	}
	if ("manageSetup" in this.controls.dataset) {
	    window[this.controls.dataset.manageSetup]();
	}
	this.dialog = document.getElementById("hoba");
	this.dialog.showModal();
    }

    visit_login(force) {
    	const r = new URL(location);
	r.pathname = this.options.login_uri;

	if (!force && this.options.login_iframe) {
	    const iframe = document.createElement("iframe");
	    iframe.src = r;
	    iframe.style.display = "none";
	    iframe.setAttribute("scrolling", "no");
	    iframe.style.width = "1px";
	    iframe.style.height = "1px";
	    document.body.appendChild(iframe);
	    return;
	}
	
	r.searchParams.set("redirect", location);
	location = r;
    }
    
    async auto_login() {
	if (!localStorage.getItem(this.STORAGE + this.S.HAS_PRIVKEY)
	    || localStorage.getItem(this.STORAGE + this.S.AUTO) == "false") {
	    this.present_ui();
	    return;
	}

	if (!this.options.is_login_page) {
	    if (!this.get_cookie(this.COOKIE.TOKEN)) {
		this.visit_login();
		return;
	    }
	    this.send_login_event();
	    return;
	}
	
	await this.get_user();
	if (this.user) {
	    this.send_login_event();
	} else {
	    if (!await this.login()) {
		this.present_ui();
	    }
	}
    }

    on_login_callback(e, callback) {
	if (e.key == this.STORAGE + this.S.LOGGED_IN && e.newValue) {
	    callback();
	}
    }

    // To be called during init phase of non-login pages
    on_login(callback) {
	addEventListener("storage", e => this.on_login_callback(e, callback));
	if (localStorage.getItem(this.STORAGE + this.S.LOGGED_IN)) {
	    callback();
	}
    }

    // To be called on API responses from non-login pages
    check_user(response) {
	if (response.startsWith(this.options.failed_msg)) {
	    const redirect = confirm("Not logged in. Press OK to go to login page, or Cancel to remain here.");
	    if (redirect) {
		this.visit_login(true);
	    }
	    return null;
	}
	return true;
    }
};

const HOBA = new Hoba();
