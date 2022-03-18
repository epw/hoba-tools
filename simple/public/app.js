
async function app() {
    const user = HOBA.get_user();
    if (user) {
	document.getElementById("user").textContent = user.username;
    }
}

function init() {
    app();
}
init();
