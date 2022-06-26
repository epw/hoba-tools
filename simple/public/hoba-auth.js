const HOBA_AUTH_VALUES = {
    FAILED: "AUTH FAILED",
};

class HobaAuth {
    check_user(text) {
	if (text.startsWith(HOBA_AUTH_VALUES.FAILED)) {
	    alert("Not logged in.");
	    return null;
	}
	return true;
    }
};

const HOBA_AUTH = new HobaAuth();
