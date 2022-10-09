CREATE TABLE users (
       public_id INT,
       data TEXT,
       new_browser_secret TEXT,
       new_browser_secret_expiry INT,
       old_browser_identifier TEXT,
       acl_create_account BOOLEAN
);

CREATE TABLE keys (
       userid INT,
       pubkey TEXT,
       challenge TEXT,
       token TEXT,
       csrf TEXT
);

CREATE TABLE share_codes (
       userid INT,
       share_code INT,
       share_code_created INT,
       logged_in_uds TEXT,
       new_device_uds TEXT,
       temp_name TEXT,
       keyid INT       
);
