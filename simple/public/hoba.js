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
 <div id="hoba-sharing" class="hoba-ui-row">
  <p>
   <button type="button" onclick="HOBA.generate_share()">Link to Log In Elsewhere</button>
  </p>
  <div id="hoba-share">
   <div class="hoba-identifier">
     <div id="hoba-identifier-code"></div>
   </div>
   <div><div id="hoba-qr"></div></div>
   <div><span>Link to share:</span> <input type="text" id="hoba-share-link" readonly>
        <button type="button" id="hoba-copy-button" onclick="HOBA.copy_link()">Copy</button></div>
   <div><button type="button" onclick="HOBA.share_link()">Share</button></div>
  </div>
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

	// Author-provided configuration
	this.options = {};
	this.controls = null;

	this.url_params = new URLSearchParams(location.search);

	this.CSS = {
	    SHOW: "hoba-show",
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

	if (this.url_params.get("secret")) {
	    document.getElementById("hoba-identifier-code-binding").textContent = this.url_params.get("original_identifier");
	}

	const options = document.getElementById("hoba-options");
	if (options) {
	    this.options = options.dataset;
	}

	this.controls = document.getElementById("hoba-controls");
	if (this.controls) {
	    this.controls.innerHTML = HOBA_CONTROLS;
	} else {
	    console.warn("No #hoba-controls element found, make sure you've provided a custom way for the user to manage their account.");
	}

	this.update_ui();
    }

    update_ui() {
	Array.from(document.querySelectorAll(".hoba-ui-row, .hoba-immediate-button")).map(el => el.classList.remove(this.CSS.SHOW));
	let ids_to_show = [];
	if (this.url_params.get("secret")) {
	    ids_to_show = ["hoba-bind"];
	} else if (localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    if (this.user) {
		ids_to_show = ["hoba-manage-button", "hoba-logout", "hoba-logout-immediate", "hoba-destroy",
			       "hoba-sharing"];
	    } else {
		ids_to_show = ["hoba-login", "hoba-login-immediate"];
	    }
	} else {
	    ids_to_show = ["hoba-create", "hoba-create-immediate"];
	}
	ids_to_show.map(id => this.safe_css_class_add(id, this.CSS.SHOW));
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

    show_error(msg) {
	document.getElementById("hoba-error-message").innerHTML = msg;
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
	    return {"error": "Code " + res.status,
		    "status": res.status};
	}
	const body = await res.json();
	if (confirmation && !(confirmation in body)) {
	    console.error("Error " + res.status);
	    console.error(body);
	    return {"error": body};
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
	if ("error" in body) {
	    console.error("Failed to create new user.");
	    let err = "<p>Failed to create new user.";
	    if ("status" in body) {
		err += " Code: " + body.status;
	    }
	    err += "</p>";
	    this.show_error(err);
	    this.clear_user();
	    return;
	}
	localStorage.setItem(this.STORAGE + this.S.USER, body["id"])
	this.set_cookie("user", body["id"]);
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
	this.user = await this.api_call("hoba.cgi?action=retrieve", null);
	this.update_ui();
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
	this.send_login_event();

	if (this.url_params.get("redirect")) {
	    location = this.url_params.get("redirect");
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

    clear_user() {
	for (let cookie of ["token", "user"]) {
	    this.clear_cookie(cookie);
	}
	for (let field of [this.S.USER, this.S.PUBKEY, this.S.PRIVKEY, this.S.AUTO]) {
	    localStorage.removeItem(this.STORAGE + field);
	}
    }
    
    async destroy() {
	const confirmation = confirm(`Really destroy credentials?
WARNING: If you do not have another browser logged in, you won't be able to recover this account!`);
	if (!confirmation) {
	    return;
	}
	this.logout();
	this.clear_user();
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
	if (this.options.uniqueUi == "true") {
	    this.dialog_dismissable = false;
	    document.getElementById("hoba-close-button").classList.remove(this.CSS.SHOW);
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
	document.querySelector("#hoba-share").classList.add(this.CSS.SHOW);
	
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
	this.dialog = document.getElementById("hoba");
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
