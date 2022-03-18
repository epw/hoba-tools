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
    const res = await fetch("hoba.cgi?action=create", {
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
    init();
}

function create() {
    create_user();
}

function init() {
}
init();
