const HOBA_AUTH_VALUES = {
    FAILED: "AUTH FAILED",
    LOGIN: "/login.html",
};

class HobaAuth {
    probably_logged_in() {
//       return text.startsWith(HOBA_AUTH_VALUES.FAILED);
	return localStorage.getItem(".hoba.has_priv_key");
    }

    check_user(skip_prompt) {
	if (!this.probably_logged_in()) {
	    let redirect = skip_prompt || confirm("Not logged in. Press OK to go to login page, or Cancel to remain here.");
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
