// While this is outside of the HOBA namespace, it's a lot more convenient to have
// the template HTML at the top of the file.
const HOBA_UI = `
<dialog id="hoba">
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
`;

// Class is used to create a namespace but keep all the functions available.
class Hoba {
    // Constructor sets constants, and attaches dialog element to document.
    constructor() {
	// Give localStorage its own "namespace" to stay separate from other scripts on the same server.
	this.STORAGE = ".hoba.";
	// Assign constants so keys can be program-recognized, not just strings
	this.S = {
	    UUID: "uuid",
	    PRIVKEY: "priv_key",
	    PUBKEY: "pub_key",
	    USER: "user",
	    AUTO: "auto",
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
	if (!(confirmation in body)) {
	    console.error("Error " + res.status);
	    console.error(body);
	    return null;
	}
	return body;
    }

    // PRIMARY USER MANAGEMENT

    async create() {
	console.log("Creating user");
	const keypair = await crypto.subtle.generateKey(this.KEY_ALG, true, ["sign", "verify"]);
	const private_key = await crypto.subtle.exportKey(this.PRIV_KEY_EXPORT_FORMAT, keypair.privateKey);
	const priv_buf = new Uint8Array(private_key);
	localStorage.setItem(this.STORAGE + this.S.PRIVKEY, priv_buf);

	const public_key = await this.get_pem(keypair.publicKey);
	localStorage.setItem(this.STORAGE + this.S.PUBKEY, public_key);
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

    async login() {
	if (!localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    console.error("Can't login before user has been created.");
	    return;
	}

	localStorage.setItem(this.STORAGE + this.S.AUTO, "true");

	const user_id = localStorage.getItem(this.STORAGE + this.S.USER);
	
	const challenge_form = new FormData();
	challenge_form.set("user", user_id);
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
	console.log("Token established.");
	document.getElementById("hoba").close();
	return true;
    }

    logout() {
	this.clear_cookie("token");
	localStorage.setItem(this.STORAGE + this.S.AUTO, "false");
    }

    present_ui() {
	document.getElementById("hoba").showModal();
    }
    
    async auto_login() {
	if (localStorage.getItem(this.STORAGE + this.S.AUTO) == "false") {
	    this.present_ui();
	    return;
	}
	if (localStorage.getItem(this.STORAGE + this.S.PRIVKEY)) {
	    if (!await this.login()) {
		this.present_ui();
	    }
	}
    }

    // Standard interface for scripts wanting to hook into authentication.
    
    get_user() {
	return this.api_call("hoba.cgi?action=retrieve", null, "pubkey");
    }
};

const HOBA = new Hoba();