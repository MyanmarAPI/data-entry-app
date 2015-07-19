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
    "full_name" TEXT,
    "national_id" TEXT,
    "ward_village" TEXT,
    "dob" TEXT,
    "education" TEXT,
    "occupation" TEXT,
    "address_perm" TEXT,
    "address_mail" TEXT,
    "constituency" TEXT,
    "party" TEXT,
    "father" TEXT,
    "father_origin" TEXT,
    "mother" TEXT,
    "mother_origin" TEXT
);

CREATE TABLE "forms" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "national_id" TEXT,
    "approved" BOOLEAN,
    "scan_file" TEXT,
    "color_scan" BOOLEAN,
    "first_entry_id" INTEGER,
    "second_entry_id" INTEGER,
    "third_entry_id" INTEGER,
    "entries_match" BOOLEAN
);