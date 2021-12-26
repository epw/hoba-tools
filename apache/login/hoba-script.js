const STORAGE = ".hoba.";
const S = {
    UUID: "uuid",
    PRIVKEY: "priv_key",
    PUBKEY: "pub_key"
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

async function get_pem(public_key) {
    const keydata = await crypto.subtle.exportKey("spki", public_key);
    const body = btoa(String.fromCharCode(...new Uint8Array(keydata)));
    return "-----BEGIN PUBLIC KEY-----\r\n" + body.match(/.{1,64}/g).join("\r\n") + "\r\n-----END PUBLIC KEY-----";
};

async function login() {
    console.error("Unimplemented");
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
    const res = await fetch("/hoba.cgi?action=create", {
	method: "POST",
	body: form
    });
    if (res.status != 200) {
	console.error("Error " + res.status);
	console.error(await res.text());
    }
    const body = await res.json();
    if (body != true) {
	console.error("Error " + res.status);
	console.error(body);
    }
    console.log("User created");
//    init();
}

function buf2hex(buf) {
  return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
}

async function sign_challenge(keydata) {
    console.log("signing challenge");
    const private_key = await crypto.subtle.importKey(
	PRIV_KEY_EXPORT_FORMAT,
	keydata,
	KEY_ALG,
	true,
	["sign"]);
    const form = new FormData();
    form.set("pubkey", localStorage.getItem(STORAGE + S.PUBKEY));
    const res = await fetch("/hoba.cgi?action=challenge", {
	method: "POST",
	body: form
    });
    if (res.status != 200) {
	console.error("Challenge acquisition error " + res.status);
	console.error(await res.text());
	return;
    }
    const challenge = await res.json();
    let signature = await crypto.subtle.sign(KEY_ALG, private_key, encoder.encode(challenge.value));
    signature = buf2hex(signature);
    form.set("signature", signature);
    const token_res = await fetch("/hoba.cgi?action=token", {
	method: "POST",
	body: form
    });
    if (token_res.status != 200) {
	console.error("Token acquisition error " + token_res.status);
	console.error(await res.text());
    }
    const token_json = await token_res.json();
    document.getElementById("pubkey").value = localStorage.getItem(STORAGE + S.PUBKEY);
    document.getElementById("token").value = token_json.token;
    console.log("Token saved:", token_json.token);
    //document.getElementById("login").submit();
}


function init() {
    const stored_privkey = localStorage.getItem(STORAGE + S.PRIVKEY);
    if (stored_privkey) {
	sign_challenge(new Uint8Array(stored_privkey.split(",")));
    } else {
	document.getElementById("create").classList.add("visible");
    }
}

init();
