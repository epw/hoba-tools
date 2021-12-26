CREATE TABLE authn (
       username TEXT,
       password TEXT
);

CREATE TABLE accounts (
       name TEXT,
       email TEXT
);

CREATE TABLE pubkeys (
       keydata TEXT,
       challenge TEXT,
       token TEXT,
       account_id INT,

       FOREIGN KEY (account_id)
       	       REFERENCES accounts(rowid)
	       ON DELETE CASCADE
	       ON UPDATE CASCADE
);

CREATE TABLE session (
       key TEXT,
       value TEXT,
       expiry INT,
       account_id INT,

       FOREIGN KEY (account_id)
       	       REFERENCES accounts(rowid)
	       ON DELETE CASCADE
	       ON UPDATE CASCADE
);
