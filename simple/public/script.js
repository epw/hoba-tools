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

async function app() {
    const user = await HOBA.get_user();
    if (user) {
	document.getElementById("user").textContent = user.name;
    }
}

function init() {
    app();
}
init();
