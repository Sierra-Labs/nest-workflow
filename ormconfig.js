const path = require('path');
const convict = require('convict');
const configSchema = require(`${process.cwd()}/config/config-schema.json`);
const schema = convict(configSchema).validate();

const env = process.env.NODE_ENV || 'development';
const envPath = `.env.${env}`;
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(process.cwd(), envPath) });
const config = schema.loadFile(`${process.cwd()}/config/config.${env}.json`);
const { PostgresNamingStrategy } = require('@sierralabs/nest-utils');
/**
 * Helper script used to load configuration of migrations with typeorm.
 * http://typeorm.io/#/using-ormconfig/loading-from-ormconfigjs
 * Grabs the current database connection settings from config/config.*.json
 */
const ormConfig = config.get('database'); // connection settings
ormConfig.namingStrategy = new PostgresNamingStrategy();

// Source migrations (typeorm migration:create -n)
ormConfig.cli = { migrationsDir: 'src/migration' };

// Transpiled migrations (target locations)
ormConfig.entities = [process.cwd() + '/dist/src/entities/*.entity.js'];
ormConfig.migrations = [process.cwd() + '/dist/src/migration/*.js'];

module.exports = ormConfig;
