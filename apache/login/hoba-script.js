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
    return "-----BEGIN PUBLIC KEY-----\n" + body.match(/.{1,64}/g).join("\n") + "\n-----END PUBLIC KEY-----";
};

async function login() {
    console.error("Unimplemented");
}

async function create_user() {
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
//    init();
}

async function sign_challenge(keydata) {
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
    const signature = await crypto.subtle.sign(KEY_ALG, private_key, new Uint8Array(challenge.value));
    form.set("signature", encoder.encode(signature));
    const token_res = await fetch("/hoba.cgi?action=token", {
	method: "POST",
	body: form
    });
    console.log("token", await token_res.text());
    if (token_res.status != 200) {
	console.error("Token acquisition error " + token_res.status);
	console.error(await res.text());
    }
    document.getElementById("token").value = (await token_res.json()).value;
//    document.getElementById("login").submit();
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
