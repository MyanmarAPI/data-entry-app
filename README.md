# data-entry-app

Simple data entry app for digitizing paper forms

## Prerequisites

Node.js and SQLite3

## Install
```
cd data-entry-app
npm install
npm install -g gulp bower
gulp
cd app
bower install
mv bower_components app/
```

## Initialize database

We use a SQLite3 database with three tables: users, forms, and entries. A form should have at least
two entries by different users. If the first and second entries do not match, a third user should
weigh in on the correct values.

```
cd data-entry-app
sqlite3 database.sqlite3
(enter code from setup.sql)
```

## Myanmar text

Assumes Unicode input. Includes converters for Zawgyi input and Myanmar numerals.

To set the default font to Google Noto Myanmar on a page, include the /styles/myanmar.css stylesheet.

## URLs

/ = static page /app/index.html

/form.json = static data /app/form.json about form fields

/status = JSON endpoint for server and user status

/register = create user: post to /register

/login = login user: post to /login

/login?state=newuser = just came from /register

/login?state=failed = just failed username / password combo

/data-update = ensure a form row exists for each image in the /app/form_images directory

/activate-form = any unfinished form entries are reopened for new users

/type-form = page to render form, requires login

/get-form = return next form image and id as JSON

```
{
  "form":{
    "id":3,  // return in form_id field
    "order":1,  // return in order field; first, second, or third entry
    "scan_file":"/form_images/000000-test.png"  // path to image
  },
  "matching":[]  // on third entry: list of fields which already match
}
```

/submit-form = POST here, get JSON response { status: "ok", entry: 101 } OR { status: "error", error: "Error Message" } OR { status: "done" } -- requires login

/entries = index of recent entries

/entries/:username = list of recent entries by a user

/candidate/:national_id = list of entries for a national id - can be Myanmar or Latin numerals

/candidate/:serial = list of entries with a serial number - can be Myanmar or Latin numerals

/admin = links to /data-update and other pages; stats

## License

Open source under the BSD license
