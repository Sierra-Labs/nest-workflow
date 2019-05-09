# @sierralabs/nest-workflow

Sierra Labs Nest Workflow NPM module powered by NestJS, TypeORM, and Postgres.

# Requirements

Make sure to have the following installed:

- `Node 10.15+ / NPM 6.8+` for application
- `docker` for postgres database
- `jest` for unit testing
- `tslint` for TypeScript linting (tslint in VSCode to automate linting)
- `prettier` for auto formatting in VSCode
- Make sure you setup an [npmjs.com](http://www.npmjs.com) account and request access to the `@sierralabs` private repos for the NPM dependencies.

## Installation

Using your npmjs.com account from above, run:

```bash
$ npm login
$ npm install
```

# Development Guide

## Development Database Setup

```bash
# Rebuilds the database with a new Docker container and executes the migration scripts.
$ npm run db
```

## Run the App

```bash
# development
$ npm run start

# development: watch mode (restarts on changes)
$ npm run start:dev
```

For development, you can explore the API endpoints via Swagger:
http://localhost:3000/explorer/

# Troubleshooting

## Clear persistent NPM packages

Delete you node_modules folder. Then:

```bash
$ npm install
$ npm cache verify
```

## Migrations

This is the preferred way to implement data model schema changes. Create migrations for feature related changes. Try to keep migration scripts as small as possible.

> **NOTE:** When naming migrations, include the operation and affected column/table.

```bash
# TypeORM to generate the migration files automatically
npm run db:migrate:new -- AlterOrderAddTypeColumn
```

After running the above script will create a migration script in `src/migration/`. Check the source of the migration script to make sure only the intended data model changes are applied.

```bash
# Execute the migration on the appropriate environment
npm run db:migrate:up

# Revert the migration on the appropriate environment
npm run db:migrate:down
```
