const HOBA_AUTH_VALUES = {
    FAILED: "AUTH FAILED",
    LOGIN: "/login.html",
};

class HobaAuth {
    check_user(text) {
	if (text.startsWith(HOBA_AUTH_VALUES.FAILED)) {
	    const redirect = confirm("Not logged in. Press OK to go to login page, or Cancel to remain here.");
	    if (redirect) {
		const r = new URL(location);
		r.pathname = HOBA_AUTH_VALUES.LOGIN;
		r.searchParams.set("redirect", location);
		location = r;
	    }
	    return null;
	}
	return true;
    }
};

const HOBA_AUTH = new HobaAuth();
