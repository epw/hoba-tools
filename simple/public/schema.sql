CREATE TABLE users (
       data TEXT,
       new_browser_secret TEXT,
);

CREATE TABLE keys (
       userid INT,
       pubkey TEXT,
       challenge TEXT,
       token TEXT
);
