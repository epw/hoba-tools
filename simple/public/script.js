const STORAGE = ".hoba.";
const S = {
    UUID: "uuid",
    PRIVKEY: "priv_key",
    PUBKEY: "pub_key",
    USER: "user"
}

const KEY_ALG = {
    name: "RSASSA-PKCS1-v1_5",
    hash: {
	name: "SHA-256",
	classicname: "sha256",
    },
    modulusLength: 1024,
    extractable: true,
    publicExponent: new Uint8Array([1, 0, 1]),
};
const PRIV_KEY_EXPORT_FORMAT = "pkcs8";

const encoding = "UTF-8";
const decoder = new TextDecoder(encoding);
const encoder = new TextEncoder(encoding);

function get_cookies() {
    const cookies = {};
    for (let cookie of document.cookie.split(";")) {
	const parts = cookie.split("=");
	cookies[parts[0]] = parts[1];
    }
    return cookies;
}

function get_cookie(name) {
    for (let cookie of document.cookie.split(";")) {
	if (cookie.trim().startsWith(name + "=")) {
	    return cookie.split("=")[1];
	}
    }
}
function set_cookie(name, value) {
    document.cookie = name + "=" + value;
}

async function get_pem(public_key) {
    const keydata = await crypto.subtle.exportKey("spki", public_key);
    const body = btoa(String.fromCharCode(...new Uint8Array(keydata)));
    return "-----BEGIN PUBLIC KEY-----\r\n" + body.match(/.{1,64}/g).join("\r\n") + "\r\n-----END PUBLIC KEY-----";
};

async function api_call(url, form, confirmation) {
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

async function create_user() {
    console.log("Creating user");
    const keypair = await crypto.subtle.generateKey(KEY_ALG, true, ["sign", "verify"]);
    const private_key = await crypto.subtle.exportKey(PRIV_KEY_EXPORT_FORMAT, keypair.privateKey);
    const priv_buf = new Uint8Array(private_key);
    localStorage.setItem(STORAGE + S.PRIVKEY, priv_buf);

    const public_key = await get_pem(keypair.publicKey);
    localStorage.setItem(STORAGE + S.PUBKEY, public_key);
    const form = new FormData();
    form.set("pubkey", public_key);
    const body = await api_call("hoba.cgi?action=create", form, "id");
    localStorage.setItem(STORAGE + S.USER, body["id"])
    set_cookie("user", body["id"]);
    console.log("User created");
}

function buf2hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
}

async function sign_challenge(challenge) {
    const private_key = await crypto.subtle.importKey(
	PRIV_KEY_EXPORT_FORMAT,
	new Uint8Array(localStorage.getItem(STORAGE + S.PRIVKEY).split(",")),
	KEY_ALG,
	true,
	["sign"]);
    const signature = await crypto.subtle.sign(KEY_ALG, private_key, encoder.encode(challenge));
    return buf2hex(signature);
}

async function login() {
    const user_id = localStorage.getItem(STORAGE + S.USER);
    
    const challenge_form = new FormData();
    challenge_form.set("user", user_id);
    const challenge = await api_call("hoba.cgi?action=challenge", challenge_form, "challenge");
    const signature = await sign_challenge(challenge["challenge"]);

    const signature_form = new FormData();
    signature_form.set("user", localStorage.getItem(STORAGE + S.USER));
    signature_form.set("signature", signature);
    const token = await api_call("hoba.cgi?action=token", signature_form, "token");
    set_cookie("user", user_id);
    set_cookie("token", token.token);
    console.log("Token established.");
}

function auto_login() {
    if (localStorage.getItem(STORAGE + S.PRIVKEY)) {
	login();
    }
}

function create() {
    create_user();
}

function init() {
    auto_login();
}
init();
