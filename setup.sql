CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "username" TEXT,
    "password" TEXT, -- sha256 hash of the plain-text password
    "salt" TEXT -- salt that is appended to the password before it is hashed
);
