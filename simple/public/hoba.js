class Hoba {
    async api_call(url, form, confirmation) {
	const res = await fetch(url, {
	    method: "POST",
	    body: form
	});
	if (res.status != 200) {
	    console.error("Error " + res.status);
	    console.error(await res.text());
	    return null;
	}
	const body = await res.json();
	if (!(confirmation in body)) {
	    console.error("Error " + res.status);
	    console.error(body);
	    return null;
	}
	return body;
    }

    get_user() {
	return this.api_call("hoba.cgi?action=retrieve", null, "pubkey");
    }
};

const HOBA = new Hoba();
