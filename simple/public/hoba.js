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

<dialog id="hoba" onclick="HOBA.dialog_click(event)">
 <div id="hoba-bind" class="hoba-ui-row">
   <div class="hoba-identifier">
    <div id="hoba-identifier-code-binding"></div>
   </div>
   <p>
    <button type="button" onclick="HOBA.bind()">Bind account to this browser</button>
   </p>
   <p>
    <a id="hoba-new-account-page" href="index.html">New account page</a>
   </p>
 </div>
 <div id="hoba-share">
  <div class="hoba-identifier">
    <div id="hoba-identifier-code"></div>
  </div>
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
   To log in on a new device, open this URL on a device with an existing login, click the "Link to Log In Elsewhere" button, and scan the QR code or visit the provided URL.
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
	
	// Events other scripts can listen for on <body>
	this.EVENTS = {
	    LOGIN: "LOGIN",
	    LOGOUT: "LOGOUT",
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
	if (typeof(this.options.api) != "string") {
	    console.error("No HOBA API URL provided. It must be provided with a tag: <meta name='hoba:api' content='URL'>");
	}

	this.controls = document.getElementById("hoba-controls");
	if (this.controls) {
	    this.controls.innerHTML = HOBA_CONTROLS;
	} else {
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
		if (this.user[".acl_create_account"]) {
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
	this.get_params();
	this.attach_ui();
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
	document.getElementById("hoba-error-message").innerHTML = "";
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
	document.dispatchEvent(new Event(this.EVENTS.LOGIN));
    }
    send_logout_event() {
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
    
    async generate_share() {
	document.querySelector("#hoba-share").classList.add(this.CSS.SHOW);
	
	const field = document.getElementById("hoba-share-link");
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

	document.getElementById("hoba-identifier-code").textContent = this.description;

	const qr = qrcode(0, "L");
	qr.addData(url.toString());
	qr.make();
	document.getElementById("hoba-qr").innerHTML = qr.createImgTag(5);
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
    
    async auto_login() {
	if (!localStorage.getItem(this.STORAGE + this.S.HAS_PRIVKEY)
	    || localStorage.getItem(this.STORAGE + this.S.AUTO) == "false") {
	    this.present_ui();
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
};

const HOBA = new Hoba();
