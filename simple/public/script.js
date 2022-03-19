async function change_name() {
    const name = prompt("What do you want your new name to be?", document.getElementById("user").textContent);
    if (name == null) {
	return;
    }
    const form = new FormData();
    form.set("name", name);
    const new_name = await HOBA.api_call("app.cgi", form, "name");
    document.getElementById("user").textContent = new_name.name;
}

function logout() {
    document.getElementById("user").textContent = "";
    HOBA.present_ui();
}

async function app() {
    if (HOBA.user != null) {
	document.getElementById("user").textContent = HOBA.user.name;
    }
}

function init() {
    document.addEventListener(HOBA.EVENTS.LOGIN, app);
    document.addEventListener(HOBA.EVENTS.LOGOUT, logout);
}
init();
