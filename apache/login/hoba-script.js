const STORAGE = ".hoba.";
const S = {
    UUID: "uuid"
}

async function login() {
    console.error("Unimplemented");
}

async function create_user() {
    const res = await fetch("/hoba.cgi?create=1", {
	method: "POST",
    });
    const uuid = (await res.text()).trim();
    localStorage.setItem(STORAGE + S.UUID, uuid);
    init();
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

init();
