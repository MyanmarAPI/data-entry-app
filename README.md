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

## License

Open source under the BSD license
