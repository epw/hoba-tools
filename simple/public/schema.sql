CREATE TABLE users (
       public_id INT,
       data TEXT,
       new_browser_secret TEXT,
       new_browser_secret_expiry INT,
       old_browser_identifier TEXT
);

CREATE TABLE keys (
       userid INT,
       pubkey TEXT,
       challenge TEXT,
       token TEXT
);
