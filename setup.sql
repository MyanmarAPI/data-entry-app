CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "password" TEXT, -- sha256 hash of the plain-text password
    "salt" TEXT -- salt that is appended to the password before it is hashed
);

CREATE TABLE "entries" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "form_id" INTEGER,
    "user_id" INTEGER,
    "house" TEXT,
    "serial" TEXT,
    "full_name" TEXT,
    "national_id" TEXT,
    "norm_national_id" TEXT,
    "ward_village" TEXT,
    "voter_list_number" TEXT,
    "dob" TEXT,
    "nationality" TEXT,
    "religion" TEXT,
    "education" TEXT,
    "occupation" TEXT,
    "address_perm" TEXT,
    "address_mail" TEXT,
    "constituency_name" TEXT,
    "constituency_number" INTEGER,
    "party" TEXT,
    "mother" TEXT,
    "mother_id" TEXT,
    "mother_religion" TEXT,
    "mother_ethnicity" TEXT,
    "father" TEXT,
    "father_id" TEXT,
    "father_religion" TEXT,
    "father_ethnicity" TEXT,
    "saved" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "forms" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "consensus_id" TEXT,
    "approved" BOOLEAN DEFAULT 0,
    "scan_file" TEXT,
    "color_scan" TEXT,
    "first_entry_id" INTEGER,
    "second_entry_id" INTEGER,
    "third_entry_id" INTEGER,
    "entries_done" BOOLEAN DEFAULT 0
);
