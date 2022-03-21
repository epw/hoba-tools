// Template HTML is at the top of the file, even though that means it's outside of the HOBA.* namespace
const HOBA_UI = `
<style>
#hoba .hoba-bind {
  display: none;
}
.hoba-hide {
 display: none;
}
#hoba .hoba-bind.hoba-show {
  display: unset;
}
#hoba-create, #hoba-login, #hoba-logout {
  display: none;
}
#hoba-create.hoba-show, #hoba-login.hoba-show, #hoba-logout.hoba-show {
  display: unset;
}
#hoba-sharing {
  display: none;
}
#hoba-sharing.hoba-show {
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
#hoba-manage .hoba-destroy {
  color: red;
}
</style>

<dialog id="hoba" onclick="HOBA.dialog_click(event)">
 <div class="hoba-bind">
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
 <div id="hoba-create" class="hoba-show">
  <p>
   <button type="button" onclick="HOBA.create()">Create Account</button>
  </p>
 </div>
 <div id="hoba-login">
  <p>
   <button type="button" onclick="HOBA.login()">Login</button>
  </p>
 </div>
 <div id="hoba-logout">
  <p>
   <button type="button" onclick="HOBA.logout()">Logout</button>
  </p>
 </div>
 <div id="hoba-close-button">
  <p>
   <button type="button" onclick="HOBA.close_dialog()">Close</button>
  </p>
 </div>
</dialog>

<dialog id="hoba-manage" onclick="HOBA.dialog_click(event)">
 <p>
  <p>
   <button type="button" onclick="HOBA.generate_share()">Link to Log In Elsewhere</button>
  </p>
  <div id="hoba-sharing">
   <div class="hoba-identifier">
     <div id="hoba-identifier-code"></div>
   </div>
   <div><div id="hoba-qr"></div></div>
   <div><span>Link to share:</span> <input type="text" id="hoba-share-link" readonly>
        <button type="button" id="hoba-copy-button" onclick="HOBA.copy_link()">Copy</button></div>
   <div><button type="button" onclick="HOBA.share_link()">Share</button></div>
  </div>
 </p>
 <p>
  <button type="button" onclick="HOBA.logout()">Logout</button>
 </p>
 <p>
  <button type="button" class="hoba-destroy" onclick="HOBA.destroy()">Destroy credentials</button>
 </p>
 <p>
  <button type="button" onclick="HOBA.close_dialog()">Close</button>
 </p>
</dialog>
`;

const HOBA_CONTROLS_CREATE = `
<button type="button" onclick="HOBA.create()">Create Account</button>
`;
const HOBA_CONTROLS_MANAGE = `
<button type="button" id="hoba-manage-button" onclick="HOBA.manage()">Manage Accounts</button>
<button type="button" id="hoba-login-immediate" class="hoba-hide" onclick="HOBA.login()">Login</button>
<button type="button" id="hoba-logout-immediate" class="hoba-hide" onclick="HOBA.logout()">Logout</button>
`;

// Class is used to create a namespace but keep all the functions available.
class Hoba {
    // Constructor sets constants, and attaches dialog element to document.
    constructor() {
	this.user = null;

	this.description = null;
	this.dialog_dismissable = true;
	this.dialog = null;

	// Author-provided configuration
	this.options = {};
	this.controls = null;

	this.CSS = {
	    SHOW: "hoba-show",
	    HIDE: "hoba-hide",
	};

	// Give localStorage its own "namespace" to stay separate from other scripts on the same server.
	this.STORAGE = ".hoba.";
	// Assign constants so keys can be program-recognized, not just strings
	this.S = {
	    PRIVKEY: "priv_key",
	    PUBKEY: "pub_key",
	    USER: "user",
	    AUTO: "auto",
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

    attach_ui() {
	const script = document.createElement("script");
	script.setAttribute("async", "async");
	script.setAttribute("defer", "defer");
	script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
	document.body.append(script);

	document.body.insertAdjacentHTML("beforeend", HOBA_UI);
	const url_params = new URLSearchParams(location.search);
	if (url_params.get("secret")) {
	    document.querySelector("#hoba .hoba-bind").classList.add(this.CSS.SHOW);
	    document.querySelector("#hoba-create").classList.remove(this.CSS.SHOW);
	    document.getElementById("hoba-identifier-code-binding").textContent = url_params.get("original_identifier");
	}

	const options = document.getElementById("hoba-options");
	if (options) {
	    this.options = options.dataset;
	}
	this.controls = document.getElementById("hoba-controls");

	if (!this.controls) {
	    console.warn("No #hoba-controls element found, make sure you've provided a custom way for the user to manage their account.");
	    return;
	}
	if (localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    this.controls.innerHTML = HOBA_CONTROLS_MANAGE;
	    document.getElementById("hoba-login-immediate").classList.remove(this.CSS.HIDE);
	} else {
	    this.controls.innerHTML = HOBA_CONTROLS_CREATE;
	}
    }
    
    loaded() {
	this.attach_ui();
	this.auto_login();
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
	document.cookie = name + "=" + value;
    }
    clear_cookie(name) {
	document.cookie = name + "=; Max-Age=0"
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

    // Convenience wrapper for AJAX call
    async api_call(url, form, confirmation) {
	const res = await fetch(url, {
	    method: "POST",
	    body: form
	});
	if (res.status != 200) {
	    console.error("Error " + res.status);
	    console.error(await res.text());
	    return null;
	}
	const body = await res.json();
	if (confirmation && !(confirmation in body)) {
	    console.error("Error " + res.status);
	    console.error(body);
	    return null;
	}
	return body;
    }

    // PRIMARY USER MANAGEMENT

    // Helper function used to actually generate keypair, used in both create() and bind(),
    // for new and preexisting accounts respectively.
    async new_keypair() {
	const keypair = await crypto.subtle.generateKey(this.KEY_ALG, true, ["sign", "verify"]);
	const private_key = await crypto.subtle.exportKey(this.PRIV_KEY_EXPORT_FORMAT, keypair.privateKey);
	const priv_buf = new Uint8Array(private_key);
	localStorage.setItem(this.STORAGE + this.S.PRIVKEY, priv_buf);

	const public_key = await this.get_pem(keypair.publicKey);
	localStorage.setItem(this.STORAGE + this.S.PUBKEY, public_key);

	return public_key;
    }
    
    async create() {
	console.log("Creating user");
	const public_key = await this.new_keypair();
	const form = new FormData();
	form.set("pubkey", public_key);
	const body = await this.api_call("hoba.cgi?action=create", form, "id");
	if (!body) {
	    console.error("Failed to create new user.");
	    return;
	}
	localStorage.setItem(this.STORAGE + this.S.USER, body["id"])
	this.set_cookie("user", body["id"]);
	console.log("User created");
	document.getElementById("hoba-create").classList.remove(this.CSS.SHOW);
	document.getElementById("hoba-login").classList.add(this.CSS.SHOW);
	this.login();
    }

    async bind() {
	console.log("Binding to existing user");
	const public_key = await this.new_keypair();

	const url_params = new URLSearchParams(location.search);

	const form = new FormData();
	form.set("pubkey", public_key);
	form.set("user", url_params.get("user"));
	form.set("secret", url_params.get("secret"));
	const body = await this.api_call("hoba.cgi?action=bind", form, "id");
	if (!body) {
	    console.error("Failed to bind to existing user.");
	    return;
	}
	localStorage.setItem(this.STORAGE + this.S.USER, body["id"])
	this.set_cookie("user", body["id"]);
	console.log("User created");
	this.login();
    }
    
    async sign_challenge(challenge) {
	const private_key = await crypto.subtle.importKey(
	    this.PRIV_KEY_EXPORT_FORMAT,
	    new Uint8Array(localStorage.getItem(this.STORAGE + this.S.PRIVKEY).split(",")),
	    this.KEY_ALG,
	    true,
	    ["sign"]);
	const signature = await crypto.subtle.sign(this.KEY_ALG, private_key, this.encoder.encode(challenge));
	return this.buf2hex(signature);
    }

    send_login_event() {
	document.dispatchEvent(new Event(this.EVENTS.LOGIN));
    }
    send_logout_event() {
	document.dispatchEvent(new Event(this.EVENTS.LOGOUT));
    }

    css_class_add(el, class_name) {
	if (typeof(el) == "string") {
	    el = document.getElementById(el);
	}
	if (el) {
	    el.classList.add(class_name);
	    return el;
	}
    }
    css_class_remove(el, class_name) {
	if (typeof(el) == "string") {
	    el = document.getElementById(el);
	}
	if (el) {
	    el.classList.remove(class_name);
	    return el;
	}
    }

    async get_user() {
	this.user = await this.api_call("hoba.cgi?action=retrieve", null);
	if (this.controls) {
	    this.controls.innerHTML = HOBA_CONTROLS_MANAGE;
	}
	this.css_class_add("hoba-login-immediate", this.CSS.HIDE);
	this.css_class_remove("hoba-logout-immediate", this.CSS.HIDE);
	return this.user;
    }

    async login() {
	if (!localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    console.error("Can't login before user has been created.");
	    return;
	}

	localStorage.setItem(this.STORAGE + this.S.AUTO, "true");

	const user_id = localStorage.getItem(this.STORAGE + this.S.USER);
	
	const challenge_form = new FormData();
	challenge_form.set("user", user_id);
	challenge_form.set("pubkey", localStorage.getItem(this.STORAGE + this.S.PUBKEY));
	const challenge = await this.api_call("hoba.cgi?action=challenge", challenge_form, "challenge");
	const signature = await this.sign_challenge(challenge["challenge"]);
	const signature_form = new FormData();
	signature_form.set("user", localStorage.getItem(this.STORAGE + this.S.USER));
	signature_form.set("pubkey", localStorage.getItem(this.STORAGE + this.S.PUBKEY));
	signature_form.set("signature", signature);
	const token = await this.api_call("hoba.cgi?action=token", signature_form, "token");
	if (!token) {
	    console.error("Failed to log in.");
	    return false;
	}
	this.set_cookie("user", user_id);
	this.set_cookie("token", token.token);
	console.log("Token established:", token);
	document.getElementById("hoba").close();
	await this.get_user();
	document.getElementById("hoba-login").classList.remove(this.CSS.SHOW);
	document.getElementById("hoba-logout").classList.add(this.CSS.SHOW);
	this.send_login_event();

	const url_params = new URLSearchParams(location.search);
	if (url_params.get("redirect")) {
	    location = url_params.get("redirect");
	}

	return true;
    }

    logout() {
	this.clear_cookie("token");
	localStorage.setItem(this.STORAGE + this.S.AUTO, "false");
	this.close_dialog();
	this.send_logout_event();
	location.reload();
    }

    async destroy() {
	const confirmation = confirm(`Really destroy credentials?
WARNING: If you do not have another browser logged in, you won't be able to recover this account!`);
	if (!confirmation) {
	    return;
	}
	this.logout();
	for (let cookie of ["token", "user"]) {
	    this.clear_cookie(cookie);
	}
	for (let field of [this.S.USER, this.S.PUBKEY, this.S.PRIVKEY, this.S.AUTO]) {
	    console.log(this.STORAGE + field);
	    localStorage.removeItem(this.STORAGE + field);
	}
    }

    close_dialog() {
	if (this.dialog) {
	    this.dialog.close();
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
	if (this.options.uniqueUi == "true") {
	    this.dialog_dismissable = false;
	    document.getElementById("hoba-close-button").style.display = "none";
	}
	if (localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    document.getElementById("hoba-create").classList.remove(this.CSS.SHOW);
	    document.getElementById("hoba-login").classList.add(this.CSS.SHOW);
	}
	this.dialog.showModal();
    }

    friendly_identifier() {
	const identifier = [];
	for (let i = 0; i < 5; i++) {
	    identifier.push(Math.floor(Math.random() * 10));
	}
	return identifier.join("");
    }
    
    async generate_share() {
	document.querySelector("#hoba-sharing").classList.add(this.CSS.SHOW);
	
	const field = document.getElementById("hoba-share-link");
	const url = new URL("hoba.cgi", location);
	const params = new URLSearchParams();
	params.set("action", "confirm_bind");
	params.set("user", this.get_cookie("user"));
	params.set("redirect", location);
	params.set("original_identifier", this.description);
	const secret = await this.api_call("hoba.cgi?action=browser_secret", null, "secret");
	params.set("secret", secret.secret);
	url.search = params;
	field.value = url;

	document.getElementById("hoba-identifier-code").textContent = this.description;

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
	this.dialog = document.getElementById("hoba-manage");
	this.dialog.showModal();
    }
    
    async auto_login() {
	if (!localStorage.getItem(this.STORAGE + this.S.PRIVKEY)
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
