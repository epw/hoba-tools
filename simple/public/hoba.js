// While this is outside of the HOBA namespace, it's a lot more convenient to have
// the template HTML at the top of the file.
const HOBA_UI = `
<style>
#hoba .hoba-bind {
}
</style>

<dialog id="hoba">
 <p class="hoba-bind">
   <button type="button" onclick="HOBA.bind()">Bind account to this browser</button>
 </p>
 <p>
  <button type="button" onclick="HOBA.create()">Create Account</button>
 </p>
 <p>
  <button type="button" onclick="HOBA.login()">Login</button>
 </p>
 <p>
  <button type="button" onclick="HOBA.logout()">Logout</button>
 </p>
</dialog>

<dialog id="hoba-manage">
 <p>
  <p>
   <button type="button" onclick="HOBA.generate_share()">Link to Log In Elsewhere</button>
  </p>
  <p>
    <a id="hoba-share-link"></a>
  </p>
 </p>
 <p>
  <button type="button" onclick="HOBA.logout()">Logout</button>
 </p>
</dialog>
`;

// Class is used to create a namespace but keep all the functions available.
class Hoba {
    // Constructor sets constants, and attaches dialog element to document.
    constructor() {
	this.user = null;

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
	document.body.insertAdjacentHTML("beforeend", HOBA_UI);
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

    async get_user() {
	this.user = await this.api_call("hoba.cgi?action=retrieve", null);
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
	return true;
    }

    logout() {
	this.clear_cookie("token");
	localStorage.setItem(this.STORAGE + this.S.AUTO, "false");
	this.send_logout_event();
    }

    present_ui() {
	document.getElementById("hoba").showModal();
    }

    async generate_share() {
	const a = document.getElementById("hoba-share-link");
	const url = new URL("hoba.cgi", location);
	const params = new URLSearchParams();
	params.set("action", "bind");
	params.set("user", this.get_cookie("user"));
	const secret = await this.api_call("hoba.cgi?action=browser_secret", null, "secret");
	params.set("secret", secret.secret);
	url.search = params;
	a.href = url;
	a.textContent = url;
    }
    
    manage() {
	document.getElementById("hoba-manage").showModal();
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
