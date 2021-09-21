const STORAGE = ".hoba.";
const S = {
    UUID: "uuid",
    PRIVKEY: "priv_key"
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


async function login() {
    console.error("Unimplemented");
}

async function create_user() {
    const keypair = await crypto.subtle.generateKey(KEY_ALG, true, ["sign", "verify"]);
    const private_key = await crypto.subtle.exportKey("pkcs8", keypair.privateKey);
    const priv_buf = new Uint8Array(private_key);
    localStorage.setItem(STORAGE + S.PRIVKEY, priv_buf);

    const public_key = await crypto.subtle.exportKey("spki", keypair.publicKey);
    const pub_buf = new Uint8Array(public_key);
    console.log(pub_buf);
    const form = new FormData();
    form.set("pubkey", pub_buf);
    const res = await fetch("/hoba.cgi?create=1", {
	method: "POST",
	body: form
    });
    const body = await res.text();
    if (res.status != 200 || body.trim() != "OK") {
	console.error("Error " + res.status);
	console.error(body);
    }
//    init();
}

function init() {
    const uuid = localStorage.getItem(STORAGE + S.UUID);
    if (uuid) {
	document.getElementById("username").value = uuid;
	document.getElementById("login").submit();
    } else {
	document.getElementById("create").classList.add("visible");
    }
}

//init();

